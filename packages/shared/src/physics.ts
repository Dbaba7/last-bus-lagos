import { RULES } from './config.js';
import type { InputFrame, Motion } from './protocol.js';
import { WORLD, WORLD_BOUNDS, type Box, type Traverse, type Vec3 } from './world.js';
const epsilon = 0.00001;
export function bounds(box: Box): { min: Vec3; max: Vec3 } {
  return { min: { x: box.x - box.w / 2, y: box.y - box.h / 2, z: box.z - box.d / 2 }, max: { x: box.x + box.w / 2, y: box.y + box.h / 2, z: box.z + box.d / 2 } };
}
export const bodyHeight = (p: { crouched?: boolean }) => p.crouched ? RULES.crouchHeight : RULES.height;
export const eyeHeight = (p: { crouched?: boolean }) => p.crouched ? RULES.crouchEye : RULES.eye;
export function bodyBounds(p: Vec3 & { crouched?: boolean }) {
  return { min: { x: p.x - RULES.radius, y: p.y, z: p.z - RULES.radius }, max: { x: p.x + RULES.radius, y: p.y + bodyHeight(p), z: p.z + RULES.radius } };
}
function overlaps(a: { min: Vec3; max: Vec3 }, b: { min: Vec3; max: Vec3 }) {
  return a.max.x > b.min.x + epsilon && a.min.x < b.max.x - epsilon && a.max.y > b.min.y + epsilon && a.min.y < b.max.y - epsilon && a.max.z > b.min.z + epsilon && a.min.z < b.max.z - epsilon;
}
export function clearPosition(p: Vec3 & { crouched?: boolean }, world = WORLD): boolean {
  const a = bodyBounds(p);
  return !world.some(b => overlaps(a, bounds(b)));
}
/** Swept distance the body can travel along one axis before touching world geometry. */
function sweep(p: Vec3 & { crouched?: boolean }, axis: keyof Vec3, delta: number, world: Box[]) {
  const a = bodyBounds(p); let distance = delta;
  const others = (['x', 'y', 'z'] as const).filter(key => key !== axis);
  for (const box of world) {
    const b = bounds(box);
    if (!others.every(k => a.max[k] > b.min[k] + epsilon && a.min[k] < b.max[k] - epsilon)) continue;
    if (delta > 0 && a.max[axis] <= b.min[axis] + epsilon) distance = Math.min(distance, Math.max(0, b.min[axis] - a.max[axis]));
    if (delta < 0 && a.min[axis] >= b.max[axis] - epsilon) distance = Math.max(distance, Math.min(0, b.max[axis] - a.min[axis]));
  }
  return distance;
}
function moveVertical(p: Motion, delta: number, world: Box[]) {
  const distance = sweep(p, 'y', delta, world); p.y += distance;
  if (Math.abs(distance - delta) > epsilon) { if (delta < 0) p.grounded = true; p.vy = 0; }
}
/**
 * Horizontal sweep with a bounded step-up. Kerbs, stair treads and other ledges
 * no taller than RULES.stepHeight are climbed instead of snagging the player.
 */
