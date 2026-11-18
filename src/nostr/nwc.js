import { nwc } from '@getalby/sdk';
import { db } from '../db.js';
import { seal, unseal } from '../security/crypto.js';
import { HttpError } from '../lib/errors.js';

const REQUIRED = ['get_balance', 'make_invoice', 'pay_invoice', 'lookup_invoice'];
const HEX64 = /^[0-9a-f]{64}$/;

/** Valida y canonicaliza una NWC URI (nostr+walletconnect://<pubkey>?relay=..&secret=..) */
export function parseNwcUri(raw) {
  const s = String(raw).trim().replace(/^nostr\+walletconnect:(\/\/)?/i, 'nwc://');
  let u;
  try { u = new URL(s); } catch { throw new HttpError(400, 'NWC URI inválida'); }
  const pubkey = u.hostname.toLowerCase();
  const secret = (u.searchParams.get('secret') ?? '').toLowerCase();
  const relays = u.searchParams.getAll('relay');
  if (!HEX64.test(pubkey) || !HEX64.test(secret)) throw new HttpError(400, 'Claves NWC inválidas');
  if (!relays.length || relays.length > 3 || !relays.every(r => /^wss:\/\/[\w.-]+(:\d+)?(\/.*)?$/.test(r)))
    throw new HttpError(400, 'Solo relays wss:// (máx. 3)');
  const canonical = `nostr+walletconnect://${pubkey}?` +
    relays.map(r => `relay=${encodeURIComponent(r)}`).join('&') + `&secret=${secret}`;
  return { canonical, pubkey, relays };
}

/** Conecta, verifica permisos requeridos y guarda la URI cifrada. Devuelve info pública del wallet. */
export async function connectWallet(userPk, rawUri) {
  const { canonical } = parseNwcUri(rawUri);
  const client = new nwc.NWCClient({ nostrWalletConnectUrl: canonical });
  try {
    const info = await Promise.race([
      client.getInfo(),
      new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 10_000)),
    ]);
    const missing = REQUIRED.filter(m => !info.methods?.includes(m));
    if (missing.length) throw new HttpError(400, `Permisos NWC faltantes: ${missing.join(', ')}`);
    db.prepare('UPDATE users SET nwc_enc=? WHERE pubkey=?').run(seal(canonical), userPk);
    drop(userPk);
    return { alias: info.alias ?? null, network: info.network ?? null, methods: info.methods };
  } catch (e) {
    if (e instanceof HttpError) throw e;
    throw new HttpError(502, 'No se pudo contactar el wallet vía NWC');
  } finally { client.close(); }
}

// --- pool de clientes con cierre por inactividad ---
const pool = new Map();
const IDLE_MS = 120_000;

function drop(pk) {
  const h = pool.get(pk);
  if (h) { clearTimeout(h.t); h.client.close(); pool.delete(pk); }
}

export function clientFor(pk) {
  const hit = pool.get(pk);
  if (hit) { clearTimeout(hit.t); hit.t = setTimeout(() => drop(pk), IDLE_MS); return hit.client; }
  const row = db.prepare('SELECT nwc_enc FROM users WHERE pubkey=?').get(pk);
  if (!row?.nwc_enc) throw new HttpError(409, 'wallet_not_connected');
  const client = new nwc.NWCClient({ nostrWalletConnectUrl: unseal(row.nwc_enc) });
  pool.set(pk, { client, t: setTimeout(() => drop(pk), IDLE_MS) });
  return client;
}
