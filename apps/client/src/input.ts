import { neutral, type InputFrame, type Player, type WeaponId } from '@lastbus/shared';
import { DEFAULT_BINDINGS, type Action } from './settings.js';

/**
 * Keyboard/mouse and touch input. Mouse deltas are applied the moment they
 * arrive, with no smoothing, so aim never trails the hand. Fixed-step frames
 * sample held state; one-shot presses are kept as edges until consumed.
 */
export class InputController {
  yaw = 0; pitch = 0; locked = false; enabled = false; touchMode = false;
  sensitivityX = 1; sensitivityY = 1; aimMultiplier = 0.8; invertY = false;
  toggleAim = false; toggleCrouch = false; toggleSprint = false;
  bindings: Record<Action, string[]> = structuredClone(DEFAULT_BINDINGS);
  /** Accumulated raw mouse movement this render frame, read by the viewmodel for sway. */
  lookDelta = { x: 0, y: 0 };
  private touchActive = false;
  private moveX = 0; private moveZ = 0; private sprinting = false;
  private keys = new Set<string>(); private edges = new Set<string>();
  private firing = false; private trigger = false; private slot: WeaponId | '' = '';
  /** Ticks left on a slide started by tapping crouch mid-sprint (toggle crouch and touch); the body stands up when it ends. */
  private slideTicks = 0;
  private aimHeld = false; private aimLatched = false; private crouchLatched = false; private sprintLatched = false; private touchCrouch = false; private touchAim = false; private touchInteract = false;
  onLockChange?: (active: boolean) => void;
  onScoreboard?: (show: boolean) => void;
  onClear?: () => void;
  onPause?: () => void;
  /** Rebinding capture: receives the next key or mouse button instead of gameplay. */
  capture?: (code: string) => void;
  get active() { return this.touchMode ? this.touchActive : this.locked; }
  get aiming() { return this.touchMode ? this.touchAim : this.toggleAim ? this.aimLatched : this.aimHeld; }

