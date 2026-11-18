// Decisión determinista; el LLM solo la explica
let cache = { t: 0, v: null };

async function fees() {
  if (Date.now() - cache.t < 60_000 && cache.v) return cache.v;
  const r = await fetch('https://mempool.space/api/v1/fees/recommended', { signal: AbortSignal.timeout(4000) });
  if (!r.ok) throw new Error('mempool');
  cache = { t: Date.now(), v: await r.json() };
  return cache.v;
}

const VBYTES = 140; // tx típica 1-in/2-out segwit (apertura/cierre de canal, swap)

export async function settlementAdvice(amountSats) {
  try {
    const f = await fees();
    const congestion = f.fastestFee >= 60 ? 'high' : f.fastestFee >= 20 ? 'medium' : 'low';
    const costNow = f.halfHourFee * VBYTES, costEco = f.economyFee * VBYTES;
    let action = 'onchain_ok_now';
    if (amountSats && costNow / amountSats > 0.02) action = 'stay_on_lightning'; // comisión > 2 %
    else if (congestion !== 'low') action = 'wait_for_lower_fees';
    return { congestion, feeRates: f, onchainCostSats: { now: costNow, economy: costEco }, action };
  } catch {
    return { congestion: 'unknown', action: 'stay_on_lightning' }; // fallo seguro
  }
}
