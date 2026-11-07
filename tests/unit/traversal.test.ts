import { expect, it } from 'vitest';
import { Simulation, WORLD, ARENA, RULES, MOVE, VERSION, movePlayer, clearPosition, groundHeight, neutral, traversal, traverseHint, bounds, type InputFrame, type Player } from '@lastbus/shared';
import { predictPlayer } from '../../apps/client/src/prediction.js';
function solo(x: number, z: number, yaw = 0) { const game = new Simulation({ practice: true }); const p = game.add('p', 'P', 0); game.ready('p'); Object.assign(p, { x, y: groundHeight(x, z), z, yaw, vx: 0, vz: 0 }); return { game, p }; }
const step = (p: Player, input: Partial<InputFrame> = {}) => movePlayer(p, { ...neutral(), yaw: p.yaw, ...input });
function run(p: Player, frames: number, input: (i: number) => Partial<InputFrame>) { const kinds = new Set<number>(); for (let i = 0; i < frames; i++) { step(p, input(i)); kinds.add(p.traverse); } return kinds; }
it('bumps the protocol for the new body state', () => expect(VERSION).toBe('lagos-3'));
it('vaults waist-high cover with a jump and lands on the far side with momentum', () => {
  const { p } = solo(-4.5, -24.6, 0); // South of the west checkpoint barricade (1.1 m).
  expect(traverseHint(p, 0)).toBe('vault');
  step(p, { z: 1, jump: true }); expect(p.traverse).toBe(MOVE.vault);
  const kinds = run(p, 20, () => ({ z: 1 }));
  expect(kinds.has(MOVE.none)).toBe(true); expect(p.z).toBeGreaterThan(-22.8); expect(p.y).toBeCloseTo(0, 3); expect(p.grounded).toBe(true); expect(clearPosition(p)).toBe(true);
  // Walking into the same cover without jumping still stops at it.
  const blocked = solo(-4.5, -24.6, 0); run(blocked.p, 40, () => ({ z: 1 })); expect(blocked.p.z).toBeLessThan(-24.19); expect(blocked.p.traverse).toBe(MOVE.none);
});
it('mantles onto a chest-high car roof and can stand there', () => {
  const { p } = solo(30.3, -17, Math.PI / 2); expect(traverseHint(p, Math.PI / 2)).toBe('mantle');
  step(p, { z: 1, jump: true }); expect(p.traverse).toBe(MOVE.mantle);
  run(p, 30, () => ({})); expect(p.traverse).toBe(MOVE.none); expect(p.y).toBeCloseTo(1.45, 3); expect(p.x).toBeGreaterThan(31.1); expect(clearPosition(p)).toBe(true);
});
it('a jump into a ledge you can reach mid-air pulls you up; tall walls, buses and buildings do not', () => {
  const air = solo(30.1, -17, Math.PI / 2); step(air.p, { jump: true }); let pulled = false; const kinds = run(air.p, 40, () => { pulled ||= air.p.traverse === MOVE.mantle; return pulled ? {} : { z: 1 }; }); expect(kinds.has(MOVE.mantle)).toBe(true); expect(air.p.y).toBeCloseTo(1.45, 3);
  // Mama Tee Kitchen (a building), a danfo (2.6 m) and the 2.4 m compound wall.
  for (const [x, z, yaw] of [[16, -9.4, Math.PI], [-4.6, -10.9, Math.PI], [24.5, -21.5, Math.PI / 2]]) {
    const { p } = solo(x, z, yaw); expect(traverseHint(p, yaw)).toBeUndefined();
    const seen = run(p, 60, i => ({ z: 1, jump: i === 0 || i === 25 }));
    expect([...seen].every(k => k === MOVE.none)).toBe(true); expect(p.y).toBeLessThan(0.2);
  }
});
it('never carries a body onto a roof or out of the arena from any reachable face', () => {
  const tall = WORLD.filter(b => b.kind !== 'ground' && b.y + b.h / 2 > 2.1 && b.y - b.h / 2 < 0.5);
  let tried = 0;
  for (const box of tall) {
    const { min, max } = bounds(box);
    for (const [x, z, yaw] of [[box.x, min.z - 0.5, 0], [box.x, max.z + 0.5, Math.PI], [min.x - 0.5, box.z, Math.PI / 2], [max.x + 0.5, box.z, -Math.PI / 2]]) {
      const y = groundHeight(x, z, 0.6); if (!Number.isFinite(y) || y > 0.5 || !clearPosition({ x, y, z }) || Math.abs(x) > ARENA.halfX || Math.abs(z) > ARENA.halfZ) continue;
      const { p } = solo(x, z, yaw); tried++;
      const seen = run(p, 70, i => ({ z: 1, sprint: i < 10, jump: i === 2 || i === 30 }));
      expect(Math.abs(p.x) < ARENA.halfX && Math.abs(p.z) < ARENA.halfZ, `${box.id} → ${p.x},${p.z}`).toBe(true);
      if (!seen.has(MOVE.climb)) expect(p.y, `${box.id} ${yaw}`).toBeLessThan(2.1);
      expect(clearPosition(p), box.id).toBe(true);
    }
  }
  expect(tried).toBeGreaterThan(60);
  for (const box of WORLD) if (['building', 'shell', 'fence', 'deck', 'pillar'].includes(box.kind)) expect(traversal(box), box.id).toBe('none');
}, 20000);
it('climbs the marked container ladder onto its roof, and drops off with a jump or at the bottom', () => {
  const { p } = solo(35.3, -20.5, Math.PI / 2); const kinds = run(p, 90, () => p.y > 2.5 && !p.traverse ? {} : { z: 1 });
  expect(kinds.has(MOVE.climb)).toBe(true); expect(p.traverse).toBe(MOVE.none); expect(p.y).toBeCloseTo(2.6, 3); expect(p.x).toBeGreaterThan(36.3);
  const down = solo(35.3, -20.5, Math.PI / 2); run(down.p, 14, () => ({ z: 1 })); expect(down.p.traverse).toBe(MOVE.climb); const height = down.p.y; expect(height).toBeGreaterThan(0.5);
  run(down.p, 40, () => ({ z: -1 })); expect(down.p.traverse).toBe(MOVE.none); expect(down.p.y).toBeCloseTo(0, 3);
  const jump = solo(35.3, -20.5, Math.PI / 2); run(jump.p, 12, () => ({ z: 1 })); step(jump.p, { jump: true }); expect(jump.p.traverse).toBe(MOVE.none); expect(jump.p.vx).toBeLessThan(0);
  run(jump.p, 60, () => ({})); expect(jump.p.y).toBeCloseTo(0, 3); expect(clearPosition(jump.p)).toBe(true);
});
it('climbs the drainpipe and vaults the railing onto the records balcony, never past the top', () => {
  const { p } = solo(-37.5, -9, Math.PI); expect(traverseHint(p, Math.PI)).toBeUndefined();
  run(p, 6, () => ({ z: 1 })); expect(traverseHint({ ...p, traverse: 0 }, Math.PI) ?? 'climb').toBe('climb');
  const kinds = run(p, 120, () => ({ z: 1 })); expect(kinds.has(MOVE.climb)).toBe(true); expect(kinds.has(MOVE.vault)).toBe(true);
  expect(p.y).toBeCloseTo(3, 3); expect(p.z).toBeLessThan(-10.1); expect(clearPosition(p)).toBe(true);
  // Plain walls are not ladders: walking into a building face never starts a climb.
  const wall = solo(16, -9.4, Math.PI); expect(run(wall.p, 40, () => ({ z: 1 })).has(MOVE.climb)).toBe(false);
});
it('slides from a sprint when crouch is pressed, faster at first, then settles into a crouch', () => {
  const { p } = solo(7, -24, 0); run(p, 30, () => ({ z: 1, sprint: true })); expect(Math.hypot(p.vx, p.vz)).toBeCloseTo(RULES.sprint, 1);
  step(p, { z: 1, sprint: true, crouch: true }); expect(p.traverse).toBe(MOVE.slide); expect(p.crouched).toBe(true); expect(Math.hypot(p.vx, p.vz)).toBeGreaterThan(RULES.sprint + 1);
  const start = p.z; run(p, 30, () => ({ z: 1, sprint: true, crouch: true })); expect(p.traverse).toBe(MOVE.none); expect(p.z - start).toBeGreaterThan(4);
  run(p, 20, () => ({ z: 1, sprint: true, crouch: true })); expect(p.crouched).toBe(true); expect(Math.hypot(p.vx, p.vz)).toBeCloseTo(RULES.crouchSpeed, 1);
  // Crouching from a walk is an ordinary crouch.
  const walk = solo(7, -24, 0); run(walk.p, 20, () => ({ z: 1 })); step(walk.p, { z: 1, crouch: true }); expect(walk.p.traverse).toBe(MOVE.none);
});
it('cannot shoot or aim while vaulting', () => {
  const { game, p } = solo(-4.5, -24.6, 0); let shots = 0;
  for (let i = 1; i <= 10; i++) for (const e of game.step(new Map([['p', { ...neutral(i, p.life, 0), z: 1, jump: i === 1, fire: true, aim: true }]]))) if (e.type === 'shot') shots++;
  expect(p.traverse).toBe(MOVE.vault); expect(shots).toBe(0); expect(p.aiming).toBe(false);
});
it('client prediction replays traversal identically, including a correction taken mid-vault', () => {
  const game = new Simulation({ private: true, countdown: 0 }); const a = game.add('a', 'A'), b = game.add('b', 'B'); game.ready('a'); game.ready('b'); game.start('a'); game.step();
  Object.assign(a, { x: 4.5, y: 0, z: -24.6, yaw: 0, vx: 0, vz: 0, protectedUntil: 0 }); Object.assign(b, { x: 30, z: 20 });
  let predicted = structuredClone(a); const inputs: InputFrame[] = [], states: Player[] = [];
  for (let i = 1; i <= 70; i++) {
    const frame = { ...neutral(i, a.life, game.round), yaw: 0, z: 1, sprint: i > 20, jump: i === 2, crouch: i > 48 };
    inputs.push(frame); game.step(new Map([['a', frame]])); states.push(structuredClone(a)); predictPlayer(predicted, frame, game.now);
    expect(predicted.x, `tick ${i}`).toBeCloseTo(a.x, 6); expect(predicted.y).toBeCloseTo(a.y, 6); expect(predicted.z).toBeCloseTo(a.z, 6); expect(predicted.traverse).toBe(a.traverse);
  }
  expect(states.some(s => s.traverse === MOVE.vault)).toBe(true); expect(states.some(s => s.traverse === MOVE.slide)).toBe(true);
  // Reconcile from a snapshot taken mid-vault, with float32 fields as they arrive over the wire.
  const mid = states.findIndex(s => s.traverse === MOVE.vault) + 3, wire = structuredClone(states[mid]) as unknown as Record<string, unknown>;
  for (const key of ['x', 'y', 'z', 'vx', 'vy', 'vz', 'traverseT', 'fromX', 'fromY', 'fromZ', 'toX', 'toY', 'toZ', 'ledgeY']) wire[key] = Math.fround(wire[key] as number);
  predicted = wire as unknown as Player; let time = game.now - (inputs.length - mid - 1) * RULES.dt;
  for (const frame of inputs.slice(mid + 1)) { time += RULES.dt; predictPlayer(predicted, frame, time); }
  expect(predicted.x).toBeCloseTo(a.x, 3); expect(predicted.z).toBeCloseTo(a.z, 3); expect(predicted.y).toBeCloseTo(a.y, 3);
});
