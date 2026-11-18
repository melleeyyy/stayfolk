/**
 * StayFolk — reference API server.
 *
 * A deliberately small, dependency-free Node server that mirrors what the
 * browser demo does in localStorage. It is NOT deployed to GitHub Pages;
 * it exists so the static demo has a real backend to grow into.
 *
 *   node server/index.js            → http://localhost:8787
 *   PORT=3000 node server/index.js
 *
 * Data is persisted to server/data.json (created on first write).
 */

'use strict';

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const PORT = Number(process.env.PORT) || 8787;
const DATA_FILE = path.join(__dirname, 'data.json');
const PUBLIC_DIR = path.join(__dirname, '..');

/* ------------------------------------------------------------- storage */

const emptyDB = () => ({
  users: [],
  hosts: [],
  requests: [],
  threads: [],
  messages: [],
  reports: [],
});

let db = emptyDB();

try {
  if (fs.existsSync(DATA_FILE)) {
    db = { ...emptyDB(), ...JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')) };
  }
} catch (err) {
  console.warn('[stayfolk] could not read data.json, starting fresh:', err.message);
}

let writeTimer = null;
function save() {
  clearTimeout(writeTimer);
  writeTimer = setTimeout(() => {
    try {
      fs.writeFileSync(DATA_FILE, JSON.stringify(db, null, 2));
    } catch (err) {
      console.error('[stayfolk] write failed:', err.message);
    }
  }, 50);
}

/* ---------------------------------------------------------------- auth */

const sessions = new Map(); // token -> userId
const id = (p) => `${p}_${crypto.randomBytes(6).toString('hex')}`;

function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.scryptSync(String(password), salt, 32).toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password, stored) {
  const [salt, hash] = String(stored).split(':');
  if (!salt || !hash) return false;
  const candidate = crypto.scryptSync(String(password), salt, 32);
  const expected = Buffer.from(hash, 'hex');
  return candidate.length === expected.length && crypto.timingSafeEqual(candidate, expected);
}

function userFrom(req) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return null;
  const userId = sessions.get(token);
  return db.users.find((u) => u.id === userId) || null;
}

const publicUser = (u) => ({
  id: u.id, name: u.name, email: u.email, city: u.city, verified: u.verified, hostId: u.hostId || null,
});

/* -------------------------------------------------------------- helpers */

function json(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
    'Cache-Control': 'no-store',
  });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (chunk) => {
      raw += chunk;
      if (raw.length > 1e6) {
        reject(new Error('payload too large'));
        req.destroy();
      }
    });
    req.on('end', () => {
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch {
        reject(new Error('invalid JSON'));
      }
    });
    req.on('error', reject);
  });
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.webmanifest': 'application/manifest+json',
};

function serveStatic(req, res, pathname) {
  const rel = pathname === '/' ? '/index.html' : pathname;
  const file = path.normalize(path.join(PUBLIC_DIR, rel));
  if (!file.startsWith(PUBLIC_DIR)) return json(res, 403, { error: 'forbidden' });

  fs.readFile(file, (err, buf) => {
    if (err) {
      // SPA fallback for anything that is not a file
      return fs.readFile(path.join(PUBLIC_DIR, 'index.html'), (e2, html) => {
        if (e2) return json(res, 404, { error: 'not found' });
        res.writeHead(200, { 'Content-Type': MIME['.html'] });
        res.end(html);
      });
    }
    res.writeHead(200, {
      'Content-Type': MIME[path.extname(file)] || 'application/octet-stream',
      'Cache-Control': path.extname(file) === '.html' ? 'no-cache' : 'public, max-age=3600',
    });
    res.end(buf);
  });
}

/* ---------------------------------------------------------------- routes */

