import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { config } from './config.js';

function ensureDir(p: string) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

if (config.dbPath !== ':memory:') {
  ensureDir(path.dirname(path.resolve(config.dbPath)));
}
ensureDir(config.uploadDir);

export const db = new Database(config.dbPath);
db.pragma('journal_mode = WAL');
db.pragma('synchronous = normal');

db.exec(`
CREATE TABLE IF NOT EXISTS runs (
  id TEXT PRIMARY KEY,
  status TEXT NOT NULL,
  invoice_no TEXT,
  vendor TEXT,
  bill_to TEXT,
  ship_to TEXT,
  date TEXT,
  terms INTEGER,
  agent TEXT,
  items_json TEXT NOT NULL,
  totals_json TEXT NOT NULL,
  bill_link TEXT,
  duration REAL NOT NULL,
  file_name TEXT NOT NULL,
  file_hash TEXT NOT NULL,
  stored_path TEXT,
  notes_json TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_runs_file_hash ON runs(file_hash);
CREATE INDEX IF NOT EXISTS idx_runs_created_at ON runs(created_at DESC);

CREATE TABLE IF NOT EXISTS run_payloads (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  run_id TEXT NOT NULL,
  kind TEXT NOT NULL, -- 'parsed' | 'zoho_request' | 'zoho_response'
  body_json TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (run_id) REFERENCES runs(id)
);
CREATE INDEX IF NOT EXISTS idx_payloads_run ON run_payloads(run_id);

CREATE TABLE IF NOT EXISTS tokens (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  provider TEXT NOT NULL,
  access_token TEXT,
  refresh_token TEXT,
  expires_at INTEGER
);
`);
