import { Color3 } from '@babylonjs/core/Maths/math.color';
import { DynamicTexture } from '@babylonjs/core/Materials/Textures/dynamicTexture';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import type { Scene } from '@babylonjs/core/scene';
import type { Material } from '@babylonjs/core/Materials/material';
import type { WeaponId } from '@lastbus/shared';
import { assemble, blend, tint, weaponParts, type Part } from './models.js';
import { surface } from './textures.js';
/** 0 = Police, 1 = Bandits, 2 = civilian (story NPCs, never combatants). */
export type Faction = 0 | 1 | 2;
export interface Pose {
  x: number; y: number; z: number; yaw: number; pitch: number; vx: number; vz: number; grounded: boolean; crouched: boolean; aiming: boolean;
  weapon: WeaponId; health: number; reloading: number; equipping: number; seated?: boolean;
  /** Traversal kind (physics MOVE) and progress 0..1, for vault, mantle, ladder and slide poses. */
  traverse?: number; traverseP?: number;
  /** Cutscene staging: weapon held low, lying on the floor, empty hands, and a gesture blended in by gestureT. */
  relaxed?: boolean; lying?: boolean; unarmed?: boolean; gesture?: Gesture | ''; gestureT?: number;
  /** Cutscene speech: the mouth moves while this is set. */
  talk?: boolean;
  /** Cutscene staging: Ada's case file tucked under her right arm. */
  folder?: boolean; bag?: boolean;
  /** Femi before the attack, with no plaster on his temple. */
  clean?: boolean;
}
export type Gesture = 'point' | 'radio' | 'brace' | 'phone' | 'shrug' | 'wave' | 'look-up' | 'reach' | 'hold';
/** Named looks: 'ada' is Inspector Nwosu herself (bareheaded, hair tied back, sidearm on the belt). */
export type Variant = 'default' | 'ada' | 'femi' | 'sergeant' | 'trader';
function hash(text: string) { let h = 2166136261; for (const c of text) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return () => { h ^= h << 13; h ^= h >>> 17; h ^= h << 5; return (h >>> 0) / 4294967295; }; }
const SKIN = ['#4a2c1d', '#5c3622', '#6b4129', '#3d2418', '#7a4c31', '#553220'];
const HAIR = ['#120d0a', '#1a1410', '#0d0b0a', '#2a1c14'];
const BANDIT_TOPS = ['#6b2a22', '#5a5f3a', '#3b4a63', '#7a5a2e', '#2f3a35', '#8a3b2b', '#4b3a52', '#2b2b2e', '#5d4a3a'];
const BANDIT_LEGS = ['#2d3a4f', '#3c3a33', '#24282c', '#4a4237', '#1f2a36'];
type HairStyle = 'crop' | 'short' | 'afro' | 'locs' | 'shaved' | 'cornrows';
type Hat = 'peaked' | 'helmet' | 'beanie' | 'cap' | 'cap-back' | 'hood' | 'bandana';
type Outfit = 'police' | 'ada' | 'femi' | 'hoodie' | 'jacket' | 'vest' | 'tee';
/** Everything that makes one person look like themselves, picked once from the actor's seed. */
interface Look {
  outfit: Outfit; skin: string; top: string; under: string; legs: string; sleeves: 'long' | 'rolled' | 'short' | 'bare';
  shoes: 'boots' | 'sneakers'; shoe: string; gloves?: string; hair: HairStyle; hairColor: string; hat?: Hat; hatColor: string;
  beard: boolean; mask: boolean; shades: boolean; scarf: string; female: boolean; pockets: boolean;
}
function lookFor(faction: Faction, variant: Variant, r: () => number): Look {
  const pick = <T>(list: readonly T[]) => list[Math.floor(r() * list.length)];
  const skin = variant === 'ada' ? '#5a3422' : variant === 'femi' ? '#6b4129' : pick(SKIN), hairColor = pick(HAIR);
  const base = { skin, hairColor, under: '#d8d4c4', beard: false, mask: false, shades: false, scarf: '#a3221a', female: false, pockets: false, hatColor: '#0f1730' };
  if (variant === 'ada') return { ...base, outfit: 'ada', top: '#1d2b4a', under: '#7f8ca3', legs: '#16181d', sleeves: 'long', shoes: 'boots', shoe: '#101112', hair: 'cornrows', hairColor: '#0e0a08', female: true, pockets: true };
  if (variant === 'femi') return { ...base, outfit: 'femi', top: '#8fb3d6', under: '#a9c6e2', legs: '#9a8a68', sleeves: 'rolled', shoes: 'sneakers', shoe: '#5a5f66', hair: 'short', hairColor: '#120d0a' };
  // Plain clothes, a dark jacket over a police-blue shirt: an officer, or someone dressed like one.
  if (variant === 'sergeant') return { ...base, outfit: 'jacket', top: '#2b2f36', under: '#3f5a86', legs: '#1f2126', sleeves: 'long', shoes: 'boots', shoe: '#141414', hair: 'crop', beard: true, scarf: '' };
  if (variant === 'trader') return { ...base, outfit: 'tee', top: '#a33a4a', under: '#e0b84a', legs: '#7a4a2a', sleeves: 'short', shoes: 'sneakers', shoe: '#5a4a38', hair: 'crop', hat: 'bandana', hatColor: '#e0b84a', female: true, scarf: '' };
  // Ordinary Lagos: drivers, traders and passengers, with none of the crew's red.
  if (faction === 2) { const outfit = pick(['tee', 'jacket'] as const); return { ...base, outfit, top: pick(['#b98a3e', '#4f7a5a', '#8c4a3a', '#3f5f8a', '#c9c2ae', '#6a5a7a']), under: pick(['#d8d4c4', '#c9b48a']), legs: pick(['#3c3a33', '#4a4237', '#2d3a4f', '#5a4a38']), sleeves: outfit === 'tee' ? 'short' : 'long', shoes: 'sneakers', shoe: pick(['#5a4a38', '#2a2a2a', '#7a4a2a']), hair: pick(['crop', 'short', 'shaved'] as const), hat: r() < 0.3 ? 'cap' : undefined, hatColor: pick(['#3f5f8a', '#7a6a4a', '#2a2a2a']), beard: r() < 0.4, scarf: '' }; }
  if (faction === 0) { const helmet = r() < 0.5; return { ...base, outfit: 'police', top: pick(['#1f2d4d', '#22314f', '#1b2944']), legs: '#1a1c20', sleeves: 'long', shoes: 'boots', shoe: '#111213', gloves: '#151515', hair: helmet ? 'shaved' : 'crop', hat: helmet ? 'helmet' : 'peaked', hatColor: helmet ? '#1d2320' : '#0f1730', beard: r() < 0.25, pockets: true }; }
  // STATIC: a crew, not a uniform. Every one wears the red scarf, so they still read as one side at a glance.
  const outfit = pick(['hoodie', 'jacket', 'vest', 'tee'] as const);
  return { ...base, outfit, top: pick(BANDIT_TOPS), under: pick(['#d8d4c4', '#3a3a3a', '#c9b48a', '#8a2b22']), legs: pick(BANDIT_LEGS), sleeves: outfit === 'vest' ? 'bare' : outfit === 'tee' ? 'short' : 'long',
    shoes: r() < 0.6 ? 'sneakers' : 'boots', shoe: pick(['#e9e6dc', '#2a2a2a', '#7a4a2a', '#b22d22', '#3b4a63']), gloves: r() < 0.3 ? '#1c1c1c' : undefined, hair: pick(['crop', 'afro', 'locs', 'shaved', 'short'] as const),
    hat: r() < 0.55 ? pick(['beanie', 'cap', 'cap-back', 'hood', 'bandana'] as const) : undefined, hatColor: pick(['#1d1d1d', '#5a2a22', '#3b4a2e', '#7a6a4a', '#a3221a']), beard: r() < 0.45, mask: r() < 0.4, shades: r() < 0.25, scarf: pick(['#a3221a', '#b8261c', '#8e1d16']), pockets: r() < 0.6 };
}
/**
 * Head space: centre 0.06 up, face toward +z. Jaw and chin, ears, nose, eye whites with dark irises, brows and
 * two lips, sized so the hairline sits above the brows and the face stays readable in a close-up.
 */
