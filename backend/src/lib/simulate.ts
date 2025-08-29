import type { LineItem, Run } from './types';
import { computeTotals } from './totals';
import { newRunId } from './id';

const SAMPLE_ITEMS: LineItem[] = [
  { desc: 'BLOCK SCREW A - EX5CLASS', sku: 'D0054', qty: 20, unit: 'PC', rate: 4.5, disc: 0, tax: 0 },
  { desc: 'METER ASSY TCB - Y15ZR V2 (2PV)', sku: '3F0236', qty: 2, unit: 'SET', rate: 175, disc: 0, tax: 0 },
  { desc: 'CLIP PANEL - WAVE', sku: 'W0088', qty: 10, unit: 'PC', rate: 1.8, disc: 0, tax: 0 },
  { desc: 'HOSE BREATHER - EX5', sku: 'H0136', qty: 12, unit: 'PC', rate: 3.2, disc: 0, tax: 0 },
  { desc: 'IGNITION COIL - LC135', sku: 'I0061', qty: 4, unit: 'Unit', rate: 55, disc: 0, tax: 0 }
];

function randStatus(): Run['status'] {
  return (['success', 'warning', 'error'] as const)[Math.floor(Math.random() * 3)];
}

export function simulateRunFromFile(fileName: string): Run {
  const status = randStatus();
  const items = status === 'error'
    ? []
    : SAMPLE_ITEMS.map(it => ({
        ...it,
        qty: Math.max(1, Math.round(it.qty * (0.8 + Math.random() * 0.4))),
      }));
  const totals = computeTotals(items);
  const now = Date.now();
  return {
    id: newRunId(),
    status,
    invoiceNo: status === 'error' ? null : `I-${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-${Math.floor(Math.random() * 900 + 100)}`,
    vendor: status === 'error' ? null : 'SUPPLIER SDN BHD',
    billTo: status === 'error' ? null : 'UCON MOTORSPORT',
    shipTo: status === 'error' ? null : 'UCON MOTORSPORT',
    date: status === 'error' ? null : new Date(now).toISOString().slice(0, 10),
    terms: status === 'error' ? null : 30,
    agent: status === 'error' ? null : 'AUTO',
    items,
    totals,
    billLink: status === 'success' ? 'https://books.zoho.com/app#/purchases/bills' : null,
    duration: Number((6 + Math.random() * 10).toFixed(1)),
    file: fileName,
    notes: status === 'warning'
      ? ['Created 1 new item (SKU suffix)', '1 unit defaulted to PC']
      : status === 'error'
      ? ['Missing required fields']
      : [],
    createdAt: now,
  };
}
