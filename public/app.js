import { generateSecretKey, finalizeEvent, SimplePool, nip19, nip17, QRCode } from './nostr.bundle.js';

const $ = s => document.querySelector(s);
const show = (el, on = true) => { el.hidden = !on; };

// ---------- i18n (fr/en; wolof y otros usan fr) ----------
const I18N = {
  fr: { tab_wallet: 'Portefeuille', tab_receive: 'Encaisser', tab_pay: 'Payer', tab_chat: 'Teranga IA',
    balance: 'Solde : ', connect_help: 'Collez votre lien NWC (Alby Hub / LNbits). Donnez-lui un budget limité.',
    connect: 'Connecter', refresh: 'Actualiser', amount: 'Montant (sats)', memo: 'Description (optionnel)',
    create_invoice: 'Créer la facture', copy: 'Copier', received: '✓ Paiement reçu !',
    dm_send: 'Envoyer par message chiffré (Nostr)', dm_btn: 'Envoyer la demande',
    paste_invoice: 'Facture Lightning', scan: 'Scanner un QR', review: 'Vérifier', you_pay: 'Vous payez',
    memo_label: 'Note :', confirm: 'Confirmer le paiement', cancel: 'Annuler', send: 'Envoyer',
    ask: 'Posez votre question…', paid: '✓ Payé', copied: 'Copié',
    footer: 'Ne partagez jamais votre phrase secrète. Open source (MIT). Prototype : montants limités.' },
  en: { tab_wallet: 'Wallet', tab_receive: 'Receive', tab_pay: 'Pay', tab_chat: 'Teranga AI',
    balance: 'Balance: ', connect_help: 'Paste your NWC link (Alby Hub / LNbits). Give it a limited budget.',
    connect: 'Connect', refresh: 'Refresh', amount: 'Amount (sats)', memo: 'Description (optional)',
    create_invoice: 'Create invoice', copy: 'Copy', received: '✓ Payment received!',
    dm_send: 'Send via encrypted message (Nostr)', dm_btn: 'Send request',
    paste_invoice: 'Lightning invoice', scan: 'Scan QR', review: 'Review', you_pay: 'You are paying',
    memo_label: 'Note:', confirm: 'Confirm payment', cancel: 'Cancel', send: 'Send',
    ask: 'Ask your question…', paid: '✓ Paid', copied: 'Copied',
    footer: 'Never share your seed phrase. Open source (MIT). Prototype: limited amounts.' },
};
let lang = localStorage.getItem('lang') || 'fr';
const ui = () => (lang === 'en' || lang === 'sw' || lang === 'ha' || lang === 'yo' || lang === 'pt' || lang === 'am') ? 'en' : 'fr';
const t = k => I18N[ui()][k] ?? k;
function applyI18n() {
  document.documentElement.lang = lang;
  document.querySelectorAll('[data-i]').forEach(el => { el.textContent = t(el.dataset.i); });
  document.querySelectorAll('[data-ph]').forEach(el => { el.placeholder = t(el.dataset.ph); });
}
$('#lang').value = lang;
$('#lang').addEventListener('change', e => { lang = e.target.value; localStorage.setItem('lang', lang); applyI18n(); });

// ---------- claves y login (MVP: clave local o NIP-07) ----------
const toHex = u8 => Array.from(u8, b => b.toString(16).padStart(2, '0')).join('');
const fromHex = h => Uint8Array.from(h.match(/../g), x => parseInt(x, 16));
function getSk() {
  let h = localStorage.getItem('sk');
  if (!h) { h = toHex(generateSecretKey()); localStorage.setItem('sk', h); }
  return fromHex(h);
}

let token = sessionStorage.getItem('tk') || '';
const say = (msg = '') => { $('#status').textContent = msg; };

async function login() {
  const { challenge } = await (await fetch('/api/auth/challenge')).json();
  const tpl = { kind: 22242, created_at: Math.floor(Date.now() / 1000), tags: [['challenge', challenge]], content: '' };
  const event = window.nostr ? await window.nostr.signEvent(tpl) : finalizeEvent(tpl, getSk());
  const r = await fetch('/api/auth/login', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ event }),
  });
  if (!r.ok) throw new Error('login');
  token = (await r.json()).token;
  sessionStorage.setItem('tk', token);
}

