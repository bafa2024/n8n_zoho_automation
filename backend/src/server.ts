import express, { NextFunction, Request, Response } from 'express';
import cors from 'cors';
import morgan from 'morgan';
import path from 'path';
import { fileURLToPath } from 'url';
import { readFileSync } from 'fs';
import { config } from './config.js';
import './db.js';
import { runsRouter } from './routes/runs.js';
import { zohoRouter } from './routes/zoho.js';
import { oauthRouter } from './routes/oauth.js';
import { infoRouter } from './routes/info.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Read package.json version
const packageJsonPath = path.join(__dirname, '..', 'package.json');
const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));

const app = express();

app.use(cors());
app.use(express.json({ limit: '2mb' }));
app.use(morgan('dev'));

// Public health endpoint (before auth middleware)
app.get('/api/health', (_req, res) => res.json({ status: "healthy" }));

// Public version endpoint (before auth middleware)
app.get('/api/version', (_req, res) => res.json({ version: packageJson.version }));

// Public time endpoint (before auth middleware)
app.get('/api/time', (_req, res) => res.json({ time: new Date().toISOString() }));

// Public env-check endpoint (before auth middleware)
app.get('/api/env-check', (_req, res) => {
  const maskSecret = (value: string | undefined) => {
    if (!value) return "missing";
    if (value.length <= 4) return value + "***";
    return value.substring(0, 4) + "***";
  };

  const checkEnv = (key: string) => {
    const value = process.env[key];
    return value ? "set" : "missing";
  };

  const checkSecretEnv = (key: string) => {
    const value = process.env[key];
    return value ? maskSecret(value) : "missing";
  };

  res.json({
    ZOHO_CLIENT_ID: checkEnv('ZOHO_CLIENT_ID'),
    ZOHO_CLIENT_SECRET: checkSecretEnv('ZOHO_CLIENT_SECRET'),
    ZOHO_REDIRECT_URI: checkEnv('ZOHO_REDIRECT_URI')
  });
});

// Public mock Zoho user endpoint (before auth middleware)
app.get('/api/zoho/mock-user', (_req, res) => {
  res.json({
    id: "1234567890",
    email: "mock.user@zoho.com",
    name: "Mock User",
    role: "admin"
  });
});

// Public mock Zoho contacts endpoint (before auth middleware)
app.get('/api/zoho/mock-contacts', (_req, res) => {
  res.json([
    { id: "c1", name: "Alice Example", email: "alice@example.com" },
    { id: "c2", name: "Bob Example", email: "bob@example.com" }
  ]);
});

// Public OAuth Zoho authorize endpoint (before auth middleware)
app.get('/oauth/zoho/authorize', (_req, res) => {
  res.json({
    redirect_url: "https://accounts.zoho.com/oauth/v2/auth?response_type=code&client_id=mock-client-id&scope=ZohoBooks.fullaccess.all&redirect_uri=http://localhost:10000/oauth/callback&access_type=offline&state=mock-state-123"
  });
});

// Public OAuth Zoho callback endpoint (before auth middleware)
app.get('/oauth/zoho/callback', (req, res) => {
  const { code } = req.query;
  
  if (!code) {
    return res.status(400).json({ error: "missing_code" });
  }
  
  res.json({
    access_token: `mock_access_token_${code}`,
    refresh_token: "mock_refresh_token_xyz789",
    expires_in: 3600
  });
});

// Auth middleware for /api routes
app.use('/api', (req, res, next) => {
  const demoAuthToken = process.env.DEMO_AUTH_TOKEN;
  if (demoAuthToken) {
    const providedToken = req.headers['x-auth-token'];
    if (providedToken !== demoAuthToken) {
      return res.status(401).json({ error: 'unauthorized' });
    }
  }
  next();
});

// Info endpoint (ops snapshot)
app.use('/api/info', infoRouter);

// OAuth routes
app.use('/oauth', oauthRouter);

// API routes
app.use('/api/runs', runsRouter);
app.use('/api', zohoRouter);

// Static frontend
const staticDir = path.join(__dirname, '..', 'public');
app.use(express.static(staticDir, { index: false, maxAge: 0 }));
app.get('/', (_req, res) => res.sendFile(path.join(staticDir, 'index.html')));

// 404s
app.use((req, res, next) => {
  if (req.path.startsWith('/api/')) return res.status(404).json({ error: 'not_found' });
  return next();
});
app.use((_req, res) => res.status(404).send('Not found'));

// errors
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  console.error(err);
  res.status(500).json({ error: 'internal_error' });
});

app.listen(config.port, () => {
  console.log(`API + static UI at ${config.publicBaseUrl} (Zoho mode: ${process.env.ZOHO_MODE || 'auto'})`);
});
