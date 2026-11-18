// Login por firma Nostr (kind 22242, tag ['challenge', nonce])
import { Router } from 'express';
import { randomBytes } from 'node:crypto';
import jwt from 'jsonwebtoken';
import { verifyEvent } from 'nostr-tools/pure';
import { db } from '../db.js';
import { env } from '../config.js';
import { HttpError } from '../lib/errors.js';

const challenges = new Map();
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of challenges) if (v < now) challenges.delete(k);
}, 60_000).unref();

const r = Router();

r.get('/challenge', (_q, res) => {
  if (challenges.size > 5000) throw new HttpError(429, 'busy');
  const c = randomBytes(16).toString('hex');
  challenges.set(c, Date.now() + 120_000);
  res.json({ challenge: c });
});

r.post('/login', (req, res) => {
  const ev = req.body?.event;
  const c = ev?.tags?.find(t => t[0] === 'challenge')?.[1];
  const exp = challenges.get(c);
  challenges.delete(c);
  const fresh = Math.abs(Date.now() / 1000 - ev?.created_at) < 120;
  if (!exp || exp < Date.now() || ev.kind !== 22242 || !fresh || !verifyEvent(ev)) throw new HttpError(401, 'auth');
  db.prepare('INSERT OR IGNORE INTO users(pubkey,created) VALUES(?,?)').run(ev.pubkey, Date.now());
  res.json({ token: jwt.sign({ pk: ev.pubkey }, env.JWT_SECRET, { algorithm: 'HS256', expiresIn: '12h' }) });
});

export default r;
