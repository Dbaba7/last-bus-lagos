import { Server } from '@colyseus/core';
import { WebSocketTransport } from '@colyseus/ws-transport';
import { createServer } from 'node:http';
import express from 'express';
import { resolve } from 'node:path';
import { VERSION } from '@lastbus/shared';
import { GameRoom, invitations, metrics } from './GameRoom.js';
const port = Number(process.env.PORT ?? 2567);
const production = process.env.NODE_ENV === 'production';
const allowed = new Set((process.env.ALLOWED_ORIGINS ?? 'http://localhost:5173,http://127.0.0.1:5173').split(',').map(s => s.trim()));
if (production && !process.env.ALLOWED_ORIGINS) throw new Error('ALLOWED_ORIGINS is required in production');
const app = express(); app.disable('x-powered-by');
if (process.env.TRUST_PROXY) app.set('trust proxy', process.env.TRUST_PROXY === '1' ? 1 : process.env.TRUST_PROXY);
let ready = true;
const rate = new Map<string, { count: number; reset: number }>();
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && !allowed.has(origin)) { res.status(403).json({ error: 'Origin is not allowed' }); return; }
  if (origin) { res.setHeader('Access-Control-Allow-Origin', origin); res.setHeader('Vary', 'Origin'); }
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization'); res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (req.path.startsWith('/matchmake') || req.path === '/api/invite') {
    const key = req.ip ?? req.socket.remoteAddress ?? 'unknown', now = Date.now(); let entry = rate.get(key);
    if (!entry || entry.reset < now) { entry = { count: 0, reset: now + 60_000 }; rate.set(key, entry); }
    if (++entry.count > 240) { res.status(429).json({ error: 'Please wait before trying again.' }); return; }
    if (metrics.rooms >= 64 && req.path.includes('/create/')) { res.status(503).json({ error: 'Server is full. Try again shortly.' }); return; }
  }
  next();
});
app.get('/health', (_req, res) => res.json({ ok: true, version: VERSION, rooms: metrics.rooms }));
app.get('/ready', (_req, res) => res.status(ready ? 200 : 503).json({ ready }));
app.post('/api/invite', express.json({ limit: '1kb' }), (req, res) => { const token = req.body?.token; const roomId = typeof token === 'string' && /^[\w-]{22}$/.test(token) ? invitations.get(token) : undefined; if (!roomId) { res.status(404).json({ error: 'That invitation is invalid or the room has closed.' }); return; } res.json({ roomId }); });
// The production image serves both the static client and persistent WebSocket server.
// A separate static host can still be selected with VITE_SERVER_URL at build time.
app.use(express.static(resolve('dist/client'), { setHeaders: (res, path) => { res.setHeader('Cache-Control', path.includes(`${process.platform === 'win32' ? '\\' : '/'}assets${process.platform === 'win32' ? '\\' : '/'}`) ? 'public, max-age=31536000, immutable' : 'no-cache'); res.setHeader('X-Content-Type-Options', 'nosniff'); res.setHeader('Referrer-Policy', 'no-referrer'); } }));
const httpServer = createServer(app);
const transport = new WebSocketTransport({ server: httpServer, maxPayload: 2048, pingInterval: 5000, beforeUpgrade: async context => {
  const origin = context.headers.get('origin'); if (origin && !allowed.has(origin)) return new Response('Origin is not allowed', { status: 403 });
} });
export const server = new Server({ transport, greet: false, gracefullyShutdown: true });
server.onBeforeShutdown(() => { ready = false; });
server.define('street_wars', GameRoom);
const cleanup = setInterval(() => { const now = Date.now(); for (const [key, entry] of rate) if (entry.reset < now) rate.delete(key); }, 60_000); cleanup.unref();
await server.listen(port, '0.0.0.0');
console.log(JSON.stringify({ event: 'listening', port, version: VERSION, production }));
if (process.send && process.env.NODE_ENV === 'test') {
  const telemetry = setInterval(() => { const timings = [...metrics.tickSamples].sort((a, b) => a - b); const memory = process.memoryUsage(); process.send?.({ sample: { elapsed: process.uptime(), rss: memory.rss, heap: memory.heapUsed, rooms: metrics.rooms, p95TickMs: timings[Math.floor(timings.length * 0.95)] ?? 0, ticks: metrics.ticks, rejected: metrics.rejected } }); }, 5000); telemetry.unref();
}
