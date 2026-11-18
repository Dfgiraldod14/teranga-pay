// Nunca enviar secretos a un LLM de terceros
const SECRET_SRC = '(nsec1[0-9a-z]{20,}|nostr\\+walletconnect:\\/\\/\\S+|secret=[0-9a-f]{64}|\\b[0-9a-f]{64}\\b)';
export const containsSecret = t => new RegExp(SECRET_SRC, 'i').test(t);
export const redact = t => t.replace(new RegExp(SECRET_SRC, 'gi'), '[oculto]');
