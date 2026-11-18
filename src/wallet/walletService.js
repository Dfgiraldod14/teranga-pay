import { randomBytes } from 'node:crypto';
import { decode } from 'light-bolt11-decoder';
import { db } from '../db.js';
import { env } from '../config.js';
import { clientFor } from '../nostr/nwc.js';
import { HttpError } from '../lib/errors.js';

export async function getBalanceSats(pk) {
  const { balance } = await clientFor(pk).getBalance(); // msats
  return Math.floor(balance / 1000);
}

export async function createInvoice(pk, { sats, memo }) {
  const tx = await clientFor(pk).makeInvoice({
    amount: sats * 1000, description: memo || 'Teranga Pay', expiry: 3600,
  });
  return { invoice: tx.invoice, paymentHash: tx.payment_hash };
}

export async function isPaid(pk, paymentHash) {
  const tx = await clientFor(pk).lookupInvoice({ payment_hash: paymentHash });
  return Boolean(tx.settled_at || tx.preimage);
}

export function decodeInvoice(bolt11) {
  let d;
  try { d = decode(String(bolt11).trim()); } catch { throw new HttpError(400, 'Invoice inválido'); }
  const get = n => d.sections.find(s => s.name === n)?.value;
  const msats = get('amount');
  const expired = Date.now() / 1000 > Number(get('timestamp')) + Number(get('expiry') ?? 3600);
  return {
    paymentHash: get('payment_hash'),
    sats: msats ? Math.floor(Number(msats) / 1000) : null,
    memo: String(get('description') ?? '').slice(0, 140), // texto NO confiable
    expired,
  };
}

const spentToday = pk => db.prepare(
  'SELECT COALESCE(SUM(sats),0) s FROM spend WHERE pubkey=? AND ts>?'
).get(pk, Date.now() - 86_400_000).s;

// ---- Pago en 2 pasos: la IA no puede saltarse esto ----
const pending = new Map(); // token → {pk,bolt11,sats,exp}

setInterval(() => { // limpieza de tokens vencidos
  const now = Date.now();
  for (const [k, v] of pending) if (v.exp < now) pending.delete(k);
}, 30_000).unref();

export function preparePayment(pk, bolt11) {
  const inv = decodeInvoice(bolt11);
  if (inv.expired) throw new HttpError(400, 'Invoice expirado');
  if (!inv.sats) throw new HttpError(400, 'Invoices sin monto no soportados en el MVP');
  if (inv.sats > env.MAX_PAY_SATS) throw new HttpError(403, 'Excede el límite por pago');
  if (spentToday(pk) + inv.sats > env.DAILY_CAP_SATS) throw new HttpError(403, 'Excede el límite diario');
  const token = randomBytes(16).toString('hex');
  pending.set(token, { pk, bolt11, sats: inv.sats, exp: Date.now() + 60_000 });
  return { token, sats: inv.sats, memo: inv.memo, expiresInSec: 60 };
}

export async function confirmPayment(pk, token) {
  const p = pending.get(token);
  pending.delete(token); // un solo uso
  if (!p || p.pk !== pk || p.exp < Date.now()) throw new HttpError(400, 'Confirmación inválida o expirada');
  // reservar cupo antes de pagar (evita carreras); revertir si falla
  const { lastInsertRowid } = db.prepare('INSERT INTO spend(pubkey,sats,ts) VALUES(?,?,?)').run(pk, p.sats, Date.now());
  try {
    const r = await clientFor(pk).payInvoice({ invoice: p.bolt11 });
    return { preimage: r.preimage, feesPaidMsats: r.fees_paid ?? 0 };
  } catch {
    db.prepare('DELETE FROM spend WHERE id=?').run(lastInsertRowid);
    throw new HttpError(502, 'El pago falló; no se cobró');
  }
}