  constructor(private canvas: HTMLCanvasElement) {
    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === canvas;
      if (!this.touchMode) { if (!this.locked) this.clear(); this.onLockChange?.(this.active); }
    });
    document.addEventListener('mousemove', e => { if (!this.touchMode && this.locked && this.enabled) this.look(e.movementX, e.movementY, 0.002); });
    document.addEventListener('keydown', e => {
      if (this.capture) { e.preventDefault(); if (e.code !== 'Escape') this.capture(e.code); else this.capture(''); return; }
      if (e.code === 'Escape' && this.touchMode && this.active) this.pause();
      if (this.touchMode || !this.enabled || !this.locked) return;
      if (e.code === 'Tab' || e.code === 'Space' || e.ctrlKey || this.bound(e.code)) e.preventDefault();
      if (e.repeat) return;
      if (!this.keys.has(e.code)) this.edges.add(e.code); this.keys.add(e.code);
      if (this.is('rifle', e.code)) this.slot = 'rifle'; if (this.is('sidearm', e.code)) this.slot = 'sidearm';
      if (this.is('scores', e.code)) this.onScoreboard?.(true);
      if (this.is('crouch', e.code) && this.toggleCrouch) { if (this.sprintingForward()) this.slideTicks = 26; else this.crouchLatched = !this.crouchLatched; }
      if (this.is('sprint', e.code) && this.toggleSprint) this.sprintLatched = !this.sprintLatched;
    });
    document.addEventListener('keyup', e => { this.keys.delete(e.code); if (this.is('scores', e.code)) this.onScoreboard?.(false); });
    canvas.addEventListener('mousedown', e => {
      if (this.capture) { e.preventDefault(); this.capture(`Mouse${e.button}`); return; }
      if (this.touchMode || !this.enabled || !this.locked) return;
      if (e.button === 0) this.fire(true);
      if (e.button === 2) { this.aimHeld = true; if (this.toggleAim) this.aimLatched = !this.aimLatched; }
      if (e.button === 3 || e.button === 4) { const code = `Mouse${e.button}`; this.edges.add(code); this.keys.add(code); if (this.is('rifle', code)) this.slot = 'rifle'; if (this.is('sidearm', code)) this.slot = 'sidearm'; }
    });
    document.addEventListener('mouseup', e => { if (this.touchMode) return; if (e.button === 0) this.fire(false); if (e.button === 2) this.aimHeld = false; this.keys.delete(`Mouse${e.button}`); });
    canvas.addEventListener('wheel', e => { if (!this.enabled || !this.locked) return; this.slot = this.slot === 'rifle' ? 'sidearm' : this.slot === 'sidearm' ? 'rifle' : e.deltaY > 0 ? 'sidearm' : 'rifle'; }, { passive: true });
    window.addEventListener('blur', () => this.pause());
    document.addEventListener('visibilitychange', () => { if (document.hidden) this.pause(); });
    canvas.addEventListener('contextmenu', e => e.preventDefault());
  }
  private bound(code: string) { return Object.values(this.bindings).some(codes => codes.includes(code)); }
  private is(action: Action, code: string) { return this.bindings[action].includes(code); }
  private held(action: Action) { return this.bindings[action].some(code => this.keys.has(code)); }
  private pressed(action: Action) { return this.bindings[action].some(code => this.edges.has(code)); }
  private sprintingForward() { return this.touchMode ? this.sprinting && this.moveZ > 0.3 : (this.toggleSprint ? this.sprintLatched : this.held('sprint')) && this.held('forward'); }
  setTouchMode(value: boolean) { this.pause(); this.touchMode = value; this.onLockChange?.(false); }
  async lock() {
    if (!this.enabled) return;
    if (this.touchMode) {
      if (window.innerHeight > window.innerWidth) throw new Error('Turn your phone sideways, then tap Enter arena.');
      this.clear(); this.touchActive = true; this.onLockChange?.(true); return;
    }
    const denied = () => { this.onLockChange?.(false); return new Error('Mouse capture was denied. Click Enter arena to try again.'); };
    try { await this.canvas.requestPointerLock({ unadjustedMovement: true } as PointerLockOptions); }
    catch (error) {
      // Raw (unaccelerated) input is optional; fall back to the ordinary lock only where it is unsupported.
      if ((error as Error)?.name !== 'NotSupportedError') throw denied();
      try { await this.canvas.requestPointerLock(); } catch { throw denied(); }
    }
  }
  pause() {
    const wasActive = this.active;
    this.touchActive = false; this.clear();
    if (document.pointerLockElement === this.canvas) document.exitPointerLock();
    this.locked = false; this.onLockChange?.(false); if (wasActive) this.onPause?.();
  }
  look(dx: number, dy: number, scale = 0.005) {
    if (!this.enabled || !this.active) return;
    const aim = this.aiming ? this.aimMultiplier : 1;
    this.lookDelta.x += dx; this.lookDelta.y += dy;
    this.yaw = ((this.yaw + dx * scale * this.sensitivityX * aim + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI;
    this.pitch = Math.max(-1.5, Math.min(1.5, this.pitch - dy * scale * this.sensitivityY * aim * (this.invertY ? -1 : 1)));
  }
  move(x: number, z: number) { if (!this.enabled || !this.active) return; const length = Math.max(1, Math.hypot(x, z)); this.moveX = x / length; this.moveZ = z / length; }
  sprint(value: boolean) { this.sprinting = value && this.enabled && this.active; }
  fire(value: boolean, cancelled = false) { if (value && (!this.enabled || !this.active)) return; if (value && !this.firing) this.trigger = true; this.firing = value; if (cancelled) this.trigger = false; }
  /** Touch actions. Returns false when crouch started a slide instead of toggling, so the button stays up. */
  action(action: 'jump' | 'reload' | 'crouch' | 'aim' | WeaponId) {
    if (!this.enabled || !this.active) return false;
    if (action === 'jump') this.edges.add('Space'); else if (action === 'reload') this.edges.add('KeyR');
    else if (action === 'crouch') { if (!this.touchCrouch && this.sprintingForward()) { this.slideTicks = 26; return false; } this.touchCrouch = !this.touchCrouch; }
    else if (action === 'aim') this.touchAim = !this.touchAim; else this.slot = action;
    return true;
  }
  /** Interaction is consumed by solo modes; it is not part of the network input contract. */
  interactHeld() { return this.enabled && this.active && (this.touchMode ? this.touchInteract : this.held('interact')); }
  holdInteract(value: boolean) { this.touchInteract = value && this.enabled && this.active; }
  clear() {
    this.keys.clear(); this.edges.clear(); this.firing = false; this.trigger = false; this.slot = ''; this.aimHeld = false; this.aimLatched = false;
    this.crouchLatched = false; this.sprintLatched = false; this.touchCrouch = false; this.touchAim = false; this.touchInteract = false;
    this.moveX = 0; this.moveZ = 0; this.sprinting = false; this.slideTicks = 0; this.onScoreboard?.(false); this.onClear?.();
  }
  reset(p: Player) { this.yaw = p.yaw; this.pitch = p.pitch; this.clear(); }
  frame(seq: number, p: Player, round: number): InputFrame {
    const input = neutral(seq, p.life, round); input.yaw = this.yaw; input.pitch = this.pitch;
    if (this.enabled && this.active) {
      const touch = this.touchMode;
      Object.assign(input, {
        x: touch ? this.moveX : Number(this.held('right')) - Number(this.held('left')),
        z: touch ? this.moveZ : Number(this.held('forward')) - Number(this.held('back')),
        // Preserve a tap shorter than one simulation tick. The server derives
        // sidearm edges from fire, so a trigger-only frame would lose that shot.
        sprint: touch ? this.sprinting : this.toggleSprint ? this.sprintLatched : this.held('sprint'), fire: this.firing || this.trigger, trigger: this.trigger,
        jump: this.pressed('jump'), reload: this.pressed('reload'), weapon: this.slot,
        crouch: touch ? this.touchCrouch : this.toggleCrouch ? this.crouchLatched : this.held('crouch'), aim: this.aiming
      });
      // Sprinting forward breaks a toggled aim, like releasing the trigger finger.
      if (input.sprint && input.z > 0 && this.toggleAim) { this.aimLatched = false; input.aim = false; }
      if (input.sprint && input.z > 0 && input.crouch && this.toggleCrouch) { this.crouchLatched = false; input.crouch = false; }
      // A tapped slide holds crouch for its length; the shared solver decides whether it really slides.
      if (this.slideTicks > 0) { this.slideTicks--; input.crouch = true; }
    }
    this.edges.clear(); this.trigger = false; this.slot = ''; return input;
  }
}
