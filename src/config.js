import 'dotenv/config';
import { z } from 'zod';

const hex64 = z.string().regex(/^[0-9a-f]{64}$/i, 'debe ser hex de 64 caracteres (openssl rand -hex 32)');

export const env = z.object({
  PORT: z.coerce.number().default(3000),
  CORS_ORIGIN: z.string().url(),
  JWT_SECRET: hex64,
  KEK_HEX: hex64,
  MAX_PAY_SATS: z.coerce.number().int().positive().default(50_000),
  DAILY_CAP_SATS: z.coerce.number().int().positive().default(200_000),
  GROQ_API_KEY: z.string().optional().transform(v => v || undefined),
  GROQ_MODEL: z.string().optional().transform(v => v || undefined),
  OPENROUTER_API_KEY: z.string().optional().transform(v => v || undefined),
  OPENROUTER_MODEL: z.string().optional().transform(v => v || undefined),
}).parse(process.env); // fail-fast al arrancar
