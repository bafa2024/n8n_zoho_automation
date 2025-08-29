import express, { NextFunction, Request, Response } from 'express';
import cors from 'cors';
import morgan from 'morgan';
import path from 'path';
import { fileURLToPath } from 'url';
import { config } from './config.js';
import './db.js'; // initialize database and folders
import { runsRouter } from './routes/runs.js';
import { zohoRouter } from './routes/zoho.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Middleware
app.use(cors());
app.use(express.json({ limit: '2mb' }));
app.use(morgan('dev'));

// API routes
app.get('/api/health', (_req, res) => res.json({ ok: true, ts: Date.now() }));
app.use('/api/runs', runsRouter);
app.use('/api', zohoRouter);

// Static site (frontend) from ../public
const staticDir = path.join(__dirname, '..', 'public');
app.use(express.static(staticDir, { index: false, maxAge: 0 }));
app.get('/', (_req, res) => {
  res.sendFile(path.join(staticDir, 'index.html'));
});

app.use((req, res, next) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'not_found' });
  }
  return next();
});

app.use((_req, res) => res.status(404).send('Not found'));

app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  console.error(err);
  res.status(500).json({ error: 'internal_error' });
});

app.listen(config.port, () => {
  console.log(`API + static UI at ${config.publicBaseUrl} (Zoho mode: ${process.env.ZOHO_MODE || 'auto'})`);
});
