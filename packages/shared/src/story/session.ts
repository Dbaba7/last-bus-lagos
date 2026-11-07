import { RULES, WEAPONS } from '../config.js';
import { eyeHeight, groundHeight, lineOfSight, localMove, movePlayer } from '../physics.js';
import { neutral, still, type GameEvent, type InputFrame, type Motion, type Player } from '../protocol.js';
import { Simulation } from '../simulation.js';
import { MAPS, WORLD, type Box, type Vec3 } from '../world.js';
import { Agent, DIFFICULTY, type AgentDef, type AgentState, type Difficulty, type Senses } from './ai.js';
import type { Action, Interactable, Line, Mission, Objective } from './campaign.js';
import { navFor, type NavGrid } from './nav.js';
export interface NpcView { id: string; name: string; x: number; y: number; z: number; yaw: number; vx: number; vz: number; grounded: boolean; seated: boolean }
export interface AgentView { id: string; state: AgentState; awareness: number; sees: boolean; health: number; group: string; x: number; y: number; z: number; melee: boolean; windup: boolean }
export interface SessionHud {
  objective?: { text: string; kind: Objective['kind']; progress?: number; marker?: Vec3; warning?: string };
  optional: { text: string; done: boolean }[]; prompt?: { text: string; progress: number }; subtitle?: Line & { key: string };
  notice?: string; hostiles: number; time: number;
}
/** Enemy call-outs. Keys are stable so each line can have a recorded voice file. */
export const BARKS: Record<'engage' | 'reload' | 'lost', Record<string, Line>> = {
  engage: { 'bark-engage-1': { speaker: 'STATIC', text: 'Na police! For there!', seconds: 2.2 }, 'bark-engage-2': { speaker: 'STATIC', text: 'She dey here — open fire!', seconds: 2.2 }, 'bark-engage-3': { speaker: 'STATIC', text: 'Flank am, go left!', seconds: 2 } },
  reload: { 'bark-reload-1': { speaker: 'STATIC', text: 'Cover me, I dey reload!', seconds: 2.2 } },
  lost: { 'bark-lost-1': { speaker: 'STATIC', text: 'Where she go?', seconds: 1.8 }, 'bark-lost-2': { speaker: 'STATIC', text: 'Find am! Check the corner!', seconds: 2.2 } }
};
function placed(at: Vec3, world: Box[] = WORLD) { return { x: at.x, y: groundHeight(at.x, at.z, (at.y ?? 0) + 0.6, world), z: at.z }; }
/** Shared machinery for local, single-player modes built on the real simulation. */
abstract class LocalSession {
  readonly sim: Simulation; readonly nav: NavGrid; readonly playerId = 'you'; readonly agents = new Map<string, Agent>();
  protected deadSince = new Map<string, number>(); protected definitions = new Map<string, AgentDef>();
  stats = { time: 0, kills: 0, shots: 0, hits: 0, headshots: 0, damageTaken: 0 };
  constructor(options: ConstructorParameters<typeof Simulation>[0], name: string, protected level: Difficulty, readonly world: Box[] = WORLD) {
    this.sim = new Simulation(options); this.sim.world = world; this.nav = navFor(world);
    const p = this.sim.add(this.playerId, name, 0); this.sim.ready(p.id);
  }
  get player() { return this.sim.players.get(this.playerId)!; }
  /** How well enemies notice the player here; undefined keeps the normal rules. */
  protected get senses(): Senses | undefined { return undefined; }
  /** Movement scale for enemies; undefined keeps normal speed. */
  protected get hunterPace(): number | undefined { return undefined; }
  /** A cutlass strike landed on the player. */
  protected struck() { /* Ordinary damage is all that happens in most modes. */ }
  protected addAgent(def: AgentDef, team: 0 | 1 = 1, group = '') {
    const p = this.sim.add(def.id, def.name ?? 'STATIC', team); this.sim.ready(p.id);
    this.sim.spawn(p, { ...placed(def.at, this.world), yaw: def.yaw }); p.weapon = def.weapon ?? 'rifle'; p.protectedUntil = 0;
    // Enemies are lighter than the player: fewer hits to drop, and they never regenerate.
    this.sim.damageScale.set(def.id, DIFFICULTY[this.level].damage); if (team === 1) p.health = DIFFICULTY[this.level].health;
    if (this.hunterPace) this.sim.paceScale.set(def.id, this.hunterPace);
    // Grace runs from when a hunter appears, so a retry or a late spawn never notices the player on its first tick.
    const senses = this.senses, agent = new Agent(def, p, this.nav, this.level, senses && { ...senses, grace: this.sim.now + (senses.grace ?? 0) }); agent.group = group; this.agents.set(def.id, agent); this.definitions.set(def.id, def); return agent;
  }
  /** One fixed simulation tick: agents think, the shared simulation steps, and events feed perception and stats. */
  protected tick(frame: InputFrame) {
    const inputs = new Map<string, InputFrame>([[this.playerId, frame]]), now = this.sim.now, list = [...this.agents.values()], target = this.player.health > 0 ? this.player : undefined;
    for (const agent of list) inputs.set(agent.def.id, agent.think(target, list, now, RULES.dt));
    const events = this.sim.step(inputs);
    const tune = DIFFICULTY[this.level];
    // Strikes land after the step; sim.melee appends its events to the same tick's list.
    for (const agent of list) if (agent.strike && this.sim.melee(agent.def.id, tune.slash, tune.slashEvery)) { agent.strike = false; this.struck(); }
    for (const event of events) {
      const shooter = this.sim.players.get(event.player);
      if (event.type === 'shot') { if (event.player === this.playerId) this.stats.shots++; for (const agent of list) agent.hear(event, shooter, now); }
      if (event.type === 'hit') {
        if (event.player === this.playerId) { this.stats.hits++; if (event.head) this.stats.headshots++; }
        if (event.target === this.playerId) this.stats.damageTaken += event.amount ?? 0;
        this.agents.get(event.target ?? '')?.damaged(shooter, now);
      }
      if (event.type === 'kill' && event.player === this.playerId) this.stats.kills++;
    }
    this.stats.time += RULES.dt; return events;
  }
  agentViews(): AgentView[] { return [...this.agents.values()].map(a => ({ id: a.def.id, state: a.state, awareness: a.awareness, sees: a.seesTarget, health: a.player.health, group: a.group, x: a.player.x, y: a.player.y, z: a.player.z, melee: !!a.def.melee, windup: a.windingUp })); }
}
/**
 * One playthrough of a mission. It owns its simulation, agents, objective
 * progress, dialogue and checkpoint position; retrying builds a fresh session
 * from the checkpoint so no half-finished encounter state can leak through.
 */
