import type { LineItem, Totals } from './types.js';

export function computeTotals(items: LineItem[]): Totals {
  const subtotal = items.reduce((sum, it) => sum + lineNet(it), 0);
  const tax = items.reduce((sum, it) => sum + lineTax(it), 0);
  const discount = 0;
  const rounding = 0;
  const total = subtotal + tax - discount + rounding;
  return roundTotals({ subtotal, tax, discount, rounding, total });
}

function lineNet(it: LineItem) {
  return it.qty * it.rate * (1 - it.disc / 100);
}

function lineTax(it: LineItem) {
  const net = lineNet(it);
  return it.tax ? (net * it.tax) / 100 : 0;
}

function r2(n: number) { return Math.round(n * 100) / 100; }

function roundTotals(t: Totals): Totals {
  return {
    subtotal: r2(t.subtotal),
    tax: r2(t.tax),
    discount: r2(t.discount),
    rounding: r2(t.rounding),
    total: r2(t.total),
  };
}
