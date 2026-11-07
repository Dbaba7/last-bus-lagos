import { Color3, Color4 } from '@babylonjs/core/Maths/math.color';
import { Quaternion, Vector3 } from '@babylonjs/core/Maths/math.vector';
import { VertexBuffer } from '@babylonjs/core/Buffers/buffer';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import type { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import type { Material } from '@babylonjs/core/Materials/material';
import type { Scene } from '@babylonjs/core/scene';
import type { WeaponId } from '@lastbus/shared';
type Shape = { box: [number, number, number] } | { cyl: [number, number, number?] } | { sphere: [number, number?, number?] } | { capsule: [number, number] } | { limb: [number, [number, number, number], [number, number, number]] };
export interface Part { shape: Shape; at: [number, number, number]; rot?: [number, number, number]; color: string; tess?: number }
/**
 * Builds one vertex-coloured mesh from primitive parts. Characters and weapons
 * share a single material, so a whole rig costs one draw per bone.
 */
export function assemble(scene: Scene, name: string, parts: Part[], material: Material, parent?: TransformNode) {
  const meshes = parts.map(p => {
    const s = p.shape; let mesh: Mesh;
    if ('box' in s) mesh = MeshBuilder.CreateBox(name, { width: s.box[0], height: s.box[1], depth: s.box[2] }, scene);
    else if ('cyl' in s) mesh = MeshBuilder.CreateCylinder(name, { diameterBottom: s.cyl[0], diameterTop: s.cyl[2] ?? s.cyl[0], height: s.cyl[1], tessellation: p.tess ?? 10 }, scene);
    else if ('capsule' in s) mesh = MeshBuilder.CreateCapsule(name, { radius: s.capsule[0], height: s.capsule[1], tessellation: p.tess ?? 10, subdivisions: 2 }, scene);
    else if ('limb' in s) {
      // A capsule spanning two joints, so limbs are placed by where they start and end rather than by guessed angles.
      const a = new Vector3(...s.limb[1]), b = new Vector3(...s.limb[2]), d = b.subtract(a), length = d.length();
      mesh = MeshBuilder.CreateCapsule(name, { radius: s.limb[0], height: length + s.limb[0] * 2, tessellation: p.tess ?? 10, subdivisions: 2 }, scene);
      mesh.position = a.add(b).scale(0.5); mesh.rotationQuaternion = new Quaternion(); Quaternion.FromUnitVectorsToRef(Vector3.Up(), d.normalize(), mesh.rotationQuaternion);
    }
    else mesh = MeshBuilder.CreateSphere(name, { diameterX: s.sphere[0], diameterY: s.sphere[1] ?? s.sphere[0], diameterZ: s.sphere[2] ?? s.sphere[0], segments: p.tess ?? 6 }, scene);
    if (!('limb' in s)) { mesh.position.set(...p.at); if (p.rot) mesh.rotation.set(...p.rot); }
    const c = Color3.FromHexString(p.color), count = mesh.getTotalVertices(), colors = new Float32Array(count * 4);
    for (let i = 0; i < count; i++) colors.set([c.r, c.g, c.b, 1], i * 4);
    mesh.setVerticesData(VertexBuffer.ColorKind, colors); return mesh;
  });
  const merged = Mesh.MergeMeshes(meshes, true, true)!; merged.name = name; merged.material = material; merged.isPickable = false; merged.hasVertexAlpha = false;
  if (parent) merged.parent = parent; return merged;
}
export const tint = (hex: string, f: number) => Color3.FromHexString(hex).scale(f).toHexString();
export function blend(a: string, b: string, t: number) { return Color3.Lerp(Color3.FromHexString(a), Color3.FromHexString(b), t).toHexString(); }
export { Color4 };
/**
 * Weapon geometry in metres, muzzle toward +z, grip at the origin. The same
 * definition drives the first-person and third-person models; `high` adds the
 * small parts (rivets, levers, sight dots, grain and edge wear) only the
 * first-person view is close enough to show.
 */
export function weaponParts(weapon: WeaponId, detail: 'high' | 'low'): { parts: Part[]; magazine: Part[]; muzzle: [number, number, number]; sight: [number, number, number] } {
  const steel = '#24282a', dark = '#17191a', wood = '#6e3f22', woodDark = '#4e2e19', worn = '#3a3e3f', edge = '#5a5f60', high = detail === 'high';
  if (weapon === 'sidearm') {
    // K9 service pistol: steel slide on a polymer frame.
    const poly = '#262626';
    const parts: Part[] = [
      { shape: { box: [0.032, 0.034, 0.19] }, at: [0, 0.062, 0.055], color: steel },
      { shape: { box: [0.028, 0.026, 0.16] }, at: [0, 0.034, 0.05], color: dark },
      { shape: { box: [0.03, 0.105, 0.048] }, at: [0, -0.02, -0.012], rot: [0.22, 0, 0], color: poly },
      { shape: { box: [0.006, 0.026, 0.008] }, at: [0, 0.012, 0.03], rot: [0.25, 0, 0], color: dark },
      { shape: { box: [0.008, 0.005, 0.048] }, at: [0, -0.004, 0.034], color: poly }, { shape: { box: [0.008, 0.026, 0.006] }, at: [0, 0.009, 0.058], color: poly },
      { shape: { cyl: [0.012, 0.02] }, at: [0, 0.062, 0.152], rot: [Math.PI / 2, 0, 0], color: '#111' },
      { shape: { box: [0.006, 0.008, 0.006] }, at: [0, 0.083, 0.14], color: '#d9d9d0' },
      { shape: { box: [0.02, 0.008, 0.008] }, at: [0, 0.083, -0.03], color: dark },
      { shape: { box: [0.01, 0.018, 0.012] }, at: [0, 0.074, -0.048], rot: [-0.3, 0, 0], color: dark }
    ];
    if (high) {
      for (let i = 0; i < 6; i++) parts.push({ shape: { box: [0.034, 0.03, 0.003] }, at: [0, 0.063, -0.025 + i * 0.008], color: worn });
      parts.push({ shape: { box: [0.004, 0.013, 0.036] }, at: [0.0165, 0.068, 0.072], color: '#0a0a0a' }, { shape: { box: [0.034, 0.003, 0.19] }, at: [0, 0.0795, 0.055], color: edge },
        { shape: { box: [0.004, 0.008, 0.012] }, at: [0.015, 0.04, 0.062], color: dark }, { shape: { box: [0.003, 0.003, 0.003] }, at: [-0.006, 0.0875, -0.031], color: '#e8e8de' }, { shape: { box: [0.003, 0.003, 0.003] }, at: [0.006, 0.0875, -0.031], color: '#e8e8de' });
      for (let i = 0; i < 3; i++) parts.push({ shape: { box: [0.03, 0.004, 0.006] }, at: [0, 0.019, 0.085 + i * 0.016], color: dark });
      for (const s of [-1, 1]) for (let i = 0; i < 4; i++) parts.push({ shape: { box: [0.003, 0.004, 0.034] }, at: [s * 0.0155, -0.0 - i * 0.017, -0.006 - i * 0.004], rot: [0.22, 0, 0], color: '#1d1d1d' });
    }
    return { parts, magazine: [{ shape: { box: [0.024, 0.09, 0.036] }, at: [0, -0.045, -0.012], rot: [0.22, 0, 0], color: '#1a1a1a' }, { shape: { box: [0.029, 0.01, 0.042] }, at: [0, -0.092, -0.022], rot: [0.22, 0, 0], color: '#2a2a2a' }], muzzle: [0, 0.062, 0.17], sight: [0, 0.087, 0.05] };
  }
  // AK-26: stamped receiver, wooden furniture, slant brake and a curved steel magazine.
  const parts: Part[] = [
    { shape: { box: [0.05, 0.07, 0.34] }, at: [0, 0.02, 0.05], color: steel },
    { shape: { box: [0.046, 0.022, 0.3] }, at: [0, 0.066, 0.05], color: worn },
    { shape: { box: [0.056, 0.06, 0.2] }, at: [0, 0.015, 0.32], color: wood },
    { shape: { box: [0.04, 0.03, 0.18] }, at: [0, 0.07, 0.31], color: woodDark },
    { shape: { cyl: [0.018, 0.32] }, at: [0, 0.03, 0.5], rot: [Math.PI / 2, 0, 0], color: dark },
    { shape: { cyl: [0.016, 0.2] }, at: [0, 0.062, 0.37], rot: [Math.PI / 2, 0, 0], color: steel },
    { shape: { box: [0.03, 0.04, 0.04] }, at: [0, 0.048, 0.445], color: steel },
    { shape: { cyl: [0.03, 0.06] }, at: [0, 0.03, 0.68], rot: [Math.PI / 2, 0, 0], color: '#151515' },
    { shape: { box: [0.012, 0.05, 0.012] }, at: [0, 0.07, 0.6], color: dark },
    { shape: { box: [0.03, 0.02, 0.03] }, at: [0, 0.088, 0.17], color: dark },
    { shape: { box: [0.036, 0.1, 0.05] }, at: [0, -0.055, -0.035], rot: [0.32, 0, 0], color: '#3b2416' },
    { shape: { box: [0.006, 0.03, 0.012] }, at: [0, -0.026, 0.03], rot: [0.3, 0, 0], color: dark },
    { shape: { box: [0.008, 0.006, 0.075] }, at: [0, -0.05, 0.03], color: steel }, { shape: { box: [0.008, 0.035, 0.006] }, at: [0, -0.034, 0.066], color: steel },
    { shape: { box: [0.045, 0.06, 0.28] }, at: [0, -0.005, -0.25], rot: [-0.1, 0, 0], color: wood },
    { shape: { box: [0.05, 0.115, 0.014] }, at: [0, -0.02, -0.392], rot: [-0.1, 0, 0], color: steel },
    { shape: { box: [0.012, 0.016, 0.06] }, at: [0.03, 0.05, 0.12], color: dark },
    { shape: { box: [0.034, 0.012, 0.03] }, at: [0, 0.046, 0.692], rot: [0.4, 0, 0], color: '#151515' }
  ];
  if (high) {
    for (let i = 0; i < 5; i++) parts.push({ shape: { box: [0.058, 0.004, 0.012] }, at: [0, 0.046, 0.25 + i * 0.03], color: woodDark });
    parts.push({ shape: { box: [0.052, 0.02, 0.02] }, at: [0, 0.03, 0.43], color: steel },
      // Selector lever, rear sight leaf, front sight hood, cleaning rod, sling swivels.
      { shape: { box: [0.004, 0.014, 0.11] }, at: [0.027, 0.035, 0.06], rot: [0.08, 0, 0], color: dark }, { shape: { box: [0.024, 0.006, 0.05] }, at: [0, 0.1, 0.19], rot: [-0.06, 0, 0], color: steel },
      { shape: { box: [0.004, 0.03, 0.016] }, at: [-0.011, 0.07, 0.6], color: dark }, { shape: { box: [0.004, 0.03, 0.016] }, at: [0.011, 0.07, 0.6], color: dark },
      { shape: { cyl: [0.006, 0.26] }, at: [0, 0.008, 0.53], rot: [Math.PI / 2, 0, 0], color: worn },
      { shape: { box: [0.006, 0.02, 0.02] }, at: [0, -0.02, 0.4], color: steel }, { shape: { box: [0.006, 0.02, 0.02] }, at: [0, -0.07, -0.33], rot: [-0.1, 0, 0], color: steel },
      // Edge wear where hands and slings rub the finish off.
      { shape: { box: [0.052, 0.004, 0.32] }, at: [0, 0.055, 0.05], color: edge }, { shape: { box: [0.004, 0.02, 0.06] }, at: [0.0255, 0.0, -0.06], color: edge });
    for (const s of [-1, 1]) for (const z of [-0.08, -0.02, 0.12, 0.18]) parts.push({ shape: { sphere: [0.006, 0.006, 0.004] }, at: [s * 0.0255, 0.005, z], color: edge });
    for (const y of [-0.02, 0.0, 0.015]) parts.push({ shape: { box: [0.047, 0.003, 0.24] }, at: [0, y, -0.24], rot: [-0.1, 0, 0], color: woodDark });
    parts.push({ shape: { box: [0.06, 0.012, 0.03] }, at: [0, 0.02, 0.26], color: '#8a5530' }, { shape: { box: [0.06, 0.01, 0.02] }, at: [0, -0.01, 0.36], color: '#8a5530' });
  }
  const magazine: Part[] = [0, 1, 2, 3].map(i => ({ shape: { box: [0.034, 0.06, 0.06] }, at: [0, -0.045 - i * 0.05, 0.11 + i * 0.018], rot: [0.32 + i * 0.1, 0, 0], color: i % 2 ? '#2e2a22' : '#3a3428' } as Part));
  if (high) for (const i of [0, 1, 2, 3]) magazine.push({ shape: { box: [0.037, 0.008, 0.05] }, at: [0, -0.045 - i * 0.05, 0.11 + i * 0.018], rot: [0.32 + i * 0.1, 0, 0], color: '#4a4436' });
  magazine.push({ shape: { box: [0.038, 0.012, 0.064] }, at: [0, -0.215, 0.178], rot: [0.75, 0, 0], color: '#1d1b16' });
  return { parts, magazine, muzzle: [0, 0.03, 0.71], sight: [0, 0.098, 0.17] };
}
