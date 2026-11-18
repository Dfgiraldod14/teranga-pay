import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { rateLimit } from 'express-rate-limit';
import { env } from './config.js';
import { requireAuth } from './middleware/auth.js';
import auth from './routes/auth.js';
import wallet from './routes/wallet.js';
import assistant from './routes/assistant.js';

const app = express();
app.set('trust proxy', 1);
app.use(helmet());
app.use(cors({ origin: env.CORS_ORIGIN }));
app.use(express.json({ limit: '10kb' }));
app.use(rateLimit({ windowMs: 60_000, limit: 60 }));

app.use('/api/auth', auth);
app.use('/api/wallet', requireAuth, wallet);
app.use('/api/assistant', requireAuth, rateLimit({ windowMs: 60_000, limit: 10 }), assistant); // LLM = $$$
app.use(express.static('public')); // útil en desarrollo; en producción lo sirve Caddy

app.use((err, _req, res, _next) => {
  const status = err.status ?? (err.name === 'ZodError' ? 400 : 500);
  if (status === 500) console.error(err.message); // nunca loguear URIs/invoices/tokens
  res.status(status).json({ error: status === 500 ? 'internal' : err.message });
});

app.listen(env.PORT, () => console.log(`Teranga Pay :${env.PORT}`));
