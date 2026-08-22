const http = require('http');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const database = require('./database');

const port = Number(process.env.PORT || 4173);
const host = process.env.HOST || '127.0.0.1';
const secret = process.env.THERAPYFLOW_SESSION_SECRET || 'development-only-change-me';
const users = {
  therapist: { id: 'therapist-1', role: 'therapist', name: 'Dr. Nyawose' },
  sarah: { id: 'client-1', role: 'client', name: 'Sarah Dlamini', clientId: 1 }
};
const collectionKeys = { moods: 'moodEntries', journals: 'journalEntries', assessments: 'assessments', sessions: 'sessions', appointments: 'appointments', messages: 'messages' };

function tokenFor(user) {
  const payload = Buffer.from(JSON.stringify({ ...user, exp: Date.now() + 8 * 60 * 60 * 1000 })).toString('base64url');
  const signature = crypto.createHmac('sha256', secret).update(payload).digest('base64url');
  return `${payload}.${signature}`;
}

function userFromRequest(request) {
  const value = request.headers.authorization || '';
  if (!value.startsWith('Bearer ')) return null;
  const [payload, signature] = value.slice(7).split('.');
  if (!payload || !signature) return null;
  const expected = crypto.createHmac('sha256', secret).update(payload).digest('base64url');
  if (signature.length !== expected.length) return null;
  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null;
  let user;
  try { user = JSON.parse(Buffer.from(payload, 'base64url').toString()); } catch { return null; }
  return user.exp > Date.now() ? user : null;
}

function send(response, status, body) {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type, Authorization' });
  response.end(JSON.stringify(body));
}

function serveStatic(request, response) {
  const requested = request.url === '/' ? '/index.html' : request.url;
  const filePath = path.normalize(path.join(__dirname, requested));
  if (!filePath.startsWith(__dirname) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) return send(response, 404, { error: 'Not found' });
  const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8' };
  response.writeHead(200, { 'Content-Type': types[path.extname(filePath)] || 'application/octet-stream' });
  fs.createReadStream(filePath).pipe(response);
}

function readBody(request) {
  return new Promise((resolve, reject) => {
    let body = '';
    request.on('data', (chunk) => { body += chunk; if (body.length > 1024 * 1024) request.destroy(); });
    request.on('end', () => { try { resolve(body ? JSON.parse(body) : {}); } catch { reject(new Error('Invalid JSON')); } });
    request.on('error', reject);
  });
}

function allowed(user, clientId) {
  return user.role === 'therapist' || (user.role === 'client' && Number(clientId) === Number(user.clientId));
}

const server = http.createServer(async (request, response) => {
  const url = new URL(request.url, `http://${request.headers.host || host}`);
  if (!url.pathname.startsWith('/api/')) return serveStatic(request, response);
  if (request.method === 'OPTIONS') { response.writeHead(204, { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type, Authorization', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS' }); return response.end(); }
  if (url.pathname === '/api/health' && request.method === 'GET') return send(response, 200, { ok: true, service: 'therapyflow-api' });
  if (url.pathname === '/api/auth/login' && request.method === 'POST') {
    try { const body = await readBody(request); const user = users[String(body.username || '').toLowerCase()]; if (!user || body.password !== 'demo-password') return send(response, 401, { error: 'Invalid credentials' }); return send(response, 200, { token: tokenFor(user), user }); } catch (error) { return send(response, 400, { error: error.message }); }
  }
  const user = userFromRequest(request);
  if (!user) return send(response, 401, { error: 'Authentication required' });
  if (url.pathname === '/api/me' && request.method === 'GET') return send(response, 200, { user });
  if (url.pathname === '/api/clients' && request.method === 'GET') return send(response, 200, { clients: database.clientsForUser(user) });
  const match = url.pathname.match(/^\/api\/clients\/(\d+)\/(moods|journals|assessments|sessions|appointments|messages)$/);
  if (match && request.method === 'GET') { const [, clientId, collection] = match; if (!allowed(user, clientId)) return send(response, 403, { error: 'Forbidden' }); return send(response, 200, { [collection]: database.recordsForClient(collection, clientId) }); }
  if (match && request.method === 'POST') { const [, clientId, collection] = match; if (!allowed(user, clientId)) return send(response, 403, { error: 'Forbidden' }); try { const body = await readBody(request); const record = database.addRecord(collection, clientId, body, crypto.randomUUID(), new Date().toISOString()); return send(response, 201, record); } catch (error) { return send(response, 400, { error: error.message }); } }
  return send(response, 404, { error: 'API route not found' });
});

server.listen(port, host, () => console.log(`TherapyFlow API listening on http://${host}:${port}`));
