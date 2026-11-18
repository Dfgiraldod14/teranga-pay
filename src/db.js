// SQLite nativo de Node (node:sqlite, Node >= 22.13): sin compilar binarios, funciona en Windows sin Build Tools.
import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';

mkdirSync('data', { recursive: true });
export const db = new DatabaseSync('data/app.db');
db.exec('PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;');
db.exec(`
  CREATE TABLE IF NOT EXISTS users(
    pubkey TEXT PRIMARY KEY, nwc_enc TEXT, lang TEXT DEFAULT 'fr', created INTEGER);
  CREATE TABLE IF NOT EXISTS spend(
    id INTEGER PRIMARY KEY, pubkey TEXT NOT NULL, sats INTEGER NOT NULL, ts INTEGER NOT NULL);
  CREATE INDEX IF NOT EXISTS spend_idx ON spend(pubkey, ts);
`);
