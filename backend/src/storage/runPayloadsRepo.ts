import { db } from '../db';

export type PayloadKind = 'parsed' | 'zoho_request' | 'zoho_response';

const insertStmt = db.prepare(`
INSERT INTO run_payloads (run_id, kind, body_json, created_at)
VALUES (@run_id, @kind, @body_json, @created_at)
`);

const latestByKindStmt = db.prepare(`
SELECT body_json FROM run_payloads
WHERE run_id = ? AND kind = ?
ORDER BY id DESC
LIMIT 1
`);

export const RunPayloadsRepo = {
  add(runId: string, kind: PayloadKind, body: unknown) {
    insertStmt.run({
      run_id: runId,
      kind,
      body_json: JSON.stringify(body),
      created_at: Date.now(),
    });
  },
  getLatest(runId: string, kind: PayloadKind): any | null {
    const row = latestByKindStmt.get(runId, kind) as { body_json: string } | undefined;
    return row ? JSON.parse(row.body_json) : null;
  },
};
