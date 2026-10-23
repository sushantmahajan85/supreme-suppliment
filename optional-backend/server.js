'use strict';
/*
 * Supreme Nutrition — OPTIONAL backend (not needed for GitHub Pages).
 *
 *  - Serves the static landing page (index.html + /assets).
 *  - Creates Razorpay orders with a SERVER-calculated amount.
 *  - Verifies the Razorpay payment signature (HMAC-SHA256) and re-checks the payment
 *    with Razorpay's API before an order is marked paid.
 *  - Verifies webhook signatures and processes payment.captured / order.paid / payment.failed.
 *  - Stores contact messages and newsletter sign-ups.
 *
 * Secrets come from environment variables only (see .env.example). Requires Node >= 18.
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.resolve(__dirname, '..');
loadEnv(path.join(ROOT, '.env'));

const PORT = Number(process.env.PORT || 3000);
const KEY_ID = process.env.RAZORPAY_KEY_ID || '';
const KEY_SECRET = process.env.RAZORPAY_KEY_SECRET || '';
const WEBHOOK_SECRET = process.env.RAZORPAY_WEBHOOK_SECRET || '';
const RZP_API = (process.env.RAZORPAY_API_BASE || 'https://api.razorpay.com/v1').replace(/\/$/, '');
const CURRENCY = 'INR';
const UNIT_PRICE_PAISE = Number(process.env.UNIT_PRICE_PAISE || 349900); // ₹3,499 — must match the site
const MAX_QTY = Number(process.env.MAX_QTY || 10);
const DATA_DIR = path.resolve(ROOT, process.env.DATA_DIR || 'data');
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || ''; // only needed if the site is hosted on another origin

const paymentsConfigured = () => Boolean(KEY_ID && KEY_SECRET);

/* ------------------------------------------------------------------ utils */
function loadEnv(file) {
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}
const timingSafeEq = (a, b) => {
  const A = Buffer.from(String(a)); const B = Buffer.from(String(b));
  return A.length === B.length && crypto.timingSafeEqual(A, B);
};
const hmac = (secret, data) => crypto.createHmac('sha256', secret).update(data).digest('hex');

class HttpError extends Error {
  constructor(status, code, message, fields) { super(message); this.status = status; this.code = code; this.fields = fields; }
}

/* ------------------------------------------------------------------ storage (JSON file, atomic writes) */
fs.mkdirSync(DATA_DIR, { recursive: true });
const ORDERS_FILE = path.join(DATA_DIR, 'orders.json');
let db = { orders: {}, idem: {}, receipts: 0, processedEvents: {} };
try { db = Object.assign(db, JSON.parse(fs.readFileSync(ORDERS_FILE, 'utf8'))); } catch (_) { /* first run */ }
function saveDb() {
  const tmp = ORDERS_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(db, null, 2));
  fs.renameSync(tmp, ORDERS_FILE);
}
function appendLine(name, obj) {
  fs.appendFileSync(path.join(DATA_DIR, name), JSON.stringify(obj) + '\n');
}

/* ------------------------------------------------------------------ validation */
function validateOrderInput(body) {
  const f = {};
  const qty = Number(body.quantity);
  if (!Number.isInteger(qty) || qty < 1 || qty > MAX_QTY) f.quantity = `Quantity must be between 1 and ${MAX_QTY}.`;
  const c = body.customer || {};
  const str = (v, min, max) => typeof v === 'string' && v.trim().length >= min && v.trim().length <= max;
  if (!str(c.name, 2, 80)) f.name = 'Enter your full name.';
  if (!/^(\+?91)?[6-9]\d{9}$/.test(String(c.phone || '').replace(/[\s-]/g, ''))) f.phone = 'Enter a valid 10-digit Indian mobile number.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(c.email || '').trim()) || String(c.email).length > 120) f.email = 'Enter a valid email address.';
  if (!str(c.address, 8, 240)) f.address = 'Enter your delivery address.';
  if (!str(c.city, 2, 60)) f.city = 'Enter your city.';
  if (!str(c.state, 2, 60)) f.state = 'Enter your state.';
  if (!/^[1-9]\d{5}$/.test(String(c.pincode || '').trim())) f.pincode = 'Enter a valid 6-digit PIN code.';
  const key = body.idempotencyKey;
  if (typeof key !== 'string' || key.length < 8 || key.length > 80) f.idempotencyKey = 'Missing idempotency key.';
  if (Object.keys(f).length) throw new HttpError(400, 'validation_failed', Object.values(f)[0], f);
  return {
    qty,
    key,
    customer: {
      name: c.name.trim(), phone: String(c.phone).replace(/[\s-]/g, '').slice(-10), email: c.email.trim(),
      address: c.address.trim(), city: c.city.trim(), state: c.state.trim(), pincode: c.pincode.trim(),
    },
  };
}

