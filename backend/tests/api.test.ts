import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import supertest from 'supertest';
import express from 'express';
import cors from 'cors';

// Use in-memory DB and temp upload dir during tests
process.env.NODE_ENV = 'test';
process.env.DB_PATH = ':memory:';
process.env.UPLOAD_DIR = './tmp-uploads-test';

import { runsRouter } from '../src/routes/runs';
import fs from 'fs';

let server: any;

beforeAll(async () => {
  const app = express();
  app.use(cors());
  app.use('/api/runs', runsRouter);
  server = app.listen(0);
});

afterAll(async () => {
  server?.close();
  if (fs.existsSync('./tmp-uploads-test')) {
    fs.rmSync('./tmp-uploads-test', { recursive: true, force: true });
  }
});

describe('api', () => {
  it('ingests a file and returns a run', async () => {
    const request = supertest(server);
    const res = await request.post('/api/runs/ingest')
      .attach('file', Buffer.from('%PDF-1.4'), 'demo.pdf');
    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('id');
    expect(res.body.file).toBe('demo.pdf');
  });

  it('deduplicates by file hash', async () => {
    const request = supertest(server);
    const buf = Buffer.from('%PDF-1.4 same content');
    const first = await request.post('/api/runs/ingest')
      .attach('file', buf, 'same.pdf');
    const second = await request.post('/api/runs/ingest')
      .attach('file', buf, 'same-again.pdf');
    expect(second.status).toBe(200);
    expect(second.headers['x-duplicate']).toBe('1');
    expect(second.body.id).toBe(first.body.id);
  });

  it('lists runs', async () => {
    const request = supertest(server);
    const res = await request.get('/api/runs');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.runs)).toBe(true);
    expect(res.body.runs.length).toBeGreaterThan(0);
  });
});