export class StorySession extends LocalSession {
  state: 'playing' | 'failed' | 'complete' = 'playing'; index: number; checkpoint: number; relay = false; following = false; completedAt = 0;
  /** Named world states the client presents (city restored, night, bus gone…), and whether the player has weapons. */
  readonly flags = new Set<string>(); armed = true;
  /** Set when the story moves the player, so the client can bring its input and camera along. */
  moved = false;
  /** Interactables already used for a `collect` objective, and phone messages waiting to be shown by the client. */
  readonly collected = new Set<string>(); readonly messages: string[] = [];
  private removed = new Set<string>(); private later: { at: number; keys: string[] }[] = [];
  readonly optionalDone = new Set<string>(); readonly npc?: NpcView & Motion;
  private pending: { at: number; group: string; id?: string }[] = []; private spawned = new Set<string>(); private spawnedIds = new Set<string>(); private interactions = new Map<string, number>();
  private lines: (Line & { key: string })[] = []; private line?: Line & { key: string; until: number }; private notice?: { text: string; until: number };
  private defendTime = 0; private grabs = 0; private barkAt = -99; private seenStates = new Map<string, AgentState>(); private stuckFemi = 0;
  /** Cutscenes waiting to be shown. The client plays them and does not step the session meanwhile. */
  readonly cutscenes: string[] = [];
  /** Measured lengths of recorded voice files, so subtitles stay up until a line has been spoken. */
  voiceSeconds: Record<string, number> = {};
  constructor(readonly mission: Mission, level: Difficulty, name: string, from = 0, readonly retries = 0) {
    super({ story: true, regenDelay: DIFFICULTY[level].regenDelay, regenRate: DIFFICULTY[level].regenRate }, name, level, MAPS[mission.map ?? 'ojuelegba'].world);
    this.index = from; this.checkpoint = from; this.armed = !mission.unarmed;
    const start = from > 0 ? mission.objectives[from].checkpoint ?? mission.start : mission.start;
    this.sim.spawn(this.player, { ...placed(start.at, this.world), yaw: start.yaw }); if (mission.pursuit) this.sim.paceScale.set(this.playerId, mission.pursuit.pace);
    // Replaying from a checkpoint restores what earlier objectives already did to the world.
    for (const o of mission.objectives.slice(0, from)) for (const a of [...(o.onStart ?? []), ...(o.onComplete ?? [])]) if ('flag' in a || 'remove' in a || 'arm' in a) this.act(a, true);
    for (const o of mission.objectives.slice(0, from)) if (o.kind === 'collect') for (const id of o.items ?? []) this.collected.add(id);
    if (mission.npc) this.npc = { id: mission.npc.id, name: mission.npc.name, ...placed(mission.npc.at, this.world), yaw: mission.npc.yaw, vx: 0, vy: 0, vz: 0, pitch: 0, grounded: true, crouched: false, ...still(), seated: !mission.npc.standing };
    this.begin(this.index, retries > 0);
  }
  protected get senses() { return this.mission.pursuit; }
  protected get hunterPace() { return this.mission.pursuit?.hunters[this.level]; }
  /** In a pursuit a hunter's grab can be shaken off once, except on Hard; they want the target alive, so it is not a matter of health. */
  protected struck() { if (this.mission.pursuit && ++this.grabs >= (this.level === 'hard' ? 1 : 2)) this.player.health = 0; }
  /** Rebuilds the mission at the last checkpoint with fresh enemies, objectives and a full loadout. */
  retry() { return new StorySession(this.mission, this.level, this.player.name, this.checkpoint, this.retries + 1); }
  restart() { return new StorySession(this.mission, this.level, this.player.name, 0, this.retries + 1); }
  get objective(): Objective | undefined { return this.mission.objectives[this.index]; }
  private begin(index: number, quiet: boolean) {
    const objective = this.mission.objectives[index]; if (!objective) return;
    if (objective.checkpoint && index !== this.checkpoint) { this.checkpoint = index; this.notify('Checkpoint reached'); }
    this.defendTime = 0; for (const action of objective.onStart ?? []) this.act(action, quiet);
  }
  private act(action: Action, quiet = false) {
    if ('spawn' in action) { if (action.delay) this.pending.push({ at: this.sim.now + action.delay, group: action.spawn }); else this.spawnGroup(action.spawn); }
    // New dialogue supersedes anything still waiting from earlier beats, so radio never lags the action.
    else if ('say' in action && action.delay) { if (!quiet) this.later.push({ at: this.sim.now + action.delay, keys: action.say }); }
    else if ('say' in action) { if (!quiet) { this.lines = this.lines.filter(l => l.key.startsWith('bark')).slice(0, 1); for (const key of action.say) { const line = this.mission.lines[key]; if (line) this.lines.push({ ...line, key }); } } }
    else if ('relay' in action) this.relay = action.relay;
    else if ('flag' in action) { if (action.off) this.flags.delete(action.flag); else this.flags.add(action.flag); }
    else if ('remove' in action) { for (const id of action.remove) this.removed.add(id); this.sim.world = this.world.filter(b => !this.removed.has(b.id)); }
    // A mission that starts unarmed gives back only the service pistol.
    else if ('arm' in action) { this.armed = action.arm; if (action.arm && this.mission.unarmed) { this.player.weapon = 'sidearm'; this.player.guns.rifle = { ammo: 0, reserve: 0, nextShot: 0 }; } }
    else if ('notice' in action) this.notify(action.notice);
    else if ('place' in action) { Object.assign(this.player, placed(action.place, this.world), { yaw: action.yaw, vx: 0, vy: 0, vz: 0, traverse: 0 }); this.moved = true; }
    else if ('pace' in action) this.sim.paceScale.set(this.playerId, action.pace);
    else if ('cutscene' in action) { if (!quiet && this.mission.cutscenes[action.cutscene]) this.cutscenes.push(action.cutscene); }
    // Femi stays seated (e.g. through his cutscene) until he actually takes his first step.
    else if ('follow' in action) this.following = action.follow;
  }
  /** The part of an encounter that spawns at this difficulty. Easy faces about half of each group. */
  roster(group: string) { const defs = this.mission.groups[group] ?? []; return this.mission.pursuit ? defs : defs.slice(0, Math.max(1, Math.round(defs.length * DIFFICULTY[this.level].roster))); }
  /**
   * Starts an encounter. Groups sent in as reinforcements arrive one at a time a few
   * seconds apart, announced with the direction they come from, instead of all at once.
   */
  private spawnGroup(group: string) {
    if (this.spawned.has(group)) return; this.spawned.add(group);
    const defs = this.roster(group), arriving = !this.mission.pursuit && defs.some(d => d.alert);
    defs.forEach((def, i) => { if (arriving && i > 0) this.pending.push({ at: this.sim.now + i * 3.5, group, id: def.id }); else this.spawnOne(group, def.id); });
    if (arriving && defs[0]) this.notify(`Hostiles incoming from the ${bearing(this.player, defs[0].at)}`);
  }
  private spawnOne(group: string, id: string) { const def = this.roster(group).find(d => d.id === id); if (!def || this.spawnedIds.has(id)) return; this.spawnedIds.add(id); this.addAgent(def, 1, group); }
  private notify(text: string) { this.notice = { text, until: this.sim.now + 3 }; }
  private groupAlive(groups: string[]) {
    let alive = 0; for (const group of groups) for (const def of this.roster(group)) { if (!this.spawnedIds.has(def.id)) alive++; else { const a = this.agents.get(def.id); if (a && a.player.health > 0) alive++; } }
    return alive;
  }
  private interactable(id?: string) { return this.mission.interactables.find(i => i.id === id); }
  /** Interactables the player could use right now, honouring objective order. */
  private available(): Interactable[] {
    const ids = new Set<string>(); const o = this.objective; if (o?.interact) ids.add(o.interact);
    if (o?.kind === 'collect') for (const id of o.items ?? []) if (!this.collected.has(id)) ids.add(id);
    for (const opt of this.mission.optional) if (opt.interact && !this.optionalDone.has(opt.id)) ids.add(opt.interact);
    const short = this.player.guns.rifle.reserve < WEAPONS.rifle.reserve || this.player.guns.sidearm.reserve < WEAPONS.sidearm.reserve;
    return this.mission.interactables.filter(i => ids.has(i.id) || (i.kind === 'ammo' && short));
  }
  private focus(): Interactable | undefined {
    const p = this.player, eye = { x: p.x, y: p.y + eyeHeight(p), z: p.z }, forward = { x: Math.sin(p.yaw), z: Math.cos(p.yaw) };
    let best: Interactable | undefined, score = Infinity;
    for (const item of this.available()) {
      const dx = item.at.x - p.x, dz = item.at.z - p.z, d = Math.hypot(dx, dz); if (d > item.radius || Math.abs((item.at.y ?? p.y) - p.y) > 1.6) continue;
      if (d > 0.7 && (dx * forward.x + dz * forward.z) / d < 0.35) continue;
      if (!lineOfSight(eye, { x: item.at.x, y: (item.at.y ?? p.y) + 1.1, z: item.at.z }, this.sim.world)) continue;
      if (d < score) { score = d; best = item; }
    }
    return best;
  }
  step(frame: InputFrame, interactHeld: boolean): GameEvent[] {
    if (this.state !== 'playing') { const events = this.tick({ ...neutral(frame.seq, this.player.life, 0), yaw: frame.yaw, pitch: frame.pitch }); return events; }
    const now = this.sim.now;
    // Without a weapon the hands are empty: no shooting, aiming, reloading or switching.
    if (!this.armed) frame = { ...frame, fire: false, trigger: false, aim: false, reload: false, weapon: '' };
    for (const due of this.later.filter(l => l.at <= now)) this.act({ say: due.keys }); this.later = this.later.filter(l => l.at > now);
    for (const due of this.pending.filter(p => p.at <= now)) { if (due.id) this.spawnOne(due.group, due.id); else this.spawnGroup(due.group); } this.pending = this.pending.filter(p => p.at > now);
    // Interaction is a deliberate hold; releasing resets it.
    const focus = this.focus();
    for (const id of [...this.interactions.keys()]) if (id !== focus?.id || !interactHeld) this.interactions.delete(id);
    if (focus && interactHeld && this.player.health > 0) {
      const progress = (this.interactions.get(focus.id) ?? 0) + RULES.dt / focus.hold; this.interactions.set(focus.id, progress);
      if (progress >= 1) { this.interactions.delete(focus.id); this.used(focus); }
    }
    const events = this.tick(frame);
    this.followNpc();
    this.barks(now);
    // Clean up bodies after a while so long missions do not accumulate actors.
    for (const [id, agent] of this.agents) { if (agent.player.health > 0) { this.deadSince.delete(id); continue; } const since = this.deadSince.get(id) ?? now; this.deadSince.set(id, since); if (now - since > 8) { this.sim.remove(id); this.agents.delete(id); } }
    if (this.player.health <= 0) { this.state = 'failed'; return events; }
    this.advance();
    if (this.line && this.line.until <= now) this.line = undefined;
    if (!this.line && this.lines.length) { const next = this.lines.shift()!; this.line = { ...next, until: now + this.duration(next.key, next.seconds) }; }
    return events;
  }
  /** How long a line stays on screen: its written length, or the recording plus a short pause, whichever is longer. */
  duration(key: string, seconds = 4) { const voice = this.voiceSeconds[key]; return voice ? Math.max(seconds, voice + 0.35) : seconds; }
  /** Called by the client when the cutscene at the head of the queue has finished or been skipped. */
  finishCutscene() { this.cutscenes.shift(); }
  /** Hands a cutscene's final staging back to the mission NPC, so a character who stood up stays standing. */
  placeNpc(x: number, z: number, yaw: number, seated: boolean) { const n = this.npc; if (!n) return; Object.assign(n, placed({ x, y: n.y, z }, this.sim.world), { yaw, seated, vx: 0, vz: 0 }); }
  /** Time of night shown on the HUD: the latest `clock` reached, or the mission's own. */
  get clock() { let at = this.mission.time; for (const o of this.mission.objectives.slice(0, this.index + 1)) if (o.clock) at = o.clock; return at; }
  private used(item: Interactable) {
    if (item.kind === 'ammo') { this.sim.resupply(this.playerId); this.notify('Ammunition restocked'); }
    if (item.kind === 'phone') this.messages.push(item.id);
    for (const action of item.onUse ?? []) this.act(action);
    if (this.objective?.kind === 'collect' && this.objective.items?.includes(item.id)) { this.collected.add(item.id); if (this.objective.items.every(id => this.collected.has(id))) this.complete(); return; }
    for (const opt of this.mission.optional) if (opt.interact === item.id) this.optionalDone.add(opt.id);
    if (this.objective?.interact === item.id) this.complete();
  }
  private advance() {
    const o = this.objective, p = this.player; if (!o) return;
    if (o.kind === 'reach' && o.at) {
      const inside = Math.hypot(p.x - o.at.x, p.z - o.at.z) <= (o.radius ?? 2) && Math.abs(p.y - (o.at.y ?? 0)) < 2.2;
      const escorted = !o.escort || !this.npc || Math.hypot(this.npc.x - o.at.x, this.npc.z - o.at.z) < 6;
      if (inside && escorted) this.complete();
    }
    if (o.kind === 'defeat' && this.groupAlive(o.groups ?? []) === 0 && !this.pending.length) this.complete();
    if (o.kind === 'defend' && o.at) {
      if (Math.hypot(p.x - o.at.x, p.z - o.at.z) <= (o.radius ?? 6)) this.defendTime += RULES.dt;
      if (this.defendTime >= (o.duration ?? 30) && this.groupAlive(o.groups ?? []) === 0 && !this.pending.length) this.complete();
    }
  }
  /** Development shortcut used by the dev build's F9 key; completes the current objective through its normal actions. */
  devSkip() { for (const a of this.agents.values()) if ((this.objective?.groups ?? []).includes(a.group)) a.player.health = 0; for (const p of this.pending) { if (p.id) this.spawnOne(p.group, p.id); else this.spawnGroup(p.group); } this.pending = []; for (const a of this.agents.values()) if ((this.objective?.groups ?? []).includes(a.group)) a.player.health = 0; this.complete(); }
  private complete() {
    const o = this.objective; if (!o) return;
    for (const action of o.onComplete ?? []) this.act(action);
    this.index++;
    if (this.index >= this.mission.objectives.length) { this.state = 'complete'; this.completedAt = this.sim.now; return; }
    this.begin(this.index, false);
  }
  /** Femi follows a few metres behind using the same movement solver, and is never a combat target. */
  private followNpc() {
    const npc = this.npc; if (!npc || !this.following || this.flags.has(`${npc.id}-gone`)) return;
    const p = this.player, behind = { x: p.x - Math.sin(p.yaw) * 1.8, y: p.y, z: p.z - Math.cos(p.yaw) * 1.8 }, d = Math.hypot(p.x - npc.x, p.z - npc.z);
    const input = { ...neutral() }; let heading: { x: number; z: number } | undefined;
    if (d > 2.4) {
      const path = this.nav.walkLine(npc, behind) ? [behind] : this.nav.path(npc, behind, 2500) ?? [];
      const next = path.find(w => Math.hypot(w.x - npc.x, w.z - npc.z) > 0.5); if (next) { const dx = next.x - npc.x, dz = next.z - npc.z, l = Math.hypot(dx, dz) || 1; heading = { x: dx / l, z: dz / l }; }
    }
    if (heading) { npc.seated = false; npc.yaw = Math.atan2(heading.x, heading.z); const stick = localMove(heading.x, heading.z, npc.yaw); input.x = stick.x; input.z = stick.z; input.sprint = d > 6; }
    input.yaw = npc.yaw; input.crouch = this.groupAlive(this.objective?.groups ?? []) > 0 && d < 4 && !heading;
    const before = { x: npc.x, z: npc.z }; movePlayer(npc, input, RULES.dt);
    this.stuckFemi = heading && Math.hypot(npc.x - before.x, npc.z - before.z) < 0.01 ? this.stuckFemi + RULES.dt : 0;
    if (d > 22 || this.stuckFemi > 2.5) { const spot = this.nav.nearest(behind.x, behind.z, 4); if (spot) Object.assign(npc, { x: spot.x, y: spot.y, z: spot.z, vx: 0, vz: 0 }); this.stuckFemi = 0; }
  }
  private barks(now: number) {
    // The recorded barks are shouted at Ada; in a pursuit the only call is the one that gives a hunter away.
    const pursuit = this.mission.pursuit;
    if (pursuit) { const line = this.mission.lines[pursuit.spotted]; if (line && now - this.barkAt > 6 && [...this.agents.values()].some(a => a.windingUp)) { this.barkAt = now; this.line = undefined; this.lines.unshift({ ...line, key: pursuit.spotted }); } return; }
    for (const agent of this.agents.values()) {
      const before = this.seenStates.get(agent.def.id); this.seenStates.set(agent.def.id, agent.state);
      if (before === agent.state || now - this.barkAt < 7 || agent.player.health <= 0 || Math.hypot(agent.player.x - this.player.x, agent.player.z - this.player.z) > 26 || this.line) continue;
      const pool = agent.state === 'engage' && (before === 'patrol' || before === 'idle' || before === 'investigate') ? BARKS.engage : agent.state === 'cover' && agent.player.reloadUntil ? BARKS.reload : agent.state === 'search' ? BARKS.lost : undefined;
      if (pool) { this.barkAt = now; const keys = Object.keys(pool), key = keys[Math.floor(Math.random() * keys.length)]; this.lines.unshift({ ...pool[key], key }); }
    }
  }
  hud(): SessionHud {
    const o = this.objective, p = this.player, focus = this.state === 'playing' ? this.focus() : undefined;
    let progress: number | undefined, warning: string | undefined;
    if (o?.kind === 'defend') { progress = Math.min(1, this.defendTime / (o.duration ?? 30)); if (o.at && Math.hypot(p.x - o.at.x, p.z - o.at.z) > (o.radius ?? 6)) warning = 'Return to the yard — the reboot timer is paused'; else if (progress >= 1) warning = 'Relay online — finish the attackers'; }
    if (o?.kind === 'collect') progress = (o.items ?? []).filter(id => this.collected.has(id)).length / Math.max(1, o.items?.length ?? 1);
    if (o?.kind === 'defeat') { const total = (o.groups ?? []).reduce((n, g) => n + this.roster(g).length, 0); progress = total ? 1 - this.groupAlive(o.groups ?? []) / total : undefined; }
    if (o?.escort && this.npc && o.at && Math.hypot(this.npc.x - o.at.x, this.npc.z - o.at.z) > 6 && Math.hypot(p.x - o.at.x, p.z - o.at.z) < (o.radius ?? 2)) warning = 'Wait for Femi';
    const marker = o?.marker ?? o?.at ?? this.interactable(o?.interact)?.at;
    return {
      objective: o ? { text: o.text, kind: o.kind, progress, marker, warning } : undefined,
      optional: this.mission.optional.map(opt => ({ text: opt.text, done: this.optionalDone.has(opt.id) })),
      prompt: focus ? { text: focus.prompt, progress: this.interactions.get(focus.id) ?? 0 } : undefined,
      subtitle: this.line, notice: this.notice && this.notice.until > this.sim.now ? this.notice.text : undefined,
      hostiles: [...this.agents.values()].filter(a => a.player.health > 0).length, time: this.stats.time
    };
  }
  npcView(): NpcView | undefined { const n = this.npc; return n && !this.flags.has(`${n.id}-gone`) ? { id: n.id, name: n.name, x: n.x, y: n.y, z: n.z, yaw: n.yaw, vx: n.vx, vz: n.vz, grounded: n.grounded, seated: n.seated } : undefined; }
}
export type TrainingKind = 'targets' | 'bots';
/** The practice range: fixed targets at measured distances, or respawning bots clearly labelled as bots. */
export class TrainingSession extends LocalSession {
  constructor(readonly kind: TrainingKind, name: string, level: Difficulty) {
    super({ practice: true }, name, level);
    this.sim.spawn(this.player, { ...placed({ x: 0, y: 0, z: -27 }), yaw: 0 });
    if (kind === 'targets') [[2.5, -17], [-5, -9.5], [6, -1], [-1, 6], [-9, 13], [2, 22]].forEach(([x, z], i) => this.addAgent({ id: `target-${i}`, name: `TARGET ${Math.round(Math.hypot(x, z + 27))} M`, at: { x, y: 0, z }, yaw: Math.PI, role: 'dummy' }));
    else for (let i = 0; i < 3; i++) this.addAgent({ id: `bot-${i}`, name: `BOT ${i + 1}`, at: [{ x: -9, y: 0, z: 27.5 }, { x: 4, y: 0, z: 29 }, { x: 9, y: 0, z: 27.5 }][i], yaw: Math.PI, role: 'bot', weapon: i === 1 ? 'sidearm' : 'rifle' });
  }
  step(frame: InputFrame): GameEvent[] {
    const events = this.tick(frame);
    for (const event of events) if (event.type === 'respawn') {
      const def = this.definitions.get(event.player), p = this.sim.players.get(event.player); if (!def || !p) continue;
      if (def.role === 'dummy') Object.assign(p, placed(def.at), { yaw: def.yaw, protectedUntil: 0 });
      else { p.protectedUntil = 0; this.agents.set(def.id, Object.assign(new Agent(def, p, this.nav, this.level), { group: '' })); }
    }
    return events;
  }
}
const COMPASS = ['north', 'north-east', 'east', 'south-east', 'south', 'south-west', 'west', 'north-west'];
/** Compass word for the direction from one point to another (+z is north, as on the HUD compass). */
export function bearing(from: Vec3, to: Vec3) { const a = (Math.atan2(to.x - from.x, to.z - from.z) + Math.PI * 2) % (Math.PI * 2); return COMPASS[Math.round(a / (Math.PI / 4)) % 8]; }
export function accuracy(stats: { shots: number; hits: number }) { return stats.shots ? Math.round(stats.hits / stats.shots * 100) : 0; }
export type { Player };
