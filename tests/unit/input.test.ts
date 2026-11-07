import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { Simulation } from '@lastbus/shared';
import { InputController } from '../../apps/client/src/input.js';
import { TouchControls } from '../../apps/client/src/touch.js';

class Surface extends EventTarget {
  style = { transform: '' }; hidden = false; onclick?: () => void;
  classList = { add: vi.fn(), remove: vi.fn() };
  attributes = new Map<string, string>(); captured = new Set<number>();
  children = new Map<string, Surface>();
  requestPointerLock = vi.fn();
  setPointerCapture(id: number) { this.captured.add(id); }
  hasPointerCapture(id: number) { return this.captured.has(id); }
  releasePointerCapture(id: number) { this.captured.delete(id); }
  getBoundingClientRect() { return { left: 0, top: 0, width: 100, height: 100 }; }
  setAttribute(key: string, value: string) { this.attributes.set(key, value); }
  getAttribute(key: string) { return this.attributes.get(key); }
  querySelector(key: string) { if (!this.children.has(key)) this.children.set(key, new Surface()); return this.children.get(key)!; }
}
const send = (target: EventTarget, type: string, props: Record<string, unknown> = {}) => target.dispatchEvent(Object.assign(new Event(type, { cancelable: true }), props));
let doc: EventTarget & { hidden: boolean; pointerLockElement: unknown; exitPointerLock: () => void };
let win: EventTarget & { innerWidth: number; innerHeight: number }; let orientation: EventTarget;
let canvas: Surface, root: Surface, input: InputController;
const player = new Simulation({ practice: true }).add('test', 'Test');
const frame = () => input.frame(1, player, 1);
const pointer = (id: number, x = 50, y = 50) => ({ pointerId: id, button: 0, clientX: x, clientY: y });
beforeEach(() => {
  doc = Object.assign(new EventTarget(), { hidden: false, pointerLockElement: null, exitPointerLock: vi.fn() });
  orientation = new EventTarget();
  win = Object.assign(new EventTarget(), { innerWidth: 800, innerHeight: 360, matchMedia: () => orientation });
  vi.stubGlobal('document', doc); vi.stubGlobal('window', win);
  canvas = new Surface(); root = new Surface(); input = new InputController(canvas as unknown as HTMLCanvasElement);
  new TouchControls(input, root as unknown as HTMLElement, () => input.pause());
  input.enabled = true; input.setTouchMode(true);
});
afterEach(() => vi.unstubAllGlobals());

