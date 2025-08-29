import { describe, it, expect } from 'vitest';
import { computeTotals } from '../src/lib/totals';

describe('computeTotals', () => {
  it('sums lines and tax correctly', () => {
    const items = [
      { desc: 'A', sku: 'A', qty: 2, unit: 'PC', rate: 10, disc: 0, tax: 0 },
      { desc: 'B', sku: 'B', qty: 1, unit: 'PC', rate: 15, disc: 10, tax: 6 },
    ] as any;
    const t = computeTotals(items);
    // line1 = 20
    // line2 before discount = 15; after 10% = 13.5; tax 6% on 13.5 = 0.81
    // subtotal = 20 + 13.5 = 33.5; tax = 0.81; total = 34.31
    expect(t.subtotal).toBe(33.5);
    expect(t.tax).toBe(0.81);
    expect(t.total).toBe(34.31);
  });
});