async function handleApi(req, res, pathname, searchParams) {
  const method = req.method;

  if (method === 'OPTIONS') return json(res, 204, {});

  /* health */
  if (pathname === '/api/health') {
    return json(res, 200, { ok: true, service: 'stayfolk', users: db.users.length, hosts: db.hosts.length });
  }

  /* signup */
  if (pathname === '/api/auth/signup' && method === 'POST') {
    const body = await readBody(req);
    const { name, email, password, city } = body;
    if (!name || !email || !password || String(password).length < 6) {
      return json(res, 422, { error: 'name, email and a password of 6+ characters are required' });
    }
    if (db.users.some((u) => u.email.toLowerCase() === String(email).toLowerCase())) {
      return json(res, 409, { error: 'email already registered' });
    }
    const user = {
      id: id('u'),
      name: String(name).trim(),
      email: String(email).trim(),
      password: hashPassword(password),
      city: city || '',
      verified: false,
      createdAt: new Date().toISOString(),
    };
    db.users.push(user);
    save();
    const token = crypto.randomBytes(24).toString('hex');
    sessions.set(token, user.id);
    return json(res, 201, { token, user: publicUser(user) });
  }

  /* login */
  if (pathname === '/api/auth/login' && method === 'POST') {
    const body = await readBody(req);
    const user = db.users.find(
      (u) => u.email.toLowerCase() === String(body.email || '').toLowerCase()
    );
    if (!user || !verifyPassword(body.password, user.password)) {
      return json(res, 401, { error: 'invalid credentials' });
    }
    const token = crypto.randomBytes(24).toString('hex');
    sessions.set(token, user.id);
    return json(res, 200, { token, user: publicUser(user) });
  }

  /* me */
  if (pathname === '/api/me' && method === 'GET') {
    const user = userFrom(req);
    if (!user) return json(res, 401, { error: 'unauthorised' });
    return json(res, 200, { user: publicUser(user) });
  }

  /* hosts */
  if (pathname === '/api/hosts' && method === 'GET') {
    const city = (searchParams.get('city') || '').toLowerCase();
    const language = searchParams.get('language') || '';
    const verified = searchParams.get('verified') === '1';
    const women = searchParams.get('women') === '1';

    const list = db.hosts.filter((h) => {
      if (city && !String(h.city || '').toLowerCase().includes(city)) return false;
      if (language && !(h.languages || []).includes(language)) return false;
      if (verified && !h.verified) return false;
      if (women && !h.womenOnly) return false;
      return true;
    });
    return json(res, 200, { hosts: list, count: list.length });
  }

  if (pathname.startsWith('/api/hosts/') && method === 'GET') {
    const hostId = pathname.split('/')[3];
    const host = db.hosts.find((h) => h.id === hostId);
    if (!host) return json(res, 404, { error: 'host not found' });
    return json(res, 200, { host });
  }

  /* requests */
  if (pathname === '/api/requests' && method === 'POST') {
    const user = userFrom(req);
    if (!user) return json(res, 401, { error: 'unauthorised' });
    const body = await readBody(req);
    if (!body.hostId || !body.from || !body.to || !body.message) {
      return json(res, 422, { error: 'hostId, from, to and message are required' });
    }
    const request = {
      id: id('r'),
      hostId: body.hostId,
      userId: user.id,
      guestName: user.name,
      from: body.from,
      to: body.to,
      guests: Number(body.guests) || 1,
      message: String(body.message).slice(0, 4000),
      status: 'pending',
      createdAt: new Date().toISOString(),
    };
    db.requests.unshift(request);
    save();
    return json(res, 201, { request });
  }

  if (pathname === '/api/requests' && method === 'GET') {
    const user = userFrom(req);
    if (!user) return json(res, 401, { error: 'unauthorised' });
    const outgoing = db.requests.filter((r) => r.userId === user.id);
    const incoming = user.hostId ? db.requests.filter((r) => r.hostId === user.hostId) : [];
    return json(res, 200, { outgoing, incoming });
  }

  if (pathname.startsWith('/api/requests/') && method === 'PATCH') {
    const user = userFrom(req);
    if (!user) return json(res, 401, { error: 'unauthorised' });
    const requestId = pathname.split('/')[3];
    const body = await readBody(req);
    const request = db.requests.find((r) => r.id === requestId);
    if (!request) return json(res, 404, { error: 'request not found' });
    if (request.hostId !== user.hostId) return json(res, 403, { error: 'only the host can respond' });
    if (!['accepted', 'declined'].includes(body.status)) {
      return json(res, 422, { error: 'status must be accepted or declined' });
    }
    request.status = body.status;
    request.respondedAt = new Date().toISOString();
    save();
    return json(res, 200, { request });
  }

  /* threads + messages */
  if (pathname === '/api/threads' && method === 'GET') {
    const user = userFrom(req);
    if (!user) return json(res, 401, { error: 'unauthorised' });
    const threads = db.threads.filter((t) => (user.hostId ? t.hostId === user.hostId : t.userId === user.id));
    return json(res, 200, { threads });
  }

  if (pathname.startsWith('/api/threads/') && pathname.endsWith('/messages')) {
    const threadId = pathname.split('/')[3];
    const user = userFrom(req);
    if (!user) return json(res, 401, { error: 'unauthorised' });

    if (method === 'GET') {
      const messages = db.messages.filter((m) => m.threadId === threadId);
      return json(res, 200, { messages });
    }
    if (method === 'POST') {
      const body = await readBody(req);
      if (!body.text) return json(res, 422, { error: 'text is required' });
      const message = {
        id: id('m'),
        threadId,
        senderId: user.id,
        text: String(body.text).slice(0, 4000),
        at: new Date().toISOString(),
      };
      db.messages.push(message);
      save();
      return json(res, 201, { message });
    }
  }

  /* reports */
  if (pathname === '/api/reports' && method === 'POST') {
    const user = userFrom(req);
    if (!user) return json(res, 401, { error: 'unauthorised' });
    const body = await readBody(req);
    const report = {
      id: id('rp'),
      reporterId: user.id,
      targetType: body.targetType || 'host',
      targetId: body.targetId || '',
      reason: body.reason || '',
      detail: body.detail || '',
      status: 'open',
      createdAt: new Date().toISOString(),
    };
    db.reports.unshift(report);
    save();
    return json(res, 201, { report });
  }

  return json(res, 404, { error: 'unknown endpoint' });
}

/* ---------------------------------------------------------------- server */

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);

  try {
    if (url.pathname.startsWith('/api/')) {
      return await handleApi(req, res, url.pathname, url.searchParams);
    }
    return serveStatic(req, res, url.pathname);
  } catch (err) {
    return json(res, 400, { error: err.message || 'bad request' });
  }
});

server.listen(PORT, () => {
  console.log(`StayFolk API + static demo → http://localhost:${PORT}`);
  console.log(`Data file: ${DATA_FILE}`);
});

module.exports = server;