async function api(path, body, retry = true) {
  if (!token) await login();
  const r = await fetch('/api' + path, {
    method: body ? 'POST' : 'GET',
    headers: { 'content-type': 'application/json', authorization: 'Bearer ' + token },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (r.status === 401 && retry) { token = ''; return api(path, body, false); }
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error(j.error || r.statusText), { status: r.status });
  return j;
}

const guard = fn => async (...a) => {
  try { say(); await fn(...a); } catch (e) {
    if (e.message === 'wallet_not_connected') { show($('#connectForm')); say(t('connect_help')); }
    else say(e.message);
  }
};

// ---------- tabs ----------
document.querySelectorAll('#tabs button').forEach(b => b.addEventListener('click', () => {
  document.querySelectorAll('#tabs button').forEach(x => x.classList.toggle('on', x === b));
  document.querySelectorAll('main > section').forEach(s => show(s, s.id === b.dataset.tab));
  if (b.dataset.tab === 'wallet') loadBalance();
}));

// ---------- wallet ----------
const loadBalance = guard(async () => {
  const { sats } = await api('/wallet/balance');
  $('#balance').textContent = sats.toLocaleString();
  show($('#connectForm'), false);
});
$('#refresh').addEventListener('click', loadBalance);

$('#connectForm').addEventListener('submit', e => {
  e.preventDefault();
  guard(async () => {
    await api('/wallet/connect', { nwcUri: $('#nwcUri').value });
    $('#nwcUri').value = ''; // no dejar el secreto en el DOM
    await loadBalance();
  })();
});

// ---------- receive ----------
let pollTimer;
$('#invForm').addEventListener('submit', e => {
  e.preventDefault();
  guard(async () => {
    clearInterval(pollTimer);
    const { invoice, paymentHash } = await api('/wallet/invoice', {
      sats: Number($('#amt').value), memo: $('#memo').value || undefined,
    });
    $('#invText').textContent = invoice;
    $('#qr').src = await QRCode.toDataURL(invoice.toUpperCase(), { margin: 1, width: 240 });
    show($('#paidMsg'), false);
    show($('#invBox'));
    let n = 0;
    pollTimer = setInterval(async () => {
      if (++n > 1800) return clearInterval(pollTimer); // 1 h
      try {
        if ((await api('/wallet/invoice/' + paymentHash)).paid) {
          clearInterval(pollTimer);
          show($('#paidMsg'));
          navigator.vibrate?.(200);
        }
      } catch { /* reintenta */ }
    }, 2000);
  })();
});
$('#copyInv').addEventListener('click', async () => {
  await navigator.clipboard?.writeText($('#invText').textContent);
  say(t('copied'));
});

// DM cifrado NIP-17 firmado en el navegador (el servidor nunca ve la clave)
const RELAYS = ['wss://relay.damus.io', 'wss://nos.lol'];
$('#dmBtn').addEventListener('click', guard(async () => {
  const { type, data: pk } = nip19.decode($('#npub').value.trim());
  if (type !== 'npub') throw new Error('npub invalide');
  const msg = JSON.stringify({ type: 'pay_request', bolt11: $('#invText').textContent, memo: $('#memo').value });
  const wrap = nip17.wrapEvent(getSk(), { publicKey: pk }, msg);
  const pool = new SimplePool();
  await Promise.any(pool.publish(RELAYS, wrap));
  pool.close(RELAYS);
  say('✓');
}));

// ---------- pay (2 pasos) ----------
let pendingToken = '';
if ('BarcodeDetector' in window) show($('#scanBtn'));
$('#scanBtn').addEventListener('click', guard(async () => {
  const video = $('#cam');
  const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
  video.srcObject = stream; show(video); await video.play();
  const det = new BarcodeDetector({ formats: ['qr_code'] });
  const stop = () => { stream.getTracks().forEach(tr => tr.stop()); show(video, false); };
  const loop = async () => {
    if (video.hidden) return;
    const [code] = await det.detect(video).catch(() => []);
    if (code) { $('#payInv').value = code.rawValue.replace(/^lightning:/i, ''); stop(); return; }
    requestAnimationFrame(loop);
  };
  loop(); setTimeout(stop, 30_000);
}));

$('#payForm').addEventListener('submit', e => {
  e.preventDefault();
  guard(async () => {
    show($('#payResult'), false);
    const r = await api('/wallet/pay/prepare', { invoice: $('#payInv').value.trim().replace(/^lightning:/i, '') });
    pendingToken = r.token;
    $('#cSats').textContent = r.sats.toLocaleString();
    $('#cMemo').textContent = r.memo || '—'; // textContent: el memo es texto NO confiable
    show($('#confirmBox'));
  })();
});
$('#cancelPay').addEventListener('click', () => { pendingToken = ''; show($('#confirmBox'), false); });
$('#confirmPay').addEventListener('click', guard(async () => {
  const token = pendingToken; pendingToken = '';
  $('#confirmPay').disabled = true;
  try {
    await api('/wallet/pay/confirm', { token });
    $('#payResult').textContent = t('paid'); show($('#payResult'));
    $('#payInv').value = '';
  } finally { $('#confirmPay').disabled = false; show($('#confirmBox'), false); }
}));

// ---------- asistente ----------
const history = [];
function bubble(cls, text) {
  const d = document.createElement('div');
  d.className = 'm ' + cls; d.textContent = text; // nunca innerHTML
  $('#log').append(d); $('#log').scrollTop = 1e9;
}
$('#chatForm').addEventListener('submit', e => {
  e.preventDefault();
  guard(async () => {
    const message = $('#msg').value.trim();
    if (!message) return;
    $('#msg').value = ''; bubble('u', message);
    const { reply } = await api('/assistant', { message, lang, history: history.slice(-6) });
    bubble('a', reply);
    history.push({ role: 'user', content: message }, { role: 'assistant', content: reply });
  })();
});

// ---------- arranque ----------
applyI18n();
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
loadBalance();
