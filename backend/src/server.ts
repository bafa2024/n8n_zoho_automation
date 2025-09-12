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