function moveHorizontal(p: Motion, axis: 'x' | 'z', delta: number, world: Box[], footing: boolean) {
  const distance = sweep(p, axis, delta, world);
  if (Math.abs(distance - delta) <= epsilon || !footing) { p[axis] += distance; if (Math.abs(distance - delta) > epsilon) { if (axis === 'x') p.vx = 0; else p.vz = 0; } return; }
  const trial = { x: p.x, y: p.y, z: p.z, crouched: p.crouched };
  const up = sweep(trial, 'y', RULES.stepHeight, world); trial.y += up;
  const across = sweep(trial, axis, delta, world); trial[axis] += across;
  const down = sweep(trial, 'y', -up, world); trial.y += down;
  if (Math.abs(across) > Math.abs(distance) + 0.001 && trial.y >= p.y - epsilon) { p.x = trial.x; p.y = trial.y; p.z = trial.z; p.grounded = true; if (Math.abs(across - delta) > epsilon) { if (axis === 'x') p.vx = 0; else p.vz = 0; } return; }
  p[axis] += distance; if (axis === 'x') p.vx = 0; else p.vz = 0;
}
function approach(value: number, target: number, accelerate: number, decelerate: number) {
  const rate = Math.abs(target) < Math.abs(value) || Math.sign(target) !== Math.sign(value) ? decelerate : accelerate;
  return value + Math.max(-rate, Math.min(rate, target - value));
}
/** Local stick direction that produces a world-space heading for a given yaw (inverse of movePlayer's rotation). */
export function localMove(dx: number, dz: number, yaw: number) {
  return { x: dx * Math.cos(yaw) - dz * Math.sin(yaw), z: dx * Math.sin(yaw) + dz * Math.cos(yaw) };
}
// ── Traversal. Vaults, mantles, ladder climbs and slides are part of the shared movement
// solver, so the server stays authoritative and client prediction replays them exactly.
export const MOVE = { none: 0, vault: 1, mantle: 2, climb: 3, slide: 4 } as const;
/** Styles that look climbable as boxes but are not (machinery, masts, shop furniture). */
const NO_TRAVERSE = new Set(['tankstand', 'mast', 'relay', 'toolcabinet', 'shelf', 'booth', 'kiosk', 'umbrella', 'market']);
/** A box's traversal rule: its explicit flag, or a default from its kind. Buildings, shells, fences and the flyover are never traversable. */
export function traversal(b: Box): Traverse {
  if (b.traverse) return b.traverse;
  if (b.kind === 'ladder') return 'climb';
  if (b.style && NO_TRAVERSE.has(b.style)) return 'none';
  if (b.kind === 'rail' || b.style === 'okada') return 'vault';
  return b.kind === 'cover' || b.kind === 'prop' || b.kind === 'vehicle' || b.kind === 'bus' || b.kind === 'wall' ? 'auto' : 'none';
}
/** Distances along a horizontal ray at which the body's footprint enters and leaves a box (slab test on the footprint grown by the body radius). */
function slab(x: number, z: number, dx: number, dz: number, box: Box): [number, number] | null {
  let near = -Infinity, far = Infinity;
  for (const [o, d, c, half] of [[x, dx, box.x, box.w / 2 + RULES.radius], [z, dz, box.z, box.d / 2 + RULES.radius]]) {
    if (Math.abs(d) < epsilon) { if (Math.abs(o - c) >= half) return null; continue; }
    let a = (c - half - o) / d, b = (c + half - o) / d; if (a > b) [a, b] = [b, a];
    near = Math.max(near, a); far = Math.min(far, b); if (near > far) return null;
  }
  return [near, far];
}
interface Ledge { box: Box; enter: number; exit: number; top: number }
/** Nearest box of an accepted traversal kind that the body would walk into along (dx, dz), within `reach` metres of contact, blocking it between knee and chest. */
function probe(p: Motion, dx: number, dz: number, reach: number, world: Box[], accept: (t: Traverse) => boolean): Ledge | undefined {
  let best: Ledge | undefined;
  for (const box of world) {
    const top = box.y + box.h / 2;
    if (top <= p.y + RULES.stepHeight || box.y - box.h / 2 > p.y + 0.9 || !accept(traversal(box))) continue;
    const hit = slab(p.x, p.z, dx, dz, box); if (!hit || hit[0] < -0.05 || hit[0] > reach || (best && hit[0] >= best.enter)) continue;
    best = { box, enter: hit[0], exit: hit[1], top };
  }
  return best;
}
function inBounds(x: number, z: number, world: Box[]) { const b = WORLD_BOUNDS.get(world); return !b || (Math.abs(x) < b.halfX - 0.4 && Math.abs(z) < b.halfZ - 0.4); }
export interface TraversePlan { kind: 1 | 2; to: Vec3; top: number; crouched: boolean }
/**
 * Works out whether the body can vault over or mantle onto what is ahead. Vaults need a
 * low, thin obstacle with a clear landing beyond; mantles need a ledge no higher than
 * RULES.mantleHeight above the floor being stood on, with room to stand on top and
 * headroom to pull up. `climbing` lifts the floor limit at the top of a ladder.
 */
