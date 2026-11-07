import { RULES, WEAPONS, type WeaponId } from '../config.js';
import { MOVE, eyeHeight, lineOfSight, localMove, planTraverse } from '../physics.js';
import { neutral, type GameEvent, type InputFrame, type Player } from '../protocol.js';
import type { Vec3 } from '../world.js';
import type { NavGrid } from './nav.js';
export type Difficulty = 'easy' | 'normal' | 'hard';
/** Every tunable that difficulty changes, in one place. */
export interface Tuning {
  reaction: number; aimError: number; settledError: number; damage: number; health: number; burst: [number, number]; pause: [number, number]; turn: number; flank: number; sight: number; awareness: number;
  /** Share of each encounter that actually spawns, so lower difficulties face fewer enemies. */
  roster: number;
  /** Seconds an agent waits after losing sight before it moves in to look; low values push straight at the player. */
  patience: number;
  /** Rushers stop closing at this distance instead of running into the player's face. */
  rush: number;
  /** Cutlass damage per strike before the damage multiplier, and seconds between strikes. */
  slash: number; slashEvery: number;
  /** Player health regeneration: seconds without damage before it starts, then health per second. */
  regenDelay: number; regenRate: number;
}
export const DIFFICULTY: Record<Difficulty, Tuning> = {
  easy: { reaction: 1.1, aimError: 0.22, settledError: 0.11, damage: 0.25, health: 45, burst: [2, 3], pause: [1.2, 2], turn: 3, flank: 0.05, sight: 30, awareness: 0.55, roster: 0.5, patience: 7, rush: 14, slash: 14, slashEvery: 1.3, regenDelay: 2.5, regenRate: 45 },
  normal: { reaction: 0.85, aimError: 0.17, settledError: 0.075, damage: 0.35, health: 60, burst: [2, 4], pause: [0.9, 1.6], turn: 4.2, flank: 0.2, sight: 36, awareness: 0.75, roster: 0.75, patience: 4.5, rush: 10, slash: 22, slashEvery: 1.1, regenDelay: 4, regenRate: 30 },
  hard: { reaction: 0.5, aimError: 0.11, settledError: 0.045, damage: 0.6, health: 85, burst: [3, 5], pause: [0.6, 1.1], turn: 6, flank: 0.45, sight: 46, awareness: 1.1, roster: 1, patience: 2.5, rush: 7, slash: 32, slashEvery: 0.9, regenDelay: 5, regenRate: 25 }
};
export type Role = 'guard' | 'patrol' | 'holder' | 'rusher' | 'flanker' | 'dummy' | 'bot';
/** `melee` agents carry a cutlass instead of firing: they close in on foot and strike at arm's length. `chase` agents run flat out at their target instead of slowing as they close. */
export interface AgentDef { id: string; at: Vec3; yaw: number; weapon?: WeaponId; role: Role; patrol?: Vec3[]; alert?: Vec3; name?: string; melee?: boolean; chase?: boolean }
/**
 * Rules for missions that hunt the player rather than fight them. `sight` and `awareness` multiply how far an agent sees and how
 * fast it notices; `shout` is how far its call carries in metres; `grace` is the seconds at the start of a session when nobody
 * can notice anyone; `windup` is how long a hunter stops and shouts before charging, so being seen is a warning and not a
 * sentence; `lose` and `search` are the seconds out of sight before it gives up the chase and how long it then looks around.
 */
export interface Senses { sight: number; awareness: number; shout?: number; grace?: number; windup?: number; lose?: number; search?: number }
export type AgentState = 'idle' | 'patrol' | 'suspicious' | 'investigate' | 'engage' | 'cover' | 'flank' | 'reload' | 'search';
const rand = (seed: { v: number }) => { seed.v = (seed.v * 16807) % 2147483647; return seed.v / 2147483647; };
const wrap = (a: number) => { while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2; return a; };
/**
 * Enemy brain. It only ever produces an InputFrame for the shared simulation,
 * so enemies obey exactly the same movement, weapon and collision rules as the
 * player. Perception uses real line of sight; there is no wall knowledge.
 */
