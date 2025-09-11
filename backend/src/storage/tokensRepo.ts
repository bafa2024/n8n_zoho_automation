import { db } from '../db.js';

export type TokenRow = {
  id: number;
  provider: string;
  access_token: string;
  refresh_token: string;
  expires_at: number;
};

export const TokensRepo = {
  get(provider: string): Omit<TokenRow, 'id'> | null {
    const row = db
      .prepare(
        `SELECT provider, access_token, refresh_token, expires_at 
         FROM tokens 
         WHERE provider = ? 
         ORDER BY id DESC 
         LIMIT 1`
      )
      .get(provider) as Omit<TokenRow, 'id'> | undefined;

    return row || null;
  },

  save(
    provider: string,
    access_token: string,
    refresh_token: string,
    expires_at: number
  ) {
    db.prepare(
      `INSERT INTO tokens (provider, access_token, refresh_token, expires_at)
       VALUES (@provider, @access_token, @refresh_token, @expires_at)`
    ).run({ provider, access_token, refresh_token, expires_at });
  },

  clear(provider: string) {
    db.prepare(`DELETE FROM tokens WHERE provider = ?`).run(provider);
  },
};
