import { Router } from 'express';
import { TokensRepo } from '../storage/tokensRepo.js';

export const oauthRouter = Router();

type TokenResponse = {
  access_token: string;
  refresh_token: string;
  expires_in: number;
};

// GET /oauth/zoho/start
oauthRouter.get('/zoho/start', (req, res) => {
  const clientId = process.env.ZOHO_CLIENT_ID;
  const redirectUri = process.env.ZOHO_REDIRECT_URI;
  if (!clientId || !redirectUri) {
    return res.status(500).send('Missing ZOHO_CLIENT_ID or ZOHO_REDIRECT_URI');
  }

  const authUrl = new URL('https://accounts.zoho.com/oauth/v2/auth');
  authUrl.searchParams.set('scope', 'ZohoBooks.fullaccess.all');
  authUrl.searchParams.set('client_id', clientId);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('access_type', 'offline');
  authUrl.searchParams.set('redirect_uri', redirectUri);

  res.redirect(authUrl.toString());
});

// GET /oauth/zoho/callback
oauthRouter.get('/zoho/callback', async (req, res) => {
  const code = req.query.code as string | undefined;
  if (!code) return res.status(400).send('Missing ?code=');

  const clientId = process.env.ZOHO_CLIENT_ID || '';
  const clientSecret = process.env.ZOHO_CLIENT_SECRET || '';
  const redirectUri = process.env.ZOHO_REDIRECT_URI || '';

  const resp = await fetch('https://accounts.zoho.com/oauth/v2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
  });

  if (!resp.ok) {
    return res.status(500).send(`Token exchange failed: ${resp.status}`);
  }

  const tokenData = (await resp.json()) as TokenResponse;
  TokensRepo.save(
    'zoho',
    tokenData.access_token,
    tokenData.refresh_token,
    Date.now() + tokenData.expires_in * 1000
  );

  res.send('<h1>Zoho connected successfully 🎉</h1>');
});