export class Agent {
  state: AgentState; awareness = 0; lastSeen?: Vec3; lastSeenAt = -99; seesTarget = false; group = '';
  /** Set on a tick when a cutlass agent is close enough and facing its target; the session turns it into a strike. */
  strike = false;
  /** True while a hunter has seen its target and is shouting, before it charges. */
  windingUp = false;
  private chargeAt = 0; private arrivedAt = -1;
  private seq = 0; private path: Vec3[] = []; private goal?: Vec3; private repathAt = 0; private patrolIndex = 0; private stateAt = 0;
  private aimYaw: number; private aimPitch = 0; private errYaw = 0; private errPitch = 0; private acquiredAt = -1; private burstLeft = 0; private nextBurst = 0;
  private strafe = 1; private strafeAt = 0; private stuckAt = 0; private stuckFrom: Vec3 = { x: 0, y: 0, z: 0 }; private failures = 0; private peekAt = 0; private crouching = false;
  private rng: { v: number };
  constructor(readonly def: AgentDef, readonly player: Player, private nav: NavGrid, readonly level: Difficulty, private senses: Senses = { sight: 1, awareness: 1 }) {
    this.state = def.role === 'patrol' ? 'patrol' : 'idle'; this.aimYaw = def.yaw; this.rng = { v: [...def.id].reduce((a, c) => a * 31 + c.charCodeAt(0), 17) % 2147483646 + 1 };
    if (def.alert) { this.lastSeen = def.alert; this.state = 'investigate'; this.awareness = 0.6; this.goal = def.alert; }
  }
  get tuning() { return DIFFICULTY[this.level]; }
  private set(state: AgentState, now: number) { if (this.state !== state) { this.state = state; this.stateAt = now; this.path = []; this.repathAt = 0; } }
  /** A heard gunshot or an ally's shout: become suspicious and go look, never instantly aware of the exact position. */
  alert(at: Vec3, now: number, certain = false) {
    if (this.def.role === 'dummy') return;
    this.lastSeen = { x: at.x + (certain ? 0 : (rand(this.rng) - 0.5) * 6), y: at.y, z: at.z + (certain ? 0 : (rand(this.rng) - 0.5) * 6) }; this.lastSeenAt = Math.max(this.lastSeenAt, now - 1);
    this.awareness = Math.max(this.awareness, certain ? 0.8 : 0.5);
    if (this.state === 'idle' || this.state === 'patrol' || this.state === 'search' || this.state === 'suspicious') this.set(this.def.role === 'holder' ? 'suspicious' : 'investigate', now);
  }
  hear(event: GameEvent, shooter: Player | undefined, now: number) {
    if (event.type !== 'shot' || !shooter || shooter.team === this.player.team) return;
    if (Math.hypot(shooter.x - this.player.x, shooter.z - this.player.z) < 38) this.alert(shooter, now);
    if (event.end && Math.hypot(event.end.x - this.player.x, event.end.z - this.player.z) < 3) this.alert(shooter, now, true);
  }
  damaged(by: Player | undefined, now: number) { if (by) { this.alert(by, now, true); this.awareness = 1; } if (this.state !== 'cover' && this.player.health < 55 && this.def.role !== 'holder' && this.def.role !== 'rusher' && !this.def.melee) this.set('cover', now); }
  private perceive(target: Player | undefined, now: number, dt: number) {
    this.seesTarget = false; if (!target || target.health <= 0 || this.def.role === 'dummy' || now < (this.senses.grace ?? 0)) return;
    const me = this.player, dx = target.x - me.x, dz = target.z - me.z, distance = Math.hypot(dx, dz), t = this.tuning;
    const facing = Math.abs(wrap(Math.atan2(dx, dz) - me.yaw)), engaged = this.awareness >= 1;
    const range = t.sight * this.senses.sight * (target.crouched ? 0.75 : 1) * (Math.hypot(target.vx, target.vz) > 6 ? 1.15 : 1);
    if (distance > range || (facing > (engaged ? 1.9 : 1.05) && distance > 4)) return;
    const eye = { x: me.x, y: me.y + eyeHeight(me), z: me.z }, chest = { x: target.x, y: target.y + eyeHeight(target) - 0.25, z: target.z }, head = { x: target.x, y: target.y + eyeHeight(target), z: target.z };
    if (!lineOfSight(eye, chest, this.nav.world) && !lineOfSight(eye, head, this.nav.world)) return;
    this.seesTarget = true; this.lastSeen = { x: target.x, y: target.y, z: target.z }; this.lastSeenAt = now;
    // Awareness builds faster up close and against a moving target; at full awareness the agent engages.
    this.awareness = Math.min(1, this.awareness + dt * t.awareness * this.senses.awareness * (2.4 - distance / range * 1.8) * (target.crouched ? 0.6 : 1));
  }
  think(target: Player | undefined, allies: Agent[], now: number, dt: number): InputFrame {
    const me = this.player, frame = neutral(++this.seq, me.life, 0), t = this.tuning;
    frame.yaw = me.yaw; frame.pitch = me.pitch;
    if (me.health <= 0) return frame;
    this.perceive(target, now, dt);
    if (this.seesTarget && this.awareness >= 1) {
      if (this.acquiredAt < 0) { this.acquiredAt = now; this.errYaw = (rand(this.rng) - 0.5) * 2 * t.aimError; this.errPitch = (rand(this.rng) - 0.3) * t.aimError; }
      // Shout to nearby allies who cannot see the target yet.
      for (const ally of allies) if (ally !== this && ally.awareness < 1 && Math.hypot(ally.player.x - me.x, ally.player.z - me.z) < (this.senses.shout ?? 22)) ally.alert(this.lastSeen!, now);
      if (['idle', 'patrol', 'suspicious', 'investigate', 'search'].includes(this.state)) { this.set(this.def.role === 'flanker' && !this.def.melee && rand(this.rng) < t.flank * 2 ? 'flank' : 'engage', now); if (this.def.chase) this.chargeAt = now + (this.senses.windup ?? 0); }
    } else if (this.acquiredAt >= 0 && now - this.lastSeenAt > 0.4) this.acquiredAt = -1;
    if (!this.seesTarget && this.awareness < 1 && this.awareness > 0) this.awareness = Math.max(0, this.awareness - dt * 0.12);
    if (!this.seesTarget && (this.state === 'engage' || this.state === 'flank') && now - this.lastSeenAt > (this.senses.lose ?? t.patience + 2)) this.set(this.def.role === 'holder' ? 'suspicious' : 'investigate', now);
    this.windingUp = this.state === 'engage' && now < this.chargeAt;
    const gun = me.guns[me.weapon], def = WEAPONS[me.weapon];
    if (gun.ammo === 0 && gun.reserve > 0 && !me.reloadUntil) { frame.reload = true; if (this.state === 'engage' && this.def.role !== 'holder' && this.def.role !== 'rusher' && !this.def.melee) this.set('cover', now); }
    if (gun.reserve === 0 && gun.ammo === 0) gun.reserve = def.magazine * 3; // Agents carry enough to stay a threat.
    let move: Vec3 | undefined, look: Vec3 | undefined, crouch = this.def.role === 'holder' && !this.seesTarget;
    switch (this.state) {
      case 'idle': if (this.def.role === 'bot') this.set('search', now); break;
      case 'patrol': {
        const route = this.def.patrol ?? [this.def.at]; const point = route[this.patrolIndex % route.length];
        // Every stop lasts the same, so a route has a rhythm the player can learn.
        if (Math.hypot(point.x - me.x, point.z - me.z) < 0.8) { if (this.arrivedAt < 0) this.arrivedAt = now; if (now - this.arrivedAt > 2.5) { this.patrolIndex++; this.arrivedAt = -1; } }
        else move = point;
        frame.sprint = false; break;
      }
      case 'suspicious': look = this.lastSeen; if (now - this.stateAt > 4) this.set(this.def.role === 'holder' ? 'idle' : 'investigate', now); break;
      case 'investigate':
        move = this.lastSeen; look = this.lastSeen;
        if (!this.lastSeen || Math.hypot(this.lastSeen.x - me.x, this.lastSeen.z - me.z) < 1.5 || now - this.stateAt > 12) this.set('search', now); break;
      case 'search':
        if (this.def.role === 'bot') {
          // Bots roam between random open spots until they actually see or hear someone; no positional cheating.
          if (!this.goal || Math.hypot(this.goal.x - me.x, this.goal.z - me.z) < 1.5 || now - this.repathAt > 10) { this.goal = this.nav.nearest((rand(this.rng) - 0.5) * 70, (rand(this.rng) - 0.5) * 56, 6) ?? undefined; this.repathAt = now; }
          move = this.lastSeen && now - this.lastSeenAt < 6 ? this.lastSeen : this.goal; break;
        }
        frame.yaw = me.yaw + dt * 1.2 * this.strafe;
        if (now - this.stateAt > (this.senses.search ?? 7)) { this.awareness = 0.3; this.set(this.def.patrol ? 'patrol' : 'idle', now); move = this.def.at; }
        break;
      case 'engage': {
        look = this.lastSeen;
        const distance = this.lastSeen ? Math.hypot(this.lastSeen.x - me.x, this.lastSeen.z - me.z) : 0;
        // Cutlass carriers stop at arm's length rather than walking into the player.
        if (this.windingUp) move = undefined;
        else if (this.def.melee) { move = distance > 1.35 ? this.lastSeen : undefined; frame.sprint = !!this.def.chase || distance > 6 && distance < 16 && this.level !== 'easy'; }
        else if (this.def.role === 'rusher' && distance > t.rush) move = this.lastSeen;
        else if (this.def.role !== 'holder' && this.def.role !== 'guard' || distance < 4) {
          if (now > this.strafeAt) { this.strafe = rand(this.rng) < 0.5 ? -1 : 1; this.strafeAt = now + 0.7 + rand(this.rng) * 1.1; }
          if (this.lastSeen) { const dx = this.lastSeen.x - me.x, dz = this.lastSeen.z - me.z, l = Math.hypot(dx, dz) || 1; const side = { x: me.x - dz / l * this.strafe * 2, y: 0, z: me.z + dx / l * this.strafe * 2 }; if (this.nav.open(side.x, side.z)) move = side; }
        }
        if (this.def.role === 'guard' && this.crouching === false && rand(this.rng) < dt * 0.15) this.crouching = true;
        crouch = this.crouching && this.def.role === 'guard';
        if (!this.seesTarget && !this.def.melee) { if (now - this.lastSeenAt > t.patience && this.def.role !== 'holder') move = this.lastSeen; else { move = undefined; crouch = this.def.role !== 'rusher'; } }
        break;
      }
      case 'flank': {
        if (!this.goal || now > this.repathAt + 6) {
          const anchor = this.lastSeen ?? target; if (anchor) { const side = rand(this.rng) < 0.5 ? -1 : 1, a = Math.atan2(me.x - anchor.x, me.z - anchor.z) + side * 1.4; const p = this.nav.nearest(anchor.x + Math.sin(a) * 11, anchor.z + Math.cos(a) * 11, 5); this.goal = p ?? undefined; }
          this.repathAt = now;
        }
        move = this.goal; look = this.seesTarget ? this.lastSeen : this.goal; frame.sprint = !this.seesTarget;
        if (!this.goal || Math.hypot(this.goal.x - me.x, this.goal.z - me.z) < 1.2 || now - this.stateAt > 9) { this.goal = undefined; this.set('engage', now); }
        break;
      }
      case 'cover': case 'reload': {
        if (!this.goal || now - this.stateAt < dt * 1.5) this.goal = this.pickCover(target) ?? undefined;
        const there = this.goal && Math.hypot(this.goal.x - me.x, this.goal.z - me.z) < 0.7;
        if (this.goal && !there) { move = this.goal; frame.sprint = true; look = this.lastSeen; }
        else { crouch = true; look = this.lastSeen;
          if (now > this.peekAt && !me.reloadUntil && gun.ammo > def.magazine * 0.3 && (me.health > 40 || now - this.stateAt > 5)) { this.peekAt = now + 1.5 + rand(this.rng) * 2; this.goal = undefined; this.set('engage', now); }
        }
        if (now - this.stateAt > 10) { this.goal = undefined; this.set('engage', now); }
        break;
      }
    }
    if (this.def.role === 'holder' || this.def.role === 'dummy') move = undefined;
    // Movement: follow a grid path toward the goal and turn it into a stick direction relative to the aim.
    let heading: { x: number; z: number } | undefined;
    if (move) {
      const d = Math.hypot(move.x - me.x, move.z - me.z);
      if (d > 0.6) {
        const direct = this.nav.walkLine(me, move);
        if (!direct && (!this.path.length || now > this.repathAt)) { this.path = this.nav.path(me, move) ?? []; this.repathAt = now + 0.8; }
        let next = direct ? move : this.path[0];
        while (!direct && next && Math.hypot(next.x - me.x, next.z - me.z) < 0.55) { this.path.shift(); next = this.path[0]; }
        if (next) {
          const dx = next.x - me.x, dz = next.z - me.z, l = Math.hypot(dx, dz) || 1; heading = { x: dx / l, z: dz / l };
          if (!look) look = { x: me.x + dx, y: me.y + eyeHeight(me), z: me.z + dz };
        }
        // Stuck: little progress for a second means re-plan; repeated failures give up on the goal.
        if (now - this.stuckAt > 1) { if (Math.hypot(me.x - this.stuckFrom.x, me.z - this.stuckFrom.z) < 0.25) { this.path = []; this.repathAt = 0; if (++this.failures > 3) { this.goal = undefined; this.failures = 0; if (this.state === 'flank' || this.state === 'investigate') this.set('search', now); } } else this.failures = 0; this.stuckAt = now; this.stuckFrom = { x: me.x, y: 0, z: me.z }; }
      }
    }
    frame.crouch = crouch && !frame.sprint;
    // Aim: turn toward the target at a limited rate; error settles the longer the target is tracked.
    if (look) {
      const eye = me.y + eyeHeight(me), aimAt = this.seesTarget && target ? { x: target.x, y: target.y + eyeHeight(target) - (rand(this.rng) < 0.15 ? 0 : 0.3), z: target.z } : look;
      let yaw = Math.atan2(aimAt.x - me.x, aimAt.z - me.z), pitch = Math.atan2((aimAt.y ?? eye) - eye, Math.hypot(aimAt.x - me.x, aimAt.z - me.z) || 1);
      if (this.seesTarget) { const settle = Math.min(1, (now - this.acquiredAt) / 3.5); yaw += this.errYaw * (1 - settle) + (rand(this.rng) - 0.5) * t.settledError; pitch += this.errPitch * (1 - settle) + (rand(this.rng) - 0.5) * t.settledError * 0.6 - me.recoil * 0.7; }
      const turn = t.turn * dt; this.aimYaw += Math.max(-turn, Math.min(turn, wrap(yaw - this.aimYaw))); this.aimPitch += Math.max(-turn, Math.min(turn, pitch - this.aimPitch));
      frame.yaw = wrap(this.aimYaw); frame.pitch = Math.max(-1.2, Math.min(1.2, this.aimPitch));
    } else this.aimYaw = frame.yaw;
    // The stick is derived after aiming, so an agent can strafe or retreat while tracking its target.
    if (heading) { const stick = localMove(heading.x, heading.z, frame.yaw); frame.x = Math.max(-1, Math.min(1, stick.x)); frame.z = Math.max(-1, Math.min(1, stick.z)); }
    // Pinned against low cover on the way somewhere: vault it, using the same rules as the player.
    if (heading && me.grounded && !me.traverse && Math.hypot(me.vx, me.vz) < 0.6 && now - this.stateAt > 0.5 && planTraverse(me, heading.x, heading.z, this.nav.world)?.kind === MOVE.vault) frame.jump = true;
    // Fire control: only with a clear line, after the reaction delay, in designed bursts.
    const aligned = target && this.seesTarget && Math.abs(wrap(Math.atan2(target.x - me.x, target.z - me.z) - frame.yaw)) < 0.25;
    this.strike = !!(this.def.melee && target && aligned && !this.windingUp && this.awareness >= 1 && Math.hypot(target.x - me.x, target.z - me.z) < 1.9 && Math.abs(target.y - me.y) < 1);
    if (this.def.melee) { frame.fire = false; return frame; }
    if (aligned && this.awareness >= 1 && now - this.acquiredAt >= t.reaction && !me.reloadUntil && this.def.role !== 'dummy') {
      if (this.burstLeft <= 0 && now >= this.nextBurst) this.burstLeft = Math.round(t.burst[0] + rand(this.rng) * (t.burst[1] - t.burst[0]));
      if (this.burstLeft > 0) {
        frame.fire = def.automatic ? true : this.seq % Math.max(2, Math.round(def.interval * 2 / RULES.dt)) === 0;
        if (gun.nextShot <= now + RULES.dt && frame.fire) { this.burstLeft--; if (this.burstLeft <= 0) this.nextBurst = now + t.pause[0] + rand(this.rng) * (t.pause[1] - t.pause[0]); }
      }
    } else this.burstLeft = 0;
    if (frame.fire) frame.sprint = false;
    return frame;
  }
  /** Picks a nearby spot the target cannot see from where it stands, preferring half cover at fighting range. */
  private pickCover(target: Player | undefined) {
    const me = this.player, from = this.lastSeen ?? target; if (!from) return null;
    const eye = { x: from.x, y: (from.y ?? 0) + RULES.eye, z: from.z }; let best: Vec3 | null = null, score = -Infinity;
    for (const c of this.nav.cover) {
      const d = Math.hypot(c.x - me.x, c.z - me.z); if (d > 14) continue;
      const range = Math.hypot(c.x - from.x, c.z - from.z); if (range < 5) continue;
      if (lineOfSight(eye, { x: c.x, y: c.y + RULES.crouchEye, z: c.z }, this.nav.world)) continue;
      const peek = lineOfSight(eye, { x: c.x, y: c.y + RULES.eye + 0.1, z: c.z }, this.nav.world) ? 4 : 0;
      const value = peek - d * 0.6 - Math.abs(range - 14) * 0.25 + rand(this.rng);
      if (value > score) { score = value; best = c; }
    }
    return best;
  }
}
