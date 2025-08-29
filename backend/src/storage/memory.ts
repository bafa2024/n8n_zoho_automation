import type { Run } from '../lib/types';

const runs: Run[] = [];

export const MemoryStore = {
  add(run: Run) {
    runs.unshift(run);
    return run;
  },
  list() {
    return runs.slice();
  },
  get(id: string) {
    return runs.find(r => r.id === id) || null;
  },
  clear() {
    runs.length = 0;
  },
};
