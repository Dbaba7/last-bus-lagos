import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { DynamicTexture } from '@babylonjs/core/Materials/Textures/dynamicTexture';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import type { Scene } from '@babylonjs/core/scene';
import { Engine } from '@babylonjs/core/Engines/engine';
import { WORLD, type Box } from '@lastbus/shared';
import { Batches, Materials, type MatSpec } from './render/kit.js';
import { SignAtlas, chainLink } from './render/textures.js';
import { assemble, type Part } from './render/models.js';
/** Seeded random so the dressing is identical every launch and between players. */
function rng(seed: string) { let h = 2166136261; for (const c of seed) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return () => { h ^= h << 13; h ^= h >>> 17; h ^= h << 5; return (h >>> 0) / 4294967295; }; }
const FACE = { n: { x: 0, z: 1, yaw: 0 }, s: { x: 0, z: -1, yaw: Math.PI }, e: { x: 1, z: 0, yaw: Math.PI / 2 }, w: { x: -1, z: 0, yaw: -Math.PI / 2 } } as const;
type Face = keyof typeof FACE;
const SPECS: Record<string, MatSpec> = {
  asphalt: { color: '#ffffff', surface: 'asphalt', tile: 7, bump: 0.5 }, paving: { color: '#ffffff', surface: 'paving', tile: 3, bump: 0.7 }, dirt: { color: '#ffffff', surface: 'dirt', tile: 5 },
  concrete: { color: '#e9e5dc', surface: 'concrete', tile: 3 }, concreteDark: { color: '#8f8b84', surface: 'concrete', tile: 3 }, kerb: { color: '#c9c5bb', surface: 'concrete', tile: 1.5 },
  glass: { color: '#1b262c', specular: 0.85, gloss: 90 }, glassNight: { color: '#1b262c', specular: 0.85, gloss: 90, emissive: '#000000' }, glassWarm: { color: '#3a2b1a', emissive: '#e0a55a' }, glassCool: { color: '#1e2b33', emissive: '#88aac4' },
  frame: { color: '#d6cfbf', surface: 'paint', tile: 1 }, bars: { color: '#2a2d2c', specular: 0.3, gloss: 40 }, iron: { color: '#3d3a36', surface: 'metal', tile: 1, specular: 0.25 },
  shutterA: { color: '#7d97a8', surface: 'shutter', tile: 2 }, shutterB: { color: '#8aa38e', surface: 'shutter', tile: 2 }, shutterC: { color: '#b0b0aa', surface: 'shutter', tile: 2 },
  roofSheet: { color: '#b9bab1', surface: 'corrugated', tile: 2.5, specular: 0.25 }, roofRust: { color: '#c98a62', surface: 'corrugated', tile: 2.5 },
  awningRed: { color: '#b4452e', surface: 'fabric', tile: 1 }, awningBlue: { color: '#2f5f99', surface: 'fabric', tile: 1 }, awningGreen: { color: '#3e7d54', surface: 'fabric', tile: 1 }, awningYellow: { color: '#d39b2a', surface: 'fabric', tile: 1 },
  wood: { color: '#ffffff', surface: 'wood', tile: 1.6 }, metal: { color: '#8d918e', surface: 'metal', tile: 1.5, specular: 0.35, gloss: 48 }, metalDark: { color: '#3a3f3d', surface: 'metal', tile: 1.5, specular: 0.25 },
  danfo: { color: '#f2b705', surface: 'paint', tile: 2, specular: 0.4, gloss: 48 }, black: { color: '#1c1e1f', surface: 'paint', tile: 2, specular: 0.2 }, white: { color: '#efeee8', surface: 'paint', tile: 2, specular: 0.3 },
  navy: { color: '#1d2c52', surface: 'paint', tile: 2, specular: 0.35, gloss: 48 }, rubber: { color: '#ffffff', surface: 'rubber', tile: 0.6 }, chrome: { color: '#c9ced2', specular: 0.9, gloss: 80 },
  headlight: { color: '#fff2c8', emissive: '#fff0c8' }, taillight: { color: '#c42a1e', emissive: '#7a1410' }, sodium: { color: '#ffb35a', emissive: '#ffb35a' }, fluoro: { color: '#e8f4ff', emissive: '#dceeff' },
  beaconBlue: { color: '#2a5cff', emissive: '#2a5cff' }, beaconRed: { color: '#ff2a2a', emissive: '#c01818' }, ledRed: { color: '#ff3020', emissive: '#ff3020' }, ledGreen: { color: '#30ff60', emissive: '#30ff60' },
  paintWhite: { color: '#e4e0d2', surface: 'paint', tile: 1, bump: 0 }, paintYellow: { color: '#e2b23a', surface: 'paint', tile: 1, bump: 0 }, drain: { color: '#262624', surface: 'metal', tile: 0.5 },
  tank: { color: '#1d1e1e', specular: 0.18, gloss: 20 }, tankBlue: { color: '#2a4f86', specular: 0.2 }, rebar: { color: '#6a3e28' }, bark: { color: '#5c4836', surface: 'wood', tile: 0.7 },
  leaves: { color: '#4f7838', surface: 'stucco', tile: 1.2 }, leavesDark: { color: '#3a5a2c', surface: 'stucco', tile: 1.2 }, grass: { color: '#6a7f3e', surface: 'stucco', tile: 0.8 },
  tomato: { color: '#c3311d' }, pepper: { color: '#d9581c' }, onion: { color: '#a8704e' }, plantain: { color: '#c9b23a' }, cloth: { color: '#ffffff', surface: 'fabric', tile: 0.8 },
  tile: { color: '#ffffff', surface: 'tiles', tile: 1.8 }, plastic: { color: '#c33b2b', specular: 0.3 }, plasticBlue: { color: '#2d5fa3', specular: 0.3 }, plasticWhite: { color: '#e9e7e0', specular: 0.3 },
  brick: { color: '#ffffff', surface: 'brick', tile: 2 }, generator: { color: '#d6a020', surface: 'paint', tile: 1, specular: 0.3 }, container: { color: '#2f5d6b', surface: 'corrugated', tile: 2 },
  skyline: { color: '#6f6a6e' }, skylineDark: { color: '#4d4a52' }, interior: { color: '#1a1612', emissive: '#2b2116' }, interiorLit: { color: '#3a2a18', emissive: '#7a5a34' }
};
export interface ArenaHandles { relayLights: { jammed: Mesh; clear: Mesh }[]; generators: Vector3[] }
/** Vehicles built on their own nodes so cutscenes can open their doors and drive them: the last bus out of Danfo Park, and Danfo 247 itself. */
const MOVERS: Record<string, string> = { 'van-w~n': 'last-bus', 'danfo-ew': 'danfo-247' };
interface Mover { node: TransformNode; door: TransformNode; home: { x: number; z: number; yaw: number } }
/** How alive the city looks: 'dead' is the jammed junction at dusk, 'restored' is back on air at night, 'blackout' is after the blast. */
export type CityState = 'dead' | 'restored' | 'blackout';
export class Arena {
  readonly mats: Materials; readonly atlas: SignAtlas; readonly handles: ArenaHandles = { relayLights: [], generators: [] };
  private batches: Batches; private signs: StandardMaterial; private litSigns: StandardMaterial; private animated: { node: TransformNode; spin?: number; sway?: number; phase: number }[] = [];
  private beacons: { mesh: Mesh; phase: number }[] = []; private flicker: StandardMaterial[] = []; private traffic: { node: TransformNode; from: Vector3; to: Vector3; speed: number; t: number }[] = [];
  readonly shadowCasters: Mesh[] = []; readonly staticMeshes: Mesh[] = [];
  /** Movable vehicles by name: node, sliding door and resting place (heading is the way the nose points). */
  readonly movers = new Map<string, Mover>();
  private crowd?: Mesh; private noSignal: Mesh[] = [];
  private busyTraffic: TransformNode[] = []; private city: CityState = 'dead'; private glows: StandardMaterial[] = [];
  /** Everything this arena built hangs off one node, so the renderer can swap maps by enabling one arena at a time. */
  readonly root: TransformNode;
  constructor(private scene: Scene, textureSize = 512, private boxes: Box[] = WORLD, private layout: 'junction' | 'interior' = 'junction') {
    this.mats = new Materials(scene, textureSize); this.batches = new Batches(scene); this.atlas = new SignAtlas(scene);
    this.signs = new StandardMaterial('signs', scene); this.signs.diffuseTexture = this.atlas.texture; this.signs.backFaceCulling = false; this.signs.specularColor = new Color3(0.03, 0.03, 0.03); this.signs.emissiveColor = new Color3(0.08, 0.07, 0.06);
    this.litSigns = new StandardMaterial('signs-lit', scene); this.litSigns.diffuseTexture = this.atlas.texture; this.litSigns.emissiveTexture = this.atlas.texture; this.litSigns.specularColor = Color3.Black();
    const before = { meshes: scene.meshes.length, nodes: scene.transformNodes.length };
    this.build();
    this.root = new TransformNode(`arena-${layout}`, scene);
    for (const node of [...scene.meshes.slice(before.meshes), ...scene.transformNodes.slice(before.nodes)]) if (!node.parent && node !== this.root) node.parent = this.root;
  }
  setEnabled(on: boolean) { this.root.setEnabled(on); }
  m(name: string) { return this.mats.get(name, SPECS[name] ?? { color: name.startsWith('#') ? name : '#888888' }); }
  plaster(color: string) { return this.mats.get(`plaster-${color}`, { color, surface: 'plaster', tile: 3.2, bump: 0.45 }); }
  private sign(text: string, x: number, y: number, z: number, w: number, h: number, face: Face, opts: Parameters<SignAtlas['paint']>[1] & { lit?: boolean; flat?: boolean } = {}) {
    // About 150 texels per metre keeps text crisp at street distance while the whole city fits one atlas.
    const px = Math.max(96, Math.min(1024, Math.round(w * 150))), uv = this.atlas.paint(text, { w: px, h: Math.max(32, Math.round(px * h / w)), ...opts });
    this.batches.plane(opts.lit ? this.litSigns : this.signs, x, y, z, w, h, { ry: FACE[face].yaw, rx: opts.flat ? Math.PI / 2 : 0, uv });
  }
  /** Position on a box's face: `along` runs across the face, `up` is height, `out` pushes away from the wall. */
  private onFace(b: Box, face: Face, along: number, up: number, out = 0.02) {
    const f = FACE[face], halfW = face === 'n' || face === 's' ? b.w / 2 : b.d / 2, depth = face === 'n' || face === 's' ? b.d / 2 : b.w / 2;
    const tx = -f.z, tz = f.x; return { x: b.x + f.x * (depth + out) + tx * along, y: up, z: b.z + f.z * (depth + out) + tz * along, halfW };
  }
  private build() {
    if (this.layout === 'junction') { this.ground(); this.nightLights(); } else this.yard();
    for (const b of this.boxes) {
      const base = b.y - b.h / 2, r = rng(b.id);
      switch (b.kind) {
        case 'building': this.building(b, base, r); break;
        case 'shell': this.batches.box(this.plaster(b.color ?? '#d8c7a2'), b.x, b.y, b.z, b.w, b.h, b.d, { caster: true }); break;
        case 'floor': this.slab(b); break;
        case 'stairs': this.batches.box(this.m('concrete'), b.x, b.y, b.z, b.w, b.h, b.d, { caster: true }); this.batches.box(this.m('metalDark'), b.x, b.y + b.h / 2 - 0.02, b.z + (b.id.endsWith('~n') ? 1 : -1) * (b.d / 2 - 0.04), b.w, 0.04, 0.08); break;
        case 'rail': this.railing(b); break;
        case 'kerb': this.batches.box(this.m('kerb'), b.x, b.y, b.z, b.w, b.h, b.d); this.batches.box(this.m('paving'), b.x, b.y + b.h / 2 + 0.003, b.z, b.w - 0.24, 0.006, b.d - 0.24); break;
        case 'deck': this.flyover(b); break;
        case 'pillar': this.pillar(b, r); break;
        case 'bus': if (MOVERS[b.id]) this.mover(MOVERS[b.id], b, r); else this.danfo(b, r); break;
        case 'vehicle': if (b.style === 'policevan') this.policeVan(b); else this.car(b, r); break;
        case 'stall': this.stall(b, base, r); break;
        case 'cover': this.cover(b, base); break;
        case 'prop': this.prop(b, base, r); break;
        case 'pole': this.pole(b, base, r); break;
        case 'fence': this.fence(b); break;
        case 'wall': this.compound(b, base, r); break;
        case 'ladder': this.climbable(b, base); break;
        default: break;
      }
    }
    this.shells(); this.cables(); this.skyline(); if (this.layout === 'junction') { this.billboards(); this.trees(); this.puddles(); this.litter(); this.marks(); this.parkDressing(); this.people(); } else this.damage(); this.atlas.commit();
    this.batches.build((mesh, caster) => { this.staticMeshes.push(mesh); if (caster) this.shadowCasters.push(mesh); });
  }
  // ── Ground: asphalt roads, paved plazas, compacted earth in the yards, painted markings and drainage.
  private ground() {
    const B = this.batches;
    B.box(this.m('dirt'), 0, -0.5, 0, 96, 1, 80);
    B.box(this.m('asphalt'), 0, 0.012, 0, 16, 0.02, 84); B.box(this.m('asphalt'), 0, 0.014, 0, 96, 0.024, 12);
    for (const z of [-28, 28]) B.box(this.m('paving'), 0, 0.005, z, 80, 0.01, 8);
    for (const [x, z] of [[-25, -16], [25, 16]]) B.box(this.m('concrete'), x, 0.004, z, 30, 0.008, 16);
    // Centre dashes on the cross road, solid edge lines and a zebra crossing on each approach.
    for (let x = -46; x <= 46; x += 4) if (Math.abs(x) > 9) B.box(this.m('paintWhite'), x, 0.03, 0, 2, 0.01, 0.14);
    for (let z = -40; z <= 40; z += 4) if (Math.abs(z) > 7) B.box(this.m('paintWhite'), 0.0, 0.03, z, 0.14, 0.01, 2);
    for (const s of [-1, 1]) { B.box(this.m('paintYellow'), s * 7.2, 0.03, s * 22, 0.12, 0.01, 28); B.box(this.m('paintYellow'), s * 27, 0.03, s * 5.2, 32, 0.01, 0.12); }
    for (const s of [-1, 1]) for (let x = -6.5; x <= 6.5; x += 1.1) B.box(this.m('paintWhite'), x, 0.03, s * 7.4, 0.55, 0.01, 1.6);
    this.sign('BUS STOP', -5.5, 0.04, 25.5, 4, 1, 's', { style: 'stencil', fg: '#e8e2cf', flat: true });
    this.sign('SLOW', 5.5, 0.04, -25.5, 3, 1, 'n', { style: 'stencil', fg: '#e8e2cf', flat: true });
    // Drainage channels with concrete covers along every road edge.
    for (const s of [-1, 1]) {
      for (let z = -38; z <= 38; z += 1.6) if (Math.abs(z) > 7) { B.box(this.m('concreteDark'), s * 7.75, 0.02, z, 0.45, 0.04, 1.5); if (Math.round(z * 10) % 48 === 0) B.box(this.m('drain'), s * 7.75, 0.043, z, 0.3, 0.01, 0.9); }
      for (let x = -46; x <= 46; x += 1.6) if (Math.abs(x) > 9) B.box(this.m('concreteDark'), x, 0.02, s * 5.75, 1.5, 0.04, 0.45);
    }
    for (const [x, z] of [[2.5, -4], [-11, 3.5], [21, -2], [-3, 18], [4.5, -27]]) B.cylinder(this.m('drain'), x, 0.028, z, 0.75, 0.012, { tessellation: 16 });
    // Oil stains and patched asphalt break up the road surface.
    const r = rng('stains');
    for (let i = 0; i < 26; i++) { const along = (r() - 0.5) * 70, across = (r() - 0.5) * 10, ns = r() < 0.5; this.contact(ns ? across : along, ns ? along : across, 0.8 + r() * 1.6, 0.8 + r() * 1.8, 0.03); }
  }
  /** Ground for small interior maps: cracked concrete with dust, no road markings. */
  private yard() {
    const ground = this.boxes.find(b => b.kind === 'ground'); if (!ground) return;
    this.batches.box(this.m('concreteDark'), ground.x, ground.y, ground.z, ground.w, ground.h, ground.d);
    const r = rng('yard'); for (let i = 0; i < 14; i++) this.contact((r() - 0.5) * ground.w * 0.8, (r() - 0.5) * ground.d * 0.8, 1 + r() * 2.5, 1 + r() * 2.5, 0.01);
  }
  private slab(b: Box) {
    const style = b.style ?? 'slab';
    if (style === 'ceiling') { this.batches.box(this.m('concrete'), b.x, b.y, b.z, b.w, b.h, b.d, { caster: true }); return; }
    this.batches.box(this.m('concrete'), b.x, b.y, b.z, b.w, b.h, b.d, { caster: true });
    this.batches.box(this.m('tile'), b.x, b.y + b.h / 2 + 0.004, b.z, b.w - 0.1, 0.008, b.d - 0.1);
    for (let x = b.x - b.w / 2 + 1; x < b.x + b.w / 2; x += 4) this.batches.box(this.m('concreteDark'), x, b.y - b.h / 2 - 0.15, b.z, 0.25, 0.3, b.d - 0.2);
    // Potted plants on the balcony edge, against the railing so they never snag movement.
    const r = rng(b.id);
    const climbs = this.boxes.filter(c => c.kind === 'ladder');
    for (let x = b.x - b.w / 2 + 1.5; x < b.x + b.w / 2 - 1; x += 3.5 + r() * 2) { if (climbs.some(c => Math.abs(c.x - x) < 1.3 && Math.abs(c.z - b.z) < b.d / 2 + 0.5)) continue; const z = b.z + (b.z < 0 ? b.d / 2 - 0.25 : -b.d / 2 + 0.25); this.batches.cylinder(this.m('plastic'), x, b.y + b.h / 2 + 0.18, z, 0.35, 0.36, { top: 0.42 }); this.batches.sphere(this.m('leaves'), x, b.y + b.h / 2 + 0.5, z, 0.55, { sy: 0.8 }); }
  }
  /** Marked climbing routes: a steel ladder with rungs and wall brackets, or a downpipe with clamps and a shoe at the foot. */
  private climbable(b: Box, base: number) {
    const B = this.batches, alongX = b.w >= b.d, top = b.y + b.h / 2;
    if (b.style === 'drainpipe') {
      B.cylinder(this.m('metalDark'), b.x, b.y, b.z, 0.13, b.h, { tessellation: 10 });
      for (let y = base + 0.6; y < top - 0.2; y += 0.9) B.box(this.m('iron'), b.x, y, b.z, alongX ? 0.2 : 0.18, 0.05, alongX ? 0.18 : 0.2);
      B.cylinder(this.m('metalDark'), b.x, base + 0.12, b.z, 0.2, 0.24, { tessellation: 10, top: 0.13 });
      B.box(this.paint('#e2b23a'), b.x, base + 1.4, b.z, alongX ? 0.16 : 0.15, 0.06, alongX ? 0.15 : 0.16);
      return;
    }
    const span = alongX ? b.w : b.d, rail = (o: number) => B.box(this.m('paintYellow'), alongX ? b.x + o : b.x, b.y, alongX ? b.z : b.z + o, alongX ? 0.05 : 0.07, b.h + 0.5, alongX ? 0.07 : 0.05, { caster: true });
    rail(-span / 2 + 0.06); rail(span / 2 - 0.06);
    for (let y = base + 0.3; y < top + 0.3; y += 0.3) B.box(this.m('metal'), b.x, y, b.z, alongX ? span - 0.12 : 0.035, 0.035, alongX ? 0.035 : span - 0.12);
  }
  private paint(color: string) { return this.mats.get(`paint-${color}`, { color, surface: 'paint', tile: 1, bump: 0 }); }
  private railing(b: Box) {
    const B = this.batches, long = b.w > b.d, length = long ? b.w : b.d, top = b.y + b.h / 2, base = b.y - b.h / 2;
    B.box(this.m('iron'), b.x, top - 0.03, b.z, long ? b.w : 0.06, 0.06, long ? 0.06 : b.d);
    B.box(this.m('iron'), b.x, base + 0.08, b.z, long ? b.w : 0.04, 0.04, long ? 0.04 : b.d);
    for (let t = -length / 2; t <= length / 2 + 0.01; t += 0.14) B.box(this.m('iron'), long ? b.x + t : b.x, base + b.h / 2, long ? b.z : b.z + t, 0.025, b.h - 0.06, 0.025);
  }
  // ── Buildings: storeys, windows with burglar-proof bars, shop bays, signboards, roofs and rooftop clutter.
  private building(b: Box, base: number, r: () => number) {
    const B = this.batches, color = b.color ?? '#c9b48f', style = b.style ?? 'tenement', face = (b.face ?? 'n') as Face;
    if (style === 'upper') { this.upperStorey(b, base, face, r); return; }
    const wall = style === 'warehouse' ? this.m('roofSheet') : this.plaster(color);
    B.box(wall, b.x, b.y, b.z, b.w, b.h, b.d, { caster: true });
    const top = base + b.h, storey = 3.2;
    // Darker splash zone where rain and road dirt hit the base of the wall.
    B.box(this.plaster(shade(color, 0.72)), b.x, base + 0.3, b.z, b.w + 0.02, 0.6, b.d + 0.02);
    for (let y = base + storey; y < top - 1; y += storey) B.box(this.m('concrete'), b.x, y, b.z, b.w + 0.16, 0.22, b.d + 0.16, { caster: false });
    // Parapet and roof equipment.
    B.box(this.plaster(shade(color, 0.92)), b.x, top + 0.45, b.z + b.d / 2 - 0.1, b.w, 0.9, 0.2); B.box(this.plaster(shade(color, 0.92)), b.x, top + 0.45, b.z - b.d / 2 + 0.1, b.w, 0.9, 0.2);
    B.box(this.plaster(shade(color, 0.92)), b.x + b.w / 2 - 0.1, top + 0.45, b.z, 0.2, 0.9, b.d); B.box(this.plaster(shade(color, 0.92)), b.x - b.w / 2 + 0.1, top + 0.45, b.z, 0.2, 0.9, b.d);
    B.box(this.m('concreteDark'), b.x, top + 0.02, b.z, b.w - 0.4, 0.04, b.d - 0.4);
    const tanks = 1 + Math.floor(r() * 2);
    for (let i = 0; i < tanks; i++) { const tx = b.x + (r() - 0.5) * (b.w - 3), tz = b.z + (r() - 0.5) * (b.d - 3); B.box(this.m('iron'), tx, top + 0.6, tz, 1.4, 1.2, 1.4); B.cylinder(this.m(r() < 0.75 ? 'tank' : 'tankBlue'), tx, top + 1.9, tz, 1.35, 1.4, { caster: true, tessellation: 16 }); B.cylinder(this.m('tank'), tx, top + 2.7, tz, 0.4, 0.15); }
    if (r() < 0.6) for (const [cx, cz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { const px = b.x + cx * (b.w / 2 - 0.4), pz = b.z + cz * (b.d / 2 - 0.4); B.box(this.m('concrete'), px, top + 0.9, pz, 0.4, 1.8, 0.4); for (const o of [-0.12, 0.12]) B.box(this.m('rebar'), px + o, top + 2.2, pz + o, 0.03, 0.9, 0.03); }
    if (r() < 0.5) { const dx = b.x + (r() - 0.5) * b.w * 0.6, dz = b.z + (r() - 0.5) * b.d * 0.6; B.cylinder(this.m('plasticWhite'), dx, top + 1, dz, 0.9, 0.06, { rx: -0.9, ry: r() * 6 }); B.box(this.m('metal'), dx, top + 0.5, dz, 0.05, 1, 0.05); }
    // Street-facing facade.
    const f = FACE[face], W = face === 'n' || face === 's' ? b.w : b.d;
    const bays = Math.max(1, Math.floor((W - 1) / 3.6)), bay = (W - 1) / bays;
    for (let floor = 1; floor * storey + 1.6 < b.h; floor++) {
      const y = base + floor * storey + 1.5;
      if (style === 'office') { this.curtain(b, face, y, W); continue; }
      for (let i = 0; i < bays; i++) this.window(b, face, -W / 2 + 0.5 + bay * (i + 0.5), y, r, style === 'tenement' && floor % 2 === 0 && i % 2 === 1);
    }
    if (style === 'warehouse') { const p = this.onFace(b, face, 0, base + 2.2, 0.04); B.box(this.m('shutterC'), p.x, p.y, p.z, Math.abs(f.z) ? 5 : 0.08, 4.4, Math.abs(f.x) ? 5 : 0.08); }
    else if (b.kind === 'building' && base < 0.5) this.shopfront(b, face, W, r, style);
    // Side faces: drain pipes and small vents.
    for (const side of (face === 'n' || face === 's' ? ['e', 'w'] : ['n', 's']) as Face[]) { const p = this.onFace(b, side, (r() - 0.5) * 2, base + b.h / 2, 0.08); B.cylinder(this.m('plasticWhite'), p.x, p.y, p.z, 0.11, b.h); }
    if (style === 'tenement') this.laundry(b, face, base, r);
  }
  private upperStorey(b: Box, base: number, face: Face, r: () => number) {
    const B = this.batches, color = b.color ?? '#d8c7a2';
    B.box(this.plaster(color), b.x, b.y, b.z, b.w, b.h, b.d, { caster: true });
    B.box(this.m('concrete'), b.x, base + 0.1, b.z, b.w + 0.2, 0.25, b.d + 0.2);
    B.box(this.plaster(shade(color, 0.92)), b.x, base + b.h + 0.4, b.z, b.w + 0.1, 0.8, b.d + 0.1);
    const W = face === 'n' || face === 's' ? b.w : b.d;
    for (let i = 0; i < 3; i++) this.window(b, face, -W / 2 + W / 3 * (i + 0.5), base + 1.8, r, false);
    if (b.label) { const p = this.onFace(b, face, 0, base + 0.75, 0.06); this.sign(b.label, p.x, p.y, p.z, Math.min(W - 1, 8), 1.1, face, { bg: '#f1e2b6', fg: '#1c2d4a', sub: 'SALES • REPAIRS • ACCESSORIES', style: 'board' }); }
  }
  private window(b: Box, face: Face, along: number, y: number, r: () => number, balcony: boolean) {
    const B = this.batches, f = FACE[face], p = this.onFace(b, face, along, y, 0.03), across = Math.abs(f.z) > 0;
    const w = 1.25, h = 1.45, roll = r();
    B.box(this.m('frame'), p.x, p.y, p.z, across ? w + 0.16 : 0.06, h + 0.16, across ? 0.06 : w + 0.16);
    // A third of the dark windows light up once the city is back on at night.
    const glass = roll < 0.22 ? 'glassWarm' : roll < 0.3 ? 'glassCool' : roll < 0.62 ? 'glassNight' : 'glass', g = this.onFace(b, face, along, y, 0.065);
    B.box(this.m(glass), g.x, g.y, g.z, across ? w : 0.02, h, across ? 0.02 : w);
    const bars = this.onFace(b, face, along, y, 0.11);
    for (let i = -2; i <= 2; i++) B.box(this.m('bars'), bars.x + (across ? i * w / 5 : 0), bars.y, bars.z + (across ? 0 : i * w / 5), 0.025, h, 0.025);
    B.box(this.m('bars'), bars.x, bars.y + h * 0.15, bars.z, across ? w : 0.025, 0.025, across ? 0.025 : w);
    const sill = this.onFace(b, face, along, y - h / 2 - 0.06, 0.08); B.box(this.m('concrete'), sill.x, sill.y, sill.z, across ? w + 0.3 : 0.16, 0.08, across ? 0.16 : w + 0.3);
    // Rain runs off the sill and streaks the plaster below it.
    if (r() < 0.65) { const streak = this.onFace(b, face, along + (r() - 0.5) * 0.4, y - h / 2 - 0.75, 0.032); B.plane(this.grime(), streak.x, streak.y, streak.z, w * (0.5 + r() * 0.4), 1.3, { ry: f.yaw }); }
    if (r() < 0.25) { const ac = this.onFace(b, face, along + 0.95, y - 0.5, 0.25); B.box(this.m('plasticWhite'), ac.x, ac.y, ac.z, across ? 0.8 : 0.45, 0.55, across ? 0.45 : 0.8, { caster: true }); B.box(this.m('metalDark'), ac.x + f.x * 0.23, ac.y, ac.z + f.z * 0.23, across ? 0.5 : 0.01, 0.4, across ? 0.01 : 0.5); }
    if (balcony) { const bp = this.onFace(b, face, along, y - h / 2 - 0.1, 0.55); B.box(this.m('concrete'), bp.x, bp.y, bp.z, across ? 2.2 : 1.1, 0.15, across ? 1.1 : 2.2); const rail = this.onFace(b, face, along, y - h / 2 + 0.4, 1.05); B.box(this.m('iron'), rail.x, rail.y, rail.z, across ? 2.2 : 0.04, 0.9, across ? 0.04 : 2.2); }
  }
  private curtain(b: Box, face: Face, y: number, W: number) {
    const f = FACE[face], across = Math.abs(f.z) > 0, p = this.onFace(b, face, 0, y, 0.04);
    this.batches.box(this.m('glass'), p.x, p.y, p.z, across ? W - 0.8 : 0.04, 2.2, across ? 0.04 : W - 0.8);
    for (let t = -W / 2 + 0.4; t <= W / 2 - 0.4; t += 1.5) { const m = this.onFace(b, face, t, y, 0.08); this.batches.box(this.m('metal'), m.x, m.y, m.z, across ? 0.08 : 0.06, 2.3, across ? 0.06 : 0.08); }
  }
  private shopfront(b: Box, face: Face, W: number, r: () => number, style: string) {
    const B = this.batches, f = FACE[face], across = Math.abs(f.z) > 0, base = b.y - b.h / 2;
    const bays = Math.max(1, Math.floor(W / 4.2)), bay = W / bays;
    for (let i = 0; i < bays; i++) {
      const along = -W / 2 + bay * (i + 0.5), open = r() < 0.45, p = this.onFace(b, face, along, base + 1.3, 0.03);
      if (open) { const lit = r() < 0.5; B.box(this.m(lit ? 'interiorLit' : 'interior'), p.x, p.y, p.z, across ? bay - 0.8 : 0.02, 2.5, across ? 0.02 : bay - 0.8); const s = this.onFace(b, face, along, base + 2.45, 0.06); B.box(this.m(['shutterA', 'shutterB', 'shutterC'][i % 3]), s.x, s.y, s.z, across ? bay - 0.7 : 0.1, 0.3, across ? 0.1 : bay - 0.7); this.goods(b, face, along, bay, base, lit, r); }
      else B.box(this.m(['shutterA', 'shutterB', 'shutterC'][Math.floor(r() * 3)]), p.x, p.y, p.z, across ? bay - 0.7 : 0.06, 2.6, across ? 0.06 : bay - 0.7);
      const pier = this.onFace(b, face, along - bay / 2, base + 1.6, 0.06); B.box(this.plaster(shade(b.color ?? '#c9b48f', 0.85)), pier.x, pier.y, pier.z, across ? 0.45 : 0.14, 3.2, across ? 0.14 : 0.45);
    }
    // Awning, sloped down toward the street, well above head height. Buildings fronted by a balcony skip it.
    const balcony = style === 'records' || style === 'hotel', awning = this.onFace(b, face, 0, base + 3.1, 0.75);
    if (!balcony) B.box(this.m(['awningRed', 'awningBlue', 'awningGreen', 'awningYellow'][Math.floor(r() * 4)]), awning.x, awning.y, awning.z, across ? W - 0.4 : 1.5, 0.06, across ? 1.5 : W - 0.4, { rx: across ? f.z * 0.22 : 0, rz: across ? 0 : -f.x * 0.22, caster: true });
    if (b.label) {
      const s = this.onFace(b, face, 0, base + (balcony ? 5.4 : 3.85), 0.08);
      const subs: Record<string, string> = { records: 'MUSIC • VIDEOS • CDs SINCE 1989', kitchen: 'AMALA • EWEDU • PEPPER SOUP', hotel: 'ROOMS • BAR • 24 HRS LIGHT', shopfront: 'QUALITY YOU CAN TRUST' };
      const palette = [['#f0c419', '#1b1d1c'], ['#1f4f8f', '#f4efe0'], ['#b3261e', '#fff6e0'], ['#f4efe0', '#1d5a3a']][Math.floor(r() * 4)];
      this.sign(b.label, s.x, s.y, s.z, Math.min(W - 1, 11), 1.3, face, { bg: palette[0], fg: palette[1], sub: subs[style] ?? subs.shopfront, lit: r() < 0.4 });
    }
    this.trades(b, face, W, base, r);
    if (r() < 0.6) { const post = this.onFace(b, face, W / 2 - 1.2, base + 1.4, 0.04); this.sign('THIS HOUSE IS NOT FOR SALE', post.x, post.y + 0.6, post.z, 1.6, 0.55, face, { style: 'stencil', fg: '#f3efe6' }); }
  }
  private laundry(b: Box, face: Face, base: number, r: () => number) {
    const f = FACE[face], a = this.onFace(b, face, -b.w / 4, base + 5.2, 0.9), c = this.onFace(b, face, b.w / 4, base + 5.2, 0.9);
    this.batches.cable(this.m('bars'), new Vector3(a.x, a.y, a.z), new Vector3(c.x, c.y, c.z), 0.25, 6);
    for (let i = 1; i < 6; i++) { const t = i / 6, x = a.x + (c.x - a.x) * t, z = a.z + (c.z - a.z) * t; this.batches.plane(this.mats.get(`laundry-${i % 3}`, { color: ['#c1453a', '#e8e2d2', '#3d6aa8'][i % 3], surface: 'fabric', tile: 0.5, backFaces: true }), x, a.y - 0.4 - Math.sin(Math.PI * t) * 0.25, z, 0.5 + r() * 0.3, 0.7, { ry: f.yaw }); }
  }
  // ── Walk-through shops: interior floor, fluorescent tube, ceiling fan and the shop counter.
  private shells() {
    const roots = new Map<string, Box[]>(); for (const b of this.boxes) if (b.kind === 'shell' || b.id.includes('-ceiling') || b.id.includes('-upper')) { const root = b.id.split('-')[0] + (b.id.endsWith('~n') ? '~n' : ''); roots.set(root, [...(roots.get(root) ?? []), b]); }
    for (const [root, parts] of roots) {
      const ceiling = parts.find(p => p.id.includes('-ceiling')); if (!ceiling) continue;
      this.batches.box(this.m('tile'), ceiling.x, 0.006, ceiling.z, ceiling.w - 0.6, 0.012, ceiling.d - 0.6);
      this.batches.box(this.mats.get('ceiling-under', { color: '#ece6d8', surface: 'stucco', tile: 2 }), ceiling.x, ceiling.y - ceiling.h / 2 - 0.005, ceiling.z, ceiling.w - 0.6, 0.01, ceiling.d - 0.6);
      const tube = this.mats.get(`fluoro-${root}`, SPECS.fluoro); this.flicker.push(tube);
      this.batches.box(tube, ceiling.x - 2, ceiling.y - ceiling.h / 2 - 0.05, ceiling.z, 1.2, 0.05, 0.12);
      const fan = new TransformNode(`fan-${root}`, this.scene); fan.position.set(ceiling.x + 1.5, ceiling.y - ceiling.h / 2 - 0.35, ceiling.z);
      const hub = MeshBuilder.CreateCylinder('fan-hub', { diameter: 0.18, height: 0.12, tessellation: 10 }, this.scene); hub.parent = fan; hub.material = this.m('white');
      for (let i = 0; i < 3; i++) { const blade = MeshBuilder.CreateBox('fan-blade', { width: 0.55, height: 0.012, depth: 0.12 }, this.scene); blade.parent = fan; blade.material = this.m('white'); blade.rotation.y = i * Math.PI * 2 / 3; blade.position.set(Math.cos(i * Math.PI * 2 / 3) * 0.3, 0, -Math.sin(i * Math.PI * 2 / 3) * 0.3); }
      const rod = MeshBuilder.CreateCylinder('fan-rod', { diameter: 0.03, height: 0.3 }, this.scene); rod.parent = fan; rod.position.y = 0.2; rod.material = this.m('white');
      this.animated.push({ node: fan, spin: 5.5, phase: 0 });
    }
  }
  private flyover(b: Box) {
    const B = this.batches, bottom = b.y - b.h / 2, top = b.y + b.h / 2;
    B.box(this.m('concrete'), b.x, b.y, b.z, b.w, b.h, b.d, { caster: true });
    B.box(this.m('concreteDark'), b.x, bottom - 0.01, b.z, b.w - 0.2, 0.02, b.d - 0.2);
    for (const s of [-1, 1]) { B.box(this.m('concrete'), s * (b.w / 2 - 0.2), top + 0.55, b.z, 0.4, 1.1, b.d, { caster: true }); B.box(this.m('concreteDark'), s * 2.5, bottom - 0.45, b.z, 0.9, 0.9, b.d); }
    for (let z = -40; z <= 40; z += 4) for (const s of [-1, 1]) B.box(this.m('concreteDark'), s * 4.5, top + 0.02, z, 0.12, 0.02, 2);
    // Lamps along the deck edge that light the junction below at dusk.
    for (let z = -36; z <= 36; z += 12) for (const s of [-1, 1]) { B.box(this.m('metal'), s * (b.w / 2 - 0.2), top + 2.6, z, 0.12, 4, 0.12); B.box(this.m('metal'), s * (b.w / 2 - 0.9), top + 4.55, z, 1.4, 0.1, 0.12); B.box(this.m('sodium'), s * (b.w / 2 - 1.5), top + 4.45, z, 0.5, 0.08, 0.25); }
    for (const z of [-30, 0, 30]) for (const face of ['e', 'w'] as Face[]) this.sign(b.label ?? 'OJUELEGBA', face === 'e' ? b.w / 2 + 0.03 : -b.w / 2 - 0.03, top - 0.6, z, 6, 0.9, face, { bg: '#1f5c3f', fg: '#f5f1e4', sub: 'SURULERE • YABA • IKEJA', style: 'board' });
    // Distant traffic crossing the flyover keeps the city moving overhead.
    for (let i = 0; i < 5; i++) { const node = this.trafficCar(`fly-${i}`); const lane = i % 2 ? -1.8 : 1.8; this.traffic.push({ node, from: new Vector3(lane, top, i % 2 ? 44 : -44), to: new Vector3(lane, top, i % 2 ? -44 : 44), speed: 0.045 + i * 0.006, t: i / 5 }); }
    for (let i = 0; i < 4; i++) { const node = this.trafficCar(`ew-${i}`); const z = i % 2 ? -37.5 : 37.5; this.traffic.push({ node, from: new Vector3(-70, 0, z), to: new Vector3(70, 0, z), speed: 0.03 + i * 0.005, t: i / 4 }); }
    // Extra cars that only run once the city is back on air.
    for (let i = 0; i < 8; i++) { const node = this.trafficCar(`busy-${i}`), deck = i < 4, lane = i % 2 ? -1 : 1; this.traffic.push(deck ? { node, from: new Vector3(lane * 1.8, top, lane * 44), to: new Vector3(lane * 1.8, top, -lane * 44), speed: 0.05 + i * 0.004, t: (i + 0.5) / 4 } : { node, from: new Vector3(-70 * lane, 0, lane * 37.5 + lane * 1.6), to: new Vector3(70 * lane, 0, lane * 37.5 + lane * 1.6), speed: 0.035 + i * 0.003, t: i / 8 }); node.setEnabled(false); this.busyTraffic.push(node); }
  }
  private trafficCar(id: string) {
    const node = new TransformNode(id, this.scene), r = rng(id);
    const body = MeshBuilder.CreateBox(`${id}-body`, { width: 1.7, height: 0.8, depth: 4.2 }, this.scene); body.parent = node; body.position.y = 0.6; body.material = this.m(r() < 0.5 ? 'danfo' : 'white');
    const cab = MeshBuilder.CreateBox(`${id}-cab`, { width: 1.5, height: 0.6, depth: 2.2 }, this.scene); cab.parent = node; cab.position.set(0, 1.25, -0.2); cab.material = this.m('glass');
    const lights = MeshBuilder.CreateBox(`${id}-lights`, { width: 1.5, height: 0.15, depth: 0.05 }, this.scene); lights.parent = node; lights.position.set(0, 0.7, 2.11); lights.material = this.m('headlight');
    const tails = MeshBuilder.CreateBox(`${id}-tails`, { width: 1.5, height: 0.15, depth: 0.05 }, this.scene); tails.parent = node; tails.position.set(0, 0.7, -2.11); tails.material = this.m('taillight');
    return node;
  }
  private pillar(b: Box, r: () => number) {
    const B = this.batches, top = b.y + b.h / 2;
    B.box(this.m('concrete'), b.x, b.y, b.z, b.w, b.h, b.d, { caster: true });
    B.box(this.m('concreteDark'), b.x, top - 0.35, b.z, b.w + 0.6, 0.7, b.d + 0.6, { caster: true });
    B.box(this.plaster('#c8c2b4'), b.x, 0.5, b.z, b.w + 0.04, 1, b.d + 0.04);
    for (const face of ['n', 's'] as Face[]) { const p = this.onFace(b, face, 0, 1.6, 0.025); if (r() < 0.6) this.sign(['VULCANIZER →', 'POST NO BILLS', 'P-14', 'CALL 4 TINTING'][Math.floor(r() * 4)], p.x, p.y, p.z, 1.1, 0.5, face, { style: r() < 0.5 ? 'poster' : 'stencil', bg: '#efe7cf', fg: '#222' }); }
  }
  // ── Vehicles.
  private danfo(b: Box, r: () => number) {
    const B = this.batches, along = b.w > b.d, yaw = along ? Math.PI / 2 : 0, L = along ? b.w : b.d, W = along ? b.d : b.w;
    const local = (lx: number, ly: number, lz: number) => ({ x: b.x + (along ? lz : lx), y: ly, z: b.z + (along ? -lx : lz) });
    const box = (mat: string, lx: number, ly: number, lz: number, w: number, h: number, d: number, caster = false) => { const p = local(lx, ly, lz); B.box(this.m(mat), p.x, p.y, p.z, w, h, d, { ry: yaw, caster }); };
    box('danfo', 0, 1.35, 0, W - 0.06, 1.9, L - 0.2, true); box('danfo', 0, 2.42, -0.1, W - 0.16, 0.24, L - 0.6, true);
    box('black', 0, 1.0, 0, W, 0.16, L - 0.18); box('black', 0, 1.24, 0, W + 0.005, 0.08, L - 0.18);
    for (const s of [-1, 1]) for (let z = -L / 2 + 1.1; z < L / 2 - 0.9; z += 1.05) box('glass', s * (W / 2 - 0.02), 1.95, z, 0.04, 0.68, 0.92);
    box('glass', 0, 1.9, L / 2 - 0.08, W - 0.3, 0.8, 0.06); box('glass', 0, 1.95, -L / 2 + 0.08, W - 0.4, 0.6, 0.06);
    box('black', 0, 0.55, L / 2 - 0.02, W, 0.28, 0.14); box('black', 0, 0.55, -L / 2 + 0.02, W, 0.28, 0.14); box('chrome', 0, 0.9, L / 2 - 0.06, W * 0.5, 0.25, 0.04);
    for (const s of [-1, 1]) { box('headlight', s * (W / 2 - 0.35), 0.95, L / 2 - 0.08, 0.35, 0.22, 0.04); box('taillight', s * (W / 2 - 0.25), 1.0, -L / 2 + 0.08, 0.2, 0.3, 0.04); box('black', s * (W / 2 + 0.12), 1.9, L / 2 - 0.6, 0.08, 0.2, 0.16); }
    box('iron', 0, 2.62, -0.4, W - 0.4, 0.05, L * 0.55); for (const s of [-1, 1]) box('iron', s * (W / 2 - 0.25), 2.72, -0.4, 0.04, 0.2, L * 0.55);
    if (r() < 0.7) box('cloth', 0.2, 2.85, -0.6, 1.2, 0.3, 1.4);
    for (const s of [-1, 1]) for (const z of [-L / 2 + 1, L / 2 - 1]) { const p = local(s * (W / 2 - 0.05), 0.42, z); B.cylinder(this.m('rubber'), p.x, p.y, p.z, 0.84, 0.24, { rz: Math.PI / 2, ry: yaw, tessellation: 16, caster: true }); const h = local(s * (W / 2 + 0.07), 0.42, z); B.cylinder(this.m('chrome'), h.x, h.y, h.z, 0.4, 0.02, { rz: Math.PI / 2, ry: yaw }); }
    for (const s of [-1, 1]) { const p = local(s * (W / 2 + 0.01), 1.3, 0); this.sign(b.label ?? 'OJUELEGBA', p.x, p.y, p.z, L * 0.6, 0.32, (along ? (s > 0 ? 's' : 'n') : (s > 0 ? 'e' : 'w')) as Face, { bg: '#f2b705', fg: '#141414', style: 'painted' }); }
    const rear = local(0, 1.45, -L / 2 - 0.01); this.sign(['NO KING AS GOD', "GOD'S TIME IS THE BEST", 'NO TELL ME', 'EKO O NI BAJE'][Math.floor(r() * 4)], rear.x, rear.y, rear.z, W * 0.8, 0.3, (along ? 'w' : 's') as Face, { bg: '#f2b705', fg: '#1a1a1a', style: 'painted' });
    const plate = local(0, 0.72, L / 2 + 0.06); this.sign('LAG 247 XY', plate.x, plate.y, plate.z, 0.5, 0.16, (along ? 'e' : 'n') as Face, { bg: '#f3f3f3', fg: '#1a3a7a', style: 'plate' });
    // Wipers, a grab rail by the door, mud flaps, rust bubbling through the yellow and whatever is roped to the roof.
    const v = (lx: number, ly: number, lz: number) => { const p = local(lx, ly, lz); return new Vector3(p.x, p.y, p.z); };
    for (const s of [-1, 1]) B.rod(this.m('black'), v(s * 0.55, 1.52, L / 2 - 0.04), v(s * 0.15, 1.95, L / 2 - 0.05), 0.025);
    B.rod(this.m('chrome'), v(W / 2 + 0.04, 0.9, L / 2 - 2.1), v(W / 2 + 0.04, 1.9, L / 2 - 2.1), 0.035);
    for (const s of [-1, 1]) box('black', s * (W / 2 - 0.25), 0.32, -L / 2 + 0.65, 0.32, 0.36, 0.02);
    for (let i = 0; i < 3; i++) box('roofRust', (r() < 0.5 ? -1 : 1) * (W / 2 - 0.02), 0.75 + r() * 0.35, (r() - 0.5) * (L - 2), 0.012, 0.18 + r() * 0.2, 0.3 + r() * 0.5);
    if (r() < 0.6) { const p = local(-0.3, 2.95, 0.4); B.sphere(this.m('cloth'), p.x, p.y, p.z, 0.75, { sy: 0.55 }); const q = local(0.45, 2.92, -0.6); B.sphere(this.m('roofRust'), q.x, q.y, q.z, 0.6, { sy: 0.6 }); box('plastic', 0.1, 2.88, -1.4, 0.3, 0.4, 0.22); }
    const back = local(0, 1.95, -L / 2 - 0.02); this.sign(['GOD IS ABLE', 'NO WAHALA', 'JESUS IS LORD', 'ALHAMDULILLAH'][Math.floor(r() * 4)], back.x, back.y, back.z, 0.9, 0.18, (along ? 'w' : 's') as Face, { bg: '#ffffff', fg: '#b3261e', style: 'painted' });
    this.contact(b.x, b.z, b.w + 0.4, b.d + 0.4);
  }
  /** Builds one danfo into its own batches, parented to a node at its centre, with a sliding side door on the kerb side. */
  private mover(id: string, b: Box, r: () => number) {
    const main = this.batches, along = b.w > b.d, L = along ? b.w : b.d, W = along ? b.d : b.w;
    const node = new TransformNode(id, this.scene); node.position.set(b.x, 0, b.z);
    const adopt = (parent: TransformNode) => (mesh: Mesh) => { mesh.unfreezeWorldMatrix(); mesh.doNotSyncBoundingInfo = false; mesh.alwaysSelectAsActiveMesh = true; mesh.parent = parent; mesh.position.set(-b.x, 0, -b.z); };
    this.batches = new Batches(this.scene); this.danfo(b, r);
    // The doorway: a dark opening behind the panel, revealed as the door slides back along the body.
    const side = along ? { z: b.z - W / 2 - 0.02 } : { x: b.x + W / 2 + 0.02 }, at = (along_: number, out: number) => along ? { x: b.x + along_, z: (side.z ?? 0) - out } : { x: (side.x ?? 0) + out, z: b.z + along_ };
    const opening = at(L / 2 - 1.5, 0); this.batches.box(this.m('black'), opening.x, 1.3, opening.z, along ? 0.95 : 0.03, 1.7, along ? 0.03 : 0.95);
    this.batches.build(adopt(node));
    const door = new TransformNode('last-bus-door', this.scene); door.parent = node; this.batches = new Batches(this.scene);
    const panel = at(L / 2 - 1.5, 0.03); this.batches.box(this.m('danfo'), panel.x, 1.32, panel.z, along ? 0.98 : 0.04, 1.72, along ? 0.04 : 0.98); this.batches.box(this.m('glass'), panel.x, 1.95, panel.z + (along ? -0.025 : 0), along ? 0.8 : 0.02, 0.6, along ? 0.02 : 0.8);
    this.batches.box(this.m('chrome'), panel.x + (along ? -0.38 : 0), 1.2, panel.z + (along ? -0.03 : 0), along ? 0.18 : 0.02, 0.05, along ? 0.02 : 0.18);
    this.batches.build(adopt(door));
    this.batches = main; this.movers.set(id, { node, door, home: { x: b.x, z: b.z, yaw: along ? Math.PI / 2 : 0 } });
  }
  /** Places a movable vehicle: position, heading, how far its door has slid open, and whether it is shown at all. */
  setMover(id: string, x: number, z: number, yaw: number, door: number, visible: boolean) {
    const bus = this.movers.get(id); if (!bus) return; bus.node.setEnabled(visible); bus.node.position.set(x, 0, z); bus.node.rotation.y = yaw - bus.home.yaw;
    bus.door.position.x = -door * 1.05;
  }
  /**
   * Lighting and life of the city. Restored turns on shop windows, lit signs and street lamps and puts more traffic
   * on the flyover and ring roads; a blackout kills every lamp, window and sign at once.
   */
  setCity(state: CityState) {
    if (state === this.city) return; this.city = state;
    const lit = state === 'restored', dark = state === 'blackout';
    const glow = (name: string, color: string, k: number) => this.m(name).emissiveColor = Color3.FromHexString(color).scale(k);
    glow('glassWarm', '#e0a55a', dark ? 0.04 : lit ? 1.35 : 1); glow('glassCool', '#88aac4', dark ? 0.04 : lit ? 1.25 : 1); glow('glassNight', '#d99a50', lit ? 1.1 : 0); glow('interiorLit', '#7a5a34', dark ? 0.05 : lit ? 1.6 : 1);
    glow('sodium', '#ffb35a', dark ? 0.03 : lit ? 1.25 : 1); glow('headlight', '#fff0c8', dark ? 0.2 : 1);
    if (this.litSigns.emissiveTexture) this.litSigns.emissiveTexture.level = dark ? 0.05 : lit ? 1.25 : 1;
    for (const car of this.busyTraffic) car.setEnabled(lit);
  }
  private car(b: Box, r: () => number) {
    const B = this.batches, along = b.w > b.d, yaw = along ? Math.PI / 2 : 0, L = along ? b.w : b.d, W = along ? b.d : b.w, paint = this.mats.get(`car-${b.color}`, { color: b.color ?? '#555b60', surface: 'paint', tile: 2, specular: 0.45, gloss: 60 });
    const local = (lx: number, ly: number, lz: number) => ({ x: b.x + (along ? lz : lx), y: ly, z: b.z + (along ? -lx : lz) });
    const p0 = local(0, 0.68, 0); B.box(paint, p0.x, p0.y, p0.z, W, 0.7, L, { ry: yaw, caster: true });
    const p1 = local(0, 1.22, -0.25); B.box(paint, p1.x, p1.y, p1.z, W - 0.2, 0.46, L * 0.5, { ry: yaw, caster: true });
    const g = local(0, 1.22, -0.25); B.box(this.m('glass'), g.x, g.y, g.z, W - 0.15, 0.36, L * 0.48, { ry: yaw });
    for (const s of [-1, 1]) for (const z of [-L / 2 + 0.8, L / 2 - 0.8]) { const p = local(s * (W / 2 - 0.08), 0.33, z); B.cylinder(this.m('rubber'), p.x, p.y, p.z, 0.64, 0.22, { rz: Math.PI / 2, ry: yaw, tessellation: 14 }); }
    for (const s of [-1, 1]) { const h = local(s * (W / 2 - 0.3), 0.78, L / 2 + 0.01); B.box(this.m('headlight'), h.x, h.y, h.z, 0.36, 0.14, 0.03, { ry: yaw }); const t = local(s * (W / 2 - 0.3), 0.82, -L / 2 - 0.01); B.box(this.m('taillight'), t.x, t.y, t.z, 0.3, 0.14, 0.03, { ry: yaw }); }
    if (b.id.startsWith('yard')) { const hood = local(0, 1.1, L / 2 - 0.7); B.box(paint, hood.x, hood.y + 0.2, hood.z, W - 0.1, 0.05, 1.2, { ry: yaw, rx: along ? 0 : -0.9, rz: along ? 0.9 : 0 }); }
    if (r() < 0.3) { const dust = local(0, 1.46, -0.25); B.box(this.mats.get('dust', { color: '#b59c7a', surface: 'dirt', tile: 1 }), dust.x, dust.y, dust.z, W - 0.25, 0.01, L * 0.45, { ry: yaw }); }
    this.contact(b.x, b.z, b.w + 0.3, b.d + 0.3);
  }
  private policeVan(b: Box) {
    const B = this.batches, along = b.w > b.d, yaw = along ? Math.PI / 2 : 0, L = along ? b.w : b.d, W = along ? b.d : b.w;
    const local = (lx: number, ly: number, lz: number) => ({ x: b.x + (along ? lz : lx), y: ly, z: b.z + (along ? -lx : lz) });
    const box = (mat: string, lx: number, ly: number, lz: number, w: number, h: number, d: number, caster = false) => { const p = local(lx, ly, lz); B.box(this.m(mat), p.x, p.y, p.z, w, h, d, { ry: yaw, caster }); };
    box('navy', 0, 1.25, 0, W, 1.85, L, true); box('white', 0, 1.25, 0, W + 0.005, 0.32, L - 0.4);
    for (const s of [-1, 1]) for (let z = -L / 2 + 1; z < L / 2 - 0.6; z += 1.2) box('glass', s * (W / 2 + 0.01), 1.85, z, 0.02, 0.5, 0.95);
    box('glass', 0, 1.8, L / 2 + 0.01, W - 0.3, 0.7, 0.02);
    for (const s of [-1, 1]) for (const z of [-L / 2 + 0.9, L / 2 - 0.9]) { const p = local(s * (W / 2 - 0.05), 0.4, z); B.cylinder(this.m('rubber'), p.x, p.y, p.z, 0.78, 0.24, { rz: Math.PI / 2, ry: yaw, tessellation: 16 }); const h = local(s * (W / 2 + 0.075), 0.4, z); B.cylinder(this.m('metal'), h.x, h.y, h.z, 0.4, 0.02, { rz: Math.PI / 2, ry: yaw, tessellation: 12 }); }
    box('metalDark', 0, 2.24, 0.6, 1.4, 0.12, 0.3);
    const blue = local(-0.4, 2.33, 0.6), red = local(0.4, 2.33, 0.6);
    const beacon = (name: string, p: { x: number; y: number; z: number }, phase: number) => { const mesh = MeshBuilder.CreateBox(name, { width: 0.5, height: 0.12, depth: 0.26 }, this.scene); mesh.position.set(p.x, p.y, p.z); mesh.rotation.y = yaw; mesh.material = this.mats.get(`${name}-mat`, name.includes('blue') ? SPECS.beaconBlue : SPECS.beaconRed); this.beacons.push({ mesh, phase }); };
    beacon(`${b.id}-blue`, blue, 0); beacon(`${b.id}-red`, red, Math.PI);
    for (const s of [-1, 1]) { const p = local(s * (W / 2 + 0.012), 1.25, 0); this.sign('POLICE', p.x, p.y, p.z, 1.6, 0.3, (along ? (s > 0 ? 's' : 'n') : (s > 0 ? 'e' : 'w')) as Face, { bg: '#f2f2f2', fg: '#1d2c52', style: 'plate' }); }
    this.contact(b.x, b.z, b.w + 0.4, b.d + 0.4);
  }
  // ── Street furniture, stalls and props.
  private stall(b: Box, base: number, r: () => number) {
    const B = this.batches, top = base + b.h, style = b.style ?? 'market';
    if (style === 'kiosk') {
      B.box(this.mats.get('kiosk', { color: '#2f6b9f', surface: 'paint', tile: 1.5, specular: 0.3 }), b.x, b.y, b.z, b.w, b.h, b.d, { caster: true });
      B.box(this.m('roofRust'), b.x, top + 0.05, b.z, b.w + 0.5, 0.06, b.d + 0.5, { caster: true });
      const face: Face = b.x < 0 ? 'e' : 'w', p = this.onFace(b, face, 0, base + 1.4, 0.02); B.box(this.m('interiorLit'), p.x, p.y, p.z, 0.02, 0.7, b.d - 0.4);
      const s = this.onFace(b, face, 0, top - 0.2, 0.03); this.sign(b.label ?? 'RECHARGE CARD', s.x, s.y, s.z, b.d - 0.1, 0.35, face, { bg: '#f2c94c', fg: '#16365e', style: 'board' });
      this.contact(b.x, b.z, b.w + 0.3, b.d + 0.3); return;
    }
    if (style === 'booth') {
      B.box(this.plaster('#e6e1d2'), b.x, b.y, b.z, b.w, b.h, b.d, { caster: true }); B.box(this.m('roofSheet'), b.x, top + 0.06, b.z, b.w + 0.4, 0.1, b.d + 0.4, { caster: true });
      for (const face of ['n', 'e', 'w'] as Face[]) { const p = this.onFace(b, face, 0, base + 1.7, 0.02); B.box(this.m('glassWarm'), p.x, p.y, p.z, face === 'n' ? 1.6 : 0.02, 0.8, face === 'n' ? 0.02 : 1.4); }
      const s = this.onFace(b, 'n', 0, top - 0.3, 0.03); this.sign(b.label ?? 'CHECKPOINT', s.x, s.y, s.z, b.w - 0.2, 0.4, b.z < 0 ? 'n' : 's', { bg: b.z < 0 ? '#1d2c52' : '#f2b705', fg: b.z < 0 ? '#fff' : '#111', style: 'board', lit: true });
      return;
    }
    if (style === 'umbrella') {
      B.box(this.m('plasticBlue'), b.x, b.y, b.z, b.w, b.h, b.d); B.box(this.m('plasticWhite'), b.x, top + 0.02, b.z, b.w + 0.02, 0.06, b.d + 0.02);
      B.cylinder(this.m('metal'), b.x, top + 1.2, b.z, 0.05, 2.4); B.cylinder(this.m('awningRed'), b.x, top + 2.25, b.z, 2.8, 0.35, { top: 0.1, tessellation: 8, caster: true });
      for (const [dx, dz] of [[1.2, 0.4], [-0.9, -1]]) { B.box(this.m('plastic'), b.x + dx, base + 0.22, b.z + dz, 0.42, 0.04, 0.42); B.box(this.m('plastic'), b.x + dx, base + 0.45, b.z + dz + 0.2, 0.42, 0.5, 0.04); }
      return;
    }
    // Market table under a tarp canopy, piled with produce.
    B.box(this.m('wood'), b.x, base + 0.85, b.z, b.w, 0.08, b.d, { caster: true }); B.box(this.m('wood'), b.x, base + 0.42, b.z, b.w - 0.2, 0.84, b.d - 0.2);
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) B.box(this.m('wood'), b.x + sx * (b.w / 2 - 0.05), base + b.h / 2, b.z + sz * (b.d / 2 - 0.05), 0.08, b.h, 0.08);
    B.box(this.m(r() < 0.5 ? 'awningBlue' : 'awningRed'), b.x, top + 0.04, b.z, b.w + 0.6, 0.05, b.d + 0.6, { rx: 0.12, caster: true });
    const produce = ['tomato', 'pepper', 'onion', 'plantain'];
    for (let i = 0; i < 5; i++) { const px = b.x + (i - 2) * (b.w / 5), item = produce[Math.floor(r() * produce.length)]; B.cylinder(this.m('plasticBlue'), px, base + 0.95, b.z, 0.5, 0.12, { top: 0.56 }); for (let k = 0; k < 4; k++) B.sphere(this.m(item), px + (r() - 0.5) * 0.25, base + 1.05 + k * 0.03, b.z + (r() - 0.5) * 0.25, item === 'plantain' ? 0.16 : 0.12, { segments: 4 }); }
    this.contact(b.x, b.z, b.w + 0.5, b.d + 0.5);
  }
  private cover(b: Box, base: number) {
    const B = this.batches;
    if (b.style === 'counter') { B.box(this.m('wood'), b.x, b.y, b.z, b.w, b.h, b.d, { caster: true }); B.box(this.m('glass'), b.x, base + b.h + 0.01, b.z, b.w - 0.1, 0.02, b.d - 0.1); for (let i = 0; i < 4; i++) B.box(this.m(['plasticWhite', 'black', 'plasticBlue'][i % 3]), b.x - b.w / 2 + 0.6 + i * 0.9, base + b.h + 0.08, b.z, 0.3, 0.14, 0.2); return; }
    // Jersey barrier: wide foot, narrow top, faded red-and-white bands.
    const long = b.w > b.d, L = long ? b.w : b.d, T = long ? b.d : b.w;
    B.box(this.m('concrete'), b.x, base + 0.2, b.z, long ? L : T, 0.4, long ? T : L, { caster: true });
    B.box(this.m('concrete'), b.x, base + 0.75, b.z, long ? L : T * 0.55, 0.7, long ? T * 0.55 : L, { caster: true });
    for (let t = -L / 2 + 0.25; t < L / 2; t += 1) B.box(this.mats.get('band-red', { color: '#a8382c', surface: 'paint', tile: 1 }), long ? b.x + t : b.x, base + 0.72, long ? b.z : b.z + t, long ? 0.5 : T * 0.56, 0.66, long ? T * 0.56 : 0.5);
    this.contact(b.x, b.z, b.w + 0.3, b.d + 0.3);
  }
  private prop(b: Box, base: number, r: () => number) {
    const B = this.batches, top = base + b.h;
    switch (b.style) {
      case 'drums': for (const o of [-0.38, 0.38]) B.cylinder(this.m(r() < 0.5 ? 'plasticBlue' : 'roofRust'), b.x + o, base + 0.5, b.z, 0.62, 1, { caster: true, tessellation: 16 }); break;
      case 'tyres': for (let i = 0; i < 4; i++) B.torus(this.m('rubber'), b.x + (r() - 0.5) * 0.08, base + 0.14 + i * 0.27, b.z + (r() - 0.5) * 0.08, 0.82, 0.28, { caster: true }); break;
      case 'crates': for (let i = 0; i < 3; i++) B.box(this.m('wood'), b.x + (i === 2 ? 0 : (i - 0.5) * 0.78), base + (i === 2 ? 0.9 : 0.3), b.z, 0.74, 0.6, b.d - 0.1, { caster: true, ry: (r() - 0.5) * 0.2 }); break;
      case 'generator':
        B.box(this.m('generator'), b.x, base + 0.38, b.z, b.w - 0.1, 0.5, b.d - 0.2, { caster: true }); B.box(this.m('generator'), b.x, base + 0.72, b.z + 0.15, b.w - 0.2, 0.18, 0.55);
        B.box(this.m('metalDark'), b.x, base + 0.07, b.z, b.w, 0.06, b.d); for (const s of [-1, 1]) B.box(this.m('metalDark'), b.x + s * (b.w / 2 - 0.03), base + 0.45, b.z, 0.04, 0.8, b.d);
        B.cylinder(this.m('metalDark'), b.x, base + 0.45, b.z - b.d / 2 - 0.08, 0.1, 0.25, { rx: Math.PI / 2 }); this.handles.generators.push(new Vector3(b.x, base + 0.5, b.z)); break;
      case 'bin': B.box(this.mats.get('bin', { color: '#2e5e3a', surface: 'metal', tile: 1, specular: 0.2 }), b.x, b.y, b.z, b.w, b.h, b.d, { caster: true }); B.box(this.m('black'), b.x, top + 0.03, b.z, b.w + 0.04, 0.06, b.d + 0.04, { rx: 0.08 }); for (let i = 0; i < 3; i++) B.box(this.m(['black', 'plasticBlue', 'cloth'][i]), b.x + (r() - 0.5) * 2, base + 0.15, b.z + b.d / 2 + 0.3 + r() * 0.4, 0.4, 0.3, 0.35); break;
      case 'container': case 'shelter': {
        const mat = b.style === 'shelter' ? this.plaster(b.color ?? '#c8c2b4') : this.mats.get(`container-${b.color}`, { color: b.color ?? '#2f5d6b', surface: 'corrugated', tile: 1.6 });
        B.box(mat, b.x, b.y, b.z, b.w, b.h, b.d, { caster: true }); B.box(this.m('metalDark'), b.x, top + 0.03, b.z, b.w + 0.04, 0.06, b.d + 0.04);
        const face: Face = b.x < 0 ? 'e' : 'w', p = this.onFace(b, face, 0, base + 1.2, 0.03);
        if (b.style === 'shelter') { B.box(this.m('metal'), p.x, p.y, p.z, 0.04, 2.1, 0.95); this.sign('DANGER — HIGH VOLTAGE', p.x, base + 2.35, p.z + (b.x < 0 ? -1.5 : 1.5), 1.6, 0.4, face, { bg: '#f2c94c', fg: '#111', style: 'board' }); }
        else for (const t of [-0.55, 0.55]) B.box(this.m('metalDark'), p.x, p.y, p.z + t * 2, 0.04, 2.2, 0.06);
        this.contact(b.x, b.z, b.w + 0.3, b.d + 0.3); break;
      }
      case 'bench': B.box(this.m('wood'), b.x, top - 0.04, b.z, b.w, 0.08, b.d, { caster: true }); for (const s of [-1, 1]) B.box(this.m('metalDark'), b.x + s * (b.w / 2 - 0.1), base + b.h / 2, b.z, 0.08, b.h, b.d - 0.1); B.box(this.m('generator'), b.x - 0.4, top + 0.12, b.z, 0.4, 0.2, 0.3); B.box(this.m('metal'), b.x + 0.5, top + 0.04, b.z, 0.5, 0.05, 0.1); break;
      case 'toolcabinet': case 'relay': {
        const relay = b.style === 'relay';
        B.box(this.mats.get(relay ? 'relay-body' : 'tool-body', { color: relay ? '#9ea6a8' : '#a3332a', surface: 'metal', tile: 1, specular: 0.4 }), b.x, b.y, b.z, b.w, b.h, b.d, { caster: true });
        const face: Face = b.z < 0 ? 's' : 'n';
        for (let i = 0; i < 4; i++) { const p = this.onFace(b, face, 0, base + 0.4 + i * 0.35, 0.01); B.box(this.m('metalDark'), p.x, p.y, p.z, b.w - 0.25, 0.04, 0.01); }
        if (relay) {
          const p = this.onFace(b, face, 0.35, top - 0.2, 0.02), q = this.onFace(b, face, 0, top - 0.15, 0.02);
          const jammed = MeshBuilder.CreateBox('relay-jammed', { width: 0.12, height: 0.06, depth: 0.03 }, this.scene); jammed.position.set(p.x, p.y, p.z); jammed.material = this.mats.get('relay-red', SPECS.ledRed);
          const clear = MeshBuilder.CreateBox('relay-clear', { width: 0.12, height: 0.06, depth: 0.03 }, this.scene); clear.position.set(p.x - 0.2 * (face === 'n' ? -1 : 1), p.y, p.z); clear.material = this.mats.get('relay-green', SPECS.ledGreen); clear.setEnabled(false);
          this.handles.relayLights.push({ jammed, clear }); this.sign('SIGNAL 9 • RELAY 07', q.x - (face === 'n' ? -0.1 : 0.1), q.y - 0.35, q.z, 0.9, 0.22, face, { bg: '#e9e7e0', fg: '#b3261e', style: 'plate' });
          // A crude jamming box clamped to the relay: the thing the story asks you to pull.
          const j = this.onFace(b, face, -0.25, base + 1.0, 0.12); B.box(this.m('black'), j.x, j.y, j.z, 0.42, 0.3, 0.2); B.cylinder(this.m('metal'), j.x, j.y + 0.35, j.z, 0.02, 0.45);
        }
        break;
      }
      case 'tankstand': case 'mast': {
        for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) B.box(this.m('iron'), b.x + sx * 0.42, base + b.h / 2, b.z + sz * 0.42, 0.08, b.h, 0.08);
        B.box(this.m('iron'), b.x, top - 0.04, b.z, b.w, 0.08, b.d);
        if (b.style === 'tankstand') { B.cylinder(this.m('tank'), b.x, top + 0.75, b.z, 1.3, 1.5, { caster: true, tessellation: 16 }); break; }
        // Telecom lattice mast with braced legs, antenna panels and an aviation beacon.
        const H = 20, legs = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
        for (let i = 0; i < 4; i++) { const [ax, az] = legs[i]; const a = new Vector3(b.x + ax * 0.45, top, b.z + az * 0.45), c = new Vector3(b.x + ax * 0.18, top + H, b.z + az * 0.18); B.rod(this.m('metal'), a, c, 0.07); }
        for (let y = 0; y < H; y += 2) for (let i = 0; i < 4; i++) { const [ax, az] = legs[i], [bx, bz] = legs[(i + 1) % 4], s0 = 0.45 - 0.27 * y / H, s1 = 0.45 - 0.27 * (y + 2) / H; B.rod(this.m('metal'), new Vector3(b.x + ax * s0, top + y, b.z + az * s0), new Vector3(b.x + bx * s1, top + y + 2, b.z + bz * s1), 0.03); }
        for (let i = 0; i < 3; i++) { const angle = i * Math.PI * 2 / 3; B.box(this.m('plasticWhite'), b.x + Math.sin(angle) * 0.4, top + H - 1.2, b.z + Math.cos(angle) * 0.4, 0.3, 1.4, 0.1, { ry: angle }); }
        B.cylinder(this.m('plasticWhite'), b.x + 0.3, top + H - 3.5, b.z, 0.6, 0.12, { rz: Math.PI / 2 });
        const light = MeshBuilder.CreateSphere('mast-beacon', { diameter: 0.25, segments: 6 }, this.scene); light.position.set(b.x, top + H + 0.3, b.z); light.material = this.mats.get('mast-red', SPECS.beaconRed); this.beacons.push({ mesh: light, phase: 0.5 });
        break;
      }
      case 'cartons': for (let i = 0; i < 4; i++) B.box(this.mats.get('carton', { color: '#b08a5a', surface: 'paint', tile: 1 }), b.x + (i % 2 - 0.5) * 0.55, base + 0.22 + Math.floor(i / 2) * 0.44, b.z + (r() - 0.5) * 0.2, 0.5, 0.42, 0.5, { ry: (r() - 0.5) * 0.3 }); break;
      case 'shelf':
        B.box(this.m('metalDark'), b.x, b.y, b.z - b.d / 2 + 0.03, b.w, b.h, 0.04);
        for (let y = 0.3; y < b.h; y += 0.5) { B.box(this.m('metal'), b.x, base + y, b.z, b.w, 0.03, b.d); for (let x = -b.w / 2 + 0.3; x < b.w / 2; x += 0.45) B.box(this.m(['plasticWhite', 'black', 'plasticBlue', 'carton'][Math.floor(r() * 3)]), b.x + x, base + y + 0.15, b.z, 0.32, 0.26, 0.3); }
        break;
      case 'okada': {
        const yaw = 0.35; B.cylinder(this.m('rubber'), b.x, base + 0.32, b.z - 0.65, 0.62, 0.12, { rz: Math.PI / 2, ry: yaw }); B.cylinder(this.m('rubber'), b.x, base + 0.32, b.z + 0.65, 0.62, 0.12, { rz: Math.PI / 2, ry: yaw });
        B.box(this.mats.get('okada-red', { color: '#8e1f1c', surface: 'paint', tile: 1, specular: 0.4 }), b.x, base + 0.62, b.z, 0.3, 0.35, 1.1, { ry: yaw, caster: true }); B.box(this.m('black'), b.x, base + 0.86, b.z - 0.2, 0.3, 0.1, 0.7, { ry: yaw }); B.box(this.m('chrome'), b.x, base + 1.0, b.z + 0.62, 0.7, 0.04, 0.04, { ry: yaw }); break;
      }
      case 'acunit': B.box(this.m('plasticWhite'), b.x, b.y, b.z, b.w, b.h, b.d, { caster: true }); B.box(this.m('metalDark'), b.x + (b.x < 0 ? 0.36 : -0.36), b.y, b.z, 0.01, b.h - 0.15, b.d - 0.2); break;
      default: B.box(this.m('wood'), b.x, b.y, b.z, b.w, b.h, b.d, { caster: true });
    }
  }
  private pole(b: Box, base: number, r: () => number) {
    const B = this.batches, top = base + b.h;
    if (b.style === 'utility') { B.cylinder(this.m('bark'), b.x, b.y, b.z, 0.26, b.h, { top: 0.2, caster: true }); B.box(this.m('wood'), b.x, top - 0.5, b.z, 2.2, 0.12, 0.12); for (const o of [-0.9, -0.3, 0.3, 0.9]) B.cylinder(this.m('plasticWhite'), b.x + o, top - 0.38, b.z, 0.08, 0.14); if (r() < 0.5) B.cylinder(this.m('metalDark'), b.x + 0.3, top - 1.6, b.z, 0.5, 0.75); return; }
    if (b.style === 'tree') { this.tree(b.x, base, b.z, r); return; }
    const dir = b.x < 0 ? 1 : -1;
    B.cylinder(this.m('metal'), b.x, b.y, b.z, 0.2, b.h, { top: 0.12, caster: true }); B.box(this.m('metal'), b.x + dir * 0.8, top - 0.1, b.z, 1.6, 0.08, 0.08);
    B.box(this.m('metalDark'), b.x + dir * 1.55, top - 0.2, b.z, 0.6, 0.15, 0.3); B.box(this.m('sodium'), b.x + dir * 1.55, top - 0.29, b.z, 0.48, 0.03, 0.22);
    B.cylinder(this.m('concreteDark'), b.x, base + 0.15, b.z, 0.42, 0.3);
  }
  private tree(x: number, base: number, z: number, r: () => number) {
    const B = this.batches; B.cylinder(this.m('bark'), x, base + 1.8, z, 0.32, 3.6, { top: 0.22, caster: true });
    const crown = new TransformNode(`tree-${x}-${z}`, this.scene); crown.position.set(x, base + 4.4, z);
    for (let i = 0; i < 6; i++) { const leaf = MeshBuilder.CreateSphere('leaf', { diameter: 1.6 + r() * 1.2, segments: 5 }, this.scene); leaf.parent = crown; leaf.position.set((r() - 0.5) * 2.2, (r() - 0.3) * 1.2, (r() - 0.5) * 2.2); leaf.scaling.y = 0.7; leaf.material = this.m(i % 2 ? 'leaves' : 'leavesDark'); leaf.isPickable = false; this.shadowCasters.push(leaf); }
    this.animated.push({ node: crown, sway: 0.02, phase: r() * 6 });
  }
  private trees() {
    // Low weeds where pavement meets walls.
    const r = rng('weeds'); for (let i = 0; i < 40; i++) { const x = (r() - 0.5) * 78, z = (r() < 0.5 ? -1 : 1) * (8.6 + r() * 15); this.batches.cylinder(this.m('grass'), x, 0.08, z, 0.3 + r() * 0.3, 0.16, { top: 0.05, tessellation: 5 }); }
  }
  private fence(b: Box) {
    const B = this.batches, long = b.w > b.d, L = long ? b.w : b.d, base = b.y - b.h / 2;
    const mesh = this.mats.get('chainlink', { color: '#ffffff', backFaces: true }); if (!mesh.diffuseTexture) { mesh.diffuseTexture = chainLink(this.scene); mesh.diffuseTexture.hasAlpha = true; (mesh.diffuseTexture as DynamicTexture).uScale = 1 / 0.6; (mesh.diffuseTexture as DynamicTexture).vScale = 1 / 0.6; mesh.useAlphaFromDiffuseTexture = false; }
    B.plane(mesh, b.x, b.y, b.z, L, b.h, { ry: long ? 0 : Math.PI / 2 });
    for (let t = -L / 2; t <= L / 2 + 0.01; t += 2.5) B.cylinder(this.m('metal'), long ? b.x + t : b.x, b.y, long ? b.z : b.z + t, 0.08, b.h);
    B.box(this.m('metal'), b.x, base + b.h - 0.03, b.z, long ? L : 0.06, 0.06, long ? 0.06 : L);
    // Barbed coil along the top.
    for (let t = -L / 2; t < L / 2; t += 0.4) B.torus(this.m('metal'), long ? b.x + t : b.x, base + b.h + 0.15, long ? b.z : b.z + t, 0.35, 0.015, { rz: long ? Math.PI / 2 : 0, rx: long ? 0 : Math.PI / 2 });
    if (b.style === 'gate') { const f: Face = b.z < 0 ? 'n' : 's'; this.sign(b.z < 0 ? 'POLICE CHECKPOINT — STOP' : 'DANFO PARK — NO LOITERING', b.x, base + 2.6, b.z + (b.z < 0 ? 0.05 : -0.05), 4, 0.7, f, { bg: b.z < 0 ? '#1d2c52' : '#f2b705', fg: b.z < 0 ? '#f4f4f4' : '#111', style: 'board' }); }
  }
  private compound(b: Box, base: number, r: () => number) {
    const B = this.batches, long = b.w > b.d, color = b.z > 0 ? '#d9d2c0' : '#d7c3a0';
    B.box(this.plaster(color), b.x, b.y, b.z, b.w, b.h, b.d, { caster: true });
    B.box(this.m('concrete'), b.x, base + b.h + 0.06, b.z, b.w + 0.12, 0.12, b.d + 0.12);
    B.box(this.plaster(shade(color, 0.7)), b.x, base + 0.25, b.z, b.w + 0.02, 0.5, b.d + 0.02);
    for (let t = -(long ? b.w : b.d) / 2 + 0.2; t < (long ? b.w : b.d) / 2; t += 0.35) B.box(this.m('metal'), long ? b.x + t : b.x, base + b.h + 0.3, long ? b.z : b.z + t, 0.03, 0.45, 0.03);
    if (b.label) { const face: Face = b.z < 0 ? 'n' : 's'; this.sign(b.label, b.x, base + 1.5, b.z + (b.z < 0 ? b.d / 2 + 0.02 : -b.d / 2 - 0.02), Math.min(b.w - 0.4, 4.6), 0.9, face, { bg: b.z < 0 ? '#f4efe0' : '#ffffff', fg: b.z < 0 ? '#8c1f17' : '#b3261e', style: 'painted' }); }
    else if (r() < 0.4) { const face: Face = long ? (b.z < 0 ? 'n' : 's') : (b.x < 0 ? 'e' : 'w'); const p = this.onFace(b, face, 0, base + 1.2, 0.03); this.sign('POST NO BILLS', p.x, p.y, p.z, 1.6, 0.45, face, { style: 'stencil', fg: '#2a2a2a' }); }
  }
  private cables() {
    const poles = this.boxes.filter(b => b.style === 'utility').map(b => new Vector3(b.x, b.y + b.h / 2 - 0.38, b.z));
    const rows = [poles.filter(p => p.z < 0).sort((a, b) => a.x - b.x), poles.filter(p => p.z > 0).sort((a, b) => a.x - b.x)];
    for (const row of rows) for (let i = 0; i < row.length - 1; i++) for (const o of [-0.9, -0.3, 0.3, 0.9]) this.batches.cable(this.m('black'), row[i].add(new Vector3(o, 0, 0)), row[i + 1].add(new Vector3(o, 0, 0)), 0.9 + Math.abs(o) * 0.2);
    // Service drops sagging from poles to the buildings behind them, and lines across the junction.
    for (const row of rows) for (const p of row) this.batches.cable(this.m('black'), p, new Vector3(p.x + 1, p.y - 2.2, p.z + (p.z < 0 ? -2.5 : 2.5)), 0.4, 5);
    if (rows[0].length && rows[1].length) { const a = rows[0].find(p => p.x > 0) ?? rows[0][0], b = rows[1].find(p => p.x > 0) ?? rows[1][0]; this.batches.cable(this.m('black'), a, b, 2.2, 14); }
    // The informal network: every pole feeds a few buildings directly, and the wires sag across the frontages.
    const r = rng('wires'), fronts = this.boxes.filter(b => b.kind === 'building' && b.h > 6);
    for (const row of rows) for (const p of row) for (const b of fronts.filter(b => Math.abs(b.x - p.x) < 14 && Math.sign(b.z) === Math.sign(p.z)).slice(0, 3)) {
      const fz = b.z + (b.z < 0 ? 1 : -1) * (b.d / 2 + 0.05), x = Math.max(b.x - b.w / 2 + 0.6, Math.min(b.x + b.w / 2 - 0.6, p.x + (r() - 0.5) * 8));
      this.batches.cable(this.m('black'), p.add(new Vector3((r() - 0.5) * 1.6, -r() * 0.4, 0)), new Vector3(x, 4.6 + r() * 2.4, fz), 0.35 + r() * 0.6, 7);
    }
  }
  /** Distant city: silhouettes with lit window strips beyond the perimeter. */
  private skyline() {
    const r = rng('skyline');
    for (let i = 0; i < 46; i++) {
      const angle = (i / 46) * Math.PI * 2, radius = 64 + r() * 22, x = Math.sin(angle) * radius * 1.15, z = Math.cos(angle) * radius, h = 10 + r() * 26, w = 7 + r() * 9;
      this.batches.box(this.m(r() < 0.5 ? 'skyline' : 'skylineDark'), x, h / 2, z, w, h, w * 0.8, { ry: -angle });
      const uv = this.atlas.windows(Math.max(2, Math.round(w / 2.2)), Math.max(2, Math.round(h / 3.4)), i * 977 + 11);
      const nx = -Math.sin(angle), nz = -Math.cos(angle);
      this.batches.plane(this.litSigns, x + nx * (w * 0.4 + 0.05), h / 2, z + nz * (w * 0.4 + 0.05), w * 0.85, h * 0.9, { ry: Math.atan2(nx, nz), uv });
    }
  }
  private billboards() {
    const boards: [number, number, number, Face, string, string, string, string][] = [
      [-23, 46, -34, 'n', 'SIGNAL 9', 'THE NETWORK THAT NEVER SLEEPS', '#0f3b66', '#ffd23f'], [-11, 46, 34, 's', 'SIGNAL 9', 'YOUR WHOLE LIFE IS ON THIS NETWORK', '#0f3b66', '#ffd23f'], [22, 46, 34, 's', 'JOLLOF EXPRESS', "LAGOS' FAVOURITE SINCE 1998", '#c8341f', '#fff3d6'],
      [-42, 46, 14, 'e', 'OJA DIRECT', 'MARKET PRICES • DELIVERED', '#1d6b45', '#f6f0dc'], [42, 46, -14, 'w', 'BRIGHT SMILE', 'TOOTHPASTE FOR THE WHOLE FAMILY', '#f4f1e8', '#1d3f8a']
    ];
    for (const [x, , z, face, title, sub, bg, fg] of boards) {
      const host = WORLD.filter(b => b.kind === 'building' && Math.abs(b.x - x) < 9 && Math.abs(b.z - z) < 6).sort((a, b) => b.h - a.h)[0]; const roof = host ? host.y + host.h / 2 : 12;
      const f = FACE[face], along = Math.abs(f.z) > 0;
      for (const o of [-3, 3]) this.batches.box(this.m('iron'), x + (along ? o : 0), roof + 2, z + (along ? 0 : o), 0.2, 4, 0.2, { caster: true });
      this.batches.box(this.m('iron'), x, roof + 5.2, z, along ? 10.4 : 0.3, 4.4, along ? 0.3 : 10.4, { caster: true });
      this.sign(title, x + f.x * 0.17, roof + 5.2, z + f.z * 0.17, 10, 4, face, { sub, bg, fg, w: 1024, h: 384, style: 'lightbox', lit: true });
      // Signal 9's own boards die with the network: a plain panel in front, shown while the relay is down.
      if (title === 'SIGNAL 9') { const off = new Batches(this.scene), uv = this.atlas.paint('NO SIGNAL', { sub: 'SIGNAL 9', bg: '#0a0d10', fg: '#6f7a80', w: 1024, h: 384, style: 'lightbox' }); off.plane(this.litSigns, x + f.x * 0.2, roof + 5.2, z + f.z * 0.2, 10, 4, { ry: f.yaw, uv }); off.build(mesh => { mesh.setEnabled(false); this.noSignal.push(mesh); }); }
    }
  }
  // ── Night: light the street the way the lamps would. The scene's real lights stay at four, so lamp light on the
  // ground is an additive decal with a halo round the fitting; both brighten with the night and die in the blackout.
  private glowMat(name: string, paint: (ctx: CanvasRenderingContext2D) => void) {
    let mat = this.mats.all().find(m => m.name === name); if (mat) return mat;
    mat = this.mats.get(name, { color: '#000000', unlit: true, backFaces: true });
    const t = new DynamicTexture(`${name}-tex`, { width: 128, height: 128 }, this.scene, true), ctx = t.getContext() as unknown as CanvasRenderingContext2D; paint(ctx); t.hasAlpha = true; t.update();
    mat.emissiveTexture = t; mat.opacityTexture = t; mat.alphaMode = Engine.ALPHA_ADD; mat.disableDepthWrite = true; mat.zOffset = -3; this.glows.push(mat); return mat;
  }
  private nightLights() {
    const pool = this.glowMat('lamp-pool', ctx => { const g = ctx.createRadialGradient(64, 64, 2, 64, 64, 64); g.addColorStop(0, 'rgba(255,190,110,0.55)'); g.addColorStop(0.45, 'rgba(255,160,80,0.22)'); g.addColorStop(1, 'rgba(255,140,60,0)'); ctx.fillStyle = g; ctx.fillRect(0, 0, 128, 128); });
    const halo = this.glowMat('lamp-halo', ctx => { const g = ctx.createRadialGradient(64, 64, 1, 64, 64, 64); g.addColorStop(0, 'rgba(255,220,160,0.9)'); g.addColorStop(0.25, 'rgba(255,180,100,0.3)'); g.addColorStop(1, 'rgba(255,150,70,0)'); ctx.fillStyle = g; ctx.fillRect(0, 0, 128, 128); });
    const lamp = (x: number, y: number, z: number, size: number) => {
      this.batches.plane(pool, x, 0.045, z, size, size, { rx: Math.PI / 2 });
      for (const ry of [0, Math.PI / 2]) this.batches.plane(halo, x, y - 0.05, z, 1.4, 1.4, { ry });
    };
    for (const b of this.boxes) {
      if (b.kind === 'pole' && b.style === 'streetlight') { const top = b.y + b.h / 2, hx = b.x + (b.x < 0 ? 1 : -1) * 1.55; lamp(hx, top - 0.32, b.z, 9); }
      // Security lamps over the shop fronts, one every dozen metres, each on a short bracket.
      if (b.kind === 'building' && b.y - b.h / 2 < 0.5 && b.style !== 'upper' && b.face) {
        const face = b.face as Face, f = FACE[face], W = face === 'n' || face === 's' ? b.w : b.d, n = Math.max(1, Math.round(W / 12));
        for (let i = 0; i < n; i++) {
          const p = this.onFace(b, face, -W / 2 + (i + 0.5) * W / n, 4.3, 0.35), g = this.onFace(b, face, -W / 2 + (i + 0.5) * W / n, 0, 2.6), across = Math.abs(f.z) > 0;
          this.batches.box(this.m('metalDark'), p.x - f.x * 0.17, p.y + 0.05, p.z - f.z * 0.17, across ? 0.06 : 0.4, 0.06, across ? 0.4 : 0.06); this.batches.box(this.m('sodium'), p.x, p.y, p.z, across ? 0.3 : 0.18, 0.08, across ? 0.18 : 0.3);
          lamp(g.x, 4.3, g.z, 6.5);
        }
      }
      // Fittings on the flyover pillars light the road beneath the deck.
      if (b.kind === 'pillar') for (const face of ['e', 'w'] as Face[]) { const p = this.onFace(b, face, 0, 5.2, 0.08), g = this.onFace(b, face, 0, 0, 2.2); this.batches.box(this.m('sodium'), p.x, p.y, p.z, 0.12, 0.1, 0.5); lamp(g.x, 5.2, g.z, 7); }
    }
  }
  /** Lamp and window glow for the time of day and the city's state: dim lamps on the dead junction at dusk, full at night, gone in the blackout. */
  ambientLight(night: number) {
    const city = this.city === 'blackout' ? 0 : this.city === 'restored' ? 1 : 0.6, k = city * (0.15 + 0.85 * night);
    for (const m of this.glows) if (m.emissiveTexture) m.emissiveTexture.level = k;
  }
  /** Rainwater in potholes and by the drains: dark, glossy and catching the lamps. */
  private puddles() {
    const r = rng('puddles'), wet = this.mats.get('puddle', { color: '#15181c', specular: 0.9, gloss: 140 });
    const spots: [number, number][] = [[2.5, -4], [-11, 3.5], [21, -2], [-3, 18], [4.5, -27], [-6.6, -14], [6.6, 12], [-18, -4.8], [16, 4.9], [-30, 4.6], [30, -4.6], [0.8, 30], [-1.2, -33]];
    for (let i = 0; i < 8; i++) spots.push([(r() - 0.5) * 12, (r() - 0.5) * 70]);
    for (const [x, z] of spots) { const n = 2 + Math.floor(r() * 3); for (let i = 0; i < n; i++) this.batches.cylinder(wet, x + (r() - 0.5) * 1.2, 0.03, z + (r() - 0.5) * 1.6, 0.7 + r() * 1.3, 0.006, { tessellation: 14 }); }
  }
  /** Litter where people wait and walk: pure-water sachets, bottles, cans, paper and black nylon bags along the kerbs. */
  private litter() {
    const r = rng('litter'), B = this.batches;
    for (let i = 0; i < 170; i++) {
      const ns = r() < 0.55, along = (r() - 0.5) * 74, edge = (r() < 0.5 ? -1 : 1) * (ns ? 8.1 + r() * 2.6 : 6.1 + r() * 2.4);
      const x = ns ? edge : along, z = ns ? along : edge, kind = r(), ry = r() * 6.3;
      if (Math.abs(x) < 7 && Math.abs(z) < 5) continue;
      if (kind < 0.35) B.box(this.m('plasticWhite'), x, 0.035, z, 0.12, 0.012, 0.17, { ry });
      else if (kind < 0.5) B.box(this.m('paintWhite'), x, 0.033, z, 0.2, 0.004, 0.14, { ry, rx: (r() - 0.5) * 0.3 });
      else if (kind < 0.62) B.cylinder(this.m(r() < 0.5 ? 'plastic' : 'metal'), x, 0.05, z, 0.065, 0.12, { rz: Math.PI / 2, ry, tessellation: 8 });
      else if (kind < 0.74) B.cylinder(this.m('glassCool'), x, 0.06, z, 0.07, 0.24, { rz: Math.PI / 2, ry, tessellation: 8 });
      else if (kind < 0.86) B.sphere(this.m('black'), x, 0.08, z, 0.28 + r() * 0.2, { sy: 0.6, segments: 5 });
      else B.box(this.m('plasticWhite'), x, 0.05, z, 0.2, 0.07, 0.14, { ry });
    }
  }
  /** Goods in an open shop bay: stocked shelves inside, snacks hanging in the doorway, crates or chairs on the step. */
  private goods(b: Box, face: Face, along: number, bay: number, base: number, lit: boolean, r: () => number) {
    const B = this.batches, f = FACE[face], across = Math.abs(f.z) > 0, w = bay - 1.2, stock = ['plastic', 'plasticBlue', 'plasticWhite', 'tomato', 'plantain', 'awningGreen', 'awningYellow'];
    const at = (t: number, y: number, out: number) => this.onFace(b, face, along + t, base + y, out);
    for (const y of [0.55, 1.15, 1.75]) {
      const s = at(0, y, 0.08); B.box(this.m('wood'), s.x, s.y, s.z, across ? w : 0.14, 0.04, across ? 0.14 : w);
      for (let t = -w / 2 + 0.15; t < w / 2 - 0.1; t += 0.18 + r() * 0.12) { const h = 0.12 + r() * 0.22, g = at(t, y + 0.02 + h / 2, 0.1); B.box(this.m(stock[Math.floor(r() * stock.length)]), g.x, g.y, g.z, across ? 0.14 : 0.1, h, across ? 0.1 : 0.14); }
    }
    for (let i = 0; i < 4; i++) { const s = at(-w / 2 + 0.2 + i * 0.22, 2.05, 0.14); B.plane(this.m(stock[(i * 3) % stock.length]), s.x, s.y, s.z, 0.12, 0.55, { ry: f.yaw }); }
    if (lit) { const tube = at(0, 2.3, 0.06); B.box(this.m('fluoro'), tube.x, tube.y, tube.z, across ? 1.2 : 0.05, 0.05, across ? 0.05 : 1.2); const spill = this.onFace(b, face, along, 0.046, 1.6); B.plane(this.glowMat('lamp-pool', () => {}), spill.x, spill.y, spill.z, across ? bay + 1 : 3.2, across ? 3.2 : bay + 1, { rx: Math.PI / 2 }); }
    const roll = r();
    if (roll < 0.35) for (const t of [-0.45, 0.2]) { const c = at(t * w, 0.25, 0.32); B.box(this.m('wood'), c.x, c.y, c.z, 0.5, 0.5, 0.5, { ry: r() * 0.3 }); if (r() < 0.6) B.box(this.m('wood'), c.x, c.y + 0.5, c.z, 0.45, 0.45, 0.45, { ry: r() * 0.4 }); }
    else if (roll < 0.6) { const c = at(w / 2 - 0.4, 0.45, 0.4); B.box(this.m('plastic'), c.x, c.y, c.z, 0.42, 0.05, 0.42); const back = this.onFace(b, face, along + w / 2 - 0.4, base + 0.72, 0.22); B.box(this.m('plastic'), back.x, back.y, back.z, across ? 0.42 : 0.04, 0.5, across ? 0.04 : 0.42); for (const [dx, dz] of [[-0.18, -0.18], [0.18, -0.18], [-0.18, 0.18], [0.18, 0.18]]) B.box(this.m('plastic'), c.x + dx, 0.22, c.z + dz, 0.03, 0.44, 0.03); }
  }
  /** Painted signs of the small businesses that work out of every frontage. */
  private trades(b: Box, face: Face, W: number, base: number, r: () => number) {
    const names = ['POS HERE', 'RECHARGE CARD', 'PHONE REPAIRS', 'BARBING SALON', 'TAILOR', 'CHEMIST', 'BUY AM SO', 'GSM ACCESSORIES', 'PRINTING & LAMINATION', 'FAIRLY USED', 'SHOE MENDER', 'HAIR & NAILS'];
    const count = Math.min(3, Math.floor(W / 5));
    for (let i = 0; i < count; i++) {
      if (r() < 0.35) continue;
      const p = this.onFace(b, face, -W / 2 + (i + 0.5) * W / count + (r() - 0.5), base + 2.75, 0.07), palette = [['#f4efe0', '#a3221a'], ['#1f4f8f', '#f4efe0'], ['#f0c419', '#1b1d1c'], ['#ffffff', '#1d5a3a']][Math.floor(r() * 4)];
      this.sign(names[Math.floor(r() * names.length)], p.x, p.y, p.z, 1.6, 0.42, face, { bg: palette[0], fg: palette[1], style: 'painted' });
    }
  }
  /** Vertical dirt streak: black fading to nothing downward, laid over plaster under sills. */
  private grime() {
    let mat = this.mats.all().find(m => m.name === 'grime'); if (mat) return mat;
    mat = this.mats.get('grime', { color: '#000000', unlit: true });
    const t = new DynamicTexture('grime-tex', { width: 32, height: 64 }, this.scene, true), ctx = t.getContext() as unknown as CanvasRenderingContext2D;
    for (let x = 0; x < 32; x++) { const a = 0.18 + Math.sin(x * 1.7) * 0.06 + Math.sin(x * 0.45) * 0.05, len = 34 + Math.sin(x * 0.9) * 18; const g = ctx.createLinearGradient(0, 0, 0, len); g.addColorStop(0, `rgba(0,0,0,${a.toFixed(3)})`); g.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = g; ctx.fillRect(x, 0, 1, len); }
    t.hasAlpha = true; t.update(); mat.opacityTexture = t; mat.zOffset = -1; mat.disableDepthWrite = true; return mat;
  }
  /**
   * The shelter after the blast: cracked and water-stained walls, plaster down on the floor with the dust, a ceiling
   * panel hanging by its cable, overturned furniture, and the few supplies the rescue teams left. Only the hall
   * (the shell with a ceiling) is dressed; nothing here has collision.
   */
  private damage() {
    const hall = this.boxes.find(b => b.id.endsWith('-ceiling')); if (!hall) return;
    const B = this.batches, r = rng('damage'), x0 = hall.x - hall.w / 2 + 0.3, x1 = hall.x + hall.w / 2 - 0.3, z0 = hall.z - hall.d / 2 + 0.3, z1 = hall.z + hall.d / 2 - 0.3, top = hall.y - hall.h / 2;
    const cool = this.glowMat('tube-pool', ctx => { const g = ctx.createRadialGradient(64, 64, 2, 64, 64, 64); g.addColorStop(0, 'rgba(200,225,255,0.4)'); g.addColorStop(0.5, 'rgba(170,200,240,0.14)'); g.addColorStop(1, 'rgba(150,180,230,0)'); ctx.fillStyle = g; ctx.fillRect(0, 0, 128, 128); });
    B.plane(cool, hall.x - 2, 0.02, hall.z, 6, 5, { rx: Math.PI / 2 });
    const dust = this.mats.all().find(m => m.name === 'dust') ?? (() => {
      const m = this.mats.get('dust', { color: '#d6ccb8' }), t = new DynamicTexture('dust-tex', { width: 64, height: 64 }, this.scene, true), ctx = t.getContext() as unknown as CanvasRenderingContext2D;
      const g = ctx.createRadialGradient(32, 32, 2, 32, 32, 32); g.addColorStop(0, 'rgba(255,255,255,0.5)'); g.addColorStop(1, 'rgba(255,255,255,0)'); ctx.fillStyle = g; ctx.fillRect(0, 0, 64, 64); t.hasAlpha = true; t.update(); m.opacityTexture = t; m.zOffset = -2; m.disableDepthWrite = true; return m;
    })();
    // Walls: each entry is a point on an inner face and the way that face looks.
    const walls: { x: number; z: number; ry: number; along: 'x' | 'z'; from: number; to: number }[] = [
      { x: 0, z: z0 + 0.02, ry: 0, along: 'x', from: x0 + 0.5, to: x1 - 0.5 }, { x: x0 + 0.02, z: 0, ry: Math.PI / 2, along: 'z', from: z0 + 0.5, to: z1 - 0.5 },
      { x: x1 - 0.02, z: 0, ry: -Math.PI / 2, along: 'z', from: z0 + 0.5, to: -1.2 }, { x: 0, z: z1 - 0.02, ry: Math.PI, along: 'x', from: x0 + 0.5, to: -2 }
    ];
    const on = (w: typeof walls[number], t: number, y: number) => ({ x: w.along === 'x' ? t : w.x, y, z: w.along === 'z' ? t : w.z });
    for (const w of walls) {
      for (let i = 0; i < 3; i++) { const p = on(w, w.from + r() * (w.to - w.from), top - 0.7); B.plane(this.grime(), p.x, p.y, p.z, 0.6 + r() * 0.9, 1.4, { ry: w.ry }); }
      // A crack: a jagged line climbing from the floor or running down from the ceiling.
      let t = w.from + r() * (w.to - w.from), y = r() < 0.5 ? 0.2 : top - 0.1; const dir = y < 1 ? 1 : -1;
      for (let i = 0; i < 6; i++) { const a = on(w, t, y), nt = t + (r() - 0.5) * 0.5, ny = y + dir * (0.25 + r() * 0.3), b = on(w, nt, ny); B.rod(this.m('black'), new Vector3(a.x, a.y, a.z), new Vector3(b.x, b.y, b.z), 0.014); t = nt; y = ny; }
      // Plaster that has come away in a sheet, the brick showing behind it.
      if (r() < 0.7) { const p = on(w, w.from + r() * (w.to - w.from), 1 + r() * 1.4), sw = 0.5 + r() * 0.6, sh = 0.4 + r() * 0.5; B.box(this.m('brick'), p.x, p.y, p.z, w.along === 'x' ? sw : 0.02, sh, w.along === 'z' ? sw : 0.02); B.box(this.plaster('#b9b29e'), p.x, p.y + sh / 2 + 0.03, p.z, w.along === 'x' ? sw + 0.16 : 0.03, 0.06, w.along === 'z' ? sw + 0.16 : 0.03); }
    }
    // A ceiling panel down at one end, still hanging from its cable at the other.
    const px = hall.x + 2.6, pz = hall.z + 1.4; B.box(this.mats.get('ceiling-under', { color: '#ece6d8', surface: 'stucco', tile: 2 }), px, top * 0.5, pz, 1.2, 0.03, 0.6, { rz: 1.05, caster: true });
    B.cable(this.m('black'), new Vector3(px + 0.4, top - 0.02, pz), new Vector3(px + 0.1, top * 0.5 + 0.4, pz + 0.2), 0.15, 4); B.box(this.m('concreteDark'), px, top - 0.01, pz, 1.25, 0.02, 0.65);
    // Rubble, dust, broken floor tiles and paper across the floor.
    for (let i = 0; i < 70; i++) { const x = x0 + r() * (x1 - x0), z = z0 + r() * (z1 - z0), s = 0.04 + r() * 0.14; B.box(this.m(r() < 0.6 ? 'concrete' : 'concreteDark'), x, s / 2, z, s * (1 + r()), s, s * (1 + r()), { ry: r() * 6, rx: (r() - 0.5) * 0.6 }); }
    for (let i = 0; i < 14; i++) B.plane(dust, x0 + r() * (x1 - x0), 0.016, z0 + r() * (z1 - z0), 1 + r() * 2, 1 + r() * 2, { rx: Math.PI / 2 });
    for (let i = 0; i < 10; i++) B.box(this.m('tile'), x0 + r() * (x1 - x0), 0.03, z0 + r() * (z1 - z0), 0.3, 0.012, 0.3, { ry: r() * 6, rx: (r() - 0.5) * 0.4, rz: (r() - 0.5) * 0.4 });
    for (let i = 0; i < 16; i++) B.box(this.m('paintWhite'), x0 + r() * (x1 - x0), 0.02, z0 + r() * (z1 - z0), 0.21, 0.003, 0.3, { ry: r() * 6 });
    // An overturned plastic chair, blankets on the cots, a first-aid kit, water and a bucket.
    const chair = { x: hall.x + 0.6, z: hall.z - 1.8 }; B.box(this.m('plasticBlue'), chair.x, 0.22, chair.z, 0.42, 0.42, 0.05, { rx: 0.2 }); B.box(this.m('plasticBlue'), chair.x, 0.03, chair.z + 0.25, 0.42, 0.05, 0.45); for (const dx of [-0.18, 0.18]) B.box(this.m('plasticBlue'), chair.x + dx, 0.2, chair.z + 0.47, 0.03, 0.03, 0.44, { rx: 0.9 });
    for (const cot of this.boxes.filter(b => b.id.includes('-cot'))) B.box(this.mats.get('blanket', { color: '#5a4a6a', surface: 'fabric', tile: 0.6 }), cot.x + 0.2, cot.y + cot.h / 2 + 0.04, cot.z, cot.w * 0.6, 0.06, cot.d * 0.95, { rz: 0.04 });
    const table = this.boxes.find(b => b.id.endsWith('-table'));
    if (table) {
      const ty = table.y + table.h / 2; B.box(this.m('white'), table.x - 0.5, ty + 0.09, table.z, 0.38, 0.18, 0.26); B.box(this.m('plastic'), table.x - 0.5, ty + 0.12, table.z - 0.131, 0.16, 0.05, 0.005); B.box(this.m('plastic'), table.x - 0.5, ty + 0.12, table.z - 0.131, 0.05, 0.14, 0.005);
      for (let i = 0; i < 5; i++) B.cylinder(this.m('glassCool'), table.x + 0.1 + i * 0.14, ty + 0.13, table.z + (r() - 0.5) * 0.3, 0.07, 0.26, { tessellation: 8 });
    }
    B.cylinder(this.m('plastic'), hall.x - 3.2, 0.14, hall.z + 1.2, 0.3, 0.32, { rz: Math.PI / 2, ry: 0.6, top: 0.24 });
    // Notices pinned up by the rescue teams.
    const notice = walls[1], n = on(notice, 0.8, 1.6); B.box(this.m('wood'), n.x + 0.01, n.y, n.z, 0.02, 0.9, 1.4);
    this.sign('EMERGENCY SHELTER', n.x + 0.03, n.y + 0.25, n.z - 0.3, 0.6, 0.3, 'e', { bg: '#f4efe0', fg: '#b3261e', style: 'poster' });
    this.sign('MISSING PERSONS', n.x + 0.03, n.y - 0.15, n.z + 0.3, 0.55, 0.4, 'e', { bg: '#ffffff', fg: '#1a1a1a', style: 'poster' });
    this.sign('FIRST AID →', n.x + 0.03, n.y - 0.2, n.z - 0.32, 0.5, 0.22, 'e', { bg: '#1d5a3a', fg: '#ffffff', style: 'board' });
  }
  /** STATIC's mark, a flat line with one spike, sprayed where they have been. It is on the walls from the first frame, so Chapter 1 inherits it. */
  private marks() {
    const mark = (x: number, y: number, z: number, face: Face, w = 1.5) => this.sign('', x, y, z, w, w * 0.4, face, { style: 'spray', w: 384, h: 154 });
    mark(-2.38, 2.1, 8, 'e'); mark(2.38, 1.9, -8, 'w'); mark(22, 1.6, 27.78, 's', 1.2); mark(-27.4, 1.3, 9.98, 's'); mark(-10.98, 1.7, 15, 'e'); mark(13, 1.5, 31.98, 's', 1.7);
    // One half painted out by a shopkeeper, the shape still showing through.
    this.batches.box(this.plaster('#b9b2a0'), 13.5, 1.5, 31.99, 0.8, 0.8, 0.02);
  }
  /** Danfo Park before the jam: what the passengers walk past. Readable from the street, with no prompts. */
  private parkDressing() {
    const B = this.batches, board = (text: string, sub: string, x: number, y: number, z: number, face: Face, w: number, h: number, bg: string, fg: string) => this.sign(text, x, y, z, w, h, face, { sub, bg, fg, style: 'board' });
    board('POS • TRANSFER • RECHARGE', 'NETWORK DEY TODAY', 4.5, 0.72, 23.92, 'n', 2.8, 0.6, '#f4efe0', '#a3221a');
    B.box(this.m('wood'), 4.5, 0.74, 24.28, 1.5, 0.05, 0.56); for (const x of [3.85, 5.15]) B.box(this.m('wood'), x, 0.36, 24.28, 0.06, 0.72, 0.5);
    B.box(this.m('black'), 4.3, 0.8, 24.28, 0.12, 0.06, 0.2); B.box(this.m('plasticBlue'), 4.8, 0.82, 24.3, 0.5, 0.1, 0.3);
    B.box(this.m('wood'), 10.8, 0.22, 26.6, 0.42, 0.44, 0.42);
    this.sign('SIGNAL 9', 9.5, 2.4, 31.98, 3.6, 2, 's', { sub: 'THE NETWORK THAT NEVER SLEEPS', bg: '#0f3b66', fg: '#ffd23f', style: 'poster', accent: '#ffd23f', w: 720, h: 400 });
    this.sign('PLANNED MAINTENANCE', 9.5, 1.9, 31.96, 2.2, 0.36, 's', { sub: 'SERVICE MAY BE AFFECTED', bg: '#f4efe0', fg: '#1a1a1a', style: 'plate' });
  }
  /** A frozen crowd for the ordinary evening: dozens of people for one draw call, so the animated cast can stay small. */
  private people() {
    const r = rng('crowd'), parts: Part[] = [], skin = ['#4a2c1d', '#5c3622', '#6b4129', '#3d2418'], cloth = ['#b98a3e', '#4f7a5a', '#8c4a3a', '#3f5f8a', '#7a6a4a', '#6a5a7a', '#a33a4a', '#4a6a7a'], legs = ['#3c3a33', '#2d3a4f', '#4a4237'];
    // Along the edges of the park and the street, never in the aisle the player walks: these hold the distance, not a close look.
    const spots: [number, number][] = [[6.8, 30.7], [7.8, 31], [8.8, 30.6], [3, 30.9], [-8, 30.8], [-9.2, 31], [-5.4, 24.5], [-6.6, 24.8], [-7.8, 24.5], [-9, 24.9], [-10.2, 24.6], [-7.2, -20.4], [-6.4, -21], [-7.4, -21.7], [-6.7, -22.4], [10.6, 7.4], [11.8, 7.2], [-13, 7.3], [-14.4, 7.2], [17, -7], [18.2, -7.2]];
    for (const [x, z] of spots) { const yaw = r() * 6.28, top = cloth[Math.floor(r() * cloth.length)], h = 0.94 + r() * 0.1; parts.push({ shape: { capsule: [0.085, 0.8 * h] }, at: [x - 0.1, 0.42 * h, z], color: legs[Math.floor(r() * 3)] }, { shape: { capsule: [0.085, 0.8 * h] }, at: [x + 0.1, 0.42 * h, z], color: legs[Math.floor(r() * 3)] }, { shape: { capsule: [0.19, 0.72 * h] }, at: [x, 1.2 * h, z], color: top, tess: 8, rot: [0, yaw, 0] }, { shape: { sphere: [0.22, 0.26, 0.24] }, at: [x, 1.7 * h, z], color: skin[Math.floor(r() * 4)] }, { shape: { sphere: [0.23, 0.14, 0.25] }, at: [x, 1.78 * h, z], color: '#120d0a' }); }
    this.crowd = assemble(this.scene, 'crowd', parts, this.mats.get('crowd', { color: '#ffffff' })); this.crowd.setEnabled(false);
  }
  /** Soft dark footprint under vehicles and props so they sit on the ground. */
  private contact(x: number, z: number, w: number, d: number, y = 0.02) {
    let mat = this.mats.all().find(m => m.name === 'contact-shadow');
    if (!mat) {
      mat = this.mats.get('contact-shadow', { color: '#000000', unlit: true });
      const t = new DynamicTexture('contact-tex', { width: 64, height: 64 }, this.scene, true), ctx = t.getContext() as unknown as CanvasRenderingContext2D;
      const g = ctx.createRadialGradient(32, 32, 4, 32, 32, 32); g.addColorStop(0, 'rgba(0,0,0,0.55)'); g.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = g; ctx.fillRect(0, 0, 64, 64); t.hasAlpha = true; t.update();
      mat.opacityTexture = t; mat.zOffset = -2; mat.disableDepthWrite = true;
    }
    this.batches.plane(mat, x, y, z, w, d, { rx: Math.PI / 2, uv: [0, 0, 1, 1] });
  }
  /** Inexpensive ambient animation: fans, swaying crowns, beacons, a failing tube and distant traffic. */
  update(time: number, dt: number) {
    for (const a of this.animated) { if (a.spin) a.node.rotation.y += a.spin * dt; if (a.sway) { a.node.rotation.z = Math.sin(time * 0.7 + a.phase) * a.sway; a.node.rotation.x = Math.cos(time * 0.5 + a.phase) * a.sway * 0.6; } }
    for (const b of this.beacons) b.mesh.visibility = Math.sin(time * 6 + b.phase) > 0.2 ? 1 : 0.15;
    for (const [i, m] of this.flicker.entries()) { const off = i === 0 && Math.sin(time * 13) * Math.sin(time * 2.3) > 0.82; m.emissiveColor.set(off ? 0.2 : 0.86, off ? 0.22 : 0.93, off ? 0.25 : 1); }
    for (const car of this.traffic) { car.t = (car.t + car.speed * dt) % 1; Vector3.LerpToRef(car.from, car.to, car.t, car.node.position); car.node.rotation.y = Math.atan2(car.to.x - car.from.x, car.to.z - car.from.z); }
  }
  /** The network itself: the relay's lights, and Signal 9's own billboards going to NO SIGNAL while it is down. */
  setRelay(clear: boolean) { for (const l of this.handles.relayLights) { l.jammed.setEnabled(!clear); l.clear.setEnabled(clear); } for (const m of this.noSignal) m.setEnabled(!clear); }
  /** The ordinary evening before the jam: the people on the street. */
  setCrowd(on: boolean) { this.crowd?.setEnabled(on); }
  /** Development: what the street is showing, for checks. */
  get shown() { return { city: this.city, crowd: !!this.crowd?.isEnabled() }; }
}
function shade(hex: string, factor: number) { const c = Color3.FromHexString(hex).scale(factor); return c.toHexString(); }
