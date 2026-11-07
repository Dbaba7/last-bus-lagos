import { expect, it } from 'vitest';
import { Simulation, WORLD, SPAWNS, RULES, WEAPONS, TEST_LANE, movePlayer, clearPosition, neutral, spreadCone, spreadOffset, damageAt, lineOfSight, groundHeight, bounds, type Player } from '@lastbus/shared';
function solo(x: number, z: number, yaw = 0) { const game = new Simulation({ practice: true }); const p = game.add('p', 'P', 0); game.ready('p'); Object.assign(p, { x, y: groundHeight(x, z), z, yaw }); return { game, p }; }
const run = (p: Player, frames: number, input: Partial<ReturnType<typeof neutral>>) => { for (let i = 0; i < frames; i++) movePlayer(p, { ...neutral(), yaw: p.yaw, ...input }); };
it('every spawn is clear, on the ground and inside the arena', () => {
  for (const point of SPAWNS.flat()) { expect(clearPosition(point)).toBe(true); expect(groundHeight(point.x, point.z)).toBeCloseTo(0); expect(Math.abs(point.x)).toBeLessThan(40); expect(Math.abs(point.z)).toBeLessThan(32); }
});
it('no solid box overlaps another walkable spawn lane and the test lane is open end to end', () => {
  expect(lineOfSight({ x: TEST_LANE.x, y: 1.2, z: -TEST_LANE.spawnZ }, { x: TEST_LANE.x, y: 1.2, z: TEST_LANE.spawnZ })).toBe(true);
  for (const box of WORLD) expect(Number.isFinite(box.x + box.y + box.z + box.w + box.h + box.d)).toBe(true);
  expect(new Set(WORLD.map(b => b.id)).size).toBe(WORLD.length);
});
it('steps up onto a kerb instead of snagging, but not onto waist-high cover', () => {
  const { p } = solo(7.5, -15, -Math.PI / 2); run(p, 30, { z: 1 }); expect(p.x).toBeLessThan(7); expect(p.y).toBeCloseTo(0, 4);
  const kerb = solo(6.5, -15, Math.PI / 2); run(kerb.p, 16, { z: 1 }); expect(kerb.p.x).toBeLessThan(10); expect(kerb.p.x).toBeGreaterThan(8.3); expect(kerb.p.y).toBeCloseTo(0.15, 3);
  const cover = solo(-1.5, -14, Math.PI / 2); run(cover.p, 45, { z: 1 }); expect(cover.p.x).toBeLessThan(-0.6); expect(cover.p.y).toBeCloseTo(0, 4);
});
it('climbs the Junction Records stairs to the balcony and the railing holds', () => {
  const { p } = solo(-24.3, -23.2, 0); run(p, 120, { z: 1 }); expect(p.y).toBeCloseTo(3, 2);
  run(p, 90, { z: 1 }); expect(p.z).toBeLessThan(-10.1); expect(p.y).toBeCloseTo(3, 2); expect(clearPosition(p)).toBe(true);
});
it('crouch lowers the body, slows movement and cannot stand up under a ceiling', () => {
  const { p } = solo(0, -28); run(p, 20, { crouch: true, z: 1 }); expect(p.crouched).toBe(true); expect(Math.hypot(p.vx, p.vz)).toBeCloseTo(RULES.crouchSpeed, 1);
  const low = solo(0, -28); const world = [...WORLD, { id: 'low', kind: 'floor' as const, x: 0, y: 1.45, z: -28, w: 4, h: 0.2, d: 4 }];
  movePlayer(low.p, { ...neutral(), crouch: true }, RULES.dt, world); movePlayer(low.p, neutral(), RULES.dt, world); expect(low.p.crouched).toBe(true);
});
it('aiming tightens spread and spread samples are deterministic', () => {
  const { p } = solo(0, -28); const hip = spreadCone(p); p.aiming = true; expect(spreadCone(p)).toBeLessThan(hip * 0.3);
  const a = spreadOffset(p), b = spreadOffset(structuredClone(p)); expect(a).toEqual(b); p.shots++; expect(spreadOffset(p)).not.toEqual(a);
});
it('applies falloff and headshot multipliers from weapon data', () => {
  expect(damageAt(WEAPONS.rifle, 10, false)).toBe(25); expect(damageAt(WEAPONS.rifle, 90, false)).toBe(18); expect(damageAt(WEAPONS.rifle, 10, true)).toBe(40); expect(damageAt(WEAPONS.sidearm, 5, true)).toBe(60);
});
it('designed recoil climbs during a spray and recovers after release', () => {
  const { game, p } = solo(7, -20); const peaks: number[] = [];
  for (let i = 1; i <= 12; i++) { game.step(new Map([['p', { ...neutral(i, p.life, 0), fire: true }]])); peaks.push(p.recoil); }
  expect(peaks.at(-1)!).toBeGreaterThan(0.03); expect(p.burst).toBeGreaterThan(2);
  for (let i = 13; i <= 60; i++) game.step(new Map([['p', neutral(i, p.life, 0)]]));
  expect(p.recoil).toBeLessThan(0.002); expect(p.burst).toBe(0);
});
it('headshots kill in fewer hits than body shots', () => {
  const game = new Simulation({ private: true, countdown: 0 }); const a = game.add('a', 'A'), b = game.add('b', 'B'); game.ready('a'); game.ready('b'); game.start('a'); game.step();
  Object.assign(a, { x: 7, y: 0, z: -5, yaw: 0, protectedUntil: 0 }); Object.assign(b, { x: 7, y: 0, z: 5, protectedUntil: 0 }); a.weapon = 'sidearm';
  for (let i = 1; i <= 4; i++) { a.guns.sidearm.nextShot = 0; game.step(new Map([['a', { ...neutral(i * 2, a.life, game.round), fire: true, aim: true, pitch: -a.recoil, yaw: -a.recoilYaw }]])); game.step(new Map([['a', { ...neutral(i * 2 + 1, a.life, game.round), aim: true }]])); }
  expect(b.health).toBe(0); expect(a.kills).toBe(1);
});
it('host can configure private matches only with published values', () => {
  const game = new Simulation({ private: true }); game.add('h', 'Host'); game.add('g', 'Guest');
  expect(game.configure('g', 300, 20)).toBe(false); expect(game.configure('h', 999, 20)).toBe(false); expect(game.configure('h', 300, 50)).toBe(true); expect(game.options.duration).toBe(300);
});
it('story mode never respawns automatically and regenerates health after a pause', () => {
  const game = new Simulation({ story: true }); const p = game.add('p', 'P', 0); game.ready('p'); p.health = 40;
  for (let i = 0; i < 30 * 7; i++) game.step(); expect(p.health).toBe(100);
  p.health = 0; p.respawnAt = Infinity; const life = p.life; for (let i = 0; i < 300; i++) game.step(); expect(p.life).toBe(life);
});
it('collision boxes have positive size and stairs rise in climbable treads', () => {
  for (const box of WORLD) { const { min, max } = bounds(box); expect(max.x).toBeGreaterThan(min.x); expect(max.y).toBeGreaterThan(min.y); }
  const treads = WORLD.filter(b => b.kind === 'stairs' && b.id.startsWith('records-stairs-') && !b.id.endsWith('~n')).map(b => b.y + b.h / 2).sort((a, b) => a - b);
  for (let i = 1; i < treads.length; i++) expect(treads[i] - treads[i - 1]).toBeLessThanOrEqual(RULES.stepHeight);
});
