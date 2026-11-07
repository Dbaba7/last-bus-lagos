import { type Phase, type Team, type WeaponId } from './config.js';
import { RULES } from './config.js';
import type { Vec3 } from './world.js';
export interface InputFrame {
  seq: number; life: number; round: number; x: number; z: number; yaw: number; pitch: number;
  sprint: boolean; fire: boolean; trigger: boolean; jump: boolean; reload: boolean; weapon: WeaponId | '';
  crouch: boolean; aim: boolean;
}
/**
 * Traversal in progress (see physics.ts): 0 none, 1 vault, 2 mantle, 3 climb, 4 slide.
 * A vault or mantle is a short scripted move from `from` to `to` over a ledge at `ledgeY`;
 * a climb keeps the ladder's outward normal in fromX/fromZ and its top in ledgeY.
 * It is part of the body state so the server and client prediction replay it identically.
 */
export interface Traversal { traverse: number; traverseT: number; fromX: number; fromY: number; fromZ: number; toX: number; toY: number; toZ: number; ledgeY: number }
export interface Motion extends Vec3, Traversal { vx: number; vy: number; vz: number; yaw: number; pitch: number; grounded: boolean; crouched: boolean }
/** A body that is not traversing anything. */
export const still = (): Traversal => ({ traverse: 0, traverseT: 0, fromX: 0, fromY: 0, fromZ: 0, toX: 0, toY: 0, toZ: 0, ledgeY: 0 });
export interface GunState { ammo: number; reserve: number; nextShot: number }
export interface Player extends Motion {
  id: string; name: string; team: Team; connected: boolean; ready: boolean; life: number; health: number;
  kills: number; deaths: number; weapon: WeaponId; guns: Record<WeaponId, GunState>;
  reloadUntil: number; equipUntil: number; respawnAt: number; protectedUntil: number;
  /** Designed recoil offsets applied to the aim (radians) and the index inside the current spray. */
  recoil: number; recoilYaw: number; burst: number; shots: number; aiming: boolean;
  ack: number; ping: number; joined: number;
}
export interface Snapshot {
  tick: number; now: number; round: number; phase: Phase; deadline: number; score0: number; score1: number;
  host: string; private: boolean; winner: string; players: Player[]; results: ResultRow[];
  duration: number; killLimit: number;
}
export interface ResultRow { id: string; name: string; team: Team; kills: number; deaths: number }
export interface GameEvent {
  id: number; type: 'shot' | 'hit' | 'kill' | 'respawn' | 'phase' | 'reload' | 'melee';
  player: string; target?: string; weapon?: WeaponId; position?: Vec3; end?: Vec3; round: number; seq?: number; life?: number;
  /** Hit details: whether the head region was struck and the damage applied. */
  head?: boolean; amount?: number;
  /** Set on hits and kills dealt with a cutlass (solo modes only). */
  melee?: boolean;
}
export function neutral(seq = 0, life = 1, round = 0): InputFrame {
  return { seq, life, round, x: 0, z: 0, yaw: 0, pitch: 0, sprint: false, fire: false, trigger: false, jump: false, reload: false, weapon: '', crouch: false, aim: false };
}
const inputKeys = ['seq', 'life', 'round', 'x', 'z', 'yaw', 'pitch', 'sprint', 'fire', 'trigger', 'jump', 'reload', 'weapon', 'crouch', 'aim'];
export function parseInput(raw: unknown): InputFrame | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const v = raw as Record<string, unknown>;
  if (Object.keys(v).some(key => !inputKeys.includes(key))) return null;
  for (const key of ['seq', 'life', 'round', 'x', 'z', 'yaw', 'pitch']) if (typeof v[key] !== 'number' || !Number.isFinite(v[key])) return null;
  for (const key of ['seq', 'life', 'round']) if (!Number.isSafeInteger(v[key]) || Number(v[key]) < 0) return null;
  for (const key of ['sprint', 'fire', 'trigger', 'jump', 'reload']) if (typeof v[key] !== 'boolean') return null;
  // Older test drivers omit the two newer flags; treat absence as released.
  for (const key of ['crouch', 'aim']) { if (v[key] === undefined) v[key] = false; else if (typeof v[key] !== 'boolean') return null; }
  if (!['', 'rifle', 'sidearm'].includes(String(v.weapon))) return null;
  if (Math.abs(Number(v.x)) > 1 || Math.abs(Number(v.z)) > 1 || Math.abs(Number(v.pitch)) > 1.5 || Math.abs(Number(v.yaw)) > Math.PI * 2) return null;
  return v as unknown as InputFrame;
}
export function nickname(raw: unknown): string {
  if (typeof raw !== 'string') return 'Passenger';
  return raw.replace(/[\p{Cc}\p{Cf}<>]/gu, '').trim().slice(0, 20) || 'Passenger';
}
export const TICK_MS = 1000 / RULES.tickRate;
