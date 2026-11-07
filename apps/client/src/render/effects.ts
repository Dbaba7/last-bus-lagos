import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { DynamicTexture } from '@babylonjs/core/Materials/Textures/dynamicTexture';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { Engine } from '@babylonjs/core/Engines/engine';
import type { Scene } from '@babylonjs/core/scene';
import { bounds, type Box, type Vec3 } from '@lastbus/shared';
/** Surface families decide impact colour, sound and decal. */
export type SurfaceKind = 'concrete' | 'metal' | 'wood' | 'flesh' | 'glass' | 'dirt';
export function surfaceOf(box?: Box): SurfaceKind {
  if (!box) return 'dirt';
  if (['bus', 'vehicle', 'rail', 'fence', 'pole'].includes(box.kind) || ['container', 'relay', 'toolcabinet', 'bin', 'generator', 'drums', 'kiosk', 'shelf'].includes(box.style ?? '')) return 'metal';
  if (['stall', 'counter', 'crates', 'bench', 'cartons'].includes(box.style ?? '') || box.kind === 'stall') return 'wood';
  if (box.kind === 'ground') return 'dirt';
  return 'concrete';
}
/** Outward normal of the box face nearest to a hit point. */
export function hitNormal(box: Box, p: Vec3): Vec3 {
  const { min, max } = bounds(box), d = [p.x - min.x, max.x - p.x, p.y - min.y, max.y - p.y, p.z - min.z, max.z - p.z], i = d.indexOf(Math.min(...d));
  return [{ x: -1, y: 0, z: 0 }, { x: 1, y: 0, z: 0 }, { x: 0, y: -1, z: 0 }, { x: 0, y: 1, z: 0 }, { x: 0, y: 0, z: -1 }, { x: 0, y: 0, z: 1 }][i];
}
interface Particle { mesh: Mesh; v: Vector3; life: number; age: number; gravity: number; size: number }
/**
 * Pooled combat effects: tracers, impact particles, bullet holes and ejected
 * brass. Pools are fixed-size, so a long firefight never grows memory.
 */
