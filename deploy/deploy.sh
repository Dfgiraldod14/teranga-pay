#!/usr/bin/env bash
# Primer despliegue en Ubuntu 22.04/24.04. Ejecutar como usuario con sudo.
# Uso: DOMAIN=teranga.tudominio.com REPO=https://github.com/TU_USUARIO/teranga-pay.git bash deploy/deploy.sh
set -euo pipefail
: "${DOMAIN:?define DOMAIN}"; : "${REPO:?define REPO}"

sudo apt update && sudo apt -y upgrade
sudo ufw allow OpenSSH && sudo ufw allow 80,443/tcp && sudo ufw --force enable
id deploy &>/dev/null || sudo adduser --disabled-password --gecos "" deploy

curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs git openssl \
  debian-keyring debian-archive-keyring apt-transport-https curl gpg

curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor --yes -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list >/dev/null
sudo apt update && sudo apt install -y caddy
sudo npm install -g pm2

sudo mkdir -p /opt/teranga-pay && sudo chown deploy:deploy /opt/teranga-pay
sudo -iu deploy git clone "$REPO" /opt/teranga-pay
sudo -iu deploy bash -c 'cd /opt/teranga-pay && npm ci --omit=dev && mkdir -p data'

# .env con secretos generados en el servidor (permisos 600)
sudo -iu deploy bash <<EOF
cd /opt/teranga-pay
[ -f .env ] || { umask 077; cat > .env <<ENV
PORT=3000
CORS_ORIGIN=https://${DOMAIN}
JWT_SECRET=$(openssl rand -hex 32)
KEK_HEX=$(openssl rand -hex 32)
MAX_PAY_SATS=50000
DAILY_CAP_SATS=200000
GROQ_API_KEY=
GROQ_MODEL=
OPENROUTER_API_KEY=
OPENROUTER_MODEL=
ENV
}
EOF

sudo -iu deploy bash -c 'cd /opt/teranga-pay && pm2 start ecosystem.config.cjs && pm2 save'
sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u deploy --hp /home/deploy
sudo -iu deploy pm2 save
sudo -iu deploy pm2 install pm2-logrotate

sudo sed "s/teranga.tudominio.com/${DOMAIN}/g" /opt/teranga-pay/deploy/Caddyfile | sudo tee /etc/caddy/Caddyfile >/dev/null
sudo caddy validate --config /etc/caddy/Caddyfile && sudo systemctl reload caddy

echo "Listo. Edita las claves LLM:  sudo -u deploy nano /opt/teranga-pay/.env  &&  sudo -iu deploy pm2 reload teranga-pay"
echo "Prueba: curl -i https://${DOMAIN}/api/auth/challenge"