it('moves, aims and fires together; lifting aim/fire leaves the move finger active', async () => {
  await input.lock(); expect(canvas.requestPointerLock).not.toHaveBeenCalled();
  const stick = root.querySelector('#touch-move'), fire = root.querySelector('#touch-fire');
  send(stick, 'pointerdown', pointer(1, 86, 14)); send(fire, 'pointerdown', pointer(2)); send(fire, 'pointermove', pointer(2, 90, 30));
  const a = frame(); expect(Math.hypot(a.x, a.z)).toBeCloseTo(1); expect(a.fire).toBe(true); expect(a.trigger).toBe(true); expect(a.yaw).toBeGreaterThan(0); expect(a.pitch).toBeGreaterThan(0);
  expect(frame().trigger).toBe(false); send(fire, 'pointerup', pointer(2));
  expect(frame()).toMatchObject({ fire: false, x: a.x, z: a.z });
  send(stick, 'pointerup', pointer(1)); expect(frame()).toMatchObject({ x: 0, z: 0 });
});
it('ignores unrelated fingers and releases input on pointer cancellation or capture loss', async () => {
  await input.lock(); const fire = root.querySelector('#touch-fire');
  send(fire, 'pointerdown', pointer(1)); send(fire, 'pointerdown', pointer(2)); send(fire, 'pointerup', pointer(2));
  expect(frame().fire).toBe(true); send(fire, 'pointercancel', pointer(1)); expect(frame().fire).toBe(false);
  send(fire, 'pointerdown', pointer(3)); send(fire, 'lostpointercapture', pointer(3)); expect(frame().fire).toBe(false);
});
it('emits jump, reload and weapon actions once; sprint persists only until cleared', async () => {
  await input.lock();
  for (const key of ['jump', 'reload', 'sidearm', 'sprint']) root.querySelector(`#touch-${key}`).onclick!();
  expect(frame()).toMatchObject({ jump: true, reload: true, weapon: 'sidearm', sprint: true });
  expect(frame()).toMatchObject({ jump: false, reload: false, weapon: '', sprint: true });
  input.reset(player); expect(frame().sprint).toBe(false); expect(root.querySelector('#touch-sprint').getAttribute('aria-pressed')).toBe('false');
});
it('keeps a quick fire tap for one server tick, without getting stuck firing', async () => {
  await input.lock(); const fire = root.querySelector('#touch-fire');
  send(fire, 'pointerdown', pointer(1)); send(fire, 'pointerup', pointer(1));
  const pulse = frame(); expect(pulse).toMatchObject({ fire: true, trigger: true });
  expect(frame()).toMatchObject({ fire: false, trigger: false });
  const game = new Simulation({ practice: true }), p = game.add('you', 'You'); game.ready(p.id);
  p.weapon = 'sidearm'; const ammo = p.guns.sidearm.ammo;
  game.step(new Map([[p.id, { ...pulse, seq: 1, life: p.life, round: game.round }]]));
  expect(p.guns.sidearm.ammo).toBe(ammo - 1);
});
it.each(['blur', 'visibility', 'orientation'])('clears and pauses held controls on %s, requiring a deliberate resume', async cause => {
  await input.lock(); const stick = root.querySelector('#touch-move'), fire = root.querySelector('#touch-fire');
  send(stick, 'pointerdown', pointer(1, 86, 50)); send(fire, 'pointerdown', pointer(2));
  if (cause === 'blur') send(win, 'blur');
  else if (cause === 'orientation') send(orientation, 'change');
  else { doc.hidden = true; send(doc, 'visibilitychange'); }
  expect(input.active).toBe(false); expect(frame()).toMatchObject({ x: 0, z: 0, fire: false, trigger: false });
  expect(stick.captured.size + fire.captured.size).toBe(0);
  send(fire, 'pointermove', pointer(2, 100, 100)); await input.lock(); expect(frame().fire).toBe(false);
});
it('guards portrait entry and clamps pitch through long drags', async () => {
  win.innerWidth = 360; win.innerHeight = 800; await expect(input.lock()).rejects.toThrow('sideways'); expect(input.active).toBe(false);
  win.innerWidth = 800; win.innerHeight = 360; await input.lock(); input.look(100000, -100000);
  expect(frame().pitch).toBe(1.5); expect(Math.abs(frame().yaw)).toBeLessThanOrEqual(Math.PI);
});
it('preserves desktop pointer lock, keyboard movement, mouse fire and denied-lock feedback', async () => {
  input.setTouchMode(false); canvas.requestPointerLock.mockRejectedValueOnce(new Error('Denied'));
  await expect(input.lock()).rejects.toThrow('Mouse capture');
  doc.pointerLockElement = canvas; send(doc, 'pointerlockchange');
  send(doc, 'keydown', { code: 'KeyW' }); send(canvas, 'mousedown', { button: 0 }); send(doc, 'mousemove', { movementX: 20, movementY: 0 });
  expect(frame()).toMatchObject({ z: 1, fire: true }); expect(frame().yaw).toBeCloseTo(.04);
  send(doc, 'keyup', { code: 'KeyW' }); send(doc, 'mouseup', { button: 0 }); expect(frame()).toMatchObject({ z: 0, fire: false });
  doc.pointerLockElement = null; send(doc, 'pointerlockchange'); expect(input.active).toBe(false);
});
it('a crouch tap mid-sprint holds crouch for one slide instead of latching it', async () => {
  await input.lock(); root.querySelector('#touch-sprint').onclick!(); send(root.querySelector('#touch-move'), 'pointerdown', pointer(1, 50, 0));
  root.querySelector('#touch-crouch').onclick!(); expect(root.querySelector('#touch-crouch').getAttribute('aria-pressed')).not.toBe('true');
  const frames = Array.from({ length: 30 }, () => frame()); expect(frames[0]).toMatchObject({ crouch: true, sprint: true }); expect(frames[25].crouch).toBe(true); expect(frames[29].crouch).toBe(false);
  send(root.querySelector('#touch-move'), 'pointerup', pointer(1)); root.querySelector('#touch-crouch').onclick!(); expect(frame().crouch).toBe(true);
});
