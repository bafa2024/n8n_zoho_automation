import { db } from '../db.js';
import type { Run } from '../lib/types.js';

type RunRow = {
  id: string;
  status: string;
  invoice_no: string | null;
  vendor: string | null;
  bill_to: string | null;
  ship_to: string | null;
  date: string | null;
  terms: number | null;
  agent: string | null;
  items_json: string;
  totals_json: string;
  bill_link: string | null;
  duration: number;
  file_name: string;
  file_hash: string;
  stored_path: string | null;
  notes_json: string;
  created_at: number;
};

const insertStmt = db.prepare(`
INSERT INTO runs (
  id, status, invoice_no, vendor, bill_to, ship_to, date, terms, agent,
  items_json, totals_json, bill_link, duration, file_name, file_hash, stored_path,
  notes_json, created_at
) VALUES (
  @id, @status, @invoice_no, @vendor, @bill_to, @ship_to, @date, @terms, @agent,
  @items_json, @totals_json, @bill_link, @duration, @file_name, @file_hash, @stored_path,
  @notes_json, @created_at
)`);

const listAllStmt = db.prepare(`SELECT * FROM runs ORDER BY created_at DESC`);
const listPageNoCursor = db.prepare(`SELECT * FROM runs ORDER BY created_at DESC LIMIT ?`);
const listPageWithCursor = db.prepare(`SELECT * FROM runs WHERE created_at < ? ORDER BY created_at DESC LIMIT ?`);
const getStmt = db.prepare(`SELECT * FROM runs WHERE id = ?`);
const findByHashStmt = db.prepare(`SELECT * FROM runs WHERE file_hash = ?`);
const updateBillLinkStmt = db.prepare(`UPDATE runs SET bill_link = @bill_link WHERE id = @id`);

function rowToRun(row: RunRow): Run {
  return {
    id: row.id,
    status: row.status as Run['status'],
    invoiceNo: row.invoice_no,
    vendor: row.vendor,
    billTo: row.bill_to,
    shipTo: row.ship_to,
    date: row.date,
    terms: row.terms,
    agent: row.agent,
    items: JSON.parse(row.items_json),
    totals: JSON.parse(row.totals_json),
    billLink: row.bill_link,
    duration: row.duration,
    file: row.file_name,
    notes: JSON.parse(row.notes_json),
    createdAt: row.created_at,
  };
}

export const RunsRepo = {
  add(run: Run, fileHash: string, storedPath: string | null) {
    insertStmt.run({
      id: run.id,
      status: run.status,
      invoice_no: run.invoiceNo,
      vendor: run.vendor,
      bill_to: run.billTo,
      ship_to: run.shipTo,
      date: run.date,
      terms: run.terms,
      agent: run.agent,
      items_json: JSON.stringify(run.items),
      totals_json: JSON.stringify(run.totals),
      bill_link: run.billLink,
      duration: run.duration,
      file_name: run.file,
      file_hash: fileHash,
      stored_path: storedPath,
      notes_json: JSON.stringify(run.notes),
      created_at: run.createdAt,
    });
    return run;
  },
  list(): Run[] {
    return (listAllStmt.all() as RunRow[]).map(rowToRun);
  },
  listPage(limit: number, cursor?: number): { runs: Run[]; nextCursor: number | null } {
    const lim = Math.max(1, Math.min(100, Math.floor(limit || 50)));
    const rows: RunRow[] = cursor
      ? (listPageWithCursor.all(cursor, lim) as RunRow[])
      : (listPageNoCursor.all(lim) as RunRow[]);
    const runs = rows.map(rowToRun);
    const nextCursor = runs.length === lim ? runs[runs.length - 1].createdAt : null;
    return { runs, nextCursor };
  },
  get(id: string): Run | null {
    const row = getStmt.get(id) as RunRow | undefined;
    return row ? rowToRun(row) : null;
  },
  findByFileHash(fileHash: string): Run | null {
    const row = findByHashStmt.get(fileHash) as RunRow | undefined;
    return row ? rowToRun(row) : null;
  },
  setBillLink(id: string, billLink: string | null) {
    updateBillLinkStmt.run({ id, bill_link: billLink });
  },
  getStoredPath(id: string): string | null {
    const row = getStmt.get(id) as RunRow | undefined;
    return row?.stored_path || null;
  },
};
