import { Router } from 'express';
import { z } from 'zod';
import { chat } from '../ai/router.js';
import { systemPrompt } from '../ai/prompts.js';
import { settlementAdvice } from '../ai/feeAdvisor.js';
import { containsSecret, redact } from '../ai/guard.js';
import { getBalanceSats } from '../wallet/walletService.js';

const Body = z.object({
  message: z.string().min(1).max(500),
  lang: z.enum(['fr', 'wo', 'sw', 'ha', 'yo', 'en', 'pt', 'am']).default('fr'),
  amountSats: z.number().int().positive().max(100_000_000).optional(),
  history: z.array(z.object({
    role: z.enum(['user', 'assistant']),
    content: z.string().max(800),
  })).max(6).default([]),
});

const WARN = {
  fr: '⚠️ Ne partagez jamais votre phrase secrète, nsec ou lien NWC. Je ne les lis pas. Gardez-les hors ligne.',
  en: '⚠️ Never share your seed phrase, nsec or NWC link. I did not read it. Keep it offline.',
};

const r = Router();

r.post('/', async (req, res) => {
  const { message, lang, amountSats, history } = Body.parse(req.body);

  // 1) Si el usuario pegó un secreto: NO llega al LLM
  if (containsSecret(message) || history.some(h => containsSecret(h.content)))
    return res.json({ reply: WARN[lang] ?? WARN.en, provider: 'guard' });

  // 2) Contexto confiable (fail-soft)
  const [bal, adv] = await Promise.allSettled([getBalanceSats(req.user.pk), settlementAdvice(amountSats)]);
  const ctx = {
    balanceSats: bal.status === 'fulfilled' ? bal.value : 'unknown',
    settlement: adv.status === 'fulfilled' ? adv.value : { action: 'stay_on_lightning' },
  };

  // 3) LLM vía enrutador con failover
  const { text, provider } = await chat([
    { role: 'system', content: systemPrompt(lang, ctx) },
    ...history,
    { role: 'user', content: message },
  ]);
  res.json({ reply: redact(text), provider, settlement: ctx.settlement });
});

export default r;
