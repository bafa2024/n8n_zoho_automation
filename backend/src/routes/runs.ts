import { Router } from 'express';
import multer from 'multer';
import path from 'path';

import { simulateRunFromFile } from '../lib/simulate';
import { RunsRepo } from '../storage/runsRepo';
import { sha256, safeName, saveBuffer } from '../lib/fsutil';
import { config } from '../config';
import { RunPayloadsRepo } from '../storage/runPayloadsRepo';
import type { LineItem, Run } from '../lib/types';
import { newRunId } from '../lib/id';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 30 * 1024 * 1024 },
});

export const runsRouter = Router();

runsRouter.get('/', (_req, res) => {
  res.json({ runs: RunsRepo.list() });
});

runsRouter.get('/:id', (req, res) => {
  const run = RunsRepo.get(req.params.id);
  if (!run) return res.status(404).json({ error: 'not_found' });
  res.json({ run });
});

function coerceUnit(u: unknown): 'PC' | 'SET' | 'Unit' {
  const s = String(u ?? 'PC').trim().toUpperCase();
  if (s === 'PC' || s === 'PCS' || s === 'PIECE' || s === 'PIECES') return 'PC';
  if (s === 'SET' || s === 'SETS') return 'SET';
  if (s === 'UNIT' || s === 'UNITS' || s === 'EA' || s === 'EACH') return 'Unit';
  return 'PC';
}

async function callParser(fileName: string, buf: Buffer) {
  if (!config.parserUrl) return null;
  try {
    // Node 20+ has global FormData/Blob/fetch types
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
      totals: {
        subtotal: number;
        tax: number;
        discount: number;
        rounding: number;
        total: number;
      };
      anomalies: string[];
    };
  } catch (e) {
    console.error('parser failed:', e);
    return null;
  }
}

runsRouter.post('/ingest', upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({
      error: 'file_required',
      message: 'multipart field "file" is required',
    });
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

    // store parsed snapshot for audits
    RunPayloadsRepo.add(run.id, 'parsed', parsed);
  } else {
    run = simulateRunFromFile(original);
  }

  // Save file to disk
  const storedName = `${run.id}-${original}`;
  const storedPath = path.join(config.uploadDir, storedName);
  await saveBuffer(config.uploadDir, storedName, buffer);

  // Persist run
  RunsRepo.add(run, fileHash, storedPath);

  return res.status(201).json(run);
});
