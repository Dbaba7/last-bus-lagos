import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { testServer, until, sleep } from '../helpers/server.js';
import { Peer, laneController } from '../helpers/peer.js';
const fullMatch = process.env.SMOKE_FULL_MATCH === '1';
const server = await testServer(2571, { TEST_MATCH_SECONDS: fullMatch ? '240' : '35', TEST_COUNTDOWN_SECONDS: fullMatch ? '5' : '0.2', TEST_RESULTS_SECONDS: '1' });
const peers: Peer[] = [], assertions: string[] = [];
const started = Date.now();
try {
  const host = await Peer.create(server.endpoint); peers.push(host); const guest = await Peer.join(server.endpoint, host); peers.push(guest);
  host.ready(); guest.ready(); await until(() => host.state.players.every(p => p.ready)); host.room.send('start'); await until(() => host.state.phase === 'ACTIVE');
  const goA = laneController(-6), goB = laneController(6); let allowFire = false;
  host.control((p, state) => { if (!allowFire) return goA(p); const target = state.players.find(other => other.id === guest.id)!; const dx = target.x - p.x, dz = target.z - p.z; return { yaw: Math.atan2(dx, dz), pitch: Math.atan2(target.y + 1.1 - p.y - 1.6, Math.hypot(dx, dz)) - p.recoil, fire: target.health > 0, reload: p.guns[p.weapon].ammo === 0 }; });
  guest.control(p => goB(p));
  await until(() => Math.abs(host.player!.x - 7) < 0.6 && Math.abs(host.player!.z + 6) < 0.6 && Math.abs(guest.player!.z - 6) < 0.6, 22000, 'players navigating to firing lane');
  const life = guest.player!.life; allowFire = true; guest.control(() => ({}));
  await until(() => guest.player!.health === 0, 5000, 'server-confirmed elimination'); allowFire = false; host.control(() => ({}));
  assert.equal(host.player!.kills, 1); assert.equal(guest.player!.deaths, 1); assert.equal(host.state.score0, guest.state.score0); assertions.push('real input navigation, hitscan damage, one elimination and shared scores');
  await until(() => guest.player!.life > life && guest.player!.health === 100, 5000, 'respawn'); assertions.push('three-second authoritative respawn');
  const before = host.player!; host.room.send('ready'); await sleep(100); assert.equal(host.player!.life, before.life); assert.equal(host.player!.guns.rifle.ammo, before.guns.rifle.ammo); assertions.push('repeated ready cannot reset life or ammunition');
  await until(() => host.state.phase === 'RESULTS', fullMatch ? 255000 : 42000, 'match timeout'); await until(() => guest.state.phase === 'RESULTS');
  assert.equal(host.state.winner, 'POLICE'); assert.deepEqual(host.state.results, guest.state.results); assertions.push(`${fullMatch ? 'four-minute' : '35-second test-configured'} match ended with accurate shared results`);
  await until(() => host.state.phase === 'WAITING'); host.room.send('start'); await until(() => host.state.phase === 'ACTIVE'); assert.equal(host.state.round, 2); assert.equal(host.state.score0, 0); assert.equal(host.player!.kills, 0); assert.equal(host.player!.guns.rifle.ammo, 30); assertions.push('rematch resets round, scores, lives and loadout');
  const elapsed = (Date.now() - started) / 1000;
  await mkdir('artifacts', { recursive: true }); const report = { fullMatch, elapsedSeconds: elapsed, assertions, perClientKiBPerSecond: peers.map(p => ({ downstream: p.receivedBytes / elapsed / 1024, upstream: p.sentBytes / elapsed / 1024 })), server: server.samples };
  await writeFile(`artifacts/multiplayer-${fullMatch ? 'full' : 'smoke'}.json`, JSON.stringify(report, null, 2)); console.log(JSON.stringify({ assertions, elapsedSeconds: elapsed, perClientKiBPerSecond: report.perClientKiBPerSecond }, null, 2));
} catch (error) { console.error(error); console.error(server.logs()); console.error(peers.map(p => ({ player: p.player, phase: p.state.phase }))); process.exitCode = 1; }
finally { for (const peer of peers) await peer.close(); await server.stop(); }
