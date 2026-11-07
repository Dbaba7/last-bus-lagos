import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Matrix, Quaternion, Vector3, Vector4 } from '@babylonjs/core/Maths/math.vector';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { VertexData } from '@babylonjs/core/Meshes/mesh.vertexData';
import { CreateBoxVertexData } from '@babylonjs/core/Meshes/Builders/boxBuilder';
import { CreateCylinderVertexData } from '@babylonjs/core/Meshes/Builders/cylinderBuilder';
import { CreateSphereVertexData } from '@babylonjs/core/Meshes/Builders/sphereBuilder';
import { CreatePlaneVertexData } from '@babylonjs/core/Meshes/Builders/planeBuilder';
import { CreateTorusVertexData } from '@babylonjs/core/Meshes/Builders/torusBuilder';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import type { Scene } from '@babylonjs/core/scene';
import { surface, type Surface } from './textures.js';
/** Metres per texture repeat for each textured material. */
export const tiles = new WeakMap<StandardMaterial, number>();
export interface MatSpec { color: string; surface?: string; tile?: number; specular?: number; gloss?: number; emissive?: string; emissiveTexture?: boolean; bump?: number; alpha?: boolean; backFaces?: boolean; unlit?: boolean }
/** Shared material library. Texture scale is in metres, so every surface tiles at a believable size. */
export class Materials {
  private cache = new Map<string, StandardMaterial>();
  constructor(private scene: Scene, private textureSize = 512) {}
  get(name: string, spec: MatSpec) {
    let m = this.cache.get(name); if (m) return m;
    m = new StandardMaterial(name, this.scene); m.diffuseColor = Color3.FromHexString(spec.color);
    m.specularColor = new Color3(spec.specular ?? 0.04, spec.specular ?? 0.04, spec.specular ?? 0.04); m.specularPower = spec.gloss ?? 24;
    if (spec.surface) {
      // Textures are shared between materials; the tile size is baked into each batch's UVs instead (see Batches.build).
      const s: Surface = surface(this.scene, spec.surface, this.textureSize); m.diffuseTexture = s.diffuse; tiles.set(m, spec.tile ?? 2);
      if (s.normal && spec.bump !== 0) { m.bumpTexture = s.normal; m.bumpTexture.level = spec.bump ?? 0.6; }
    }
    if (spec.emissive) m.emissiveColor = Color3.FromHexString(spec.emissive);
    if (spec.unlit) m.disableLighting = true;
    if (spec.backFaces) m.backFaceCulling = false;
    this.cache.set(name, m); return m;
  }
  all() { return [...this.cache.values()]; }
}
type Placement = { x: number; y: number; z: number; ry?: number; rx?: number; rz?: number };
/**
 * Accumulates transformed vertex data per material and emits one static mesh
 * per material, so thousands of building details cost a few dozen draws.
 */
