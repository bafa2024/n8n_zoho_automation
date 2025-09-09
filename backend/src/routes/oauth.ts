import { Router } from 'express';
import { TokensRepo } from '../storage/tokensRepo.js';

export const oauthRouter = Router();

// OAuth start - redirect to Zoho
oauthRouter.get('/zoho/start', (req, res) => {
  const clientId = process.env.ZOHO_CLIENT_ID;
  const redirectUri = process.env.ZOHO_REDIRECT_URI;
  
  if (!clientId || !redirectUri) {
    return res.status(500).json({ error: 'OAuth not configured' });
  }
  
  const params = new URLSearchParams({
    scope: 'ZohoBooks.fullaccess.all',
    client_id: clientId,
    response_type: 'code',
    access_type: 'offline',
    redirect_uri: redirectUri
  });
  
  const authUrl = `https://accounts.zoho.com/oauth/v2/auth?${params.toString()}`;
  res.redirect(authUrl);
});

// OAuth callback - handle authorization code
oauthRouter.get('/zoho/callback', async (req, res) => {
  const code = req.query.code as string;
  
  if (!code) {
    return res.status(400).send('Missing authorization code');
  }
  
  const clientId = process.env.ZOHO_CLIENT_ID;
  const clientSecret = process.env.ZOHO_CLIENT_SECRET;
  const redirectUri = process.env.ZOHO_REDIRECT_URI;
  
  if (!clientId || !clientSecret || !redirectUri) {
    return res.status(500).send('OAuth not configured');
  }
  
  try {
    // Exchange code for tokens
    const tokenResponse = await fetch('https://accounts.zoho.com/oauth/v2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code'
      })
    });
    
    if (!tokenResponse.ok) {
      throw new Error(`Token exchange failed: ${tokenResponse.status}`);
    }
    
    const tokenData = await tokenResponse.json();
    
    // Save tokens to database
    const expiresAt = Date.now() + (tokenData.expires_in * 1000);
    TokensRepo.save('zoho', tokenData.access_token, tokenData.refresh_token, expiresAt);
    
    // Return success page
    res.send(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Zoho Connected</title>
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <script src="https://cdn.tailwindcss.com"></script>
        </head>
        <body class="bg-slate-100 flex items-center justify-center min-h-screen">
          <div class="bg-white rounded-2xl border p-8 text-center">
            <div class="h-16 w-16 rounded-xl bg-green-600 mx-auto mb-4"></div>
            <h1 class="text-2xl font-semibold text-slate-900 mb-2">Zoho Connected</h1>
            <p class="text-slate-600 mb-4">Your Zoho account has been successfully connected.</p>
            <a href="/" class="inline-block bg-slate-900 text-white px-4 py-2 rounded-lg">Return to Dashboard</a>
          </div>
        </body>
      </html>
    `);
    
  } catch (error) {
    console.error('OAuth callback error:', error);
    res.status(500).send(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Connection Failed</title>
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <script src="https://cdn.tailwindcss.com"></script>
        </head>
        <body class="bg-slate-100 flex items-center justify-center min-h-screen">
          <div class="bg-white rounded-2xl border p-8 text-center">
            <div class="h-16 w-16 rounded-xl bg-red-600 mx-auto mb-4"></div>
            <h1 class="text-2xl font-semibold text-slate-900 mb-2">Connection Failed</h1>
            <p class="text-slate-600 mb-4">There was an error connecting to Zoho.</p>
            <a href="/" class="inline-block bg-slate-900 text-white px-4 py-2 rounded-lg">Return to Dashboard</a>
          </div>
        </body>
      </html>
    `);
  }
});
