// Single-user password login. Set APP_PASSWORD in the environment to turn it on.
// Session = HMAC-signed cookie, no server-side session store, no extra dependencies.
const crypto = require('crypto');

const COOKIE = 'earned_session';
const MAX_AGE_S = 30 * 24 * 60 * 60;

function password() { return process.env.APP_PASSWORD || ''; }
function authEnabled() { return password().length > 0; }
function secret() {
  return process.env.SESSION_SECRET ||
    crypto.createHash('sha256').update('earned-session:' + password()).digest('hex');
}
function sign(payload) {
  return crypto.createHmac('sha256', secret()).update(payload).digest('hex');
}
function safeEqual(a, b) {
  const ha = crypto.createHash('sha256').update(String(a)).digest();
  const hb = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(ha, hb);
}
function makeToken() {
  const exp = String(Date.now() + MAX_AGE_S * 1000);
  return exp + '.' + sign(exp);
}
function validToken(token) {
  if (!token) return false;
  const [exp, sig] = String(token).split('.');
  if (!exp || !sig || !/^\d+$/.test(exp)) return false;
  if (Number(exp) < Date.now()) return false;
  return safeEqual(sig, sign(exp));
}
function readCookie(req, name) {
  const raw = req.headers.cookie || '';
  for (const part of raw.split(';')) {
    const i = part.indexOf('=');
    if (i > -1 && part.slice(0, i).trim() === name) return decodeURIComponent(part.slice(i + 1).trim());
  }
  return null;
}
function isAuthed(req) { return validToken(readCookie(req, COOKIE)); }
function cookieHeader(value, maxAge) {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  return `${COOKIE}=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`;
}

// Brute-force guard: 8 wrong passwords per 15 minutes per IP.
const attempts = new Map();
function tooMany(ip) {
  const now = Date.now();
  const rec = attempts.get(ip);
  if (!rec || now - rec.start > 15 * 60 * 1000) return false;
  return rec.count >= 8;
}
function recordFail(ip) {
  const now = Date.now();
  const rec = attempts.get(ip);
  if (!rec || now - rec.start > 15 * 60 * 1000) attempts.set(ip, { start: now, count: 1 });
  else rec.count += 1;
}

function mountAuth(app) {
  app.get('/api/auth/status', (req, res) => {
    res.set('Cache-Control', 'no-store');
    res.json({ enabled: authEnabled(), authed: authEnabled() ? isAuthed(req) : true });
  });
  app.post('/api/auth/login', (req, res) => {
    if (!authEnabled()) return res.json({ ok: true });
    const ip = req.ip || 'unknown';
    if (tooMany(ip)) return res.status(429).json({ error: 'Too many attempts. Try again in 15 minutes.' });
    if (!safeEqual((req.body && req.body.password) || '', password())) {
      recordFail(ip);
      return res.status(401).json({ error: 'Wrong password' });
    }
    attempts.delete(ip);
    res.set('Set-Cookie', cookieHeader(makeToken(), MAX_AGE_S));
    res.json({ ok: true });
  });
  app.post('/api/auth/logout', (req, res) => {
    res.set('Set-Cookie', cookieHeader('', 0));
    res.json({ ok: true });
  });
}

// Paths that never need a session: version (health check), auth itself, and the
// email ingest endpoint, which has its own key.
// /api/ingest/* is reached by an iOS Shortcut, which cannot hold a session
// cookie. Those routes check their own HEALTH_INGEST_KEY header instead and
// refuse everything when it is unset, so opening the path here grants nothing
// on its own.
const OPEN = ['/api/version', '/api/auth/', '/api/money/ingest', '/api/ingest/'];

function requireAuth(req, res, next) {
  if (!req.path.startsWith('/api/')) return next();
  if (OPEN.some(p => req.path === p || req.path.startsWith(p))) return next();
  if (!authEnabled()) {
    // No password configured: the fitness API behaves as before, but bank data is never served.
    if (req.path.startsWith('/api/money')) {
      return res.status(503).json({ error: 'Set APP_PASSWORD on the server to use Money.' });
    }
    return next();
  }
  if (isAuthed(req)) return next();
  res.status(401).json({ error: 'Login required' });
}

module.exports = { mountAuth, requireAuth, authEnabled, isAuthed, makeToken, validToken, safeEqual };
