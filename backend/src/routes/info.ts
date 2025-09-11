import { Router } from 'express';
import { config } from '../config.js';
import { env } from '../lib/env.js';
import { TokensRepo } from '../storage/tokensRepo.js';

export const infoRouter = Router();

infoRouter.get('/info', (_req, res) => {
  // Get Zoho token status
  const zohoToken = TokensRepo.get('zoho');
  const now = Date.now();
  
  res.json({
    parser: { 
      configured: Boolean(config.parserUrl), 
      url: config.parserUrl || null 
    },
    zoho: {
      mode: env.ZOHO_MODE || (env.ZOHO_ACCESS_TOKEN && env.ZOHO_ORG_ID ? 'live' : 'mock'),
      connected: Boolean(zohoToken),
      valid: Boolean(zohoToken?.expires_at && zohoToken.expires_at > now),
      expires_at: zohoToken?.expires_at || null,
    },
    storage: { 
      dbPath: config.dbPath, 
      uploadDir: config.uploadDir 
    },
    now: now,
  });
});
