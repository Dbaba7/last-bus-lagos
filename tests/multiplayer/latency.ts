import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { neutral, RULES, type InputFrame, type Player } from '@lastbus/shared';
import { predictPlayer } from '../../apps/client/src/prediction.js';
import { Peer, laneController } from '../helpers/peer.js';
import { testServer, until, sleep } from '../helpers/server.js';
import { latencyProxy } from '../helpers/latency.js';
const server = await testServer(2574, { TEST_MATCH_SECONDS: '100' });
const reports: object[] = [];
try {
  for (const [rtt, jitter] of [[0, 0], [80, 0], [150, 30], [250, 0]]) {
    const proxy = await latencyProxy(2575, 2574, rtt, jitter), peers: Peer[] = [];
    try {
      const host = await Peer.create(proxy.endpoint); peers.push(host); const guest = await Peer.join(proxy.endpoint, host); peers.push(guest);
      peers.forEach(p => { p.ready(); p.room.reconnection.minUptime = 0; });
      await until(() => host.state.players.length === 2 && host.state.players.every(p => p.ready)); host.room.send('start'); await until(() => host.state.phase === 'ACTIVE');
      const route = laneController(-6), targetRoute = laneController(6), corrections: number[] = [], pings: number[] = [];
      let predicted: Player | undefined, pending: InputFrame[] = [], predictionTime = 0, firing = false;
      host.room.onStateChange(() => {
        const p = host.player; if (!p) return; const previous = predicted;
        pending = pending.filter(input => input.seq > p.ack && input.life === p.life);
        predicted = structuredClone(p); predictionTime = host.state.now;
        for (const input of pending) { predictionTime += RULES.dt; predictPlayer(predicted, input, predictionTime); }
        if (previous?.life === p.life) corrections.push(Math.hypot(predicted.x - previous.x, predicted.y - previous.y, predicted.z - previous.z));
        if (p.ping > 0) pings.push(p.ping);
      });
      host.control((p, state) => {
        const target = state.players.find(q => q.id === guest.id)!;
        const dx = target.x - p.x, dz = target.z - p.z;
        const control = firing ? { yaw: Math.atan2(dx, dz), pitch: Math.atan2(target.y + 1.1 - p.y - 1.6, Math.hypot(dx, dz)) - p.recoil, fire: target.health > 0, reload: p.guns.rifle.ammo === 0 } : route(p);
        const input = { ...neutral(host.seq, p.life, state.round), yaw: p.yaw, pitch: p.pitch, ...control };
        pending.push(input); if (predicted) { predictionTime += RULES.dt; predictPlayer(predicted, input, predictionTime); }
        return control;
      });
      guest.control(p => targetRoute(p));
      await until(() => Math.abs(host.player!.z + 6) < 0.6 && Math.abs(guest.player!.z - 6) < 0.6, 26000, 'firing lane under latency');
      firing = true; const shootingAt = Date.now(); let direction = 1;
      guest.control(p => { if (p.x > 7.55) direction = -1; if (p.x < 6.45) direction = 1; return { yaw: 0, x: direction * 0.5 }; });
      await until(() => guest.player!.health === 0, 7000, 'moving-target elimination');
      const timeToKillMs = Date.now() - shootingAt; firing = false; host.control(() => ({})); guest.control(() => ({}));
      assert.equal(host.state.score0, guest.state.score0);
      await sleep(1000); assert.ok(pending.length < 15, 'acknowledgements keep prediction bounded');
      let recovered = rtt !== 250;
      if (rtt === 250) { host.room.onReconnect(() => { recovered = true; }); proxy.interrupt(); await until(() => recovered && host.room.connection.isOpen, 12000, 'actual socket drop and recovery'); }
      corrections.sort((a, b) => a - b); pings.sort((a, b) => a - b);
      const report = { configuredRttMs: rtt, configuredJitterMs: jitter, measuredMedianPingMs: pings[Math.floor(pings.length / 2)], correctionP95Metres: corrections[Math.floor(corrections.length * 0.95)], correctionMaxMetres: Math.max(...corrections), timeToKillMs, shots: host.events.filter(e => e.type === 'shot' && e.player === host.id).length, socketRecovery: recovered, forwardedTcpBytes: proxy.bytes() };
      reports.push(report); console.log(JSON.stringify(report));
    } finally { for (const p of peers) await p.close(); await proxy.close(); }
  }
  await mkdir('artifacts', { recursive: true }); await writeFile('artifacts/latency-report.json', JSON.stringify(reports, null, 2));
} finally { await server.stop(); }