export class Effects {
  private tracers: { mesh: Mesh; until: number }[] = []; private particles: Particle[] = []; private decals: Mesh[] = []; private decalIndex = 0;
  private materials: Record<string, StandardMaterial> = {};
  constructor(scene: Scene) {
    const dot = new DynamicTexture('fx-dot', { width: 32, height: 32 }, scene, false), ctx = dot.getContext() as unknown as CanvasRenderingContext2D, g = ctx.createRadialGradient(16, 16, 1, 16, 16, 16);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(1, 'rgba(255,255,255,0)'); ctx.fillStyle = g; ctx.fillRect(0, 0, 32, 32); dot.hasAlpha = true; dot.update();
    const make = (name: string, color: string, additive: boolean) => { const m = new StandardMaterial(`fx-${name}`, scene); m.diffuseColor = Color3.Black(); m.emissiveColor = Color3.FromHexString(color); m.opacityTexture = dot; m.disableLighting = true; m.alphaMode = additive ? Engine.ALPHA_ADD : Engine.ALPHA_COMBINE; m.disableDepthWrite = true; m.backFaceCulling = false; return m; };
    this.materials = { spark: make('spark', '#ffb04a', true), concrete: make('dust', '#a8a296', false), dirt: make('dirt', '#8a765c', false), wood: make('wood', '#7a5a3a', false), flesh: make('flesh', '#6a1410', false), glass: make('glass', '#cfe3ea', true), tracer: make('tracer', '#ffd27a', true), brass: make('brass', '#c9a04a', false) };
    this.materials.brass.disableLighting = false; this.materials.brass.diffuseColor = Color3.FromHexString('#c9a04a'); this.materials.brass.opacityTexture = null;
    const hole = new DynamicTexture('fx-hole', { width: 64, height: 64 }, scene, false), hctx = hole.getContext() as unknown as CanvasRenderingContext2D, hg = hctx.createRadialGradient(32, 32, 2, 32, 32, 30);
    hg.addColorStop(0, 'rgba(10,10,10,1)'); hg.addColorStop(0.25, 'rgba(30,28,24,0.95)'); hg.addColorStop(0.5, 'rgba(60,55,48,0.45)'); hg.addColorStop(1, 'rgba(60,55,48,0)'); hctx.fillStyle = hg; hctx.fillRect(0, 0, 64, 64); hole.hasAlpha = true; hole.update();
    const hm = new StandardMaterial('fx-hole', scene); hm.diffuseTexture = hole; hm.useAlphaFromDiffuseTexture = true; hm.specularColor = Color3.Black(); hm.zOffset = -4; hm.disableDepthWrite = true; this.materials.hole = hm;
    for (let i = 0; i < 24; i++) { const mesh = MeshBuilder.CreateBox('tracer', { width: 0.018, height: 0.018, depth: 1 }, scene); mesh.material = this.materials.tracer; mesh.isPickable = false; mesh.setEnabled(false); this.tracers.push({ mesh, until: 0 }); }
    for (let i = 0; i < 160; i++) { const mesh = MeshBuilder.CreatePlane('fx', { size: 1 }, scene); mesh.billboardMode = Mesh.BILLBOARDMODE_ALL; mesh.isPickable = false; mesh.setEnabled(false); this.particles.push({ mesh, v: new Vector3(), life: 0, age: 1, gravity: 0, size: 0.05 }); }
    for (let i = 0; i < 96; i++) { const mesh = MeshBuilder.CreatePlane('decal', { size: 0.09 }, scene); mesh.material = hm; mesh.isPickable = false; mesh.setEnabled(false); this.decals.push(mesh); }
  }
  tracer(from: Vec3, to: Vec3, chance = 1) {
    if (Math.random() > chance) return;
    const slot = this.tracers.find(t => !t.mesh.isEnabled()) ?? this.tracers[0], a = new Vector3(from.x, from.y, from.z), b = new Vector3(to.x, to.y, to.z), length = Vector3.Distance(a, b);
    if (length < 1.5) return;
    // A short streak placed partway down the shot reads as a bullet in flight, not a laser.
    const streak = Math.min(length * 0.6, 6), start = Vector3.Lerp(a, b, 0.15 + Math.random() * 0.2), end = start.add(b.subtract(a).normalize().scale(streak));
    slot.mesh.position.copyFrom(Vector3.Lerp(start, end, 0.5)); slot.mesh.scaling.z = streak; slot.mesh.lookAt(end); slot.mesh.setEnabled(true); slot.until = performance.now() + 45;
  }
  impact(at: Vec3, normal: Vec3, kind: SurfaceKind, box?: Box) {
    const n = new Vector3(normal.x, normal.y, normal.z), p = new Vector3(at.x, at.y, at.z).add(n.scale(0.02));
    const count = kind === 'metal' ? 7 : kind === 'flesh' ? 5 : 6;
    for (let i = 0; i < count; i++) {
      const spark = kind === 'metal' && i < 5;
      this.emit(p, n.scale(spark ? 3 + Math.random() * 3 : 0.8 + Math.random() * 1.2).add(new Vector3(Math.random() - 0.5, Math.random() * 0.8, Math.random() - 0.5).scale(spark ? 3 : 1.2)), spark ? 'spark' : kind, spark ? 0.18 + Math.random() * 0.15 : 0.35 + Math.random() * 0.35, spark ? 0.03 : kind === 'flesh' ? 0.12 : 0.1 + Math.random() * 0.12, spark ? 9 : 1.5);
    }
    if (kind !== 'flesh' && box && box.kind !== 'fence') {
      const decal = this.decals[this.decalIndex++ % this.decals.length]; decal.position.copyFrom(new Vector3(at.x, at.y, at.z).add(n.scale(0.012)));
      decal.lookAt(decal.position.subtract(n)); decal.rotation.z = Math.random() * Math.PI; decal.scaling.setAll(kind === 'metal' ? 0.6 : 0.8 + Math.random() * 0.4); decal.setEnabled(true);
    }
  }
  brass(from: Vector3, right: Vector3) { this.emit(from, right.scale(1.8 + Math.random()).add(new Vector3(0, 1.6 + Math.random(), 0)), 'brass', 0.7, 0.025, 12); }
  private emit(at: Vector3, v: Vector3, kind: string, life: number, size: number, gravity: number) {
    const p = this.particles.find(q => q.age >= q.life) ?? this.particles[0];
    p.mesh.material = this.materials[kind] ?? this.materials.concrete; p.mesh.position.copyFrom(at); p.v.copyFrom(v); p.life = life; p.age = 0; p.size = size; p.gravity = gravity; p.mesh.scaling.setAll(size); p.mesh.setEnabled(true);
  }
  update(dt: number) {
    const now = performance.now();
    for (const t of this.tracers) if (t.mesh.isEnabled() && now > t.until) t.mesh.setEnabled(false);
    for (const p of this.particles) {
      if (p.age >= p.life) continue; p.age += dt;
      if (p.age >= p.life) { p.mesh.setEnabled(false); continue; }
      p.v.y -= p.gravity * dt; p.v.scaleInPlace(Math.exp(-dt * 2.5)); p.mesh.position.addInPlace(p.v.scale(dt));
      const k = p.age / p.life; p.mesh.scaling.setAll(p.size * (1 + k * 1.5)); p.mesh.visibility = 1 - k;
    }
  }
  clear() { for (const t of this.tracers) t.mesh.setEnabled(false); for (const p of this.particles) { p.age = p.life; p.mesh.setEnabled(false); } for (const d of this.decals) d.setEnabled(false); }
}
