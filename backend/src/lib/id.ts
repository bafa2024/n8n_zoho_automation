import { customAlphabet } from 'nanoid';

const alphabet = '0123456789ABCDEFGHJKLMNPQRSTUVWXYZ';
const nano = customAlphabet(alphabet, 4);

export function newRunId() {
  return `R-${nano()}`;
}