/* ------------------------------------------------------------------ Razorpay API */
async function rzp(method, endpoint, body) {
  const res = await fetch(RZP_API + endpoint, {
    method,
    headers: {
      Authorization: 'Basic ' + Buffer.from(`${KEY_ID}:${KEY_SECRET}`).toString('base64'),
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    console.error('[razorpay]', method, endpoint, res.status, json && json.error && json.error.description);
    throw new HttpError(502, 'razorpay_error', 'The payment provider returned an error. Please try again shortly.');
  }
  return json;
}

/* ------------------------------------------------------------------ order lifecycle */
async function createOrder(body) {
  if (!paymentsConfigured()) throw new HttpError(503, 'payments_not_configured', 'Online payments are not configured on this server yet.');
  const { qty, key, customer } = validateOrderInput(body);

  // Idempotency: an identical retry returns the same unpaid order instead of creating another.
  const existingId = db.idem[key];
  if (existingId && db.orders[existingId]) {
    const o = db.orders[existingId];
    if (o.status === 'paid') throw new HttpError(409, 'already_paid', 'This order has already been paid.');
    if (o.quantity === qty) return publicOrder(o);
  }

  const amount = qty * UNIT_PRICE_PAISE; // never taken from the client
  const receipt = 'SN-' + String(++db.receipts).padStart(5, '0');
  const rzpOrder = await rzp('POST', '/orders', {
    amount, currency: CURRENCY, receipt,
    notes: { product: 'Fat loss kit — 30-day program', quantity: String(qty), customer: customer.name, phone: customer.phone },
  });
  if (rzpOrder.amount !== amount || rzpOrder.currency !== CURRENCY) throw new HttpError(502, 'amount_mismatch', 'Order amount mismatch.');

  db.orders[rzpOrder.id] = {
    id: rzpOrder.id, receipt, status: 'created', amount, currency: CURRENCY, quantity: qty,
    customer, createdAt: new Date().toISOString(), paymentId: null, failures: [],
  };
  db.idem[key] = rzpOrder.id;
  saveDb();
  return publicOrder(db.orders[rzpOrder.id]);
}
const publicOrder = (o) => ({ orderId: o.id, keyId: KEY_ID, amount: o.amount, currency: o.currency, receipt: o.receipt, quantity: o.quantity });

// Confirms with Razorpay itself that this payment belongs to this order, for this amount.
async function confirmPayment(order, paymentId) {
  const p = await rzp('GET', '/payments/' + encodeURIComponent(paymentId));
  if (p.order_id !== order.id || p.amount !== order.amount || p.currency !== order.currency) {
    throw new HttpError(400, 'payment_mismatch', 'Payment does not match the order.');
  }
  return p.status; // captured | authorized | failed | created | refunded
}
function markPaid(order, paymentId, via) {
  if (order.status === 'paid') return;
  order.status = 'paid'; order.paymentId = paymentId; order.paidAt = new Date().toISOString(); order.paidVia = via;
  saveDb();
  console.log(`[order] ${order.receipt} PAID (${via}) payment=${paymentId}`);
}

async function verifyPayment(body) {
  if (!paymentsConfigured()) throw new HttpError(503, 'payments_not_configured', 'Online payments are not configured on this server yet.');
  const { razorpay_order_id: oid, razorpay_payment_id: pid, razorpay_signature: sig } = body || {};
  if (![oid, pid, sig].every((v) => typeof v === 'string' && v.length > 5 && v.length < 200)) throw new HttpError(400, 'bad_request', 'Missing payment details.');
  const order = db.orders[oid];
  if (!order) throw new HttpError(404, 'order_not_found', 'Order not found.');

  if (!timingSafeEq(hmac(KEY_SECRET, `${oid}|${pid}`), sig)) {
    order.failures.push({ at: new Date().toISOString(), reason: 'signature_mismatch', paymentId: pid }); saveDb();
    throw new HttpError(400, 'invalid_signature', 'Payment signature could not be verified.');
  }
  if (order.status === 'paid') {
    if (order.paymentId !== pid) throw new HttpError(409, 'already_paid', 'This order has already been paid with a different payment.');
    return { status: 'paid', receipt: order.receipt };
  }
  const status = await confirmPayment(order, pid);
  if (status === 'captured') { markPaid(order, pid, 'client-verify'); return { status: 'paid', receipt: order.receipt }; }
  if (status === 'authorized') { order.status = 'authorized'; order.paymentId = pid; saveDb(); return { status: 'pending', receipt: order.receipt }; }
  throw new HttpError(402, 'payment_not_successful', `Payment status is "${status}".`);
}

function markFailed(orderId, reason, paymentId) {
  const order = db.orders[orderId];
  if (!order || order.status === 'paid') return;
  order.failures.push({ at: new Date().toISOString(), reason: String(reason || 'failed').slice(0, 200), paymentId: paymentId || null });
  if (order.status === 'created') order.status = 'failed_attempt'; // customer may retry on the same order
  saveDb();
}

function handleWebhook(rawBody, signature) {
  if (!WEBHOOK_SECRET) throw new HttpError(503, 'webhook_not_configured', 'Webhook secret not configured.');
  if (!signature || !timingSafeEq(hmac(WEBHOOK_SECRET, rawBody), signature)) throw new HttpError(400, 'invalid_signature', 'Bad webhook signature.');
  const evt = JSON.parse(rawBody);
  const evtId = evt.id || crypto.createHash('sha256').update(rawBody).digest('hex');
  if (db.processedEvents[evtId]) return { ok: true, duplicate: true };
  const payment = evt.payload && evt.payload.payment && evt.payload.payment.entity;
  const rOrder = evt.payload && evt.payload.order && evt.payload.order.entity;
  const orderId = (payment && payment.order_id) || (rOrder && rOrder.id);
  const order = orderId && db.orders[orderId];
  if (order) {
    if ((evt.event === 'payment.captured' || evt.event === 'order.paid') && payment) {
      if (payment.amount === order.amount && payment.currency === order.currency && payment.status === 'captured') markPaid(order, payment.id, 'webhook');
      else console.error('[webhook] amount/currency/status mismatch for', orderId);
    } else if (evt.event === 'payment.failed' && payment) {
      markFailed(orderId, (payment.error_description || 'failed'), payment.id);
    }
  }
  db.processedEvents[evtId] = Date.now();
  const ids = Object.keys(db.processedEvents);
  if (ids.length > 2000) ids.slice(0, ids.length - 2000).forEach((k) => delete db.processedEvents[k]);
  saveDb();
  return { ok: true };
}

/* ------------------------------------------------------------------ http plumbing */
const buckets = new Map();
function rateLimit(ip, limit = 40, windowMs = 60_000) {
  const now = Date.now(); const b = buckets.get(ip) || { n: 0, t: now };
  if (now - b.t > windowMs) { b.n = 0; b.t = now; }
  b.n++; buckets.set(ip, b);
  if (b.n > limit) throw new HttpError(429, 'rate_limited', 'Too many requests. Please wait a minute and try again.');
}
function readBody(req, limit = 20_000) {
  return new Promise((resolve, reject) => {
    let size = 0; const chunks = [];
    req.on('data', (c) => { size += c.length; if (size > limit) { reject(new HttpError(413, 'too_large', 'Request too large.')); req.destroy(); } else chunks.push(c); });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}
const parseJson = (raw) => { try { return JSON.parse(raw || '{}'); } catch (_) { throw new HttpError(400, 'bad_json', 'Invalid JSON.'); } };
function send(res, status, obj, extra = {}) {
  const body = JSON.stringify(obj);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...extra });
  res.end(body);
}
function secHeaders(res) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
}

const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.json': 'application/json' };
function serveStatic(req, res, pathname) {
  let rel = decodeURIComponent(pathname);
  if (rel === '/') rel = '/index.html';
  const allowed = rel === '/index.html' || (rel.startsWith('/assets/') && !rel.includes('/source/'));
  const file = path.normalize(path.join(ROOT, rel));
  if (!allowed || !file.startsWith(ROOT + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
    res.writeHead(404, { 'Content-Type': 'text/plain' }); return res.end('Not found');
  }
  const ext = path.extname(file).toLowerCase();
  const cache = rel.startsWith('/assets/img/') ? 'public, max-age=604800' : 'no-cache';
  res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream', 'Cache-Control': cache });
  fs.createReadStream(file).pipe(res);
}

const server = http.createServer(async (req, res) => {
  secHeaders(res);
  const url = new URL(req.url, 'http://localhost');
  try {
    if (url.pathname.startsWith('/api/')) {
      if (ALLOWED_ORIGIN) {
        res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGIN);
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
        res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
        if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }
      }
      const ip = req.socket.remoteAddress || 'ip';
      if (req.method === 'GET' && url.pathname === '/api/health') return send(res, 200, { ok: true, payments: paymentsConfigured() });
      if (req.method !== 'POST') throw new HttpError(405, 'method_not_allowed', 'Method not allowed.');

      if (url.pathname === '/api/webhook') {
        const raw = await readBody(req, 200_000);
        return send(res, 200, handleWebhook(raw, req.headers['x-razorpay-signature']));
      }
      rateLimit(ip);
      const body = parseJson(await readBody(req));
      switch (url.pathname) {
        case '/api/orders': return send(res, 201, await createOrder(body));
        case '/api/payments/verify': return send(res, 200, await verifyPayment(body));
        case '/api/payments/failed': markFailed(String(body.razorpay_order_id || ''), body.reason); return send(res, 200, { ok: true });
        case '/api/contact': {
          const ok = typeof body.name === 'string' && body.name.trim().length >= 2 && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(body.email)) && typeof body.message === 'string' && body.message.trim().length >= 5;
          if (!ok) throw new HttpError(400, 'validation_failed', 'Please fill in your name, a valid email and a message.');
          appendLine('messages.jsonl', { at: new Date().toISOString(), name: body.name.trim().slice(0, 80), email: body.email.trim().slice(0, 120), message: body.message.trim().slice(0, 1500) });
          return send(res, 201, { ok: true });
        }
        case '/api/subscribe': {
          if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(body.email))) throw new HttpError(400, 'validation_failed', 'Enter a valid email address.');
          appendLine('subscribers.jsonl', { at: new Date().toISOString(), email: body.email.trim().slice(0, 120) });
          return send(res, 201, { ok: true });
        }
        default: throw new HttpError(404, 'not_found', 'Unknown endpoint.');
      }
    }
    if (req.method !== 'GET' && req.method !== 'HEAD') throw new HttpError(405, 'method_not_allowed', 'Method not allowed.');
    serveStatic(req, res, url.pathname);
  } catch (err) {
    if (!(err instanceof HttpError)) { console.error(err); err = new HttpError(500, 'server_error', 'Something went wrong on our side.'); }
    if (!res.headersSent) send(res, err.status, { error: { code: err.code, message: err.message, fields: err.fields } });
  }
});

if (require.main === module) {
  server.listen(PORT, () => {
    console.log(`Supreme Nutrition running on http://localhost:${PORT}`);
    console.log(paymentsConfigured() ? `Razorpay: configured (${KEY_ID.startsWith('rzp_live') ? 'LIVE' : 'test'} mode)` : 'Razorpay: NOT configured — set RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET in .env to activate payments.');
    if (!WEBHOOK_SECRET) console.log('Webhook: RAZORPAY_WEBHOOK_SECRET not set — /api/webhook disabled.');
  });
}
module.exports = server;
