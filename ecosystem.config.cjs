// PM2: un solo proceso (challenges/pending viven en memoria y SQLite es de un solo escritor)
module.exports = {
  apps: [{
    name: 'teranga-pay',
    script: 'src/server.js',
    cwd: '/opt/teranga-pay',          // dotenv lee .env desde aquí
    node_args: '--disable-warning=ExperimentalWarning', // node:sqlite aún es experimental
    exec_mode: 'fork',
    instances: 1,
    autorestart: true,
    min_uptime: '10s',
    max_restarts: 20,
    exp_backoff_restart_delay: 200,
    max_memory_restart: '300M',
    kill_timeout: 5000,
    time: true,
    env: { NODE_ENV: 'production' },
  }],
};
