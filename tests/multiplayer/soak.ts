import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { Peer, laneController } from '../helpers/peer.js';
import { testServer, until, sleep } from '../helpers/server.js';
const seconds = Number(process.env.SOAK_SECONDS ?? 1800);
const server = await testServer(2573, { TEST_MATCH_SECONDS: '240', TEST_COUNTDOWN_SECONDS: '5', TEST_RESULTS_SECONDS: '10' });
const peers: Peer[] = []; const started = Date.now(); let rounds = 0;
try {
  const host = await Peer.create(server.endpoint); peers.push(host);
  for (let i = 1; i < 8; i++) peers.push(await Peer.join(server.endpoint, host, `Soak ${i}`));
  peers.forEach((peer, index) => {
    peer.ready(); const travel = laneController(index % 2 === 0 ? -5 : 5);
    peer.control((p, state) => {
      if (state.phase !== 'ACTIVE') return {};
      const movement = travel(p); if (movement.z) return movement;
      const enemy = state.players.filter(q => q.team !== p.team && q.health > 0).sort((a, b) => Math.hypot(a.x - p.x, a.z - p.z) - Math.hypot(b.x - p.x, b.z - p.z))[0];
      if (!enemy) return {};
      const dx = enemy.x - p.x, dz = enemy.z - p.z;
      return { yaw: Math.atan2(dx, dz), pitch: Math.atan2(enemy.y + 1.1 - p.y - 1.6, Math.hypot(dx, dz)) - p.recoil, fire: true, reload: p.guns[p.weapon].ammo === 0 };
    });
  });
  await until(() => host.state.players.every(p => p.ready)); host.room.send('start');
  while ((Date.now() - started) / 1000 < seconds) {
    await sleep(1000);
    assert.equal(host.state.players.length, 8); assert.ok(peers.every(p => p.room.connection.isOpen));
    for (const p of host.state.players) assert.ok([p.x, p.y, p.z, p.health].every(Number.isFinite));
    if (host.state.round > rounds) { rounds = host.state.round; console.log(`Eight-client soak: round ${rounds}, elapsed ${Math.round((Date.now() - started) / 1000)}s`); }
    if (host.state.phase === 'WAITING') host.room.send('start');
  }
  const elapsed = (Date.now() - started) / 1000;
  await mkdir('artifacts', { recursive: true });
  const report = { elapsedSeconds: elapsed, clients: peers.length, rounds, samples: server.samples, perClientKiBPerSecond: peers.map(p => ({ downstream: p.receivedBytes / elapsed / 1024, upstream: p.sentBytes / elapsed / 1024 })) };
  await writeFile('artifacts/soak-report.json', JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ elapsedSeconds: elapsed, clients: 8, rounds, first: server.samples[0], last: server.samples.at(-1) }, null, 2));
} catch (error) { console.error(error); console.error(server.logs()); process.exitCode = 1; }
finally { for (const p of peers) await p.close(); await server.stop(); }
