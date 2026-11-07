import { expect, it } from 'vitest';
import { Simulation, movePlayer, clearPosition, neutral, RULES, type Box } from '@lastbus/shared';
import { predictPlayer } from '../../apps/client/src/prediction.js';
function players() { const game = new Simulation({ private: true, countdown: 0 }); const a = game.add('a', 'A'), b = game.add('b', 'B'); game.ready('a'); game.ready('b'); game.start('a'); game.step(); Object.assign(a, { x: 7, y: 0, z: -5, protectedUntil: 0 }); Object.assign(b, { x: 7, y: 0, z: 5, protectedUntil: 0 }); return { game, a, b }; }
it('sweeps through a thin-wall corner without penetration and stops at a low ceiling', () => {
  const { a } = players(); Object.assign(a, { x: 0, y: 0, z: 0 });
  const world: Box[] = [
    { id: 'floor', kind: 'ground', x: 0, y: -0.5, z: 0, w: 100, h: 1, d: 100 },
    { id: 'x', kind: 'wall', x: 2, y: 2, z: 0, w: 0.05, h: 4, d: 100 },
    { id: 'z', kind: 'wall', x: 0, y: 2, z: 2, w: 100, h: 4, d: 0.05 },
    { id: 'ceiling', kind: 'wall', x: 0, y: 2.5, z: 0, w: 100, h: 0.2, d: 100 }
  ];
  let peak = 0;
  for (let i = 0; i < 300; i++) { movePlayer(a, { ...neutral(), x: 1, z: 1, sprint: true, jump: i === 0 }, RULES.dt, world); peak = Math.max(peak, a.y); expect(clearPosition(a, world)).toBe(true); }
  expect(a.x).toBeLessThanOrEqual(1.6251); expect(a.z).toBeLessThanOrEqual(1.6251); expect(peak).toBeLessThanOrEqual(0.6001); expect(a.y).toBeCloseTo(0);
});
it('server rejects dead, protected, friendly and obstructed damage', () => {
  const { game, a, b } = players(); b.protectedUntil = game.now + 10;
  const shot = () => { a.guns.rifle.nextShot = 0; game.step(new Map([['a', { ...neutral(a.ack + 1, a.life, game.round), fire: true, pitch: -a.recoil }]])); };
  shot(); expect(b.health).toBe(100);
  b.protectedUntil = 0; b.team = 0; shot(); expect(b.health).toBe(100);
  b.team = 1; Object.assign(a, { x: -4.6, z: -20 }); Object.assign(b, { x: -4.6, z: -9 }); shot(); expect(b.health).toBe(100);
  a.health = 0; a.respawnAt = game.now + 30; const ammo = a.guns.rifle.ammo; shot(); expect(a.guns.rifle.ammo).toBe(ammo);
});
it('keeps departed round participants in frozen results', () => { const { game, a } = players(); a.kills = 3; game.remove('a'); game.finish(); expect(game.results.find(p => p.id === 'a')?.kills).toBe(3); });
it('shared prediction replays movement and weapons identically after an acknowledgement', () => {
  const { game, a } = players(); a.yaw = 0; let predicted = structuredClone(a); const states = [], inputs = [];
  for (let i = 1; i <= 30; i++) { const frame = { ...neutral(i, a.life, game.round), x: -0.4, z: -0.5, fire: i < 15, reload: i === 20 }; inputs.push(frame); game.step(new Map([['a', frame]])); states.push(structuredClone(a)); predictPlayer(predicted, frame, game.now); }
  expect(predicted.x).toBeCloseTo(a.x); expect(predicted.z).toBeCloseTo(a.z); expect(predicted.guns).toEqual(a.guns); expect(predicted.recoil).toBeCloseTo(a.recoil);
  predicted = states[9]; let time = game.now - 20 * RULES.dt;
  for (const frame of inputs.slice(10)) { time += RULES.dt; predictPlayer(predicted, frame, time); }
  expect(predicted.x).toBeCloseTo(a.x); expect(predicted.guns.rifle.ammo).toBe(a.guns.rifle.ammo); expect(predicted.reloadUntil).toBeCloseTo(a.reloadUntil);
});
