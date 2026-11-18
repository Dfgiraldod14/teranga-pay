# Teranga Pay ⚡

Billetera Lightning ligera para comerciantes informales y receptores de remesas en África.
Lightning vía **NWC (NIP-47)** · identidad **Nostr** · DMs cifrados **NIP-17** · asistente de IA educativo multilingüe.

> Prototipo de hackathon (Bitcoin Dakar by BTrust). Licencia MIT. Usa montos pequeños.

## Seguridad en una línea
El servidor **no custodia fondos**: guarda (cifrada con AES-256-GCM) una URI NWC con presupuesto acotado.
La IA **no puede mover dinero**: pagar exige `prepare` → confirmación humana → `confirm` (token de un solo uso, topes por pago y por día).

## Desarrollo local (Windows/Linux/macOS, Node ≥ 22.13)
Base de datos: `node:sqlite` integrado en Node (sin compilar nada; no necesitas Visual Studio Build Tools).

```bash
npm install
npm run build:web                 # genera public/nostr.bundle.js (nostr-tools + QR para el navegador)
cp .env.example .env              # en Windows: copy .env.example .env
npm run gen:secret                # ejecútalo 2 veces → JWT_SECRET y KEK_HEX
# CORS_ORIGIN=http://localhost:3000 para desarrollo
npm run dev                       # http://localhost:3000
```
> `public/nostr.bundle.js` debe existir y estar en git para el despliegue (el deploy usa `npm ci --omit=dev`).

## Probar sin dinero real
1. LNbits (backend `FakeWallet`) + extensión **NWC Service Provider** → crea una conexión con permisos
   `get_balance`, `make_invoice`, `pay_invoice`, `lookup_invoice` y presupuesto bajo. Relay `wss://`.
2. Pega la URI en la pestaña *Portefeuille*.
3. Crea dos wallets en LNbits ("Comerciante" y "Primo") y paga entre ellas: los pagos internos se liquidan al instante.

## Despliegue (Ubuntu)
```bash
DOMAIN=teranga.tudominio.com REPO=https://github.com/TU_USUARIO/teranga-pay.git bash deploy/deploy.sh
```
Instala Node 22, Caddy (HTTPS automático), PM2 (`ecosystem.config.cjs`), genera `JWT_SECRET`/`KEK_HEX` con `openssl rand -hex 32`
y deja el `.env` en 600. Después añade las claves LLM al `.env` y `pm2 reload teranga-pay`.
Alternativa a Caddy: `deploy/nginx.conf` + certbot.

Actualizar: `cd /opt/teranga-pay && git pull && npm ci --omit=dev && pm2 reload teranga-pay`

## Estructura
```
src/        server, config (zod), db (sqlite), security/crypto, nostr/nwc, wallet/walletService,
            ai/{router,feeAdvisor,guard,prompts}, routes/{auth,wallet,assistant}
public/     PWA (index.html, app.js, style.css, sw.js, manifest.json)
web/        entry del bundle del navegador
deploy/     Caddyfile, nginx.conf, deploy.sh
```

## Antes de la demo
- Verifica `npm view @getalby/sdk versions` (el código usa `nwc.NWCClient` de la serie 3.x).
- Ensayo completo: login → conectar → cobrar → pagar en 2 pasos → chat. Ten un video de respaldo.
- Guarda `KEK_HEX` fuera del VPS: sin él no se pueden descifrar las NWC guardadas.
- La clave Nostr del navegador vive en `localStorage` (MVP). Usa una extensión NIP-07 para mayor seguridad.
