# Teranga Pay ⚡

Lightweight Lightning wallet for informal merchants and remittance recipients in Africa.
Lightning via **NWC (NIP-47)** · **Nostr** identity · **NIP-17** encrypted DMs · Multilingual educational AI assistant.

> Hackathon prototype (Bitcoin Dakar by BTrust). MIT License. Use small amounts.

## Security in One Line
The server **does not custody funds**: it stores an NWC URI with a bounded budget (encrypted with AES-256-GCM).
The AI **cannot move money**: paying requires `prepare` → human confirmation → `confirm` (single-use token, per-payment and daily spending caps).

## Local Development (Windows/Linux/macOS, Node ≥ 22.13)
Database: `node:sqlite` built into Node (nothing to compile; no Visual Studio Build Tools required).

```bash
npm install
npm run build:web                 # generates public/nostr.bundle.js (nostr-tools + browser QR)
cp .env.example .env              # on Windows: copy .env.example .env
npm run gen:secret                # run twice → JWT_SECRET and KEK_HEX
# CORS_ORIGIN=http://localhost:3000 for development
npm run dev                       # http://localhost:3000

public/nostr.bundle.js must exist and be tracked in git for deployment (deployment runs npm ci --omit=dev).

Testing Without Real Money
LNbits (FakeWallet backend) + NWC Service Provider extension → create a connection with permissions
get_balance, make_invoice, pay_invoice, lookup_invoice and a low budget. Relay wss://.

Paste the URI in the Wallet (Portefeuille) tab.

Create two wallets in LNbits ("Merchant" and "Cousin") and pay between them: internal payments settle instantaneously.

Deployment (Ubuntu)
DOMAIN=teranga.yourdomain.com REPO=[https://github.com/YOUR_USERNAME/teranga-pay.git](https://github.com/YOUR_USERNAME/teranga-pay.git) bash deploy/deploy.sh
Installs Node 22, Caddy (automatic HTTPS), PM2 (ecosystem.config.cjs), generates JWT_SECRET/KEK_HEX with openssl rand -hex 32,
and sets .env permissions to 600. Then add your LLM keys to .env and run pm2 reload teranga-pay.
Alternative to Caddy: deploy/nginx.conf + certbot.

Update: cd /opt/teranga-pay && git pull && npm ci --omit=dev && pm2 reload teranga-pay

Project Structure
src/        server, config (zod), db (sqlite), security/crypto, nostr/nwc, wallet/walletService,
            ai/{router,feeAdvisor,guard,prompts}, routes/{auth,wallet,assistant}
public/     PWA (index.html, app.js, style.css, sw.js, manifest.json)
web/        browser bundle entry point
deploy/     Caddyfile, nginx.conf, deploy.sh

Before the Demo
Verify npm view @getalby/sdk versions (the codebase uses nwc.NWCClient from the 3.x series).

Full rehearsal: login → connect → receive → 2-step pay → AI chat. Keep a backup video ready.

Back up KEK_HEX outside the VPS: without it, saved NWC credentials cannot be decrypted.

The browser Nostr key lives in localStorage (MVP). Use a NIP-07 extension for stronger security.
