import type { ActorLook, ActorPose, CineCue, CineFx, CineSound, CabinState, Cutscene, Ease, Gesture, Grade, PhoneState, Shot, SoundMood, Sting, Vec3 } from '@lastbus/shared';
/** A staged character's live state; the renderer draws it like any other actor. */
export interface ActorState {
  id: string; look: ActorLook; x: number; y: number; z: number; yaw: number; vx: number; vz: number; pose: ActorPose; weapon: 'rifle' | 'sidearm' | 'none';
  gesture: Gesture | ''; gestureT: number; hidden: boolean; keep: boolean; path: Vec3[]; speed: number; face?: number; speaker?: string; folder?: boolean; bag?: boolean; clean?: boolean; variant?: 'sergeant' | 'trader';
}
/** A moving prop (the last bus): position, heading, door opening 0..1 and whether it is shown. */
export interface PropState { id: string; x: number; z: number; yaw: number; door: number; doorTarget: number; hidden: boolean; path: Vec3[]; speed: number; v: number }
export interface CameraPose { pos: Vec3; look: Vec3; fov: number; roll: number }
/** Presentation the director cannot do itself: lines, sounds, stings, effects and ducking. */
export interface DirectorHooks {
  shot?(index: number, shot: Shot): void; say?(key: string): void; sound?(kind: CineSound, at?: Vec3, volume?: number): void;
  sting?(kind: Sting): void; caption?(text: string, sub: string | undefined, seconds: number): void; fx?(kind: CineFx, from?: Vec3, to?: Vec3, seconds?: number): void; duck?(level: number, seconds: number): void; grade?(grade: Grade, seconds: number): void;
  cabin?(state: CabinState, seconds: number): void; phone?(state: PhoneState): void; ambience?(mood: SoundMood, seconds: number): void; radio?(cue: Extract<CineCue, { radio: unknown }>, skipping: boolean): void;
}
const EASE: Record<Ease, (t: number) => number> = { linear: t => t, smooth: t => t * t * (3 - 2 * t), in: t => t * t, out: t => 1 - (1 - t) * (1 - t), hold: () => 0 };
const lerp = (a: Vec3, b: Vec3, k: number): Vec3 => ({ x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k, z: a.z + (b.z - a.z) * k });
const wrap = (a: number) => { while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2; return a; };
const ONE_OFF = ['sound', 'sting', 'fx', 'shake', 'tumble', 'say', 'duck', 'caption'];
/** These effects change what the city is, not just how a moment looks, so a skipped scene still applies them. */
const STATE_FX: CineFx[] = ['live', 'jam'];
/**
 * Plays one cutscene. Shots run in order, each as long as its line takes to speak (the
 * `length` callback), and cues fire at their times within a shot. `next` (a click) ends the
 * current shot and `skip` (holding Space) ends the scene; either way the state cues still
 * land, so actors, props, fades and grades finish where the scene intended.
 */
