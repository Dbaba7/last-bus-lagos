import { beforeAll, afterAll, it, expect } from 'vitest';
import { Peer } from '../helpers/peer.js';
import { neutral } from '@lastbus/shared';
import { testServer, until, sleep } from '../helpers/server.js';
let server: Awaited<ReturnType<typeof testServer>>;
const peers: Peer[] = [];
beforeAll(async () => { server = await testServer(2577, { TEST_MATCH_SECONDS: '60' }); });
afterAll(async () => { for (const peer of peers) await peer.close(); await server.stop(); });
it('denies unknown HTTP origins and malformed invitation bodies', async () => {
  const denied = await fetch(`${server.endpoint}/health`, { headers: { Origin: 'https://untrusted.invalid' } }); expect(denied.status).toBe(403);
  const allowed = await fetch(`${server.endpoint}/health`, { headers: { Origin: 'http://localhost:5173' } }); expect(allowed.status).toBe(200);
  const tooLarge = await fetch(`${server.endpoint}/api/invite`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: 'a'.repeat(2000) }) }); expect(tooLarge.status).toBe(413);
});
it('closes an oversized socket payload while another connection and the room remain healthy', async () => {
  const host = await Peer.create(server.endpoint); peers.push(host); const guest = await Peer.join(server.endpoint, host); peers.push(guest);
  guest.room.reconnection.enabled = false; await until(() => host.state.players.length === 2);
  guest.room.connection.send(new Uint8Array(4096)); await until(() => !guest.room.connection.isOpen);
  await sleep(100); expect(host.room.connection.isOpen).toBe(true); expect((await fetch(`${server.endpoint}/health`)).ok).toBe(true);
});
it('bounds repeated unsupported gameplay messages and HTTP invitation requests', async () => {
  const host = await Peer.create(server.endpoint); peers.push(host); host.room.reconnection.enabled = false;
  for (let i = 0; i < 35; i++) host.room.send('award-kill', { health: 999, kills: 999 });
  await until(() => !host.room.connection.isOpen);
  let limited = false;
  for (let i = 0; i < 245; i++) { const response = await fetch(`${server.endpoint}/api/invite`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"token":"bad"}' }); if (response.status === 429) { limited = true; break; } }
  expect(limited).toBe(true); expect((await fetch(`${server.endpoint}/health`)).ok).toBe(true);
});
it('drops a congestion burst without speed gain, disconnect or long token debt', async () => {
  // A fresh server avoids the preceding deliberate HTTP-limit exhaustion.
  const isolated = await testServer(2578, { TEST_MATCH_SECONDS: '60' });
  let host: Peer | undefined, guest: Peer | undefined;
  try {
    host = await Peer.create(isolated.endpoint); guest = await Peer.join(isolated.endpoint, host);
    host.ready(); guest.ready(); await until(() => host!.state.players.length === 2 && host!.state.players.every(p => p.ready)); host.room.send('start'); await until(() => host!.state.phase === 'ACTIVE');
    const x = host.player!.x, life = host.player!.life, round = host.state.round;
    for (let seq = 1; seq <= 300; seq++) host.room.send('input', { ...neutral(seq, life, round), x: 1 });
    await sleep(400); expect(host.room.connection.isOpen).toBe(true); expect(Math.abs(host.player!.x - x)).toBeLessThan(2.5);
    await sleep(200); host.room.send('input', neutral(301, life, round)); await until(() => host!.player!.ack === 301, 1500, 'accept input after burst');
    expect(guest.room.connection.isOpen).toBe(true);
  } finally { await host?.close(); await guest?.close(); await isolated.stop(); }
});
