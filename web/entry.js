// Punto de entrada del bundle del navegador (npm run build:web → public/nostr.bundle.js)
export { generateSecretKey, getPublicKey, finalizeEvent } from 'nostr-tools/pure';
export { SimplePool } from 'nostr-tools/pool';
export * as nip19 from 'nostr-tools/nip19';
export * as nip17 from 'nostr-tools/nip17';
export { default as QRCode } from 'qrcode';
