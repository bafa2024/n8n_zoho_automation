import { TokensRepo } from '../storage/tokensRepo.js';

type RefreshResponse = {
  access_token: string;
  expires_in: number;
};

export async function getValidToken(): Promise<string> {
  const token = TokensRepo.get('zoho');
  if (!token) throw new Error('Zoho not connected');

  // still valid?
  if (token.expires_at && token.expires_at > Date.now()) {
    return token.access_token;
  }

  // refresh
  if (!token.refresh_token) {
    throw new Error('Missing refresh_token for Zoho');
  }

  const resp = await fetch('https://accounts.zoho.com/oauth/v2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token: token.refresh_token,
      client_id: process.env.ZOHO_CLIENT_ID || '',
      client_secret: process.env.ZOHO_CLIENT_SECRET || '',
      grant_type: 'refresh_token',
    }),
  });

  if (!resp.ok) {
    throw new Error(`Zoho refresh failed: ${resp.status}`);
  }

  const refreshData = (await resp.json()) as RefreshResponse;
  const newToken = refreshData.access_token;
  const expiresIn = refreshData.expires_in;

  TokensRepo.save('zoho', newToken, token.refresh_token, Date.now() + expiresIn * 1000);
  return newToken;
}
