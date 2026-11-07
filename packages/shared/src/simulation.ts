import { MATCH_OPTIONS, RULES, TEAMS, WEAPONS, type Phase, type Team } from './config.js';
import { aim, bodyBounds, bodyHeight, clearPosition, eyeHeight, movePlayer, rayBox, worldRay } from './physics.js';
import { neutral, nickname, still, type GameEvent, type InputFrame, type Player, type ResultRow, type Snapshot } from './protocol.js';
import { loadout, advanceWeapon, applyRecoil, damageAt, spreadOffset } from './weapons.js';
import { SPAWNS, WORLD, type Box, type Vec3 } from './world.js';
export interface GameOptions {
  private?: boolean; practice?: boolean; duration?: number; killLimit?: number; countdown?: number; results?: number;
  /** Solo campaign: always active, no automatic respawn, no score limit, larger roster and health regeneration. */
  story?: boolean; capacity?: number;
  /** Story health regeneration for the player: delay after the last hit, then health per second. */
  regenDelay?: number; regenRate?: number;
}
export class Simulation {
  players = new Map<string, Player>();
  now = 0; tick = 0; round = 0; phase: Phase = 'WAITING'; deadline = 0; host = ''; winner = '';
  score0 = 0; score1 = 0; results: ResultRow[] = []; events: GameEvent[] = [];
  readonly options: Required<GameOptions>;
  /** Per-shooter damage multiplier. Only local solo modes use it, for difficulty. */
  readonly damageScale = new Map<string, number>();
  /** Movement speed per body, for story chases (a hurt civilian, hunters a little faster than him). Multiplayer never sets it. */
  readonly paceScale = new Map<string, number>();
  /** Collision world for movement and shots. Solo story sessions swap it (another map, or a vehicle that has driven off); the server always uses the arena. */
  world: Box[] = WORLD;
  private eventId = 0; private absentSince = -1; private heldFire = new Map<string, boolean>();
  private departed = new Map<string, ResultRow>(); private lastDamage = new Map<string, number>(); private meleeReady = new Map<string, number>();
  constructor(options: GameOptions = {}) {
    this.options = { private: options.private ?? false, practice: options.practice ?? false, duration: options.duration ?? RULES.duration, killLimit: options.killLimit ?? RULES.killLimit, countdown: options.countdown ?? RULES.countdown, results: options.results ?? RULES.results, story: options.story ?? false, capacity: options.capacity ?? (options.story ? 32 : RULES.maxPlayers), regenDelay: options.regenDelay ?? 5, regenRate: options.regenRate ?? 25 };
    if (this.options.practice || this.options.story) { this.phase = 'ACTIVE'; this.deadline = 3600 * 24; }
  }
  get local() { return this.options.practice || this.options.story; }
  add(id: string, name: string, explicitTeam?: Team): Player {
    if (this.players.size >= this.options.capacity) throw new Error('This bus is full. Try another room.');
    const counts = [0, 0]; for (const p of this.players.values()) counts[p.team]++;
    const team = explicitTeam ?? (counts[0] <= counts[1] ? 0 : 1);
    const p: Player = { id, name: nickname(name), team, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, yaw: team === 0 ? 0 : Math.PI, pitch: 0,
      grounded: true, crouched: false, ...still(), connected: true, ready: false, life: 0, health: 100, kills: 0, deaths: 0, weapon: 'rifle', guns: loadout(),
      reloadUntil: 0, equipUntil: 0, respawnAt: 0, protectedUntil: 0, recoil: 0, recoilYaw: 0, burst: 0, shots: 0, aiming: false, ack: 0, ping: 0, joined: this.tick };
    this.players.set(id, p); if (!this.host) this.host = id; this.spawn(p); return p;
  }
  remove(id: string) { const p = this.players.get(id); if (p && this.phase === 'ACTIVE' && (p.kills || p.deaths)) { const { name, team, kills, deaths } = p; this.departed.set(id, { id, name, team, kills, deaths }); } this.players.delete(id); this.heldFire.delete(id); this.damageScale.delete(id); this.lastDamage.delete(id); this.chooseHost(); }
  chooseHost() { if (!this.players.get(this.host)?.connected) this.host = [...this.players.values()].find(p => p.connected)?.id ?? ''; }
  ready(id: string) { const p = this.players.get(id); if (p && !p.ready) { p.ready = true; if (this.phase === 'ACTIVE' && !this.options.story) this.spawn(p); } }
  canStart() { const ready = [...this.players.values()].filter(p => p.ready && p.connected); return ready.length >= (this.options.private ? 2 : RULES.publicMinimum) && ready.some(p => p.team === 0) && ready.some(p => p.team === 1); }
  start(requester = '') { if (this.phase !== 'WAITING' || !this.canStart() || (this.options.private && requester !== this.host)) return false; this.setPhase('COUNTDOWN', this.options.countdown); return true; }
  /** Host-only private match settings, accepted only while waiting and only from the published option lists. */
  configure(requester: string, duration: unknown, killLimit: unknown) {
    if (!this.options.private || requester !== this.host || this.phase !== 'WAITING') return false;
    if (!(MATCH_OPTIONS.duration as readonly unknown[]).includes(duration) || !(MATCH_OPTIONS.killLimit as readonly unknown[]).includes(killLimit)) return false;
    this.options.duration = duration as number; this.options.killLimit = killLimit as number; return true;
  }
  /** Moves a player between teams while waiting, respecting the four-per-team cap. */
  switchTeam(id: string) {
    const p = this.players.get(id); if (!p || this.phase !== 'WAITING') return false;
    const other: Team = p.team === 0 ? 1 : 0; if ([...this.players.values()].filter(q => q.team === other).length >= RULES.teamSize) return false;
    p.team = other; this.spawn(p); return true;
  }
  private setPhase(phase: Phase, seconds = 0) { this.phase = phase; this.deadline = this.now + seconds; this.emit({ type: 'phase', player: '' }); }
  private begin() {
    this.round++; this.score0 = 0; this.score1 = 0; this.winner = ''; this.results = []; this.departed.clear(); this.absentSince = -1;
    for (const p of this.players.values()) { p.kills = 0; p.deaths = 0; this.spawn(p); }
    this.setPhase('ACTIVE', this.options.duration);
  }
  finish(reason?: string) {
    if (this.phase !== 'ACTIVE') return;
    this.winner = reason ?? (this.score0 === this.score1 ? 'DRAW' : this.score0 > this.score1 ? TEAMS[0].id : TEAMS[1].id);
    this.results = [...this.players.values(), ...this.departed.values()].map(({ id, name, team, kills, deaths }) => ({ id, name, team, kills, deaths })).sort((a, b) => b.kills - a.kills || a.deaths - b.deaths || a.id.localeCompare(b.id));
    this.setPhase('RESULTS', this.options.results);
  }
  spawn(p: Player, at?: Vec3 & { yaw?: number }) {
    let choice: Vec3 = at ?? SPAWNS[p.team][0], best = -Infinity;
    if (!at) for (const point of SPAWNS[p.team]) {
      if (!clearPosition(point, this.world)) continue;
      let value = 100;
      for (const enemy of this.players.values()) {
        if (enemy.id === p.id || enemy.health <= 0) continue;
        const distance = Math.hypot(point.x - enemy.x, point.z - enemy.z);
        if (enemy.team === p.team) { if (distance < 1) value -= 100; continue; }
        value = Math.min(value, distance);
        const origin = { ...point, y: RULES.eye }, direction = { x: (enemy.x - point.x) / Math.max(distance, 0.01), y: 0, z: (enemy.z - point.z) / Math.max(distance, 0.01) };
        if (worldRay(origin, direction, distance, this.world) >= distance) value -= 30;
      }
      if (value > best) { best = value; choice = point; }
    }
    Object.assign(p, { x: choice.x, y: choice.y, z: choice.z }, { vx: 0, vy: 0, vz: 0, yaw: at?.yaw ?? (p.team === 0 ? 0 : Math.PI), pitch: 0, health: 100, grounded: true, crouched: false, ...still(), aiming: false, guns: loadout(), weapon: 'rifle', reloadUntil: 0, equipUntil: 0, recoil: 0, recoilYaw: 0, burst: 0, respawnAt: 0, protectedUntil: this.now + (this.options.story ? 0 : RULES.protection) });
    p.life++; this.heldFire.set(p.id, false); this.lastDamage.delete(p.id); this.emit({ type: 'respawn', player: p.id });
  }
  /** Refills reserves for a solo resupply crate. Never exposed to the multiplayer server. */
  resupply(id: string) { const p = this.players.get(id); if (!p || !this.local) return; for (const weapon of Object.keys(WEAPONS) as (keyof typeof WEAPONS)[]) p.guns[weapon].reserve = WEAPONS[weapon].reserve; }
  step(inputs = new Map<string, InputFrame>(), dt: number = RULES.dt) {
    this.events = []; this.now += dt; this.tick++;
    if (this.phase === 'WAITING' && !this.options.private) this.start();
    if (this.phase === 'COUNTDOWN') { if (!this.canStart()) this.setPhase('WAITING'); else if (this.now >= this.deadline) this.begin(); }
    if (this.phase === 'RESULTS' && this.now >= this.deadline) this.setPhase('WAITING');
    const ordered = [...this.players.values()].sort((a, b) => a.id.localeCompare(b.id));
    for (const p of ordered) {
      const raw = inputs.get(p.id); const valid = raw && raw.life === p.life && raw.round === this.round && p.connected && p.ready;
      const frame = valid ? { ...raw } : { ...neutral(p.ack, p.life, this.round), yaw: p.yaw, pitch: p.pitch, crouch: p.crouched };
      if (raw && p.connected && raw.seq > p.ack) p.ack = raw.seq;
      frame.trigger = frame.fire && !this.heldFire.get(p.id); this.heldFire.set(p.id, frame.fire);
      if (p.health <= 0) { if (this.phase === 'ACTIVE' && p.ready && p.connected && !this.options.story && this.now >= p.respawnAt) this.spawn(p); continue; }
      if (this.phase === 'ACTIVE' && p.ready) {
        movePlayer(p, frame, dt, this.world, this.paceScale.get(p.id) ?? 1);
        if (p.y < -8 || !Number.isFinite(p.x)) { this.spawn(p); continue; }
        if (p.connected) {
          const action = advanceWeapon(p, frame, this.now, dt);
          if (action === 'shot') this.shoot(p);
          if (action === 'reload') this.emit({ type: 'reload', player: p.id, weapon: p.weapon });
        }
        if (this.options.story && p.team === 0 && p.health < 100 && this.now - (this.lastDamage.get(p.id) ?? -99) > this.options.regenDelay) p.health = Math.min(100, p.health + this.options.regenRate * dt);
      }
      if (this.phase !== 'ACTIVE') { p.vx = 0; p.vz = 0; }
    }
    if (this.phase === 'ACTIVE' && !this.local) {
      if (this.now >= this.deadline) this.finish();
      const active = ordered.filter(p => p.connected && p.ready);
      if (!active.some(p => p.team === 0) || !active.some(p => p.team === 1)) { if (this.absentSince < 0) this.absentSince = this.now; else if (this.now - this.absentSince >= RULES.abandon) this.finish('ABANDONED'); } else this.absentSince = -1;
    }
    return this.events;
  }
  private shoot(shooter: Player) {
    const def = WEAPONS[shooter.weapon]; const origin: Vec3 = { x: shooter.x, y: shooter.y + eyeHeight(shooter), z: shooter.z };
    const spread = spreadOffset(shooter, def);
    const direction = aim(shooter.yaw + shooter.recoilYaw + spread.yaw, shooter.pitch + shooter.recoil + spread.pitch); let nearest = worldRay(origin, direction, def.range, this.world); let target: Player | undefined;
    for (const other of this.players.values()) {
      if (other.id === shooter.id || other.health <= 0 || !other.ready) continue;
      const b = bodyBounds(other), distance = rayBox(origin, direction, b.min, b.max, nearest);
      if (distance !== null && distance < nearest) { nearest = distance; target = other; }
    }
    const end = { x: origin.x + direction.x * nearest, y: origin.y + direction.y * nearest, z: origin.z + direction.z * nearest };
    this.emit({ type: 'shot', player: shooter.id, weapon: shooter.weapon, position: origin, end, seq: shooter.ack, life: shooter.life, target: target?.id });
    applyRecoil(shooter);
    if (!target || target.team === shooter.team || this.now < target.protectedUntil) return;
    const head = end.y > target.y + bodyHeight(target) - RULES.head;
    this.damage(shooter, target, Math.max(1, Math.round(damageAt(def, nearest, head) * (this.damageScale.get(shooter.id) ?? 1))), head, false);
  }
  private damage(attacker: Player, target: Player, amount: number, head: boolean, melee: boolean) {
    target.health = Math.max(0, target.health - amount); this.lastDamage.set(target.id, this.now);
    this.emit({ type: 'hit', player: attacker.id, target: target.id, head, amount, melee, position: { x: attacker.x, y: attacker.y, z: attacker.z } });
    if (target.health > 0) return;
    target.health = 0; target.deaths++; target.reloadUntil = 0; target.respawnAt = this.options.story ? Infinity : this.now + RULES.respawn; target.vx = 0; target.vz = 0;
    attacker.kills++; if (attacker.team === 0) this.score0++; else this.score1++;
    this.emit({ type: 'kill', player: attacker.id, target: target.id, weapon: attacker.weapon, head, melee });
    if (!this.local && Math.max(this.score0, this.score1) >= this.options.killLimit) this.finish();
  }
  /**
   * A cutlass strike, used only by solo modes (the multiplayer server never calls it).
   * It lands on the nearest opponent within arm's reach in front of the attacker with a clear line.
   */
  melee(attackerId: string, amount: number, cooldown: number) {
    const a = this.players.get(attackerId); if (!a || a.health <= 0 || !this.local || this.now < (this.meleeReady.get(attackerId) ?? 0)) return false;
    this.meleeReady.set(attackerId, this.now + cooldown); this.emit({ type: 'melee', player: a.id, position: { x: a.x, y: a.y, z: a.z } });
    const eye = { x: a.x, y: a.y + eyeHeight(a), z: a.z };
    for (const t of this.players.values()) {
      if (t.team === a.team || t.health <= 0 || !t.ready) continue;
      const dx = t.x - a.x, dz = t.z - a.z, d = Math.hypot(dx, dz), facing = Math.abs(Math.atan2(Math.sin(Math.atan2(dx, dz) - a.yaw), Math.cos(Math.atan2(dx, dz) - a.yaw)));
      if (d > 2 || Math.abs(t.y - a.y) > 1 || facing > 1 || worldRay(eye, { x: dx / (d || 1), y: 0, z: dz / (d || 1) }, d, this.world) < d - 0.4) continue;
      this.damage(a, t, Math.max(1, Math.round(amount * (this.damageScale.get(a.id) ?? 1))), false, true); return true;
    }
    return false;
  }
  private emit(event: Omit<GameEvent, 'id' | 'round'>) { this.events.push({ ...event, id: ++this.eventId, round: this.round }); }
  snapshot(): Snapshot { return { tick: this.tick, now: this.now, round: this.round, phase: this.phase, deadline: this.deadline, score0: this.score0, score1: this.score1, host: this.host, private: this.options.private, winner: this.winner, players: [...this.players.values()], results: this.results, duration: this.options.duration, killLimit: this.options.killLimit }; }
}
