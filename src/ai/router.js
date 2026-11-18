// Enrutador multi-LLM con failover y cooldown (APIs compatibles con OpenAI)
import { env } from '../config.js';

const PROVIDERS = [
  { name: 'groq', url: 'https://api.groq.com/openai/v1/chat/completions', key: env.GROQ_API_KEY, model: env.GROQ_MODEL },
  { name: 'openrouter', url: 'https://openrouter.ai/api/v1/chat/completions', key: env.OPENROUTER_API_KEY, model: env.OPENROUTER_MODEL },
].filter(p => p.key && p.model);

const coolUntil = new Map();

export async function chat(messages) {
  let lastErr;
  for (const p of PROVIDERS) {
    if ((coolUntil.get(p.name) ?? 0) > Date.now()) continue;
    try {
      const r = await fetch(p.url, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${p.key}` },
        body: JSON.stringify({ model: p.model, messages, temperature: 0.3, max_tokens: 400 }),
        signal: AbortSignal.timeout(15_000),
      });
      if (!r.ok) throw new Error(`${p.name} ${r.status}`);
      const text = (await r.json()).choices?.[0]?.message?.content?.trim();
      if (!text) throw new Error(`${p.name} vacío`);
      return { text, provider: p.name };
    } catch (e) { lastErr = e; coolUntil.set(p.name, Date.now() + 30_000); }
  }
  throw lastErr ?? new Error('Sin proveedores de IA configurados');
}