export function planTraverse(p: Motion, dx: number, dz: number, world: Box[] = WORLD, climbing = false, reach = 0.55): TraversePlan | undefined {
  const length = Math.hypot(dx, dz); if (length < epsilon) return; dx /= length; dz /= length;
  const ledge = probe(p, dx, dz, reach, world, t => t === 'auto' || t === 'vault'); if (!ledge) return;
  const rule = traversal(ledge.box), rise = ledge.top - p.y, depth = ledge.exit - ledge.enter - RULES.radius * 2, lift = ledge.top + 0.04;
  const along = (k: number, y: number, crouched: boolean) => ({ x: p.x + dx * k, y, z: p.z + dz * k, crouched });
  if (rise <= RULES.vaultHeight && depth <= RULES.vaultDepth) {
    const k = ledge.exit + 0.12, land = along(k, 0, false); land.y = groundHeight(land.x, land.z, ledge.top + 0.01, world);
    if (Number.isFinite(land.y) && ledge.top - land.y < 4.5 && inBounds(land.x, land.z, world) && clearPosition(land, world)
      && [0, (ledge.enter + ledge.exit) / 2, k].every(d => clearPosition(along(d, lift, true), world))) return { kind: MOVE.vault, to: { x: land.x, y: land.y, z: land.z }, top: ledge.top, crouched: false };
  }
  if (rule !== 'auto' || depth < 0.55 || rise > RULES.mantleHeight) return;
  if (!climbing && ledge.top - groundHeight(p.x, p.z, p.y + 0.05, world) > RULES.mantleHeight) return;
  const k = Math.min(ledge.enter + RULES.radius * 2 + 0.05, (ledge.enter + ledge.exit) / 2), at = along(k, ledge.top, false);
  if (!inBounds(at.x, at.z, world) || !clearPosition(along(0, ledge.top + 0.02, true), world)) return;
  if (!clearPosition(at, world)) { at.crouched = true; if (!clearPosition(at, world)) return; }
  return { kind: MOVE.mantle, to: { x: at.x, y: at.y, z: at.z }, top: ledge.top, crouched: at.crouched };
}
function begin(p: Motion, kind: number, to: Vec3, top: number) {
  Object.assign(p, { traverse: kind, traverseT: 0, fromX: p.x, fromY: p.y, fromZ: p.z, toX: to.x, toY: to.y, toZ: to.z, ledgeY: top, grounded: false, vy: 0 });
}
/** The ladder or drainpipe directly ahead, with the standing point in front of it and its outward normal. */
function ladderAhead(p: Motion, dx: number, dz: number, world: Box[]) {
  const length = Math.hypot(dx, dz); if (length < epsilon) return;
  const ladder = probe(p, dx / length, dz / length, 0.3, world, t => t === 'climb'); if (!ladder) return;
  const b = ladder.box, alongX = b.w >= b.d, nx = alongX ? 0 : Math.sign(p.x - b.x) || 1, nz = alongX ? Math.sign(p.z - b.z) || 1 : 0;
  if (-(nx * dx + nz * dz) / length < 0.6 || p.y > ladder.top - 1.2) return;
  const gap = RULES.radius + 0.02, at = { x: alongX ? b.x : b.x + nx * (b.w / 2 + gap), z: alongX ? b.z + nz * (b.d / 2 + gap) : b.z };
  return { at, nx, nz, top: ladder.top };
}
const easeOut = (t: number) => 1 - (1 - t) * (1 - t), easeIn = (t: number) => t * t, smooth = (t: number) => t * t * (3 - 2 * t);
/** One step of a vault, mantle or climb. Input steers only the look; the body follows its scripted path. */
function traverseStep(p: Motion, input: InputFrame, dt: number, world: Box[]) {
  if (p.traverse === MOVE.climb) {
    const up = Math.max(-1, Math.min(1, input.z)), nx = p.fromX, nz = p.fromZ;
    p.vx = 0; p.vz = 0; p.vy = up * RULES.climbSpeed; p.traverseT += dt;
    if (input.jump) { Object.assign(p, { traverse: MOVE.none, vx: nx * 3.2, vz: nz * 3.2, vy: 3.6, grounded: false }); return; }
    const y = p.y + p.vy * dt, floor = groundHeight(p.x, p.z, p.y + 0.05, world);
    if (clearPosition({ x: p.x, y, z: p.z, crouched: p.crouched }, world)) p.y = y; else p.vy = 0;
    if (p.y <= floor + epsilon) { p.y = floor; if (up < 0) { p.traverse = MOVE.none; p.grounded = true; } }
    const cap = p.ledgeY - 1.15;
    if (p.y >= cap - epsilon && up > 0) {
      p.y = Math.min(p.y, cap); const plan = planTraverse(p, -nx, -nz, world, true, 0.35);
      if (plan) { begin(p, plan.kind, plan.to, plan.top); p.crouched = plan.crouched; }
    } else p.y = Math.min(p.y, cap);
    return;
  }
  p.traverseT += dt;
  const mantle = p.traverse === MOVE.mantle, total = mantle ? 0.32 + 0.16 * Math.max(0, p.ledgeY - p.fromY) : RULES.vaultTime, s = Math.min(1, p.traverseT / total);
  const lift = p.ledgeY + (mantle ? 0.02 : 0.05), before = { x: p.x, y: p.y, z: p.z };
  const across = mantle ? (s < 0.45 ? 0 : smooth((s - 0.45) / 0.55)) : smooth(s);
  p.x = p.fromX + (p.toX - p.fromX) * across; p.z = p.fromZ + (p.toZ - p.fromZ) * across;
  p.y = mantle ? (s < 0.6 ? p.fromY + (lift - p.fromY) * easeOut(s / 0.6) : lift + (p.toY - lift) * (s - 0.6) / 0.4)
    : s < 0.4 ? p.fromY + (lift - p.fromY) * easeOut(s / 0.4) : s < 0.7 ? lift : lift + (p.toY - lift) * easeIn((s - 0.7) / 0.3);
  p.vx = (p.x - before.x) / dt; p.vy = (p.y - before.y) / dt; p.vz = (p.z - before.z) / dt; p.grounded = false;
  if (s < 1) return;
  // Leave a vault with walking momentum along the move; a mantle ends standing still on the ledge.
  const dx = p.toX - p.fromX, dz = p.toZ - p.fromZ, l = Math.hypot(dx, dz) || 1, exit = mantle ? 0 : RULES.walk * 1.05;
  Object.assign(p, { x: p.toX, y: p.toY, z: p.toZ, vx: dx / l * exit, vy: 0, vz: dz / l * exit, grounded: true, traverse: MOVE.none });
}
/** Progress 0..1 through the current vault, mantle or slide (climbs loop), for presentation. */
export function traverseProgress(p: Motion) {
  if (p.traverse === MOVE.vault) return Math.min(1, p.traverseT / RULES.vaultTime);
  if (p.traverse === MOVE.mantle) return Math.min(1, p.traverseT / (0.32 + 0.16 * Math.max(0, p.ledgeY - p.fromY)));
  if (p.traverse === MOVE.slide) return Math.min(1, p.traverseT / RULES.slideTime);
  return 0;
}
/** What traversal the body would start from here if the player pressed jump: drives the HUD hint. */
export function traverseHint(p: Motion, yaw: number, world: Box[] = WORLD): 'vault' | 'mantle' | 'climb' | undefined {
  if (p.traverse || !p.grounded) return;
  const dx = Math.sin(yaw), dz = Math.cos(yaw);
  if (ladderAhead(p, dx, dz, world)) return 'climb';
  const plan = planTraverse(p, dx, dz, world); return plan ? (plan.kind === MOVE.vault ? 'vault' : 'mantle') : undefined;
}
export function movePlayer(p: Motion & { aiming?: boolean }, input: InputFrame, dt = RULES.dt, world = WORLD, pace = 1) {
  p.yaw = input.yaw; p.pitch = input.pitch;
  if (p.traverse && p.traverse !== MOVE.slide) { p.aiming = false; traverseStep(p, input, dt, world); return; }
  let wx = input.x * Math.cos(p.yaw) + input.z * Math.sin(p.yaw), wz = input.z * Math.cos(p.yaw) - input.x * Math.sin(p.yaw);
  const wish = Math.hypot(wx, wz); if (wish > 1) { wx /= wish; wz /= wish; }
  // Jump into an obstacle to vault or mantle it; moving into a ladder grabs it; in the air,
  // pushing forward into a ledge you can reach pulls you up onto it.
  if (wish > 0.5) {
    const ladder = ladderAhead(p, wx, wz, world);
    if (ladder && input.z > 0.3) { Object.assign(p, { traverse: MOVE.climb, traverseT: 0, x: ladder.at.x, z: ladder.at.z, fromX: ladder.nx, fromY: p.y, fromZ: ladder.nz, ledgeY: ladder.top, vx: 0, vy: 0, vz: 0, grounded: false, crouched: false }); return; }
    const forward = (wx * Math.sin(p.yaw) + wz * Math.cos(p.yaw)) / Math.min(1, wish) > 0.3;
    const plan = (input.jump && p.grounded) || (!p.grounded && forward && !p.traverse) ? planTraverse(p, wx, wz, world, false, p.grounded ? 0.55 : 0.35) : undefined;
    if (plan) { const from = p.crouched; begin(p, plan.kind, plan.to, plan.top); p.crouched = plan.crouched || (from && !clearPosition({ ...plan.to, crouched: false }, world)); p.aiming = false; return; }
  }
  // Slide: crouch while sprinting at speed. The body drops to crouch height and carries its momentum, slowing down.
  const speedNow = Math.hypot(p.vx, p.vz);
  if (!p.traverse && p.grounded && input.crouch && !p.crouched && input.sprint && input.z > 0 && !input.aim && !input.fire && speedNow > RULES.walk + 0.6) {
    const boost = Math.max(speedNow, RULES.slideSpeed) / speedNow; p.vx *= boost; p.vz *= boost; p.crouched = true; p.traverse = MOVE.slide; p.traverseT = 0;
  }
  if (p.traverse === MOVE.slide) {
    p.traverseT += dt; p.crouched = true;
    if (input.jump || !input.crouch || p.traverseT >= RULES.slideTime || speedNow < 3.2) p.traverse = MOVE.none;
    else {
      const drag = Math.exp(-RULES.slideDrag * dt); p.vx *= drag; p.vz *= drag;
      for (let step = 0; step < 2; step++) { const footing = p.grounded; p.vy -= RULES.gravity * dt / 2; p.grounded = false; moveHorizontal(p, 'x', p.vx * dt / 2, world, footing); moveHorizontal(p, 'z', p.vz * dt / 2, world, footing); moveVertical(p, p.vy * dt / 2, world); }
      if (!p.grounded) p.traverse = MOVE.none;
      p.aiming = false; return;
    }
  }
  if (input.crouch) p.crouched = true;
  else if (p.crouched && clearPosition({ x: p.x, y: p.y, z: p.z, crouched: false }, world)) p.crouched = false;
  p.aiming = !!input.aim;
  let ix = input.x, iz = input.z; const length = Math.hypot(ix, iz); if (length > 1) { ix /= length; iz /= length; }
  const sprinting = input.sprint && !input.fire && !input.aim && !p.crouched && iz > 0;
  const speed = (p.crouched ? RULES.crouchSpeed : input.aim ? RULES.aimSpeed : sprinting ? RULES.sprint : RULES.walk) * pace;
  const targetX = (ix * Math.cos(p.yaw) + iz * Math.sin(p.yaw)) * speed;
  const targetZ = (iz * Math.cos(p.yaw) - ix * Math.sin(p.yaw)) * speed;
  if (input.jump && p.grounded) {
    if (p.crouched && clearPosition({ x: p.x, y: p.y, z: p.z, crouched: false }, world)) p.crouched = false;
    if (!p.crouched) { p.vy = RULES.jump; p.grounded = false; }
  }
  for (let step = 0; step < 2; step++) {
    const delta = dt / 2, footing = p.grounded, control = footing ? 1 : RULES.airControl;
    p.vx = approach(p.vx, targetX, RULES.acceleration * control * delta, RULES.deceleration * control * delta);
    p.vz = approach(p.vz, targetZ, RULES.acceleration * control * delta, RULES.deceleration * control * delta);
    p.vy -= RULES.gravity * delta; p.grounded = false;
    moveHorizontal(p, 'x', p.vx * delta, world, footing); moveHorizontal(p, 'z', p.vz * delta, world, footing); moveVertical(p, p.vy * delta, world);
  }
}
export function rayBox(origin: Vec3, direction: Vec3, min: Vec3, max: Vec3, range = Infinity): number | null {
  let near = 0, far = range;
  for (const axis of ['x', 'y', 'z'] as const) {
    if (Math.abs(direction[axis]) < epsilon) { if (origin[axis] < min[axis] || origin[axis] > max[axis]) return null; }
    else {
      let a = (min[axis] - origin[axis]) / direction[axis], b = (max[axis] - origin[axis]) / direction[axis];
      if (a > b) [a, b] = [b, a]; near = Math.max(near, a); far = Math.min(far, b); if (near > far) return null;
    }
  }
  return near <= range ? near : null;
}
export function worldRay(origin: Vec3, direction: Vec3, range: number, world = WORLD): number {
  let nearest = range;
  for (const box of world) { const { min, max } = bounds(box); const hit = rayBox(origin, direction, min, max, nearest); if (hit !== null) nearest = hit; }
  return nearest;
}
/** Nearest world hit with the box that was struck, for impact presentation. */
export function worldRayHit(origin: Vec3, direction: Vec3, range: number, world = WORLD): { distance: number; box?: Box } {
  let nearest = range, struck: Box | undefined;
  for (const box of world) { const { min, max } = bounds(box); const hit = rayBox(origin, direction, min, max, nearest); if (hit !== null && hit < nearest) { nearest = hit; struck = box; } }
  return { distance: nearest, box: struck };
}
/** True when nothing in the world blocks the segment between two points. */
export function lineOfSight(a: Vec3, b: Vec3, world = WORLD) {
  const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z, distance = Math.hypot(dx, dy, dz);
  if (distance < 0.001) return true;
  return worldRay(a, { x: dx / distance, y: dy / distance, z: dz / distance }, distance, world) >= distance - 0.01;
}
/** Highest walkable surface at or below `maxY` under a point, used by navigation and spawns. */
export function groundHeight(x: number, z: number, maxY = 0.6, world = WORLD) {
  let top = -Infinity;
  for (const box of world) {
    if (Math.abs(x - box.x) > box.w / 2 || Math.abs(z - box.z) > box.d / 2) continue;
    const surface = box.y + box.h / 2; if (surface <= maxY + epsilon && surface > top) top = surface;
  }
  return top;
}
export function aim(yaw: number, pitch: number): Vec3 { return { x: Math.sin(yaw) * Math.cos(pitch), y: Math.sin(pitch), z: Math.cos(yaw) * Math.cos(pitch) }; }
