import jwt from 'jsonwebtoken';
import { env } from '../config.js';
import { HttpError } from '../lib/errors.js';

export function requireAuth(req, _res, next) {
  try {
    req.user = jwt.verify((req.headers.authorization ?? '').replace('Bearer ', ''), env.JWT_SECRET, { algorithms: ['HS256'] });
    next();
  } catch { next(new HttpError(401, 'auth')); }
}
