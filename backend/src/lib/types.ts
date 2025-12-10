export type LineItem = {
  desc: string;
  sku: string;
  qty: number;
  unit: 'PC' | 'SET' | 'Unit';
  rate: number;
  disc: number;
  tax: number;
};

export type Totals = {
  subtotal: number;
  tax: number;
  discount: number;
  rounding: number;
  total: number;
};

export type Run = {
  id: string;
  status: 'success' | 'warning' | 'error' | 'pending';
  invoiceNo: string | null;
  vendor: string | null;
  billTo: string | null;
  shipTo: string | null;
  date: string | null;
  terms: number | null;
  agent: string | null;
  items: LineItem[];
  totals: Totals;
  billLink: string | null;
  duration: number;
  file: string;
  notes: string[];
  createdAt: number;
};
