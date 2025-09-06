import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

import { simulateRunFromFile } from '../lib/simulate.js';
import { RunsRepo } from '../storage/runsRepo.js';
import { sha256, safeName, saveBuffer } from '../lib/fsutil.js';
import { config } from '../config.js';
import { RunPayloadsRepo } from '../storage/runPayloadsRepo.js';
import type { LineItem, Run } from '../lib/types.js';
import { newRunId } from '../lib/id.js';
import { db } from '../db.js';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 30 * 1024 * 1024 },
});

export const runsRouter = Router();

// Parser response type
type ParserResponse = {
  header?: {
    invoiceNo?: string;
    bill_number?: string;
    vendor?: string;
    billTo?: string;
    shipTo?: string;
    date?: string;
    terms?: number;
    agent?: string;
  };
  items?: Array<{
    desc?: string;
    description?: string;
    sku?: string;
    qty?: number;
    unit?: string;
    rate?: number;
    disc?: number;
    tax?: number;
  }>;
  totals?: {
    subtotal: number;
    tax: number;
    discount: number;
    rounding: number;
    total: number;
  };
  anomalies?: string[];
};

// Helper: coerce units
function coerceUnit(u: unknown): 'PC' | 'SET' | 'Unit' {
  const s = String(u ?? 'PC').trim().toUpperCase();
  if (s.startsWith('PC')) return 'PC';
  if (s.startsWith('SET')) return 'SET';
  return 'Unit';
}

// Parser call
async function callParser(fileName: string, buf: Buffer): Promise<ParserResponse | null> {
  if (!config.parserUrl) return null;
  try {
    const form = new FormData();
    const blob = new Blob([buf], { type: 'application/pdf' });
    form.append('file', blob, fileName);

    const resp = await fetch(`${config.parserUrl.replace(/\/+$/, '')}/parse`, {
      method: 'POST',
      body: form as any,
    });
    if (!resp.ok) throw new Error(`parser ${resp.status}`);
    return (await resp.json()) as ParserResponse;
  } catch (e) {
    console.error('parser failed:', e);
    return null;
  }
}

// List with pagination
runsRouter.get('/', (req, res) => {
  const limit = Number(req.query.limit || 20);
  const cursor = req.query.cursor ? Number(req.query.cursor) : undefined;
  const { runs, nextCursor } = RunsRepo.listPage(limit, cursor);
  res.json({ runs, nextCursor });
});

// View one
runsRouter.get('/:id', (req, res) => {
  const run = RunsRepo.get(req.params.id);
  if (!run) return res.status(404).json({ error: 'not_found' });
  res.json({ run });
});

// View parsed snapshot
runsRouter.get('/:id/parsed', (req, res) => {
  const parsed = RunPayloadsRepo.getLatest(req.params.id, 'parsed');
  if (!parsed) return res.status(404).json({ error: 'not_found' });
  res.json(parsed);
});

// View Zoho payloads
runsRouter.get('/:id/zoho', (req, res) => {
  const pair = RunPayloadsRepo.getZohoPair(req.params.id);
  if (!pair.request && !pair.response) return res.status(404).json({ error: 'not_found' });
  res.json(pair);
});

// Download original file
runsRouter.get('/:id/file', (req, res) => {
  const run = RunsRepo.get(req.params.id);
  if (!run) return res.status(404).json({ error: 'not_found' });
  const storedPath = path.join(config.uploadDir, `${run.id}-${run.file}`);
  if (!fs.existsSync(storedPath)) return res.status(404).json({ error: 'file_not_found' });
  res.download(storedPath, run.file);
});

// Delete run
runsRouter.delete('/:id', (req, res) => {
  const run = RunsRepo.get(req.params.id);
  if (!run) return res.status(404).json({ error: 'not_found' });

  const storedPath = path.join(config.uploadDir, `${run.id}-${run.file}`);
  if (fs.existsSync(storedPath)) fs.unlinkSync(storedPath);

  db.prepare('DELETE FROM run_payloads WHERE run_id = ?').run(run.id);
  db.prepare('DELETE FROM runs WHERE id = ?').run(run.id);

  res.json({ ok: true, deleted: run.id });
});

// Ingest
runsRouter.post('/ingest', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'file_required' });

  const buffer = req.file.buffer;
  const fileHash = sha256(buffer);

  const existing = RunsRepo.findByFileHash(fileHash);
  if (existing) {
    res.set('x-duplicate', '1');
    return res.json(existing);
  }

  const original = safeName(req.file.originalname || 'upload.pdf');
  const parsed = await callParser(original, buffer);

  let run: Run;
  if (parsed) {
    const items: LineItem[] = (parsed.items || []).map(it => ({
      desc: String(it.desc ?? it.description ?? ''),
      sku: String(it.sku ?? ''),
      qty: Number(it.qty ?? 0),
      unit: coerceUnit(it.unit),
      rate: Number(it.rate ?? 0),
      disc: Number(it.disc ?? 0),
      tax: Number(it.tax ?? 0),
    }));

    run = {
      id: newRunId(),
      status: 'success',
      invoiceNo: parsed.header?.invoiceNo ?? parsed.header?.bill_number ?? 'I-PARSED-0001',
      vendor: parsed.header?.vendor ?? 'UNKNOWN',
      billTo: parsed.header?.billTo ?? null,
      shipTo: parsed.header?.shipTo ?? null,
      date: parsed.header?.date ?? null,
      terms: parsed.header?.terms ?? null,
      agent: parsed.header?.agent ?? null,
      items,
      totals: parsed.totals || { subtotal: 0, tax: 0, discount: 0, rounding: 0, total: 0 },
      billLink: null,
      duration: 6,
      file: original,
      notes: parsed.anomalies ?? [],
      createdAt: Date.now(),
    };

    RunPayloadsRepo.add(run.id, 'parsed', parsed);
  } else {
    run = simulateRunFromFile(original);
  }

  const storedName = `${run.id}-${original}`;
  await saveBuffer(config.uploadDir, storedName, buffer);
  RunsRepo.add(run, fileHash, storedName);
  res.status(201).json(run);
});
