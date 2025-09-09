import { db } from '../db.js';

export interface TokenData {
  access_token: string;
  refresh_token: string;
  expires_at: number;
}

export const TokensRepo = {
  get(provider: string): TokenData | null {
    const stmt = db.prepare('SELECT access_token, refresh_token, expires_at FROM tokens WHERE provider = ?');
    const row = stmt.get(provider) as { access_token: string; refresh_token: string; expires_at: number } | undefined;
    
    if (!row) return null;
    
    return {
      access_token: row.access_token,
      refresh_token: row.refresh_token,
      expires_at: row.expires_at
    };
  },

  save(provider: string, access_token: string, refresh_token: string, expires_at: number): void {
    const stmt = db.prepare(`
      INSERT OR REPLACE INTO tokens (provider, access_token, refresh_token, expires_at)
      VALUES (?, ?, ?, ?)
    `);
    stmt.run(provider, access_token, refresh_token, expires_at);
  },

  clear(provider: string): void {
    const stmt = db.prepare('DELETE FROM tokens WHERE provider = ?');
    stmt.run(provider);
  }
};
