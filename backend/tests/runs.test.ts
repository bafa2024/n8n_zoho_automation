import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import express from 'express';
import cors from 'cors';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const RUNS_PATH = path.join(__dirname, '../data/runs.test.json');

describe("GET /api/runs", () => {
  let app: any;
  let server: any;

  beforeEach(() => {
    const mock = [
      { id: "R-1", invoice: "I-001", vendor: "Vendor", status: "parsed", items: 3, bill: null, when: "2024-01-01T00:00:00.000Z", raw: {} },
      { id: "R-2", invoice: "I-002", vendor: "VendorB", status: "parsed", items: 2, bill: null, when: "2024-01-02T00:00:00.000Z", raw: {} }
    ];
    
    // Ensure data directory exists
    const dataDir = path.dirname(RUNS_PATH);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    
    fs.writeFileSync(RUNS_PATH, JSON.stringify(mock, null, 2));

    // Create test Express app with the same route logic as server.ts
    app = express();
    app.use(cors());
    app.use(express.json());

    app.get("/api/runs", (req, res) => {
      try {
        const limit = parseInt(req.query.limit as string) || 20;
        const data = fs.readFileSync(RUNS_PATH, "utf8");
        const runs = JSON.parse(data);
        const slice = runs.slice(0, limit);
        res.json({
          runs: slice,
          nextCursor: slice.length === limit ? limit : null
        });
      } catch (err) {
        console.error("Error reading runs:", err);
        res.status(500).json({ error: "Failed to load runs" });
      }
    });

    server = app.listen(0);
  });

  afterEach(() => {
    server?.close();
    // Clean up test file
    if (fs.existsSync(RUNS_PATH)) {
      fs.unlinkSync(RUNS_PATH);
    }
  });

  it("returns runs and nextCursor correctly", async () => {
    const res = await request(app).get("/api/runs?limit=1");
    
    expect(res.status).toBe(200);
    expect(res.body.runs.length).toBe(1);
    expect(res.body.nextCursor).toBe(1);
  });

  it("returns all runs if limit is large", async () => {
    const res = await request(app).get("/api/runs?limit=10");
    
    expect(res.status).toBe(200);
    expect(res.body.runs.length).toBe(2);
    expect(res.body.nextCursor).toBe(null);
  });
});