export class Director {
  shot = 0; t = 0; clock = 0; done = false; shake = 0; roll = 0;
  /** When the current shot's line actually started (it starts late if its recording arrived after the cut). */
  lineAt = 0;
  /** Camera progress through the shot, 0..1. Accumulated, so a shot that grows mid-way slows down instead of jumping back. */
  private progress = 0;
  readonly actors = new Map<string, ActorState>(); readonly props = new Map<string, PropState>();
  fade = { alpha: 0, target: 0, rate: 0, color: 'black' as 'black' | 'white' }; letterbox = { value: 0, target: 1, rate: 2.5 };
  private fired = new Set<CineCue>(); private shakeDecay = 1; private tumble = { left: 0, total: 0 }; private previous?: CameraPose; private pose?: CameraPose;
  constructor(readonly scene: Cutscene, private length: (shot: Shot) => number, private hooks: DirectorHooks = {}, props: Record<string, { x: number; z: number; yaw: number; door?: number }> = {}, private comfort = 1) {
    for (const a of scene.cast ?? []) this.actors.set(a.id, { id: a.id, look: a.look, x: a.at.x, y: a.at.y ?? 0, z: a.at.z, yaw: a.yaw, vx: 0, vz: 0, pose: a.pose ?? 'relaxed', weapon: a.weapon ?? (a.look === 'femi' || a.look === 'civilian' ? 'none' : 'rifle'), gesture: '', gestureT: 0, hidden: !!a.hidden, keep: !!a.keep, path: [], speed: 1.4, speaker: a.speaker, folder: a.folder, bag: a.bag, clean: a.clean, variant: a.variant });
    for (const [id, p] of Object.entries(props)) this.props.set(id, { id, x: p.x, z: p.z, yaw: p.yaw, door: p.door ?? 0, doorTarget: p.door ?? 0, hidden: false, path: [], speed: 0, v: 0 });
    if (scene.fadeIn) this.fade = { alpha: 1, target: 0, rate: 1 / scene.fadeIn, color: 'black' };
    if (scene.grade) hooks.grade?.(scene.grade, 0.01);
    this.hooks.shot?.(0, scene.shots[0]);
  }
  get current() { return this.scene.shots[this.shot]; }
  /** Seconds the current shot lasts, from its line's recording or written length. */
  get span() { return this.lineAt + this.length(this.current); }
  /**
   * The current shot's recording has just become available (it was still decoding at the cut). Restarts the
   * line's timing from now so all of it is heard; returns false when the line belongs to another shot or it
   * is too late in the shot for a restart to make sense.
   */
  lateLine(key: string) {
    if (this.done || this.current.line !== key || this.lineAt > 0 || this.t > Math.min(2.5, this.span * 0.6)) return false;
    this.lineAt = this.t; return true;
  }
  /** Advances the scene and returns the camera for this frame. */
  update(dt: number): CameraPose {
    if (!this.done) {
      this.progress = Math.min(1, this.progress + dt / Math.max(0.01, this.span - this.t) * (1 - this.progress)); this.t += dt; this.clock += dt; this.cues(false);
      const out = this.scene.fadeOut, last = this.shot === this.scene.shots.length - 1;
      if (out && last && this.span - this.t <= out && this.fade.target < 1) this.fade = { ...this.fade, target: 1, rate: 1 / out, color: this.fade.color };
      if (this.t >= this.span) this.next();
    }
    this.animate(dt); return this.camera();
  }
  /** Ends the current shot (a click): its remaining state cues land at once, then the next shot cuts in. */
  next() {
    if (this.done) return;
    this.cues(true); this.previous = this.pose;
    if (this.shot + 1 < this.scene.shots.length) { this.shot++; this.t = 0; this.lineAt = 0; this.progress = 0; this.tumble = { left: 0, total: 0 }; this.hooks.shot?.(this.shot, this.current); this.cues(false); }
    else this.finish();
  }
  /** Ends the whole scene (holding Space). Every state cue still to come is applied. */
  skip() { while (!this.done) { this.cues(true); if (this.shot + 1 < this.scene.shots.length) { this.shot++; this.t = 0; this.lineAt = 0; this.progress = 0; } else this.finish(); } }
  private finish() { this.done = true; if (this.scene.fadeOut) Object.assign(this.fade, { alpha: 1, target: 1 }); for (const a of this.actors.values()) this.snap(a); for (const p of this.props.values()) this.snapProp(p); }
  /** Fires due cues for the current shot; `all` fires the rest of the shot in skip mode. */
  private cues(all: boolean) {
    for (const cue of this.scene.cues ?? []) if (cue.shot === this.shot && !this.fired.has(cue) && (all || this.t >= (cue.at ?? 0))) { this.fired.add(cue); this.fire(cue, all); }
  }
  private fire(cue: CineCue, skipping: boolean) {
    if (skipping && ONE_OFF.some(key => key in cue) && !('fx' in cue && STATE_FX.includes(cue.fx))) return;
    const h = this.hooks;
    if ('actor' in cue) {
      const a = this.actors.get(cue.actor); if (!a) return;
      if (cue.pose) a.pose = cue.pose; if (cue.gesture !== undefined) a.gesture = cue.gesture; if (cue.speed) a.speed = cue.speed;
      if (cue.hide) a.hidden = true; if (cue.show) a.hidden = false; if (cue.bag !== undefined) a.bag = cue.bag;
      if (cue.path || cue.to) a.path = [...(cue.path ?? []), ...(cue.to ? [cue.to] : [])];
      if (cue.face !== undefined) a.face = typeof cue.face === 'number' ? cue.face : Math.atan2(cue.face.x - (a.path.at(-1)?.x ?? a.x), cue.face.z - (a.path.at(-1)?.z ?? a.z));
      if (skipping) this.snap(a);
    } else if ('prop' in cue) {
      const p = this.props.get(cue.prop); if (!p) return;
      if (cue.place) { p.x = cue.place.x; p.z = cue.place.z; p.yaw = cue.yaw ?? p.yaw; p.path = []; p.v = 0; }
      if (cue.path) { p.path = [...cue.path]; p.speed = cue.speed ?? 6; }
      if (cue.door !== undefined) p.doorTarget = cue.door; if (cue.hide) p.hidden = true; if (cue.show) p.hidden = false;
      if (skipping) this.snapProp(p);
    } else if ('fade' in cue) { this.fade = { alpha: skipping || !cue.seconds ? cue.fade : this.fade.alpha, target: cue.fade, rate: cue.seconds ? 1 / cue.seconds : 0, color: cue.color ?? 'black' }; }
    else if ('letterbox' in cue) { this.letterbox = { value: skipping || !cue.seconds ? cue.letterbox : this.letterbox.value, target: cue.letterbox, rate: cue.seconds ? 1 / cue.seconds : 0 }; }
    else if ('grade' in cue) h.grade?.(cue.grade, skipping ? 0.01 : cue.seconds ?? 1);
    else if ('shake' in cue) { this.shake = Math.max(this.shake, cue.shake); this.shakeDecay = 1 / Math.max(0.1, cue.seconds ?? 1); }
    else if ('tumble' in cue) this.tumble = { left: cue.tumble, total: cue.tumble };
    else if ('sound' in cue) h.sound?.(cue.sound, cue.from, cue.volume);
    else if ('sting' in cue) h.sting?.(cue.sting);
    else if ('duck' in cue) h.duck?.(cue.duck, cue.seconds ?? 0.3);
    else if ('say' in cue) h.say?.(cue.say);
    else if ('caption' in cue) h.caption?.(cue.caption, cue.sub, cue.seconds ?? 3);
    else if ('fx' in cue) h.fx?.(cue.fx, cue.from, cue.to, cue.seconds);
    else if ('ambience' in cue) h.ambience?.(cue.ambience, skipping ? 0.3 : cue.seconds ?? 3);
    else if ('radio' in cue) h.radio?.(cue, skipping);
    else if ('cabin' in cue) h.cabin?.(cue.cabin, skipping ? 0 : cue.seconds ?? 1);
    else if ('phone' in cue) h.phone?.(cue.phone);
  }
  private snap(a: ActorState) { const end = a.path.at(-1); if (end) { if (a.path.length) { const prev = a.path.at(-2) ?? a; a.yaw = Math.atan2(end.x - prev.x, end.z - prev.z) || a.yaw; } a.x = end.x; a.z = end.z; a.y = end.y ?? a.y; a.path = []; } if (a.face !== undefined) { a.yaw = a.face; a.face = undefined; } a.vx = 0; a.vz = 0; a.gestureT = a.gesture ? 1 : 0; }
  private snapProp(p: PropState) { const end = p.path.at(-1); if (end) { const prev = p.path.at(-2) ?? p; p.yaw = Math.atan2(end.x - prev.x, end.z - prev.z) || p.yaw; p.x = end.x; p.z = end.z; p.path = []; } p.v = 0; p.door = p.doorTarget; }
  private animate(dt: number) {
    const f = this.fade; if (f.rate) f.alpha += Math.sign(f.target - f.alpha) * Math.min(Math.abs(f.target - f.alpha), f.rate * dt); else f.alpha = f.target;
    const lb = this.letterbox; if (lb.rate) lb.value += Math.sign(lb.target - lb.value) * Math.min(Math.abs(lb.target - lb.value), lb.rate * dt); else lb.value = lb.target;
    this.shake *= Math.exp(-dt * 3 * this.shakeDecay); this.tumble.left = Math.max(0, this.tumble.left - dt);
    for (const a of this.actors.values()) {
      a.gestureT += ((a.gesture ? 1 : 0) - a.gestureT) * Math.min(1, dt * 4); a.vx = 0; a.vz = 0;
      const next = a.path[0];
      if (next) {
        const dx = next.x - a.x, dz = next.z - a.z, d = Math.hypot(dx, dz), step = Math.min(d, a.speed * dt);
        if (d < 0.02) { a.path.shift(); if (next.y !== undefined) a.y = next.y; }
        else { a.x += dx / d * step; a.z += dz / d * step; a.vx = dx / d * a.speed; a.vz = dz / d * a.speed; a.yaw += wrap(Math.atan2(dx, dz) - a.yaw) * Math.min(1, dt * 8); if (next.y !== undefined) a.y += (next.y - a.y) * Math.min(1, step / Math.max(d, 0.01)); }
      } else if (a.face !== undefined) { const turn = wrap(a.face - a.yaw); a.yaw += Math.sign(turn) * Math.min(Math.abs(turn), dt * 3.5); if (Math.abs(turn) < 0.01) a.face = undefined; }
    }
    for (const p of this.props.values()) {
      p.door += Math.sign(p.doorTarget - p.door) * Math.min(Math.abs(p.doorTarget - p.door), dt * 1.6);
      const next = p.path[0]; if (!next) { p.v = 0; continue; }
      // Vehicles pull away gently and keep rolling; heading turns toward the next waypoint.
      p.v = Math.min(p.speed, p.v + dt * 2.2); const dx = next.x - p.x, dz = next.z - p.z, d = Math.hypot(dx, dz);
      if (d < Math.max(0.3, p.v * dt * 1.5)) { p.path.shift(); continue; }
      p.yaw += wrap(Math.atan2(dx, dz) - p.yaw) * Math.min(1, dt * 1.8); p.x += Math.sin(p.yaw) * p.v * dt; p.z += Math.cos(p.yaw) * p.v * dt;
    }
  }
  private camera(): CameraPose {
    const shot = this.current, k = EASE[shot.ease ?? 'smooth'](this.progress);
    let pose: CameraPose = { pos: lerp(shot.from, shot.to, k), look: lerp(shot.look, shot.lookTo ?? shot.look, k), fov: (shot.fov ?? 60) + ((shot.fovTo ?? shot.fov ?? 60) - (shot.fov ?? 60)) * k, roll: shot.roll ?? 0 };
    if (shot.blend && this.previous && this.t < shot.blend) { const b = EASE.smooth(this.t / shot.blend), p = this.previous; pose = { pos: lerp(p.pos, pose.pos, b), look: lerp(p.look, pose.look, b), fov: p.fov + (pose.fov - p.fov) * b, roll: p.roll + (pose.roll - p.roll) * b }; }
    // Handheld wobble and event shake are layered on top, scaled by the camera-shake comfort setting.
    const c = this.clock, hand = (shot.shake ?? 0) * this.comfort, jolt = this.shake * this.comfort;
    const wobble = (a: number, b: number) => Math.sin(c * a) * 0.6 + Math.sin(c * b + 1.3) * 0.4;
    pose.pos = { x: pose.pos.x + wobble(1.3, 2.9) * hand + (Math.random() - 0.5) * jolt * 0.2, y: pose.pos.y + wobble(1.7, 3.3) * hand * 0.7 + (Math.random() - 0.5) * jolt * 0.2, z: pose.pos.z + wobble(1.1, 2.3) * hand };
    pose.look = { x: pose.look.x + wobble(0.9, 2.1) * hand * 2, y: pose.look.y + wobble(1.2, 2.7) * hand * 1.5, z: pose.look.z };
    pose.roll += wobble(0.7, 1.9) * hand * 0.4;
    if (this.tumble.total > 0) {
      // The blast throws the camera: it spins and drops, and stays thrown until the next shot cuts in.
      const s = 1 - this.tumble.left / this.tumble.total;
      pose.roll += Math.sin(s * Math.PI * 0.8) * 1.6 * Math.min(1, this.comfort + 0.3); pose.pos = { ...pose.pos, y: pose.pos.y - s * 1.1 }; pose.look = { ...pose.look, y: pose.look.y - Math.sin(s * Math.PI) * 4 };
    }
    this.pose = pose; return pose;
  }
}
