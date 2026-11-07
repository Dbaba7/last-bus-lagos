import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { DynamicTexture } from '@babylonjs/core/Materials/Textures/dynamicTexture';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import type { Camera } from '@babylonjs/core/Cameras/camera';
import type { Scene } from '@babylonjs/core/scene';
import { Engine } from '@babylonjs/core/Engines/engine';
import { WEAPONS, MOVE, traverseProgress, type Player, type WeaponId } from '@lastbus/shared';
import { assemble, weaponParts, type Part } from './models.js';
import { surface } from './textures.js';
export type Cue = 'magout' | 'magin' | 'bolt' | 'slide' | 'switch';
interface Rig { root: TransformNode; mag: TransformNode; bolt: TransformNode; leftHand: TransformNode; muzzle: Vector3; sight: [number, number, number]; hip: Vector3; ads: Vector3 }
/**
 * First-person arms and weapons. The hands are children of the weapon, so the
 * grip can never drift off the gun; the left hand is its own node so it can
 * leave the handguard to swap magazines. Everything here is presentation: it
 * reads predicted state and never feeds back into the simulation.
 */
export class Viewmodel {
  readonly root: TransformNode; private rigs = new Map<WeaponId, Rig>(); private flash: Mesh; private current: WeaponId = 'rifle';
  private ads = 0; private sprint = 0; private kickZ = 0; private kickV = 0; private kickPitch = 0; private pitchV = 0; private bobPhase = 0; private swayX = 0; private swayY = 0;
  /** Free hands for vaults, mantles, ladders and slides; the weapon drops out of view while they work. */
  private hands: [TransformNode, TransformNode]; private officerHands: [TransformNode, TransformNode]; private civilianHands: [TransformNode, TransformNode]; private busy = 0; private reach = [0, 0];
  private dip = 0; private flashUntil = 0; private lastReload = 0; private cues = new Set<string>(); private crouch = 0; private switchT = 1;
  onCue?: (cue: Cue) => void;
  constructor(private scene: Scene, private camera: Camera) {
    // Modelled at real scale, shown at 60% so a full-length rifle fits a 90° view without filling it.
    this.root = new TransformNode('viewmodel', scene); this.root.parent = camera; this.root.scaling.setAll(0.6);
    const metal = new StandardMaterial('vm-metal', scene); metal.specularColor = new Color3(0.35, 0.35, 0.35); metal.specularPower = 42; metal.diffuseTexture = surface(scene, 'metal', 256).diffuse;
    const skin = new StandardMaterial('vm-skin', scene); skin.specularColor = new Color3(0.08, 0.07, 0.06); skin.specularPower = 12; skin.diffuseTexture = surface(scene, 'fabric', 256).diffuse;
    for (const weapon of ['rifle', 'sidearm'] as WeaponId[]) this.rigs.set(weapon, this.rig(weapon, metal, skin));
    const pair = (glove: string, sleeve: string, cuff: string) => [-1, 1].map(side => {
      const hand = new TransformNode(`vm-hand-${side}`, scene); hand.parent = camera; hand.scaling.setAll(0.62);
      assemble(scene, 'vm-free-hand', [
        { shape: { box: [0.085, 0.035, 0.11] }, at: [0, 0, 0], color: glove }, { shape: { box: [0.02, 0.03, 0.07] }, at: [side * -0.05, 0.005, -0.01], rot: [0, side * 0.5, 0], color: glove },
        { shape: { limb: [0.036, [0, 0.01, -0.06], [side * 0.08, -0.12, -0.42]] }, at: [0, 0, 0], color: sleeve }, { shape: { cyl: [0.085, 0.035] }, at: [side * 0.02, -0.02, -0.12], rot: [1.25, 0, 0], color: cuff }
      ], skin, hand);
      for (const mesh of hand.getChildMeshes()) { mesh.renderingGroupId = 1; mesh.isPickable = false; }
      hand.setEnabled(false); return hand;
    }) as [TransformNode, TransformNode];
    // Ada's gloves and navy sleeves; a civilian's bare hands and rolled shirt cuffs.
    this.officerHands = this.hands = pair('#1c1b1a', '#1f2d4d', '#16223d'); this.civilianHands = pair('#6b4129', '#6b4129', '#a9c6e2');
    // Muzzle flash: two crossed additive quads with a painted star, plus a brief world light owned by the renderer.
    const tex = new DynamicTexture('flash-tex', { width: 128, height: 128 }, scene, false), ctx = tex.getContext() as unknown as CanvasRenderingContext2D;
    const g = ctx.createRadialGradient(64, 64, 2, 64, 64, 60); g.addColorStop(0, 'rgba(255,250,220,1)'); g.addColorStop(0.25, 'rgba(255,190,90,0.9)'); g.addColorStop(1, 'rgba(255,120,20,0)');
    ctx.fillStyle = g; ctx.beginPath(); for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2, r = i % 2 ? 22 : 62; ctx.lineTo(64 + Math.cos(a) * r, 64 + Math.sin(a) * r); } ctx.fill(); tex.hasAlpha = true; tex.update();
    const fm = new StandardMaterial('flash', scene); fm.diffuseTexture = tex; fm.emissiveTexture = tex; fm.opacityTexture = tex; fm.disableLighting = true; fm.alphaMode = Engine.ALPHA_ADD; fm.backFaceCulling = false;
    this.flash = MeshBuilder.CreatePlane('flash', { size: 0.22 }, scene); this.flash.material = fm; const cross = MeshBuilder.CreatePlane('flash2', { width: 0.34, height: 0.12 }, scene); cross.material = fm; cross.parent = this.flash; cross.rotation.y = Math.PI / 2; cross.position.z = 0.08;
    for (const mesh of this.root.getChildMeshes()) { mesh.renderingGroupId = 1; mesh.isPickable = false; }
    this.flash.renderingGroupId = 1; cross.renderingGroupId = 1; this.flash.isPickable = false; this.flash.setEnabled(false);
  }
  private rig(weapon: WeaponId, metal: StandardMaterial, skin: StandardMaterial): Rig {
    const def = weaponParts(weapon, 'high'), root = new TransformNode(`vm-${weapon}`, this.scene); root.parent = this.root;
    assemble(this.scene, `vm-${weapon}-body`, def.parts, metal, root);
    const mag = new TransformNode('vm-mag', this.scene); mag.parent = root; assemble(this.scene, 'vm-mag-mesh', def.magazine, metal, mag);
    const bolt = new TransformNode('vm-bolt', this.scene); bolt.parent = root;
    assemble(this.scene, 'vm-bolt-mesh', weapon === 'rifle' ? [{ shape: { box: [0.012, 0.014, 0.05] }, at: [0.035, 0.05, 0.1], color: '#1c1f20' }] : [{ shape: { box: [0.034, 0.012, 0.06] }, at: [0, 0.075, -0.02], color: '#2b2f31' }], metal, bolt);
    // Long-sleeved uniform and gloves; the cuff band marks the elbow fold.
    const glove = '#1c1b1a', sleeve = '#1f2d4d', cuff = '#16223d';
    // Right hand wraps the pistol grip; the forearm runs back and down out of frame.
    const g: [number, number, number] = weapon === 'rifle' ? [0, -0.06, -0.03] : [0, -0.03, -0.012];
    const elbowR: [number, number, number] = [g[0] + 0.14, g[1] - 0.22, g[2] - 0.3], shoulderR: [number, number, number] = [g[0] + 0.3, g[1] - 0.5, g[2] - 0.62];
    const right: Part[] = [
      { shape: { box: [0.062, 0.09, 0.095] }, at: [g[0] + 0.01, g[1], g[2]], rot: [0.3, 0, 0], color: glove },
      { shape: { box: [0.05, 0.03, 0.06] }, at: [g[0] - 0.02, g[1] + 0.035, g[2] + 0.03], color: glove },
      // Three fingers wrapped round the front of the grip, the index finger along the guard, knuckle seams on the glove.
      ...[0, 1, 2].map(i => ({ shape: { limb: [0.0125, [g[0] + 0.03, g[1] - 0.005 - i * 0.022, g[2] + 0.03 + i * 0.006], [g[0] - 0.022, g[1] - 0.008 - i * 0.022, g[2] + 0.042 + i * 0.006]] }, at: [0, 0, 0], color: glove }) as Part),
      { shape: { limb: [0.012, [g[0] - 0.024, g[1] + 0.03, g[2] + 0.035], [g[0] - 0.022, g[1] + 0.033, g[2] + 0.085]] }, at: [0, 0, 0], color: glove },
      { shape: { box: [0.066, 0.006, 0.04] }, at: [g[0] + 0.01, g[1] + 0.03, g[2] + 0.02], rot: [0.3, 0, 0], color: '#2c2a28' },
      { shape: { limb: [0.034, [g[0] + 0.02, g[1] - 0.04, g[2] - 0.05], elbowR] }, at: [0, 0, 0], color: sleeve },
      { shape: { limb: [0.05, [elbowR[0] + 0.02, elbowR[1] + 0.02, elbowR[2] + 0.06], shoulderR] }, at: [0, 0, 0], color: sleeve },
      { shape: { cyl: [0.1, 0.04] }, at: [elbowR[0] + 0.01, elbowR[1] + 0.02, elbowR[2] + 0.07], rot: [1.0, 0, -0.35], color: cuff }
    ];
    assemble(this.scene, 'vm-right-arm', right, skin, root);
    const leftHand = new TransformNode('vm-left', this.scene); leftHand.parent = root;
    const grip = weapon === 'rifle' ? [0, -0.035, 0.32] : [-0.012, -0.045, 0.0];
    leftHand.position.set(grip[0], grip[1], grip[2]);
    const elbowL: [number, number, number] = weapon === 'rifle' ? [-0.2, -0.16, -0.18] : [-0.16, -0.2, -0.25], shoulderL: [number, number, number] = [elbowL[0] - 0.12, elbowL[1] - 0.32, elbowL[2] - 0.32];
    const left: Part[] = [
      { shape: { box: [0.07, 0.05, 0.1] }, at: [-0.02, -0.015, 0], rot: [0, 0, weapon === 'rifle' ? 0.45 : 0.2], color: glove },
      { shape: { box: [0.018, 0.055, 0.075] }, at: [0.032, 0.012, 0], color: glove },
      // Fingers curl up the far side of the handguard; a watch sits on the wrist above the glove cuff.
      ...[-0.03, -0.01, 0.01, 0.03].map(z => ({ shape: { limb: [0.011, [-0.045, 0.0, z], [weapon === 'rifle' ? 0.03 : 0.025, 0.035, z]] }, at: [0, 0, 0], color: glove }) as Part),
      { shape: { cyl: [0.078, 0.022] }, at: [-0.05, -0.03, -0.07], rot: [1.2, 0, 0.3], color: '#3a3a3a' }, { shape: { box: [0.03, 0.006, 0.03] }, at: [-0.065, -0.012, -0.07], rot: [0, 0, 0.3], color: '#8a8f92' },
      { shape: { limb: [0.034, [-0.04, -0.03, -0.02], elbowL] }, at: [0, 0, 0], color: sleeve },
      { shape: { limb: [0.05, [elbowL[0] + 0.03, elbowL[1] + 0.01, elbowL[2] + 0.05], shoulderL] }, at: [0, 0, 0], color: sleeve },
      { shape: { cyl: [0.1, 0.04] }, at: [elbowL[0] + 0.03, elbowL[1] + 0.02, elbowL[2] + 0.06], rot: [1.1, 0, 0.4], color: cuff }
    ];
    assemble(this.scene, 'vm-left-arm', left, skin, leftHand);
    const hip = weapon === 'rifle' ? new Vector3(0.2, -0.22, 0.42) : new Vector3(0.2, -0.2, 0.5);
    const ads = new Vector3(-def.sight[0], -def.sight[1], weapon === 'rifle' ? 0.2 : 0.42);
    root.setEnabled(false);
    return { root, mag, bolt, leftHand, muzzle: new Vector3(...def.muzzle), sight: def.sight, hip, ads };
  }
  /**
   * Hands reaching for the world: one hand plants on the obstacle during a vault, both push
   * down over the ledge during a mantle, they alternate up the rungs on a ladder, and the left
   * hand trails low beside the body in a slide.
   */
  private traverseHands(p: Player, dt: number) {
    const kind = p.traverse, s = traverseProgress(p), bump = Math.sin(Math.min(1, s) * Math.PI);
    this.busy += ((kind && kind !== MOVE.slide ? 1 : 0) - this.busy) * Math.min(1, dt * (kind ? 18 : 9));
    const pose: [number, number, number, number][] = [[-0.2, -0.7, 0.4, 0], [0.2, -0.7, 0.4, 0]];
    if (kind === MOVE.vault) { const plant = s < 0.55 ? Math.min(1, s / 0.25) : Math.max(0, 1 - (s - 0.55) / 0.3); pose[0] = [-0.13, -0.2 - (s > 0.3 ? (s - 0.3) * 0.35 : 0), 0.55 - s * 0.2, plant]; pose[1] = [0.24, -0.42, 0.42, plant * 0.4]; }
    else if (kind === MOVE.mantle) { const press = s < 0.25 ? s / 0.25 : 1, down = Math.max(0, (s - 0.25) / 0.6); for (const i of [0, 1]) pose[i] = [(i ? 0.19 : -0.19), -0.08 - down * 0.36, 0.58 - down * 0.12, s > 0.9 ? (1 - s) * 10 : press]; }
    else if (kind === MOVE.climb) { const phase = p.y * 3.4; for (const i of [0, 1]) pose[i] = [(i ? 0.2 : -0.2), -0.2 + Math.sin(phase + i * Math.PI) * 0.1, 0.46, 1]; }
    else if (kind === MOVE.slide) { pose[0] = [-0.36, -0.44, 0.3, bump]; }
    for (const i of [0, 1]) {
      const [x, y, z, w] = pose[i]; this.reach[i] += (w - this.reach[i]) * Math.min(1, dt * 20);
      const hand = this.hands[i], on = this.reach[i] > 0.02; hand.setEnabled(on); if (!on) continue;
      const k = this.reach[i]; hand.position.set(x, y * k - 0.6 * (1 - k), z); hand.rotation.set(kind === MOVE.climb ? -0.9 : 0.25, 0, (i ? -1 : 1) * 0.15);
    }
  }
  /** Whose free hands reach into view on vaults and ladders. */
  civilian(on: boolean) { for (const hand of this.hands) hand.setEnabled(false); this.hands = on ? this.civilianHands : this.officerHands; }
  shot() { this.kickV += 3.2; this.pitchV += 6 * (this.current === 'sidearm' ? 1.4 : 1); this.flashUntil = performance.now() + 45; this.flash.rotation.z = Math.random() * Math.PI; }
  land(strength: number) { this.dip = Math.min(0.06, strength * 0.012); }
  muzzleWorld() { const rig = this.rigs.get(this.current)!; return Vector3.TransformCoordinates(rig.muzzle, rig.root.getWorldMatrix()); }
  get adsBlend() { return this.ads; }
  /** Advances presentation for one render frame. `comfort` scales bob and sway; `look` is this frame's raw mouse delta. */
  update(p: Player, now: number, dt: number, look: { x: number; y: number }, comfort: { bob: number; shake: number }, visible: boolean) {
    this.root.setEnabled(visible && p.health > 0);
    if (!visible || p.health <= 0) { this.flash.setEnabled(false); for (const h of this.hands) h.setEnabled(false); return; }
    this.traverseHands(p, dt);
    if (p.weapon !== this.current) { this.current = p.weapon; this.switchT = 0; this.onCue?.('switch'); this.cues.clear(); }
    this.switchT = Math.min(1, this.switchT + dt / Math.max(0.05, WEAPONS[p.weapon].equip));
    const rig = this.rigs.get(p.weapon)!; for (const [id, r] of this.rigs) r.root.setEnabled(id === p.weapon);
    const speed = Math.hypot(p.vx, p.vz), reloading = p.reloadUntil > now;
    this.ads += ((p.aiming && !reloading ? 1 : 0) - this.ads) * Math.min(1, dt * (p.aiming ? 16 : 12));
    this.sprint += ((speed > 6 && p.grounded ? 1 : 0) - this.sprint) * Math.min(1, dt * 10);
    this.crouch += ((p.crouched ? 1 : 0) - this.crouch) * Math.min(1, dt * 10);
    // Critically damped springs for recoil: snappy kick, fast settle, no wobble.
    const spring = (x: number, v: number, k: number) => { const a = -k * k * x - 2 * k * v; v += a * dt; return [x + v * dt, v]; };
    [this.kickZ, this.kickV] = spring(this.kickZ, this.kickV, 26); [this.kickPitch, this.pitchV] = spring(this.kickPitch, this.pitchV, 22);
    this.bobPhase += speed * dt * (this.sprint > 0.5 ? 1.25 : 1) * 2.1;
    const bob = comfort.bob * (1 - this.ads * 0.85) * Math.min(1, speed / 5) * (p.grounded ? 1 : 0.2);
    const swayLimit = 0.04 * (1 - this.ads * 0.8) * comfort.shake;
    this.swayX += (Math.max(-swayLimit, Math.min(swayLimit, -look.x * 0.0009)) - this.swayX) * Math.min(1, dt * 14);
    this.swayY += (Math.max(-swayLimit, Math.min(swayLimit, -look.y * 0.0009)) - this.swayY) * Math.min(1, dt * 14);
    this.dip *= Math.exp(-dt * 9);
    const base = Vector3.Lerp(rig.hip, rig.ads, this.ads);
    // Reload choreography: tilt, magazine out, new magazine in, then work the action.
    let tilt = 0, magDrop = 0, handDrop = 0, boltPull = 0;
    if (reloading) {
      const total = WEAPONS[p.weapon][p.guns[p.weapon].ammo === 0 || this.lastReload === 2 ? 'emptyReload' : 'reload'];
      const t = 1 - (p.reloadUntil - now) / total;
      if (this.lastReload === 0) { this.lastReload = p.guns[p.weapon].ammo === 0 ? 2 : 1; this.cues.clear(); }
      tilt = Math.sin(Math.min(1, t / 0.9) * Math.PI) * 0.45;
      magDrop = t < 0.2 ? t / 0.2 : t < 0.55 ? 1 : t < 0.75 ? 1 - (t - 0.55) / 0.2 : 0;
      handDrop = t > 0.1 && t < 0.8 ? Math.sin((t - 0.1) / 0.7 * Math.PI) : 0;
      boltPull = this.lastReload === 2 && t > 0.8 && t < 0.95 ? Math.sin((t - 0.8) / 0.15 * Math.PI) : 0;
      const cue = (name: Cue, at: number) => { if (t >= at && !this.cues.has(name)) { this.cues.add(name); this.onCue?.(name); } };
      cue('magout', 0.18); cue('magin', 0.7); if (this.lastReload === 2) cue(p.weapon === 'rifle' ? 'bolt' : 'slide', 0.85);
    } else { this.lastReload = 0; }
    rig.mag.position.y = -magDrop * 0.25; rig.mag.position.z = -magDrop * 0.05; rig.mag.setEnabled(magDrop < 0.98);
    rig.leftHand.position.y = (p.weapon === 'rifle' ? -0.035 : -0.045) - handDrop * 0.16; rig.leftHand.position.z = (p.weapon === 'rifle' ? 0.32 : 0) - handDrop * (p.weapon === 'rifle' ? 0.2 : 0.05);
    rig.bolt.position.z = -boltPull * 0.07;
    const lower = (1 - this.switchT) ** 2 * 0.25 + (p.equipUntil > now ? 0.05 : 0) + this.busy * 0.42;
    const bx = Math.sin(this.bobPhase) * 0.011 * bob, by = Math.abs(Math.cos(this.bobPhase)) * 0.009 * bob;
    rig.root.position.set(base.x + bx + this.sprint * -0.04 + this.crouch * -0.01, base.y - by - lower - this.dip - this.sprint * 0.04 - this.crouch * 0.012, base.z - this.kickZ * 0.04 - this.sprint * 0.02);
    rig.root.rotation.set(-this.kickPitch * 0.035 + this.swayY + this.sprint * 0.35 + lower * 2 + tilt * 0.4, this.swayX - this.sprint * 0.7 - (1 - this.ads) * 0.03, tilt * 0.6 + this.sprint * 0.25 + this.crouch * 0.06);
    this.flash.setEnabled(performance.now() < this.flashUntil);
    if (this.flash.isEnabled()) { this.flash.position.copyFrom(this.muzzleWorld()); this.flash.lookAt(this.camera.globalPosition); }
  }
}