export class Batches {
  private parts = new Map<StandardMaterial, { data: VertexData[]; caster: boolean }>();
  constructor(private scene: Scene) {}
  private push(material: StandardMaterial, data: VertexData, at: Placement, caster: boolean) {
    const rotation = Quaternion.RotationYawPitchRoll(at.ry ?? 0, at.rx ?? 0, at.rz ?? 0);
    data.transform(Matrix.Compose(Vector3.One(), rotation, new Vector3(at.x, at.y, at.z)));
    const entry = this.parts.get(material) ?? { data: [], caster: false }; entry.data.push(data); entry.caster ||= caster; this.parts.set(material, entry);
  }
  /** Box with UVs in metres (offset by world position so neighbours do not repeat). */
  box(material: StandardMaterial, x: number, y: number, z: number, w: number, h: number, d: number, opts: { ry?: number; rx?: number; rz?: number; caster?: boolean; uv?: Vector4[] } = {}) {
    const ox = (x * 0.37 + z * 0.61) % 7, oy = y % 3;
    const faceUV = opts.uv ?? [new Vector4(ox, oy, ox + w, oy + h), new Vector4(ox, oy, ox + w, oy + h), new Vector4(ox, oy, ox + d, oy + h), new Vector4(ox, oy, ox + d, oy + h), new Vector4(ox, ox, ox + w, ox + d), new Vector4(ox, ox, ox + w, ox + d)];
    this.push(material, CreateBoxVertexData({ width: w, height: h, depth: d, faceUV, wrap: true }), { x, y, z, ...opts }, opts.caster ?? false);
  }
  cylinder(material: StandardMaterial, x: number, y: number, z: number, diameter: number, height: number, opts: { ry?: number; rx?: number; rz?: number; caster?: boolean; tessellation?: number; top?: number } = {}) {
    this.push(material, CreateCylinderVertexData({ diameterBottom: diameter, diameterTop: opts.top ?? diameter, height, tessellation: opts.tessellation ?? 12 }), { x, y, z, ...opts }, opts.caster ?? false);
  }
  sphere(material: StandardMaterial, x: number, y: number, z: number, diameter: number, opts: { caster?: boolean; segments?: number; sy?: number } = {}) {
    const data = CreateSphereVertexData({ diameterX: diameter, diameterY: diameter * (opts.sy ?? 1), diameterZ: diameter, segments: opts.segments ?? 6 });
    this.push(material, data, { x, y, z }, opts.caster ?? false);
  }
  torus(material: StandardMaterial, x: number, y: number, z: number, diameter: number, thickness: number, opts: { ry?: number; rx?: number; rz?: number; caster?: boolean } = {}) {
    this.push(material, CreateTorusVertexData({ diameter, thickness, tessellation: 14 }), { x, y, z, ...opts }, opts.caster ?? false);
  }
  /** Flat quad facing +z after rotation; `uv` selects an atlas rectangle. */
  plane(material: StandardMaterial, x: number, y: number, z: number, w: number, h: number, opts: { ry?: number; rx?: number; uv?: [number, number, number, number] } = {}) {
    // frontUVs only apply to double-sided planes, so remap the default 0..1 coordinates by hand.
    const data = CreatePlaneVertexData({ width: w, height: h }), [u0, v0, u1, v1] = opts.uv ?? [0, 0, 1, 1], uvs = data.uvs!;
    for (let i = 0; i < uvs.length; i += 2) { uvs[i] = u0 + uvs[i] * (u1 - u0); uvs[i + 1] = v0 + uvs[i + 1] * (v1 - v0); }
    // Babylon planes face -z; rotate half a turn so `ry` names the direction the face looks.
    this.push(material, data, { x, y, z, ry: (opts.ry ?? 0) + Math.PI, rx: opts.rx }, false);
  }
  /** Straight segment between two points, used for cables, braces and rails. */
  rod(material: StandardMaterial, a: Vector3, b: Vector3, thickness: number) {
    const mid = a.add(b).scale(0.5), d = b.subtract(a), length = d.length();
    const yaw = Math.atan2(d.x, d.z), pitch = -Math.asin(d.y / Math.max(length, 1e-6));
    this.push(material, CreateBoxVertexData({ width: thickness, height: thickness, depth: length }), { x: mid.x, y: mid.y, z: mid.z, ry: yaw, rx: pitch }, false);
  }
  /** Sagging cable between two points. */
  cable(material: StandardMaterial, a: Vector3, b: Vector3, sag = 0.6, segments = 8) {
    let previous = a;
    for (let i = 1; i <= segments; i++) { const t = i / segments, p = Vector3.Lerp(a, b, t); p.y -= Math.sin(Math.PI * t) * sag; this.rod(material, previous, p, 0.025); previous = p; }
  }
  build(onMesh: (mesh: Mesh, caster: boolean) => void) {
    for (const [material, { data, caster }] of this.parts) {
      const [first, ...rest] = data; if (rest.length) first.merge(rest, true);
      const tile = tiles.get(material); if (tile && first.uvs) { const uvs = first.uvs as number[]; for (let i = 0; i < uvs.length; i++) uvs[i] /= tile; }
      const mesh = new Mesh(`static-${material.name}`, this.scene); first.applyToMesh(mesh, false); mesh.material = material;
      mesh.isPickable = false; mesh.receiveShadows = true; mesh.freezeWorldMatrix(); mesh.doNotSyncBoundingInfo = true; onMesh(mesh, caster);
    }
    this.parts.clear();
  }
}
