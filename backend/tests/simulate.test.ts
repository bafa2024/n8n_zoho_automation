import { describe, it, expect } from 'vitest';
import { simulateRunFromFile } from '../src/lib/simulate';

describe('simulateRunFromFile', () => {
  it('generates a run with expected shape', () => {
    const run = simulateRunFromFile('x.pdf');
    expect(run.id).toMatch(/^R-/);
    expect(run.file).toBe('x.pdf');
    expect(Array.isArray(run.items)).toBe(true);
    expect(run.totals).toHaveProperty('total');
  });
});