function face(l: Look): Part[] {
  const lip = blend(l.skin, l.female ? '#5a2024' : '#3a1410', 0.25), shade = tint(l.skin, 0.86), brow = tint(l.hairColor, 1.1);
  const parts: Part[] = [
    { shape: { sphere: [0.2, 0.245, 0.225] }, at: [0, 0.06, 0.005], color: l.skin, tess: 10 },
    { shape: { sphere: [0.165, 0.11, 0.165] }, at: [0, -0.02, 0.028], color: l.skin, tess: 8 },
    { shape: { sphere: [0.042, 0.062, 0.05] }, at: [0, 0.047, 0.116], color: shade },
    { shape: { sphere: [0.06, 0.028, 0.038] }, at: [0, 0.022, 0.11], color: shade },
    { shape: { sphere: [0.052, l.female ? 0.018 : 0.014, 0.012] }, at: [0, -0.007, 0.099], color: lip },
    { shape: { sphere: [0.046, 0.013, 0.012] }, at: [0, -0.019, 0.097], color: tint(lip, 0.9) }
  ];
  for (const s of [-1, 1]) parts.push(
    { shape: { sphere: [0.03, 0.062, 0.046] }, at: [s * 0.103, 0.055, -0.005], color: shade },
    { shape: { sphere: [0.046, 0.026, 0.014] }, at: [s * 0.042, 0.085, 0.099], color: '#e9e3d6' },
    { shape: { sphere: [0.021, 0.021, 0.01] }, at: [s * 0.042, 0.085, 0.106], color: '#24150c' },
    { shape: { box: [0.052, l.female ? 0.009 : 0.014, 0.016] }, at: [s * 0.045, 0.114, 0.1], rot: [0, 0, s * 0.12], color: brow });
  if (l.female) for (const s of [-1, 1]) parts.push({ shape: { sphere: [0.016, 0.016, 0.016] }, at: [s * 0.106, 0.018, 0.004], color: '#d4ae4a' });
  if (l.beard) parts.push({ shape: { sphere: [0.17, 0.085, 0.15] }, at: [0, -0.04, 0.04], color: l.hairColor }, { shape: { box: [0.062, 0.013, 0.014] }, at: [0, 0.006, 0.111], color: l.hairColor });
  if (l.mask) parts.push({ shape: { sphere: [0.218, 0.125, 0.262] }, at: [0, -0.012, 0.012], color: l.scarf }, { shape: { box: [0.17, 0.012, 0.01] }, at: [0, 0.008, 0.13], color: '#2a0d0a' });
  if (l.shades) parts.push({ shape: { box: [0.17, 0.036, 0.02] }, at: [0, 0.087, 0.114], color: '#0c0c0e' }, ...[-1, 1].map(s => ({ shape: { box: [0.008, 0.012, 0.11] }, at: [s * 0.098, 0.092, 0.06], color: '#0c0c0e' }) as Part));
  if (l.outfit === 'femi') {
    // Femi: thin wire glasses.
    for (const s of [-1, 1]) parts.push({ shape: { box: [0.052, 0.005, 0.005] }, at: [s * 0.043, 0.103, 0.118], color: '#2a2622' }, { shape: { box: [0.052, 0.005, 0.005] }, at: [s * 0.043, 0.068, 0.116], color: '#2a2622' },
      { shape: { box: [0.005, 0.036, 0.005] }, at: [s * 0.068, 0.086, 0.114], color: '#2a2622' }, { shape: { box: [0.005, 0.005, 0.11] }, at: [s * 0.098, 0.096, 0.058], color: '#2a2622' });
    parts.push({ shape: { box: [0.02, 0.005, 0.005] }, at: [0, 0.092, 0.122], color: '#2a2622' });
  }
  return parts;
}
/** Hair and headwear in head space. Caps start above the brows (y 0.1) and fall lower at the back. */
function hairParts(l: Look): Part[] {
  const c = l.hairColor, p: Part[] = [];
  const cap = (h: number, y: number, color = c, w = 0.212) => p.push({ shape: { sphere: [w, h, w + 0.024] }, at: [0, y, -0.004], color, tess: 8 }, { shape: { sphere: [w - 0.008, 0.15, 0.15] }, at: [0, 0.095, -0.055], color, tess: 8 });
  if (!l.hat || l.hat === 'cap' || l.hat === 'cap-back' || l.hat === 'bandana') {
    if (l.hair === 'crop') cap(0.12, 0.16);
    if (l.hair === 'short') cap(0.135, 0.165, c, 0.216);
    if (l.hair === 'shaved') cap(0.11, 0.163, blend(l.skin, c, 0.55), 0.206);
    if (l.hair === 'afro') p.push({ shape: { sphere: [0.27, 0.21, 0.275] }, at: [0, 0.19, -0.02], color: c, tess: 8 });
    if (l.hair === 'locs') { cap(0.12, 0.16); for (let i = 0; i < 9; i++) { const a = 1.25 + i * 0.47, x = Math.sin(a), z = Math.cos(a); p.push({ shape: { limb: [0.017, [x * 0.095, 0.15, z * 0.1 - 0.01], [x * 0.125, -0.03 - (i % 3) * 0.03, z * 0.125 - 0.02]] }, at: [0, 0, 0], color: tint(c, 1 + (i % 2) * 0.25), tess: 6 }); } }
    if (l.hair === 'cornrows') {
      // Ada: cornrows running back into a bun, with a dark red tie.
      cap(0.115, 0.16);
      for (const x of [-0.064, -0.032, 0, 0.032, 0.064]) p.push({ shape: { limb: [0.0115, [x, 0.195, 0.07], [x * 0.95, 0.21, -0.03]] }, at: [0, 0, 0], color: '#1d1511', tess: 6 }, { shape: { limb: [0.0115, [x * 0.95, 0.21, -0.03], [x * 0.45, 0.15, -0.13]] }, at: [0, 0, 0], color: '#1d1511', tess: 6 });
      p.push({ shape: { sphere: [0.12, 0.11, 0.11] }, at: [0, 0.12, -0.16], color: c, tess: 8 }, { shape: { cyl: [0.08, 0.025] }, at: [0, 0.12, -0.115], rot: [Math.PI / 2, 0, 0], color: '#6b1a18' });
    }
  }
  const h = l.hatColor;
  switch (l.hat) {
    case 'peaked': p.push({ shape: { cyl: [0.235, 0.085, 0.222] }, at: [0, 0.19, 0], color: h, tess: 14 }, { shape: { cyl: [0.25, 0.02, 0.25] }, at: [0, 0.24, 0.01], color: h, tess: 14 }, { shape: { cyl: [0.226, 0.022] }, at: [0, 0.155, 0], color: '#0a0a0a', tess: 14 },
      { shape: { box: [0.2, 0.012, 0.1] }, at: [0, 0.148, 0.13], rot: [-0.18, 0, 0], color: '#08090c' }, { shape: { box: [0.05, 0.045, 0.01] }, at: [0, 0.2, 0.118], color: '#c9b04a' }); break;
    case 'helmet': p.push({ shape: { sphere: [0.27, 0.2, 0.29] }, at: [0, 0.17, -0.005], color: h, tess: 10 }, { shape: { box: [0.26, 0.03, 0.05] }, at: [0, 0.1, 0.13], color: tint(h, 0.8) }, { shape: { box: [0.06, 0.04, 0.02] }, at: [0, 0.2, 0.14], color: '#3a3f38' }); break;
    case 'beanie': p.push({ shape: { sphere: [0.23, 0.17, 0.25] }, at: [0, 0.17, -0.005], color: h, tess: 8 }, { shape: { cyl: [0.235, 0.04, 0.235] }, at: [0, 0.125, -0.005], color: tint(h, 0.8), tess: 12 }); break;
    case 'cap': case 'cap-back': { const z = l.hat === 'cap' ? 1 : -1; p.push({ shape: { sphere: [0.225, 0.13, 0.245] }, at: [0, 0.175, 0], color: h, tess: 8 }, { shape: { box: [0.17, 0.012, 0.11] }, at: [0, 0.138, z * 0.15], rot: [z * -0.1, 0, 0], color: tint(h, 0.8) }); break; }
    case 'hood': p.push({ shape: { sphere: [0.245, 0.15, 0.255] }, at: [0, 0.175, -0.02], color: h, tess: 8 }, { shape: { box: [0.24, 0.24, 0.1] }, at: [0, 0.06, -0.095], color: h }, ...[-1, 1].map(s => ({ shape: { box: [0.026, 0.21, 0.17] }, at: [s * 0.117, 0.07, -0.015], color: h }) as Part)); break;
    case 'bandana': p.push({ shape: { sphere: [0.218, 0.11, 0.242] }, at: [0, 0.172, -0.004], color: h, tess: 8 }, { shape: { sphere: [0.06, 0.05, 0.05] }, at: [0, 0.13, -0.125], color: h }, { shape: { box: [0.04, 0.09, 0.012] }, at: [0.02, 0.07, -0.135], rot: [0.2, 0, 0.2], color: h }); break;
  }
  return p;
}
/** Chest, belly and shoulders as flattened ellipsoids, then the outfit on top of them, in spine space. */
function torsoParts(l: Look, build: number, r: () => number): Part[] {
  const t = l.top, p: Part[] = [
    { shape: { sphere: [0.31 * build, 0.36, 0.22] }, at: [0, 0.15, 0], color: l.outfit === 'jacket' ? l.under : t, tess: 10 },
    { shape: { sphere: [0.38 * build, 0.36, 0.25] }, at: [0, 0.35, 0.005], color: t, tess: 10 },
    { shape: { sphere: [0.46 * build, 0.15, 0.22] }, at: [0, 0.47, 0], color: t, tess: 10 },
    { shape: { cyl: [0.16, 0.13, 0.125] }, at: [0, 0.555, 0], color: l.skin }
  ];
  // A collar ring round the base of the neck rather than loose tabs.
  if (l.outfit !== 'vest' && l.outfit !== 'tee') p.push({ shape: { cyl: [0.19, 0.045, 0.165] }, at: [0, 0.53, 0], color: l.outfit === 'hoodie' || l.outfit === 'jacket' ? tint(l.top, 0.85) : l.under, tess: 12 });
  const vest = (color: string, depth: number) => {
    p.push({ shape: { box: [0.36 * build, 0.32, depth] }, at: [0, 0.31, 0.005], color }, ...[-1, 1].map(s => ({ shape: { box: [0.075, 0.03, depth - 0.02] }, at: [s * 0.11, 0.48, 0], color }) as Part));
    p.push({ shape: { box: [0.04, 0.045, 0.01] }, at: [0.1, 0.4, depth / 2 + 0.006], color: '#c9a640' }, { shape: { box: [0.045, 0.075, 0.03] }, at: [-0.1, 0.38, depth / 2 + 0.014], color: '#101010' }, { shape: { cyl: [0.009, 0.07] }, at: [-0.115, 0.45, depth / 2 + 0.014], color: '#101010' });
    // Reflective lettering panels, kept grey so the key light does not blow them out.
    p.push({ shape: { box: [0.22, 0.06, 0.008] }, at: [0, 0.37, -depth / 2 - 0.004], color: '#a9aca4' }, { shape: { box: [0.15, 0.03, 0.008] }, at: [0, 0.29, depth / 2 + 0.004], color: '#a9aca4' });
    for (const s of [-1, 1]) p.push({ shape: { box: [0.06, 0.016, 0.12] }, at: [s * 0.17, 0.51, 0], color: tint(t, 0.75) });
  };
  switch (l.outfit) {
    case 'police':
      vest('#23271f', 0.27);
      for (const x of [-0.1, 0, 0.1]) p.push({ shape: { box: [0.075, 0.085, 0.04] }, at: [x, 0.2, 0.15], color: '#2e3328' }, { shape: { box: [0.075, 0.02, 0.045] }, at: [x, 0.24, 0.15], color: '#262a22' });
      break;
    case 'ada':
      // Inspector Nwosu: a low-profile carrier over her shirt, the pale collar showing, gold pips on the shoulders.
      vest('#151b28', 0.262);
      for (const s of [-1, 1]) for (const z of [-0.03, 0.03]) p.push({ shape: { sphere: [0.02, 0.012, 0.02] }, at: [s * 0.17, 0.522, z], color: '#d8b54c' });
      p.push({ shape: { box: [0.11, 0.022, 0.008] }, at: [-0.08, 0.33, 0.136], color: '#c9c3b2' });
      break;
    case 'femi':
      p.push({ shape: { box: [0.018, 0.4, 0.01] }, at: [0, 0.3, 0.117], color: tint(t, 0.88) }, { shape: { box: [0.075, 0.075, 0.006] }, at: [-0.09, 0.37, 0.122], color: tint(t, 0.93) }, { shape: { cyl: [0.008, 0.07] }, at: [-0.075, 0.4, 0.126], color: '#1d4f8a' });
      for (const y of [0.17, 0.27, 0.37]) p.push({ shape: { sphere: [0.011, 0.011, 0.006] }, at: [0, y, 0.124], color: '#eceae0' });
      for (const s of [-1, 1]) p.push({ shape: { box: [0.06, 0.04, 0.014] }, at: [s * 0.045, 0.545, 0.075], rot: [-0.45, s * 0.55, 0], color: l.under }, { shape: { limb: [0.006, [s * 0.05, 0.53, 0.06], [0, 0.32, 0.122]] }, at: [0, 0, 0], color: '#1d4f8a', tess: 4 });
      p.push({ shape: { box: [0.05, 0.07, 0.006] }, at: [0, 0.28, 0.124], color: '#f0eee6' }, { shape: { box: [0.05, 0.016, 0.007] }, at: [0, 0.305, 0.125], color: '#1d4f8a' });
      break;
    case 'hoodie':
      p.push({ shape: { sphere: [0.27, 0.12, 0.15] }, at: [0, 0.53, -0.1], color: tint(t, 0.9) }, { shape: { box: [0.2, 0.09, 0.02] }, at: [0, 0.14, 0.108], color: tint(t, 0.85) });
      for (const s of [-1, 1]) p.push({ shape: { box: [0.008, 0.1, 0.008] }, at: [s * 0.03, 0.44, 0.13], color: '#d8d4c8' });
      break;
    case 'jacket':
      p.push({ shape: { box: [0.1, 0.44, 0.02] }, at: [0, 0.28, 0.118], color: l.under });
      for (const s of [-1, 1]) p.push({ shape: { box: [0.035, 0.42, 0.012] }, at: [s * 0.065, 0.28, 0.123], color: tint(t, 0.8) }, { shape: { box: [0.07, 0.06, 0.02] }, at: [s * 0.07, 0.52, 0.08], rot: [-0.4, s * 0.5, 0], color: tint(t, 0.9) }, { shape: { box: [0.06, 0.05, 0.02] }, at: [s * 0.1, 0.12, 0.112], color: tint(t, 0.85) });
      break;
    case 'vest':
      for (let i = 0; i < 9; i++) { const a = -0.9 + i * 0.225; p.push({ shape: { sphere: [0.014, 0.014, 0.014] }, at: [Math.sin(a) * 0.08, 0.5 - Math.cos(a) * 0.1 + 0.08, 0.1 + Math.cos(a) * 0.02], color: '#c9a640' }); }
      break;
    case 'tee': p.push({ shape: { box: [0.14, 0.1, 0.006] }, at: [0, 0.36, 0.126], color: l.under }, { shape: { box: [0.1, 0.02, 0.007] }, at: [0, 0.36, 0.128], color: tint(t, 0.6) }); break;
  }
  if (l.scarf && l.outfit !== 'police' && l.outfit !== 'ada' && l.outfit !== 'femi') {
    // The crew's red scarf: wrapped twice round the neck, knotted, with a frayed black stripe and two tails.
    const sc = l.scarf;
    p.push({ shape: { cyl: [0.24, 0.075, 0.2] }, at: [0, 0.53, 0], color: sc, tess: 12 }, { shape: { cyl: [0.243, 0.012, 0.21] }, at: [0, 0.53, 0], color: '#1a0a08', tess: 12 }, { shape: { sphere: [0.06, 0.055, 0.05] }, at: [0.05, 0.5, 0.1], color: tint(sc, 0.85) },
      { shape: { box: [0.05, 0.16, 0.015] }, at: [0.065, 0.41, 0.118], rot: [0, 0, 0.15], color: sc }, { shape: { box: [0.045, 0.13, 0.015] }, at: [0.025, 0.42, 0.122], rot: [0, 0, -0.12], color: tint(sc, 0.9) });
    if (r() < 0.4) p.push({ shape: { box: [0.08, 0.5, 0.27] }, at: [0.08, 0.28, 0], rot: [0, 0, 0.55], color: '#3a2a1a' });
  }
  return p;
}
/** A hand hanging from the wrist: palm, four slightly curled fingers and a thumb toward the front (+z). */
function hand(side: number, color: string): Part[] {
  const p: Part[] = [{ shape: { box: [0.034, 0.085, 0.075] }, at: [0, -0.31, 0.005], color }];
  for (const z of [-0.026, -0.009, 0.008, 0.025]) p.push({ shape: { limb: [0.0115, [0, -0.345, z], [-side * 0.006, -0.395 + Math.abs(z) * 0.3, z + 0.012]] }, at: [0, 0, 0], color, tess: 6 });
  p.push({ shape: { limb: [0.013, [-side * 0.012, -0.29, 0.035], [-side * 0.02, -0.335, 0.058]] }, at: [0, 0, 0], color, tess: 6 });
  return p;
}
/** Layer bit carried by character meshes; the cutscene key and rim lights only reach meshes with it. */
export const CAST_LAYER = 0x10000000;
let shared: { body: StandardMaterial; metal: StandardMaterial; blob: StandardMaterial } | undefined;
function materials(scene: Scene) {
  if (shared && shared.body.getScene() === scene) return shared;
  const body = new StandardMaterial('character', scene), fabric = surface(scene, 'fabric', 256);
  body.diffuseTexture = fabric.diffuse; body.specularColor = new Color3(0.06, 0.06, 0.06); body.specularPower = 16;
  const metal = new StandardMaterial('character-metal', scene); metal.specularColor = new Color3(0.4, 0.4, 0.4); metal.specularPower = 48;
  const blob = new StandardMaterial('blob', scene); blob.diffuseColor = Color3.Black(); blob.disableLighting = true; blob.zOffset = -3; blob.disableDepthWrite = true;
  const t = new DynamicTexture('blob-tex', { width: 64, height: 64 }, scene, false), ctx = t.getContext() as unknown as CanvasRenderingContext2D, g = ctx.createRadialGradient(32, 32, 2, 32, 32, 32);
  g.addColorStop(0, 'rgba(0,0,0,0.6)'); g.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = g; ctx.fillRect(0, 0, 64, 64); t.hasAlpha = true; t.update(); blob.opacityTexture = t;
  // Scene lights (4) plus the cutscene key and rim.
  body.maxSimultaneousLights = metal.maxSimultaneousLights = 6;
  shared = { body, metal, blob }; return shared;
}
/**
 * A rigged, procedurally animated person. Bones are transform nodes; each bone
 * carries one merged mesh. Animation is driven entirely by the same state the
 * simulation exposes, so the body never disagrees with gameplay.
 */
