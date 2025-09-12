import { Router } from 'express';

export const infoRouter = Router();

infoRouter.get('/info', (_req, res) => {
  res.json({
    status: "ok",
    service: "n8n-zoho-automation",
    version: "1.0.0"
  });
});
