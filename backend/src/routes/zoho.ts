import { Router } from 'express';
import { createDraftBill } from '../integrations/zoho';

export const zohoRouter = Router();

zohoRouter.post('/runs/:id/zoho/draft', async (req, res) => {
  try {
    const runId = String(req.params.id);
    const out = await createDraftBill(runId);
    res.json(out);
  } catch (err: any) {
    res.status(400).json({ error: err?.message || String(err) });
  }
});
