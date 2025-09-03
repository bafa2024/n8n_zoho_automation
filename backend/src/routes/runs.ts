import { Router } from 'express';
import multer from 'multer';
import path from 'path';

import { simulateRunFromFile } from '../lib/simulate.js';
import { RunsRepo } from '../storage/runsRepo.js';
import { sha256, safeName, saveBuffer } from '../lib/fsutil.js';
import { config } from '../config.js';
import { RunPayloadsRepo } from '../storage/runPayloadsRepo.js';
import type { LineItem, Run } from '../lib/types.js';
import { newRunId } from '../lib/id.js';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 30 * 1024 * 1024 },
});

export const runsRouter = Router();

// List with pagination: GET /api/runs?limit=50&cursor=1699999999999
runsRouter.get('/', (req, res) => {
  const limit = Number(req.query.limit || 50);
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

// Viewer: parsed snapshot
runsRouter.get('/:id/parsed', (req, res) => {
  const parsed = RunPayloadsRepo.getLatest(req.params.id, 'parsed');
  if (!parsed) return res.status(404).json({ error: 'not_found' });
  res.json({ parsed });
});

// Viewer: zoho request/response
runsRouter.get('/:id/zoho', (req, res) => {
  const pair = RunPayloadsRepo.getZohoPair(req.params.id);
  if (!pair.request && !pair.response) return res.status(404).json({ error: 'not_found' });
  res.json(pair);
});

// Ingest
async function callParser(fileName: string, buf: Buffer) {
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
    const parsed = await resp.json();
    return parsed as {
      header: any;
      items: Array<{
        desc?: string;
        description?: string;
        sku?: string;
        qty?: number;
        unit?: string;
        rate?: number;
        disc?: number;
        tax?: number;
      }>;
      totals: { subtotal: number; tax: number; discount: number; rounding: number; total: number };
      anomalies: string[];
    };
  } catch (e) {
    console.error('parser failed:', e);
    return null;
  }
}

function coerceUnit(u: unknown): 'PC' | 'SET' | 'Unit' {
  const s = String(u ?? 'PC').trim().toUpperCase();
  if (s === 'PC' || s === 'PCS' || s === 'PIECE' || s === 'PIECES') return 'PC';
  if (s === 'SET' || s === 'SETS') return 'SET';
  if (s === 'UNIT' || s === 'UNITS' || s === 'EA' || s === 'EACH') return 'Unit';
  return 'PC';
}

runsRouter.post('/ingest', upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'file_required', message: 'multipart field "file" is required' });
  }

  const buffer = req.file.buffer;
  const fileHash = sha256(buffer);

  const existing = RunsRepo.findByFileHash(fileHash);
  if (existing) {
    res.set('x-duplicate', '1');
    return res.status(200).json(existing);
  }

  const original = safeName(req.file.originalname || 'upload.pdf');
  const parsed = await callParser(original, buffer);

  let run: Run;

  if (parsed) {
    const items: LineItem[] = (parsed.items || []).map((it) => ({
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
      totals: parsed.totals,
      billLink: null,
      duration: Number((6 + Math.random() * 3).toFixed(1)),
      file: original,
      notes: parsed.anomalies ?? [],
      createdAt: Date.now(),
    };

    RunPayloadsRepo.add(run.id, 'parsed', parsed);
  } else {
    run = simulateRunFromFile(original);
  }

  const storedName = `${run.id}-${original}`;
  const storedPath = path.join(config.uploadDir, storedName);
  await saveBuffer(config.uploadDir, storedName, buffer);

  RunsRepo.add(run, fileHash, storedPath);

  return res.status(201).json(run);
});