export class Character {
  readonly root: TransformNode; private hips: TransformNode; private spine: TransformNode; private head: TransformNode;
  private shoulders: [TransformNode, TransformNode]; private elbows: [TransformNode, TransformNode]; private thighs: [TransformNode, TransformNode]; private knees: [TransformNode, TransformNode];
  private weapons = new Map<WeaponId, TransformNode>(); private blob: Mesh; private tag?: Mesh; private tagWanted = true;
  private blade?: TransformNode; private swing = 0;
  private travel = 0; private travelKind = 0; private sit = 0; private lie = 0; private gestureName: Gesture | '' = ''; private gestureBlend = 0; private wave = 0;
  private lids: Mesh; private mouth: Mesh; private folder?: TransformNode; private bag?: TransformNode; private plaster?: Mesh; private blinkIn = 1 + Math.random() * 3; private talkT = 0;
  private phase = 0; private crouch = 0; private kick = 0; private flinch = 0; private flinchSide = 1; private death = 0; private legYaw = 0; private air = 0; private aim = 0;
  constructor(private scene: Scene, readonly faction: Faction, seed: string, name = '', melee = false, readonly variant: Variant = 'default') {
    const m = materials(scene), r = hash(seed), mat: Material = m.body;
    const look = lookFor(faction, variant, r), { skin, top, legs } = look, police = faction === 0;
    const build = look.female ? 0.9 : look.outfit === 'femi' ? 0.94 : 0.95 + r() * 0.1;
    this.root = new TransformNode(`actor-${seed}`, scene);
    this.hips = node('hips', this.root, 0, 0.95, 0);
    // Pelvis with a belt and buckle; officers carry a pouch on the left hip.
    const pelvis: Part[] = [{ shape: { box: [0.34 * build, 0.2, 0.22] }, at: [0, 0, 0], color: legs }, { shape: { box: [0.36 * build, 0.05, 0.24] }, at: [0, 0.09, 0], color: look.outfit === 'femi' ? '#4a2e1a' : police || look.outfit === 'ada' ? '#0e0f10' : tint(legs, 0.6) },
      { shape: { box: [0.05, 0.035, 0.01] }, at: [0, 0.09, 0.122], color: look.outfit === 'femi' ? '#b08d4a' : '#9a9c98' }];
    if (police || look.outfit === 'ada') pelvis.push({ shape: { box: [0.06, 0.08, 0.06] }, at: [-0.17 * build, 0.04, 0.03], color: '#141414' });
    assemble(scene, 'pelvis', pelvis, mat, this.hips);
    this.spine = node('spine', this.hips, 0, 0.08, 0);
    assemble(scene, 'torso', torsoParts(look, build, r), mat, this.spine);
    this.head = node('head', this.spine, 0, 0.66, 0);
    assemble(scene, 'head', [...face(look), ...hairParts(look)], mat, this.head);
    // Eyelids and an open mouth are tiny separate meshes, shown only while blinking or talking, so they cost no draw call most of the time.
    this.lids = assemble(scene, 'lids', [-1, 1].map(s => ({ shape: { sphere: [0.05, 0.03, 0.02] }, at: [s * 0.042, 0.087, 0.103], color: tint(skin, 0.9) }) as Part), mat, this.head); this.lids.setEnabled(false);
    this.mouth = assemble(scene, 'mouth', [{ shape: { box: [0.042, 0.022, 0.008] }, at: [0, 0, 0], color: '#1c0907' }], mat, this.head); this.mouth.position.set(0, -0.013, 0.104); this.mouth.setEnabled(false);
    if (variant === 'femi') this.plaster = assemble(scene, 'plaster', [{ shape: { sphere: [0.036, 0.046, 0.03] }, at: [0.087, 0.078, 0.055], color: '#e6dccb' }], mat, this.head);
    const hands = look.gloves ?? skin;
    const arm = (side: -1 | 1) => {
      const shoulder = node('shoulder', this.spine, side * 0.22 * build, 0.48, 0);
      const upper: Part[] = [{ shape: { capsule: [0.055, 0.3] }, at: [0, -0.14, 0], color: look.sleeves === 'bare' ? skin : look.sleeves === 'short' ? skin : top }];
      if (look.sleeves === 'short') upper.push({ shape: { cyl: [0.13, 0.13, 0.12] }, at: [0, -0.06, 0], color: top });
      if (police) upper.push({ shape: { box: [0.115, 0.08, 0.115] }, at: [0, -0.02, 0], color: '#23271f' });
      // Shoulder flash on uniforms: dark red with a gold border.
      if (police || look.outfit === 'ada') upper.push({ shape: { box: [0.012, 0.05, 0.042] }, at: [side * 0.054, -0.08, 0], color: '#a8893a' }, { shape: { box: [0.014, 0.04, 0.032] }, at: [side * 0.055, -0.08, 0], color: '#5a1614' });
      assemble(scene, 'upper-arm', upper, mat, shoulder);
      const elbow = node('elbow', shoulder, 0, -0.28, 0), sleeved = look.sleeves === 'long';
      const fore: Part[] = [{ shape: { capsule: [0.048, 0.28] }, at: [0, -0.13, 0], color: sleeved ? top : skin }, ...hand(side, hands)];
      if (sleeved) fore.push({ shape: { cyl: [0.105, 0.03] }, at: [0, -0.255, 0], color: tint(top, 0.85) });
      if (look.sleeves === 'rolled') fore.push({ shape: { cyl: [0.118, 0.055] }, at: [0, -0.01, 0], color: look.under });
      assemble(scene, 'fore-arm', fore, mat, elbow);
      return [shoulder, elbow] as const;
    };
    const [sl, el] = arm(-1), [sr, er] = arm(1); this.shoulders = [sl, sr]; this.elbows = [el, er];
    const leg = (side: -1 | 1) => {
      const thigh = node('thigh', this.hips, side * 0.1, -0.04, 0);
      const t: Part[] = [{ shape: { capsule: [0.075, 0.46] }, at: [0, -0.21, 0], color: legs }];
      if ((police || look.outfit === 'ada') && side > 0) t.push({ shape: { box: [0.09, 0.14, 0.1] }, at: [0.06, -0.15, 0], color: '#151515' }, { shape: { box: [0.03, 0.06, 0.03] }, at: [0.08, -0.07, 0.03], color: '#2a2a2a' });
      else if (look.pockets) t.push({ shape: { box: [0.03, 0.11, 0.09] }, at: [side * 0.072, -0.22, 0], color: tint(legs, 0.85) }, { shape: { box: [0.034, 0.02, 0.092] }, at: [side * 0.073, -0.165, 0], color: tint(legs, 0.75) });
      assemble(scene, 'thigh', t, mat, thigh);
      const knee = node('knee', thigh, 0, -0.43, 0), boot = look.shoes === 'boots', shoe = look.shoe;
      const sole = boot ? '#050505' : '#e6e3d8';
      const shin: Part[] = [{ shape: { capsule: [0.062, 0.44] }, at: [0, -0.21, 0], color: legs },
        { shape: { box: [0.11, 0.08, 0.2] }, at: [0, -0.43, 0.02], color: shoe }, { shape: { sphere: [0.11, 0.08, 0.1] }, at: [0, -0.44, 0.12], color: shoe },
        { shape: { box: [0.12, boot ? 0.03 : 0.035, 0.28] }, at: [0, -0.476, 0.045], color: sole }, { shape: { box: [0.035, 0.012, 0.09] }, at: [0, -0.392, 0.08], rot: [-0.35, 0, 0], color: boot ? '#2a2a2a' : '#f2f0e8' }];
      if (boot) shin.push({ shape: { cyl: [0.13, 0.15, 0.125] }, at: [0, -0.34, 0], color: shoe });
      else shin.push({ shape: { cyl: [0.135, 0.035] }, at: [0, -0.37, 0], color: tint(legs, 0.88) }, { shape: { box: [0.114, 0.022, 0.11] }, at: [0, -0.44, 0.05], color: shoe === '#e9e6dc' ? '#b22d22' : '#e9e6dc' });
      assemble(scene, 'shin', shin, mat, knee);
      return [thigh, knee] as const;
    };
    const [tl, kl] = leg(-1), [tr, kr] = leg(1); this.thighs = [tl, tr]; this.knees = [kl, kr];
    if (melee) {
      // A cutlass held low in the right hand: worn steel blade with a darker spine, wooden grip and a knuckle bow.
      this.blade = node('cutlass', this.shoulders[1], 0, -0.56, 0.04);
      assemble(scene, 'cutlass', [
        { shape: { box: [0.035, 0.12, 0.035] }, at: [0, 0, 0], color: '#4a2e1a' },
        { shape: { box: [0.09, 0.012, 0.04] }, at: [0, 0.065, 0], color: '#3a3a36' },
        { shape: { box: [0.014, 0.065, 0.66] }, at: [0, 0.08, 0.35], rot: [0.06, 0, 0], color: '#b9bdbb' },
        { shape: { box: [0.018, 0.014, 0.64] }, at: [0, 0.112, 0.34], rot: [0.06, 0, 0], color: '#5e6260' },
        { shape: { box: [0.014, 0.075, 0.1] }, at: [0, 0.07, 0.72], rot: [0.35, 0, 0], color: '#b9bdbb' }
      ], m.metal, this.blade);
    }
    if (faction !== 2 && !melee) for (const weapon of ['rifle', 'sidearm'] as WeaponId[]) {
      const holder = node(`held-${weapon}`, this.spine, weapon === 'rifle' ? 0.12 : 0.1, weapon === 'rifle' ? 0.34 : 0.33, weapon === 'rifle' ? 0.28 : 0.38);
      const def = weaponParts(weapon, 'low'); assemble(scene, `weapon-${weapon}`, [...def.parts, ...def.magazine], m.metal, holder); holder.setEnabled(false); this.weapons.set(weapon, holder);
    }
    this.blob = MeshBuilder.CreateGround('blob', { width: 0.9, height: 0.9 }, scene); this.blob.parent = this.root; this.blob.position.y = 0.03; this.blob.material = m.blob; this.blob.isPickable = false;
    if (variant === 'ada') {
      this.folder = node('folder', this.spine, 0.245 * build, 0.27, 0.03);
      assemble(scene, 'folder', [{ shape: { box: [0.022, 0.33, 0.24] }, at: [0, 0, 0], color: '#c2a56c' }, { shape: { box: [0.016, 0.31, 0.225] }, at: [-0.012, -0.004, 0.004], color: '#e8e2d0' }, { shape: { box: [0.024, 0.04, 0.12] }, at: [0.002, 0.13, 0], color: '#6b1a18' }], mat, this.folder); this.folder.setEnabled(false);
    }
    if (variant === 'femi') {
      // Femi's laptop bag, the strap across his chest. It's a separate mesh, so nobody who isn't carrying it pays for it.
      this.bag = node('bag', this.spine, 0, 0.1, 0); assemble(scene, 'bag', [{ shape: { box: [0.08, 0.3, 0.38] }, at: [-0.27 * build, -0.3, 0], color: '#2b2d30' }, { shape: { box: [0.09, 0.14, 0.3] }, at: [-0.27 * build, -0.36, 0.0], color: '#3a3d41' }, { shape: { box: [0.46 * build, 0.035, 0.03] }, at: [-0.02, 0.1, 0.125], rot: [0, 0, 0.72], color: '#17181a' }, { shape: { box: [0.46 * build, 0.035, 0.03] }, at: [-0.02, 0.1, -0.125], rot: [0, 0, 0.72], color: '#17181a' }], mat, this.bag); this.bag.setEnabled(false);
    }
    for (const mesh of this.root.getChildMeshes()) if (mesh !== this.blob) mesh.layerMask = 0x0fffffff | CAST_LAYER;
    if (name) this.label(name, faction);
  }
  /** Billboarded name tag, used for teammates and story allies only. */
  private label(text: string, faction: Faction) {
    const t = new DynamicTexture('tag', { width: 256, height: 64 }, this.scene, false), ctx = t.getContext() as unknown as CanvasRenderingContext2D;
    ctx.clearRect(0, 0, 256, 64); ctx.font = '700 30px "Bahnschrift", "Segoe UI", sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillText(text, 129, 42); ctx.fillStyle = faction === 0 ? '#8fb6ff' : faction === 2 ? '#f2d27a' : '#ff9a8f'; ctx.fillText(text, 128, 40); t.hasAlpha = true; t.update();
    const mat = new StandardMaterial('tag', this.scene); mat.diffuseTexture = t; mat.emissiveColor = Color3.White(); mat.disableLighting = true; mat.useAlphaFromDiffuseTexture = true; mat.backFaceCulling = false;
    this.tag = MeshBuilder.CreatePlane('tag', { width: 1, height: 0.25 }, this.scene); this.tag.parent = this.root; this.tag.position.y = 2.15; this.tag.billboardMode = Mesh.BILLBOARDMODE_ALL; this.tag.material = mat; this.tag.isPickable = false;
  }
  showTag(visible: boolean) { this.tagWanted = visible; }
  fired() { this.kick = 1; }
  /** Starts a cutlass swing; the arm raises, cuts down and recovers over about 0.45 s. */
  slashed() { this.swing = 1; }
  hit(fromYaw: number) { this.flinch = 1; this.flinchSide = Math.sin(fromYaw - this.root.rotation.y) > 0 ? 1 : -1; }
  update(p: Pose, dt: number) {
    const dead = p.health <= 0;
    this.root.position.set(p.x, p.y, p.z); this.root.rotation.y = p.yaw;
    // Speed and direction relative to facing drive the gait: strafing turns the hips, backpedalling reverses the cycle.
    const speed = Math.hypot(p.vx, p.vz), localZ = p.vx * Math.sin(p.yaw) + p.vz * Math.cos(p.yaw), localX = p.vx * Math.cos(p.yaw) - p.vz * Math.sin(p.yaw);
    const back = localZ < -0.2, heading = speed > 0.4 ? Math.atan2(localX, Math.abs(localZ)) * (back ? -1 : 1) : 0;
    this.legYaw += (Math.max(-0.75, Math.min(0.75, heading)) - this.legYaw) * Math.min(1, dt * 10);
    this.crouch += ((p.crouched ? 1 : 0) - this.crouch) * Math.min(1, dt * 12);
    // Sitting and lying blend in and out, so a staged character gets up rather than popping upright.
    this.sit += ((p.seated ? 1 : 0) - this.sit) * Math.min(1, dt * (p.seated ? 12 : 2.6)); this.lie += ((p.lying ? 1 : 0) - this.lie) * Math.min(1, dt * (p.lying ? 12 : 1.6));
    this.aim += ((p.aiming ? 1 : 0) - this.aim) * Math.min(1, dt * 14);
    this.air += ((p.grounded ? 0 : 1) - this.air) * Math.min(1, dt * 10);
    const stride = p.crouched ? 0.9 : speed > 6 ? 1.9 : 1.45; this.phase += (back ? -1 : 1) * speed / stride * Math.PI * dt * (dead ? 0 : 1);
    const amount = Math.min(1, speed / 5) * (1 - this.air * 0.7), sprint = Math.max(0, Math.min(1, (speed - 5.2) / 2));
    const s = Math.sin(this.phase), c = Math.cos(this.phase);
    this.hips.position.y = 0.95 - this.crouch * 0.36 + Math.abs(c) * 0.035 * amount - this.air * 0.04;
    this.hips.rotation.y = this.legYaw; this.spine.rotation.y = -this.legYaw * 0.85;
    for (const [i, side] of [[0, 1], [1, -1]] as const) {
      const swing = s * side * (0.55 + sprint * 0.25) * amount;
      this.thighs[i].rotation.x = -swing - this.crouch * 1.15 - this.air * 0.35;
      this.knees[i].rotation.x = Math.max(0, Math.sin(this.phase * side + (side > 0 ? 0.6 : -0.6) + Math.PI / 2)) * 0.9 * amount + this.crouch * 1.95 + this.air * 0.6;
    }
    if (this.sit > 0.01) { const k = this.sit, rise = Math.sin(Math.min(1, (1 - k) * 1.6) * Math.PI) * 0.25; for (const i of [0, 1]) { this.thighs[i].rotation.x += (-1.5 - this.thighs[i].rotation.x) * k; this.knees[i].rotation.x += (1.5 - this.knees[i].rotation.x) * k; } this.hips.position.y += (0.45 - this.hips.position.y) * k; this.spine.rotation.x = rise; }
    // Upper body: lean into sprint, pitch with aim, recoil and flinch decay quickly.
    this.kick = Math.max(0, this.kick - dt * 9); this.flinch = Math.max(0, this.flinch - dt * 5);
    const aimPitch = Math.max(-0.9, Math.min(0.9, p.pitch));
    this.spine.rotation.x = -aimPitch * 0.35 + sprint * 0.22 + this.crouch * 0.18 - this.kick * 0.05 + (this.sit > 0.01 && !p.seated ? this.spine.rotation.x : 0);
    this.spine.rotation.z = this.flinch * 0.25 * this.flinchSide + c * 0.03 * amount;
    this.head.rotation.x = -aimPitch * 0.55 - sprint * 0.15;
    const held = this.weapons.get(p.weapon);
    for (const [id, node] of this.weapons) node.setEnabled(id === p.weapon && !dead && !p.unarmed);
    const reload = p.reloading > 0 ? Math.sin(Math.min(1, p.reloading) * Math.PI) : 0, equip = p.equipping;
    this.swing = Math.max(0, this.swing - dt * 2.2);
    if (this.blade) {
      // Overhead cut: wind up for the first third, then drive down across the body.
      const s = this.swing, wind = s > 0.66 ? (1 - s) / 0.34 : s / 0.66;
      this.shoulders[1].rotation.set(-0.35 - wind * 2.3 - sprint * 0.3, 0, -0.15 + wind * 0.3); this.elbows[1].rotation.x = -0.5 - wind * 0.6;
      // Held raised and forward at rest; the wind-up lifts it back over the shoulder.
      this.blade.rotation.set(-1.0 - wind * 0.9, 0, 0); this.blade.setEnabled(!dead);
      this.shoulders[0].rotation.set(0.15 - Math.sin(this.phase) * 0.35 * amount, 0, 0.18); this.elbows[0].rotation.x = -0.35;
    } else if (this.faction === 2 || p.unarmed) {
      for (const i of [0, 1]) { this.shoulders[i].rotation.set(p.seated ? -0.5 : 0.05 + s * (i ? 1 : -1) * 0.4 * amount, 0, (i ? -1 : 1) * 0.12); this.elbows[i].rotation.x = p.seated ? -1.4 : -0.3; }
    } else if (p.relaxed && !p.aiming) {
      // Weapon held low and pointed at the ground, the way an officer carries it between fights.
      const pistol = p.weapon === 'sidearm';
      this.shoulders[1].rotation.set(pistol ? -0.25 : -0.45 + s * 0.08 * amount, 0, -0.12); this.elbows[1].rotation.x = pistol ? -0.35 : -1.0;
      this.shoulders[0].rotation.set(pistol ? 0.1 + s * 0.3 * amount : -0.7, pistol ? 0 : 0.45, pistol ? 0.12 : 0.3); this.elbows[0].rotation.x = pistol ? -0.3 : -1.05;
      if (held) { held.rotation.set(pistol ? 1.2 : 0.75, pistol ? 0 : -0.25, pistol ? 0 : 0.15); held.position.y = pistol ? 0.08 : 0.24; held.position.z = pistol ? 0.3 : 0.24; }
    } else if (sprint > 0.5 && !p.aiming) {
      // Low-ready while sprinting: weapon across the chest.
      this.shoulders[1].rotation.set(-0.35, 0, -0.2); this.elbows[1].rotation.x = -1.6; this.shoulders[0].rotation.set(-0.7, 0.5, 0.25); this.elbows[0].rotation.x = -1.3;
      if (held) { held.rotation.set(0.35, -0.9, 0.3); held.position.y = (p.weapon === 'rifle' ? 0.3 : 0.32); }
    } else {
      const pistol = p.weapon === 'sidearm';
      this.shoulders[1].rotation.set(pistol ? -1.35 : -0.95, 0, -0.1); this.elbows[1].rotation.x = pistol ? -0.25 : -1.15;
      this.shoulders[0].rotation.set(pistol ? -1.3 + reload * 0.6 : -1.35 + reload * 0.7, pistol ? 0.45 : 0.55, 0.3); this.elbows[0].rotation.x = pistol ? -0.3 - reload : -0.45 - reload * 0.9;
      if (held) { held.rotation.set(-this.kick * 0.12 + reload * 0.4 - equip * 0.8, 0, reload * 0.3); held.position.y = (pistol ? 0.33 : 0.34) - equip * 0.1; held.position.z = (pistol ? 0.38 : 0.28) - this.kick * 0.03; }
    }
    this.traversal(p, dt); this.gestures(p, dt);
    if (this.lie > 0.01) { const e = this.lie; this.root.rotation.x = -e * 1.5; this.root.position.y = p.y + e * 0.18; this.hips.position.y += (0.6 - this.hips.position.y) * e; this.knees[0].rotation.x += (0.5 - this.knees[0].rotation.x) * e; this.shoulders[1].rotation.x += (-0.3 - this.shoulders[1].rotation.x) * e; }
    // Death: crumple backward over half a second and stay down until the next life.
    this.death = dead ? Math.min(1, this.death + dt * 2.2) : 0;
    if (this.death > 0) { const e = 1 - (1 - this.death) ** 3; this.root.rotation.x = -e * 1.45; this.root.position.y = p.y + e * 0.2; this.hips.position.y = 0.95 - e * 0.5; this.knees[0].rotation.x = this.knees[1].rotation.x = e * 0.8; }
    else if (this.lie <= 0.01) this.root.rotation.x = 0;
    this.blob.setEnabled(this.death < 0.5); this.tag?.setEnabled(this.tagWanted && !dead); this.folder?.setEnabled(!!p.folder); this.bag?.setEnabled(!!p.bag); this.plaster?.setEnabled(!p.clean);
    // Blinks every few seconds (eyes stay shut once down); the mouth opens and closes in an uneven rhythm while speaking.
    this.blinkIn -= dt; if (this.blinkIn < -0.13) this.blinkIn = 2 + Math.random() * 3.5;
    this.lids.setEnabled(this.blinkIn < 0 || this.death > 0.6);
    this.talkT += dt; const open = p.talk && !dead ? Math.max(0, Math.sin(this.talkT * 17) * 0.6 + Math.sin(this.talkT * 7.3) * 0.5) : 0;
    this.mouth.setEnabled(open > 0.15); this.mouth.scaling.y = 0.4 + open;
  }
  /** Cutscene gestures layered over the body pose, blended in and out by the director. */
  private gestures(p: Pose, dt: number) {
    if (p.gesture) this.gestureName = p.gesture; this.gestureBlend = p.gestureT ?? (p.gesture ? 1 : 0); this.wave += dt * 7;
    const b = this.gestureBlend; if (b < 0.01 || !this.gestureName) return;
    const set = (n: TransformNode, x: number, y = n.rotation.y, z = n.rotation.z) => { n.rotation.x += (x - n.rotation.x) * b; n.rotation.y += (y - n.rotation.y) * b; n.rotation.z += (z - n.rotation.z) * b; };
    const [L, R] = [0, 1];
    switch (this.gestureName) {
      case 'point': set(this.shoulders[R], -1.5, 0, -0.15); set(this.elbows[R], -0.05); set(this.head, -0.1); break;
      case 'reach': set(this.shoulders[R], -1.25, 0, -0.05); set(this.elbows[R], -0.25); set(this.spine, 0.18); break;
      case 'radio': set(this.shoulders[L], -1.15, 0, -0.75); set(this.elbows[L], -2.0); set(this.head, 0.1, 0, 0.18); break;
      case 'phone': set(this.shoulders[R], -0.85, 0, 0.2); set(this.elbows[R], -1.7); set(this.head, 0.5); break;
      case 'brace': for (const i of [L, R]) { set(this.shoulders[i], -2.1, 0, (i ? -1 : 1) * 0.3); set(this.elbows[i], -1.7); } set(this.spine, 0.45); set(this.head, 0.35); break;
      case 'shrug': for (const i of [L, R]) { set(this.shoulders[i], -0.3, 0, (i ? -1 : 1) * 0.45); set(this.elbows[i], -1.3); } break;
      case 'wave': set(this.shoulders[R], -2.6, 0, -0.3); set(this.elbows[R], -0.4, 0, Math.sin(this.wave) * 0.5); break;
      case 'look-up': set(this.head, -0.65); set(this.spine, -0.18); break;
      case 'hold': for (const i of [L, R]) { set(this.shoulders[i], -0.75, (i ? -1 : 1) * 0.3, 0); set(this.elbows[i], -1.5); } set(this.head, 0.35); break;
    }
  }
  /** Body shapes for traversal, blended over the locomotion pose: tuck over a vault, push up a mantle, alternate limbs on a ladder, lean back into a slide. */
  private traversal(p: Pose, dt: number) {
    const kind = p.health > 0 ? p.traverse ?? 0 : 0; if (kind) this.travelKind = kind;
    this.travel += ((kind ? 1 : 0) - this.travel) * Math.min(1, dt * (kind ? 16 : 8)); if (this.travel < 0.01) return;
    const b = this.travel, t = p.traverseP ?? 0, bump = Math.sin(t * Math.PI), mix = (n: TransformNode, x: number, z = n.rotation.z) => { n.rotation.x += (x - n.rotation.x) * b; n.rotation.z += (z - n.rotation.z) * b; };
    const [l, r] = [0, 1];
    switch (this.travelKind) {
      case 1: mix(this.thighs[l], -1.35 * bump); mix(this.thighs[r], -1.1 * bump); mix(this.knees[l], 1.7 * bump); mix(this.knees[r], 1.5 * bump); mix(this.shoulders[l], -0.5, 0.3); mix(this.elbows[l], -0.1); mix(this.spine, 0.35 * bump); break;
      case 2: { const up = t < 0.55 ? 1 : 1 - (t - 0.55) / 0.45; for (const i of [l, r]) { mix(this.shoulders[i], -2.7 * up - 0.4 * (1 - up), (i ? -1 : 1) * 0.15); mix(this.elbows[i], -0.3 - (1 - up) * 1.1); } mix(this.thighs[l], -1.2 * bump); mix(this.knees[l], 1.6 * bump); break; }
      case 3: { const c = Math.sin(p.y * 3.4); for (const i of [l, r]) { const s = i ? -c : c; mix(this.shoulders[i], -2.5 - s * 0.35, (i ? -1 : 1) * 0.12); mix(this.elbows[i], -0.4 + s * 0.3); mix(this.thighs[i], -0.8 - s * 0.45); mix(this.knees[i], 1.1 + s * 0.4); } break; }
      case 4: mix(this.spine, -0.45); mix(this.thighs[l], -1.45); mix(this.knees[l], 0.25); mix(this.thighs[r], -0.6); mix(this.knees[r], 1.6); this.hips.position.y += (0.42 - this.hips.position.y) * b; break;
    }
    if (this.travelKind !== 4) for (const node of this.weapons.values()) if (b > 0.5) node.setEnabled(false);
  }
  /** World position of the muzzle for third-person tracers. */
  muzzle() { const held = this.weapons.get('rifle'); return held?.getAbsolutePosition() ?? this.root.position; }
  setEnabled(value: boolean) { this.root.setEnabled(value); }
  /** Body, weapon and blob materials are shared by every character, so only this actor's own name tag material is freed. */
  dispose() { const tag = this.tag?.material as StandardMaterial | undefined; tag?.diffuseTexture?.dispose(); tag?.dispose(); this.root.dispose(false, false); }
}
function node(name: string, parent: TransformNode, x: number, y: number, z: number) { const n = new TransformNode(name, parent.getScene()); n.parent = parent; n.position.set(x, y, z); return n; }
