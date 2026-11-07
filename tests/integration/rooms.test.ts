import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Client, type Room } from '@colyseus/sdk';
import { VERSION, neutral } from '@lastbus/shared';
import { testServer } from '../helpers/server.js';
const endpoint = process.env.GAME_SERVER_URL ?? 'http://localhost:2570';
let server: Awaited<ReturnType<typeof testServer>> | undefined;
const clients = new Client(endpoint); const rooms: Room[] = [];
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
async function until(fn: () => boolean, ms = 10000) { const start = Date.now(); while (!fn()) { if (Date.now() - start > ms) throw new Error('Condition timed out'); await sleep(30); } }
async function create() { const room = await clients.create('street_wars', { version: VERSION, name: 'Host', private: true }); rooms.push(room); return room; }
beforeAll(async () => { if (!process.env.GAME_SERVER_URL) server = await testServer(2570, { TEST_MATCH_SECONDS: '60' }); const response = await fetch(`${endpoint}/health`); expect(response.ok).toBe(true); });
afterAll(async () => { for (const room of rooms) { room.reconnection.enabled = false; if (room.connection.isOpen) await room.leave(); } await server?.stop(); });
describe('actual Colyseus server', () => {
  it('rejects incompatible clients', async () => { await expect(clients.create('street_wars', { version: 'bad' })).rejects.toThrow(); });
  it('shares authoritative state, hides private access and bounds malformed movement', async () => {
    const host = await create(); let invite = ''; host.onMessage('invite', (token: string) => { invite = token; }); host.onMessage('ping', (nonce: number) => host.send('pong', nonce)); host.onMessage('event', () => {});
    await until(() => invite.length > 0);
    await expect(clients.joinById(host.roomId, { version: VERSION, name: 'Intruder' })).rejects.toThrow();
    const lookup = await fetch(`${endpoint}/api/invite`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: invite }) }); expect((await lookup.json() as { roomId: string }).roomId).toBe(host.roomId);
    const friend = await clients.joinById(host.roomId, { version: VERSION, name: 'Friend', invite }); rooms.push(friend); friend.onMessage('invite', () => {}); friend.onMessage('event', () => {}); friend.onMessage('ping', (nonce: number) => friend.send('pong', nonce));
    host.send('ready'); friend.send('ready'); await until(() => host.state.players.size === 2 && [...host.state.players.values()].every(p => (p as { ready: boolean }).ready));
    friend.send('start'); await sleep(100); expect(host.state.phase).toBe('WAITING');
    host.send('start'); await until(() => host.state.phase === 'ACTIVE');
    expect(friend.state.phase).toBe('ACTIVE');
    const player = host.state.players.get(host.sessionId), x = player.x;
    host.send('input', { ...neutral(1, player.life, host.state.round), x: NaN });
    host.send('input', { ...neutral(2, player.life, host.state.round), damage: 999 });
    await sleep(150); expect(host.state.players.get(host.sessionId).x).toBe(x);
    for (let i = 3; i < 35; i++) host.send('input', { ...neutral(i, player.life, host.state.round), x: 1 });
    await sleep(250); expect(Math.abs(host.state.players.get(host.sessionId).x - x)).toBeLessThan(2.5);
    expect(friend.state.score0).toBe(host.state.score0); expect(friend.state.score1).toBe(host.state.score1);
    host.send('input', { ...neutral(35, player.life, host.state.round), weapon: 'sidearm' }); await sleep(400);
    for (let i = 36; i <= 55; i++) { host.send('input', { ...neutral(i, player.life, host.state.round), fire: true, trigger: true }); await sleep(34); }
    await until(() => host.state.players.get(host.sessionId).guns.sidearm.ammo === 11);
    host.send('input', neutral(56, player.life, host.state.round)); await sleep(100);
    host.send('input', { ...neutral(57, player.life, host.state.round), fire: true });
    await until(() => host.state.players.get(host.sessionId).guns.sidearm.ammo === 10);
    expect(friend.state.players.get(host.sessionId).weapon).toBe('sidearm');
  }, 20000);
  it('enforces eight seats and cleans voluntary departures', async () => {
    const host = await create(); let invite = ''; host.onMessage('invite', (token: string) => { invite = token; }); await until(() => !!invite);
    for (let i = 0; i < 7; i++) { const guest = await clients.joinById(host.roomId, { version: VERSION, name: `Guest ${i}`, invite }); rooms.push(guest); guest.onMessage('invite', () => {}); }
    await until(() => host.state.players.size === 8);
    await expect(clients.joinById(host.roomId, { version: VERSION, invite })).rejects.toThrow();
    const departed = rooms.pop()!; await departed.leave(); await until(() => host.state.players.size === 7); expect(host.state.players.has(departed.sessionId)).toBe(false);
  }, 15000);
});
