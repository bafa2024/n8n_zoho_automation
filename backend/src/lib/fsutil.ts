import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

export function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

export function safeName(name: string) {
  return name.replace(/[\\/]+/g, '_').replace(/\s+/g, ' ').slice(0, 180);
}

export function sha256(buf: Buffer) {
  return crypto.createHash('sha256').update(buf).digest('hex');
}

export async function saveBuffer(dir: string, fileName: string, buf: Buffer) {
  ensureDir(dir);
  const full = path.join(dir, fileName);
  await fs.promises.writeFile(full, buf);
  return full;
}
