import { Router } from 'express';
import { z } from 'zod';
import { connectWallet } from '../nostr/nwc.js';
import * as w from '../wallet/walletService.js';

const r = Router();

r.post('/connect', async (req, res) => {
  const { nwcUri } = z.object({ nwcUri: z.string().max(1000) }).parse(req.body);
  res.json(await connectWallet(req.user.pk, nwcUri)); // inicializa y valida la wallet
});

r.get('/balance', async (req, res) => res.json({ sats: await w.getBalanceSats(req.user.pk) }));

r.post('/invoice', async (req, res) => {
  const b = z.object({
    sats: z.number().int().min(1).max(1_000_000),
    memo: z.string().max(100).optional(),
  }).parse(req.body);
  res.json(await w.createInvoice(req.user.pk, b));
});

r.get('/invoice/:hash', async (req, res) => {
  const hash = z.string().regex(/^[0-9a-f]{64}$/).parse(req.params.hash);
  res.json({ paid: await w.isPaid(req.user.pk, hash) });
});

r.post('/pay/prepare', (req, res) => {
  const { invoice } = z.object({ invoice: z.string().max(2000) }).parse(req.body);
  res.json(w.preparePayment(req.user.pk, invoice));
});

r.post('/pay/confirm', async (req, res) => {
  const { token } = z.object({ token: z.string().length(32) }).parse(req.body);
  res.json(await w.confirmPayment(req.user.pk, token));
});

export default r;
