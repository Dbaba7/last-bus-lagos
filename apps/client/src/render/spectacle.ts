import { Color3, Color4 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { DynamicTexture } from '@babylonjs/core/Materials/Textures/dynamicTexture';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { ParticleSystem } from '@babylonjs/core/Particles/particleSystem';
import '@babylonjs/core/Particles/particleSystemComponent';
import { Engine } from '@babylonjs/core/Engines/engine';
import type { Scene } from '@babylonjs/core/scene';
import type { Vec3 } from '@lastbus/shared';
interface Sprite { mesh: Mesh; v: Vector3; age: number; life: number; size: number; grow: number; fade: number; gravity: number }
interface Glide { mesh: Mesh; from: Vector3; to: Vector3; age: number; life: number; size: number; trail: boolean; pulse: number }
/**
 * Story-scale effects for the sky sequence and the aftermath: lights moving in the
 * clouds, a falling streak, the blast, the wall of dust it sends across the city, and
 * smoke columns on the skyline. The small things are a fixed pool of camera-facing
 * quads; the blast is particle systems, hundreds of puffs for one draw call each, so a
 * phone stays on budget. All of it is built on first use, so menus and multiplayer
 * never pay for it.
 */
export class Spectacle {
  /** Scales how many particles the blast uses; set from the quality preset. */
  detail = 1;
  private flames!: ParticleSystem; private cloud!: ParticleSystem; private trail!: ParticleSystem; private front!: ParticleSystem; private rubble!: ParticleSystem; private ash!: ParticleSystem; private sparkle!: ParticleSystem;
  private blast?: { at: Vector3; age: number }; private wall?: { from: Vector3; to: Vector3; age: number; life: number; at: Vector3; along: Vector3 };
  private ready = false; private sprites: Sprite[] = []; private glides: Glide[] = []; private ring?: Mesh; private ringAge = -1; private ringAt = new Vector3();
  private mats: Record<string, StandardMaterial> = {}; private smoke: { mesh: Mesh; base: Vector3; phase: number; size: number }[] = [];
  constructor(private scene: Scene) {}
  private build() {
    if (this.ready) return; this.ready = true;
    const soft = new DynamicTexture('spectacle-soft', { width: 64, height: 64 }, this.scene, false), ctx = soft.getContext() as unknown as CanvasRenderingContext2D, g = ctx.createRadialGradient(32, 32, 1, 32, 32, 32);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.4, 'rgba(255,255,255,0.55)'); g.addColorStop(1, 'rgba(255,255,255,0)'); ctx.fillStyle = g; ctx.fillRect(0, 0, 64, 64); soft.hasAlpha = true; soft.update();
    const make = (name: string, color: string, additive: boolean) => { const m = new StandardMaterial(`spectacle-${name}`, this.scene); m.diffuseColor = Color3.Black(); m.emissiveColor = Color3.FromHexString(color); m.opacityTexture = soft; m.disableLighting = true; m.alphaMode = additive ? Engine.ALPHA_ADD : Engine.ALPHA_COMBINE; m.disableDepthWrite = true; m.backFaceCulling = false; m.fogEnabled = !additive; return m; };
    this.mats = { glow: make('glow', '#fff1d0', true), fire: make('fire', '#ff9a3a', true), dust: make('dust', '#b7a690', false), smoke: make('smoke', '#3a3432', false), glass: make('glass', '#d8eef5', true) };
    for (let i = 0; i < 64; i++) { const mesh = MeshBuilder.CreatePlane('spectacle', { size: 1 }, this.scene); mesh.billboardMode = Mesh.BILLBOARDMODE_ALL; mesh.isPickable = false; mesh.setEnabled(false); this.sprites.push({ mesh, v: new Vector3(), age: 1, life: 0, size: 1, grow: 0, fade: 1, gravity: 0 }); }
    for (let i = 0; i < 6; i++) { const mesh = MeshBuilder.CreatePlane('spectacle-glide', { size: 1 }, this.scene); mesh.billboardMode = Mesh.BILLBOARDMODE_ALL; mesh.material = this.mats.glow; mesh.isPickable = false; mesh.setEnabled(false); this.glides.push({ mesh, from: new Vector3(), to: new Vector3(), age: 1, life: 0, size: 1, trail: false, pulse: 0 }); }
    // Billowing puffs: overlapping soft blobs, so each particle reads as a lump of smoke rather than a round blur.
    const puff = new DynamicTexture('spectacle-puff', { width: 128, height: 128 }, this.scene, false), p = puff.getContext() as unknown as CanvasRenderingContext2D; let seed = 77; const rand = () => (seed = seed * 16807 % 2147483647) / 2147483647;
    for (let i = 0; i < 46; i++) { const a = rand() * Math.PI * 2, d = rand() * rand() * 40, r = 12 + rand() * 20, x = 64 + Math.cos(a) * d, y = 64 + Math.sin(a) * d, b = p.createRadialGradient(x, y, 1, x, y, r); const body = 0.3 + rand() * 0.34; b.addColorStop(0, `rgba(255,255,255,${body})`); b.addColorStop(0.62, `rgba(255,255,255,${body * 0.8})`); b.addColorStop(1, 'rgba(255,255,255,0)'); p.fillStyle = b; p.fillRect(x - r, y - r, r * 2, r * 2); }
    puff.hasAlpha = true; puff.update();
    const blob = (name: string, capacity: number, texture: DynamicTexture, additive: boolean, life: [number, number], size: [number, number], gradient: [number, string, number][], sizes: [number, number][]) => {
      const ps = new ParticleSystem(name, Math.ceil(capacity * this.detail), this.scene); ps.particleTexture = texture; ps.blendMode = additive ? ParticleSystem.BLENDMODE_ADD : ParticleSystem.BLENDMODE_STANDARD; ps.updateSpeed = 1 / 60; ps.emitRate = 0; ps.gravity = Vector3.Zero();
      ps.emitter = Vector3.Zero(); ps.minLifeTime = life[0]; ps.maxLifeTime = life[1]; ps.minSize = size[0]; ps.maxSize = size[1]; ps.minAngularSpeed = -0.5; ps.maxAngularSpeed = 0.5; ps.minInitialRotation = 0; ps.maxInitialRotation = Math.PI * 2;
      for (const [t, color, alpha] of gradient) { const c = Color3.FromHexString(color); ps.addColorGradient(t, new Color4(c.r, c.g, c.b, alpha)); } for (const [t, k] of sizes) ps.addSizeGradient(t, size[0] * k, size[1] * k); return ps;
    };
    this.flames = blob('flames', 170, puff, true, [1, 3.2], [20, 46], [[0, '#fff4d8', 1], [0.25, '#ffc060', 0.95], [0.6, '#ff6a20', 0.6], [1, '#5a1404', 0]], [[0, 0.5], [0.4, 1.1], [1, 1.5]]);
    this.cloud = blob('cloud', 320, puff, false, [6, 13], [24, 52], [[0, '#ff8a34', 0], [0.05, '#e8682a', 0.92], [0.2, '#7a3520', 0.92], [0.5, '#332a28', 0.9], [1, '#1c1a1a', 0]], [[0, 0.6], [0.5, 1.2], [1, 1.8]]);
    this.trail = blob('trail', 220, puff, false, [3, 5.5], [4, 9], [[0, '#ffd080', 0.95], [0.25, '#ff7a30', 0.85], [0.6, '#8a5a48', 0.6], [1, '#4a4042', 0]], [[0, 0.5], [1, 3.4]]);
    this.front = blob('front', 340, puff, false, [1.2, 2.8], [9, 20], [[0, '#c9a57c', 0], [0.12, '#a98660', 0.9], [0.7, '#7c6248', 0.75], [1, '#5c4a3a', 0]], [[0, 0.7], [1, 1.9]]);
    this.rubble = blob('rubble', 120, soft, false, [0.7, 1.6], [0.12, 0.5], [[0, '#2a2622', 1], [1, '#1a1816', 1]], [[0, 1], [1, 1]]); this.rubble.gravity = new Vector3(0, -14, 0);
    this.ash = blob('ash', 150, soft, true, [2.5, 6], [0.05, 0.16], [[0, '#ffb060', 0], [0.2, '#ffa040', 1], [0.8, '#ff6a20', 0.8], [1, '#401000', 0]], [[0, 1], [1, 0.6]]); this.ash.gravity = new Vector3(0.3, -0.9, 0);
    this.sparkle = blob('sparkle', 90, soft, true, [0.3, 0.9], [0.05, 0.18], [[0, '#fff2c8', 1], [0.5, '#ffb050', 1], [1, '#a03000', 0]], [[0, 1], [1, 0.4]]); this.sparkle.gravity = new Vector3(0, -11, 0);
    this.ring = MeshBuilder.CreateTorus('spectacle-ring', { diameter: 1, thickness: 0.06, tessellation: 48 }, this.scene); this.ring.material = make('ring', '#fff4e0', true); this.ring.isPickable = false; this.ring.setEnabled(false);
  }
  private sprite(kind: string, at: Vector3, v: Vector3, life: number, size: number, grow: number, gravity = 0, fade = 1) {
    const s = this.sprites.find(p => p.age >= p.life) ?? this.sprites[0];
    s.mesh.material = this.mats[kind]; s.mesh.position.copyFrom(at); s.v.copyFrom(v); Object.assign(s, { age: 0, life, size, grow, gravity, fade }); s.mesh.scaling.setAll(size); s.mesh.visibility = 1; s.mesh.setEnabled(true);
  }
  /** A light sliding through the cloud layer, pulsing faintly. */
  skylight(from: Vec3, to: Vec3, seconds = 6) { this.build(); this.glide(from, to, seconds, 9, false); }
  /** The object: a bright head falling along a path with a burning trail. */
  streak(from: Vec3, to: Vec3, seconds = 3) { this.build(); this.glide(from, to, seconds, 16, true); this.trail.emitRate = 42 * this.detail; this.trail.start(); }
  private glide(from: Vec3, to: Vec3, seconds: number, size: number, trail: boolean) {
    const g = this.glides.find(x => x.age >= x.life) ?? this.glides[0];
    Object.assign(g, { from: new Vector3(from.x, from.y, from.z), to: new Vector3(to.x, to.y, to.z), age: 0, life: seconds, size, trail, pulse: Math.random() * 6 }); g.mesh.material = trail ? this.mats.fire : this.mats.glow; g.mesh.setEnabled(true);
  }
  /**
   * The blast. A white core that swells and burns out, a fireball, then a stem of smoke feeding a mushroom cap that rolls outward
   * and keeps climbing for as long as the scene lasts, lit from inside at first. The ring runs along the ground ahead of it.
   */
  explosion(at: Vec3) {
    this.build(); const p = new Vector3(at.x, at.y, at.z), ground = new Vector3(at.x, 0, at.z); this.blast = { at: ground, age: 0 };
    this.sprite('glow', p, Vector3.Zero(), 1.5, 150, 110, 0, 1); this.sprite('glow', p, Vector3.Zero(), 2.6, 90, 90, 0, 0.8);
    this.trail.stop(); const f = this.flames; f.emitter = p.clone(); f.minEmitBox = new Vector3(-16, -14, -16); f.maxEmitBox = new Vector3(16, 16, 16); f.direction1 = new Vector3(-16, 2, -16); f.direction2 = new Vector3(16, 26, 16); f.manualEmitCount = Math.ceil(120 * this.detail); f.start();
    const c = this.cloud; c.emitRate = 34 * this.detail; c.emitter = ground;
    c.startPositionFunction = (_, position) => { const b = this.blast; if (!b) return; const cap = Math.random() < 0.62, a = Math.random() * Math.PI * 2, height = Math.min(82, 26 + b.age * 15); if (cap) { const r = (12 + b.age * 7) * (0.75 + Math.random() * 0.4); position.set(b.at.x + Math.cos(a) * r, height + (Math.random() - 0.4) * 12, b.at.z + Math.sin(a) * r); } else { const r = 7 + Math.random() * 9; position.set(b.at.x + Math.cos(a) * r, Math.random() * height, b.at.z + Math.sin(a) * r); } };
    c.startDirectionFunction = (_, direction, particle) => { const b = this.blast; if (!b) return; const out = particle.position.subtract(b.at); out.y = 0; out.normalize(); direction.set(out.x * 7, 5 + Math.random() * 5, out.z * 7); }; c.start();
    this.ringAt.copyFrom(p); this.ringAt.y = 4; this.ringAge = 0; this.ring!.setEnabled(true);
  }
  /** The front of the blast crossing the city from one point to another: a wall of dust with rubble thrown ahead of it. */
  wave(from: Vec3, to: Vec3, seconds: number) {
    this.build(); const a = new Vector3(from.x, 0, from.z), b = new Vector3(to.x, 0, to.z); this.wall = { from: a, to: b, age: 0, life: seconds, at: a.clone(), along: b.subtract(a).normalize() };
    const f = this.front, across = () => new Vector3(-this.wall!.along.z, 0, this.wall!.along.x); f.emitRate = 190 * this.detail;
    f.startPositionFunction = (_, position) => { const w = this.wall; if (!w) return; position.copyFrom(w.at.add(across().scale((Math.random() - 0.5) * 90)).add(w.along.scale(Math.random() * -9))); position.y = 1 + Math.random() * Math.random() * 26; };
    f.startDirectionFunction = (_, direction) => { const w = this.wall; if (!w) return; direction.copyFrom(w.along.scale(10 + Math.random() * 12)); direction.y = 1.5 + Math.random() * 4; }; f.start();
    const r = this.rubble; r.emitRate = 60 * this.detail; r.startPositionFunction = (_, position) => { const w = this.wall; if (!w) return; position.copyFrom(w.at.add(across().scale((Math.random() - 0.5) * 30)).add(w.along.scale(Math.random() * 6))); position.y = 0.4 + Math.random() * 6; };
    r.startDirectionFunction = (_, direction) => { const w = this.wall; if (!w) return; direction.copyFrom(w.along.scale(18 + Math.random() * 22)); direction.x += (Math.random() - 0.5) * 8; direction.y = 2 + Math.random() * 8; }; r.start();
  }
  /** Burning ash and grit falling around the camera after the blast has gone through. */
  embers(on: boolean) { this.build(); const a = this.ash; a.emitRate = on ? 34 * this.detail : 0; a.minEmitBox = new Vector3(-12, 0, -12); a.maxEmitBox = new Vector3(12, 10, 12); a.direction1 = new Vector3(-0.6, -0.3, -0.6); a.direction2 = new Vector3(0.9, 0.2, 0.6); if (on) a.start(); else a.stop(); }
  /** A street lamp or a sign going: a short burst of falling sparks. */
  sparks(at: Vec3) { this.build(); const s = this.sparkle; s.emitter = new Vector3(at.x, at.y, at.z); s.direction1 = new Vector3(-3, -1, -3); s.direction2 = new Vector3(3, 4, 3); s.manualEmitCount = Math.ceil(30 * this.detail); s.start(); }
  /** Dust rolling over the camera after the shockwave. */
  dust(at: Vec3, toward: Vec3) {
    this.build(); const d = new Vector3(toward.x - at.x, 0, toward.z - at.z).normalize();
    for (let i = 0; i < 26; i++) { const side = new Vector3(-d.z, 0, d.x).scale((Math.random() - 0.5) * 24); this.sprite('dust', new Vector3(at.x, 0.8 + Math.random() * 4, at.z).add(side).add(d.scale(-8 - Math.random() * 10)), d.scale(9 + Math.random() * 6).add(new Vector3(0, Math.random() * 1.5, 0)), 3 + Math.random() * 2, 3 + Math.random() * 4, 4, 0, 0.85); }
  }
  /** Glass and sparks bursting from windows and lamps around a point. */
  shatter(at: Vec3, radius = 8) {
    this.build();
    for (let i = 0; i < 24; i++) { const a = Math.random() * Math.PI * 2, r = Math.random() * radius; this.sprite('glass', new Vector3(at.x + Math.cos(a) * r, 2 + Math.random() * 5, at.z + Math.sin(a) * r), new Vector3((Math.random() - 0.5) * 4, Math.random() * 2, (Math.random() - 0.5) * 4), 0.8 + Math.random() * 0.6, 0.12, 0.2, 9); }
  }
  /** A standing smoke column over the skyline (persistent until cleared). */
  smokeColumn(at: Vec3, size = 30) {
    this.build();
    for (let i = 0; i < 5; i++) { const mesh = MeshBuilder.CreatePlane('spectacle-smoke', { size: 1 }, this.scene); mesh.billboardMode = Mesh.BILLBOARDMODE_ALL; mesh.material = this.mats.smoke; mesh.isPickable = false; mesh.visibility = 0.75; this.smoke.push({ mesh, base: new Vector3(at.x + (Math.random() - 0.5) * size * 0.3, at.y + i * size * 0.45, at.z), phase: Math.random() * 6, size: size * (0.8 + i * 0.35) }); }
  }
  update(dt: number, camera?: Vector3) {
    if (!this.ready) return;
    if (this.blast) { this.blast.age += dt; if (this.blast.age > 14) { this.cloud.emitRate = 0; this.blast = undefined; } }
    if (this.wall) { const w = this.wall; w.age += dt; Vector3.LerpToRef(w.from, w.to, Math.min(1, w.age / w.life), w.at); if (w.age > w.life + 1.8) { this.front.stop(); this.rubble.stop(); this.wall = undefined; } }
    if (camera) this.ash.emitter = new Vector3(camera.x, camera.y, camera.z);
    for (const s of this.sprites) {
      if (s.age >= s.life) continue; s.age += dt; if (s.age >= s.life) { s.mesh.setEnabled(false); continue; }
      s.v.y -= s.gravity * dt; s.v.scaleInPlace(Math.exp(-dt * 0.8)); s.mesh.position.addInPlace(s.v.scale(dt));
      const k = s.age / s.life; s.mesh.scaling.setAll(s.size + s.grow * k); s.mesh.visibility = (1 - k) * s.fade;
    }
    for (const g of this.glides) {
      if (g.age >= g.life) continue; g.age += dt; if (g.age >= g.life) { g.mesh.setEnabled(false); if (g.trail) this.trail.stop(); continue; }
      const k = g.age / g.life, t = g.trail ? k ** 1.4 : k; Vector3.LerpToRef(g.from, g.to, t, g.mesh.position);
      g.mesh.scaling.setAll(g.size * (g.trail ? 0.6 + k : 0.8 + Math.sin(g.age * 3 + g.pulse) * 0.2)); g.mesh.visibility = g.trail ? 1 : Math.min(1, Math.min(g.age, g.life - g.age) * 1.5);
      if (g.trail) this.trail.emitter = g.mesh.position.clone();
    }
    if (this.ring && this.ringAge >= 0) {
      this.ringAge += dt; const radius = this.ringAge * 42; this.ring.position.copyFrom(this.ringAt); this.ring.scaling.set(radius * 2, 2 + this.ringAge * 5, radius * 2); this.ring.visibility = Math.max(0, 1 - this.ringAge / 3);
      if (this.ringAge > 3) { this.ringAge = -1; this.ring.setEnabled(false); }
    }
    for (const s of this.smoke) { s.phase += dt * 0.15; s.mesh.position.set(s.base.x + Math.sin(s.phase) * 3, s.base.y + Math.sin(s.phase * 0.7) * 2, s.base.z); s.mesh.scaling.setAll(s.size); }
  }
  /** Removes everything, including smoke columns, when a scene or mode ends. */
  clear() {
    if (this.ready) for (const ps of [this.flames, this.cloud, this.trail, this.front, this.rubble, this.ash, this.sparkle]) { ps.emitRate = 0; ps.stop(); ps.reset(); } this.blast = undefined; this.wall = undefined;
    for (const s of this.sprites) { s.age = s.life; s.mesh.setEnabled(false); } for (const g of this.glides) { g.age = g.life; g.mesh.setEnabled(false); }
    if (this.ring) { this.ring.setEnabled(false); this.ringAge = -1; }
    for (const s of this.smoke) s.mesh.dispose(); this.smoke = [];
  }
}
