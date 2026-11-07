export interface Vec3 { x: number; y: number; z: number }
export type BoxKind = 'ground' | 'wall' | 'building' | 'shell' | 'floor' | 'stairs' | 'rail' | 'kerb' | 'deck' | 'pillar' | 'bus' | 'vehicle' | 'stall' | 'cover' | 'prop' | 'pole' | 'fence' | 'ladder';
/**
 * How a body may cross a box: `auto` vaults low, thin obstacles and mantles onto wider
 * ledges, `vault` only goes over, `climb` is a ladder or drainpipe, `none` is never
 * traversed. Boxes without a flag take a default from their kind (see `traversal`).
 */
export type Traverse = 'auto' | 'vault' | 'climb' | 'none';
/**
 * Every solid surface in Ojuelegba Junction. The client builds its visible
 * geometry from these same boxes, so collision and visuals cannot drift apart.
 * `style` picks the dressing, `label` the painted signage and `face` the side
 * that faces the street (n/s/e/w).
 */
export interface Box extends Vec3 { id: string; w: number; h: number; d: number; kind: BoxKind; color?: string; style?: string; label?: string; face?: 'n' | 's' | 'e' | 'w'; traverse?: Traverse }
export const ARENA = { halfX: 40, halfZ: 32 } as const;
/** Playable extent of each collision world, used to keep traversal from carrying a body out of bounds. */
export const WORLD_BOUNDS = new WeakMap<readonly Box[], { halfX: number; halfZ: number }>();
const half: Box[] = [];
/** Where `put` adds boxes: the Ojuelegba south half while it is built, then other maps. */
let into = half;
/** Adds a box by its footprint on the ground (x0..x1, z0..z1) standing on `base`. */
function put(id: string, kind: BoxKind, x0: number, x1: number, z0: number, z1: number, height: number, extra: Partial<Box> = {}, base = 0) {
  into.push({ id, kind, x: (x0 + x1) / 2, y: base + height / 2, z: (z0 + z1) / 2, w: Math.abs(x1 - x0), h: height, d: Math.abs(z1 - z0), ...extra });
}
/**
 * A walk-through ground-floor room: four walls with door gaps and lintels, a
 * ceiling slab and a solid upper storey. Doors are [side, centre, width].
 */
function shell(id: string, x0: number, x1: number, z0: number, z1: number, doors: ['n' | 's' | 'e' | 'w', number, number][], extra: Partial<Box>, upper = 3.6) {
  const t = 0.3, height = 3.6, door = 2.4;
  const sides = { s: { a: x0, b: x1, at: z0, axis: 'x' }, n: { a: x0, b: x1, at: z1, axis: 'x' }, w: { a: z0, b: z1, at: x0, axis: 'z' }, e: { a: z0, b: z1, at: x1, axis: 'z' } } as const;
  for (const [side, s] of Object.entries(sides) as [keyof typeof sides, typeof sides[keyof typeof sides]][]) {
    const gaps = doors.filter(d => d[0] === side).map(d => [d[1] - d[2] / 2, d[1] + d[2] / 2]).sort((a, b) => a[0] - b[0]);
    let cursor = s.a; const inner = side === 's' || side === 'w' ? s.at : s.at - t;
    const wall = (a: number, b: number, h: number, base = 0, part = 'wall') => {
      if (b - a < 0.01) return;
      const dress = { ...extra, label: undefined, face: side };
      if (s.axis === 'x') put(`${id}-${side}-${part}-${a.toFixed(1)}`, 'shell', a, b, inner, inner + t, h, dress, base);
      else put(`${id}-${side}-${part}-${a.toFixed(1)}`, 'shell', inner, inner + t, a, b, h, dress, base);
    };
    for (const [a, b] of gaps) { wall(cursor, a, height); wall(a, b, height - door, door, 'lintel'); cursor = b; }
    wall(cursor, s.b, height);
  }
  put(`${id}-ceiling`, 'floor', x0, x1, z0, z1, 0.3, { ...extra, label: undefined, style: 'ceiling' }, height);
  put(`${id}-upper`, 'building', x0, x1, z0, z1, upper, { ...extra, style: 'upper', face: doors[0][0] }, height + 0.3);
}
/** Straight run of solid treads rising `rise` per tread; returns the top height. */
function stairs(id: string, x0: number, x1: number, zStart: number, zEnd: number, steps: number, rise = 0.3) {
  const run = (zEnd - zStart) / steps;
  for (let i = 1; i <= steps; i++) put(`${id}-${i}`, 'stairs', x0, x1, zStart + run * (i - 1), zStart + run * i, rise * i, { style: 'concrete' });
  return rise * steps;
}
// ── Perimeter: real buildings and fences form the boundary, not invisible walls.
put('perim-s-1', 'building', -44, -28, -36, -32, 12, { style: 'tenement', face: 'n', color: '#b9a585' });
put('perim-s-2', 'building', -28, -16, -36, -32, 9, { style: 'shopfront', face: 'n', color: '#c9b089', label: 'BLESSED HANDS SALON' });
put('perim-s-3', 'building', -16, -6, -36, -32, 14, { style: 'office', face: 'n', color: '#a7a99c' });
put('perim-s-gate', 'fence', -6, 6, -33, -32, 4, { style: 'gate' });
put('perim-s-4', 'building', 6, 16, -36, -32, 10, { style: 'shopfront', face: 'n', color: '#d2b48d', label: 'GRACE & GLORY PHARMACY' });
put('perim-s-5', 'building', 16, 28, -36, -32, 13, { style: 'tenement', face: 'n', color: '#b7a07e' });
put('perim-s-6', 'building', 28, 44, -36, -32, 9, { style: 'warehouse', face: 'n', color: '#9fa39a' });
put('perim-w-1', 'building', -44, -40, -32, -20, 10, { style: 'tenement', face: 'e', color: '#c2ab88' });
put('perim-w-2', 'building', -44, -40, -20, -8, 12, { style: 'office', face: 'e', color: '#b0a993' });
put('perim-w-fence', 'fence', -41, -40, -8, 0, 4, { style: 'fence' });
put('perim-e-1', 'building', 40, 44, -32, -20, 11, { style: 'warehouse', face: 'w', color: '#a9ab9f' });
put('perim-e-2', 'building', 40, 44, -20, -8, 9, { style: 'tenement', face: 'w', color: '#cfb592' });
put('perim-e-fence', 'fence', 40, 41, -8, 0, 4, { style: 'fence' });
// ── Kerbed pavements beside both roads (0.15 m, climbed by the step-up).
put('kerb-sw-ns', 'kerb', -10, -8, -24, -6, 0.15); put('kerb-sw-ew', 'kerb', -40, -10, -8, -6, 0.15);
put('kerb-se-ns', 'kerb', 8, 10, -24, -6, 0.15); put('kerb-se-ew', 'kerb', 10, 40, -8, -6, 0.15);
// ── South plaza: police checkpoint (mirrored into the north danfo park).
put('van-w', 'vehicle', -17.6, -12.4, -29.6, -27.4, 2.4, { style: 'policevan' });
put('van-e', 'vehicle', 12.4, 17.6, -30.1, -27.9, 2.4, { style: 'policevan' });
put('barricade-w', 'cover', -6.5, -2.5, -23.85, -23.15, 1.1, { style: 'barrier' });
put('barricade-e', 'cover', 2.5, 6.5, -23.85, -23.15, 1.1, { style: 'barrier' });
put('drums-sw', 'prop', -11.8, -10.2, -25.2, -24, 1, { style: 'drums' });
put('booth-sw', 'stall', -23.3, -20.7, -30.2, -27.8, 2.8, { style: 'booth', label: 'CHECKPOINT' });
put('tyres-se', 'prop', 21.4, 22.6, -26.6, -25.4, 1.1, { style: 'tyres' });
put('stall-plaza-a', 'stall', -34.5, -31.5, -28.2, -25.8, 2.1, { style: 'market' });
put('stall-plaza-b', 'stall', -30, -27, -28.2, -25.8, 2.1, { style: 'market' });
put('crates-plaza', 'prop', 30, 31.6, -27.4, -25.8, 1.2, { style: 'crates' });
// ── South-west block: Unity Electricals (walk-through), Junction Records, balcony.
shell('unity', -21, -11, -20, -10, [['n', -16, 2.4], ['e', -15, 2], ['w', -13, 1.6]], { color: '#d8c7a2', label: 'UNITY ELECTRICALS', style: 'shop' });
put('unity-counter', 'cover', -18, -14, -14.4, -13.6, 1.05, { style: 'counter' });
put('unity-shelf', 'prop', -19, -13, -19.7, -19.1, 2.2, { style: 'shelf' });
put('unity-boxes', 'prop', -20.6, -19.4, -12, -10.8, 0.9, { style: 'cartons' });
put('records', 'building', -40, -25, -24, -12, 7.5, { style: 'records', face: 'n', color: '#c69b72', label: 'JUNCTION RECORDS' });
const top = stairs('records-stairs', -25, -23.6, -22, -12, 10);
put('records-balcony', 'floor', -38, -23.6, -12, -10, 0.25, { style: 'balcony' }, top - 0.25);
put('records-rail-n', 'rail', -38, -23.6, -10.1, -10, 1.05, { style: 'rail' }, top);
put('records-rail-w', 'rail', -38.1, -38, -12, -10, 1.05, { style: 'rail' }, top);
put('records-rail-e', 'rail', -23.65, -23.55, -12, -10.1, 1.05, { style: 'rail' }, top);
put('kiosk-sw', 'stall', -9.8, -8.2, -20, -18, 2.3, { style: 'kiosk', label: 'RECHARGE CARD • POS' }, 0.15);
put('generator-sw', 'prop', -9.55, -8.65, -17.1, -15.8, 0.8, { style: 'generator' }, 0.15);
put('bin-alley-sw', 'prop', -23, -21.8, -24.2, -22.4, 1.2, { style: 'bin' });
// ── South-east block: Mama Tee Kitchen and Ade & Sons mechanic yard.
put('mamatee', 'building', 11, 21, -24, -10, 8, { style: 'kitchen', face: 'n', color: '#cfa77a', label: 'MAMA TEE KITCHEN' });
put('yard-w-a', 'wall', 25, 25.3, -24, -19, 2.4, { style: 'compound' }); put('yard-w-b', 'wall', 25, 25.3, -16.6, -10.3, 2.4, { style: 'compound' });
put('yard-n-a', 'wall', 25, 30, -10.3, -10, 2.4, { style: 'compound', label: 'ADE & SONS MOTORS • VULCANIZER' }); put('yard-n-b', 'wall', 33.5, 40, -10.3, -10, 2.4, { style: 'compound' });
put('yard-car', 'vehicle', 31.1, 32.9, -19.1, -14.9, 1.45, { style: 'car', color: '#7d2f2a' });
put('yard-container', 'prop', 36.3, 38.7, -23.5, -17.5, 2.6, { style: 'container', color: '#2f5d6b' });
put('yard-tyres', 'prop', 27.4, 28.6, -13.6, -12.4, 1.1, { style: 'tyres' });
put('yard-bench', 'prop', 27, 29, -22.9, -22.1, 0.95, { style: 'bench' });
put('yard-cabinet', 'prop', 35.9, 37.1, -11.6, -11, 1.8, { style: 'toolcabinet' });
put('yard-stand', 'prop', 33.5, 34.5, -23.5, -22.5, 2, { style: 'tankstand' });
// Climbing routes: a ladder up the yard container and a drainpipe beside the records balcony (both mirrored north).
put('ladder-container', 'ladder', 36.18, 36.3, -21, -20, 2.6, { style: 'ladder', traverse: 'climb' });
put('pipe-records', 'ladder', -37.62, -37.38, -10, -9.88, 4.05, { style: 'drainpipe', traverse: 'climb' });
put('umbrella-se', 'stall', 8.5, 9.9, -21.7, -20.3, 1, { style: 'umbrella' }, 0.15);
put('ac-se', 'prop', 9.2, 9.9, -14, -13, 0.7, { style: 'acunit' }, 0.15);
// ── Roads, flyover pillars and stalled traffic.
for (const [x, z] of [[-3, -20], [3, -20], [-3, -8], [3, -8]]) put(`pillar-${x}-${z}`, 'pillar', x - 0.6, x + 0.6, z - 0.6, z + 0.6, 7);
put('danfo-ns', 'bus', -5.8, -3.4, -17.3, -11.7, 2.6, { style: 'danfo', label: 'OSHODI • OJUELEGBA • CMS' });
put('median-s', 'cover', -0.35, 0.35, -16, -12, 1, { style: 'barrier' });
put('danfo-ew', 'bus', -16.8, -11.2, -3.8, -1.4, 2.6, { style: 'danfo', label: 'YABA • OJUELEGBA • SURULERE' });
put('car-ew', 'vehicle', -30.1, -25.9, 2.1, 3.9, 1.45, { style: 'car', color: '#33475a' });
put('okada-w', 'prop', -26.35, -25.65, -5.45, -3.55, 1.1, { style: 'okada' });
for (const [x, z] of [[-9.5, -11], [9.5, -22.5]]) put(`lamp-${x}-${z}`, 'pole', x - 0.12, x + 0.12, z - 0.12, z + 0.12, 7, { style: 'streetlight' }, 0.15);
for (const [id, x, z] of [['tree-plaza', -37, -25.3], ['tree-yard', 35.5, -30.3], ['tree-kerb', 26, -8.9]] as const) put(id, 'pole', x - 0.18, x + 0.18, z - 0.18, z + 0.18, 3.6, { style: 'tree' });
for (const x of [-33, -18, 20, 35]) put(`utility-${x}`, 'pole', x - 0.13, x + 0.13, -7.6, -7.34, 9, { style: 'utility' }, 0.15);
/** North half is the south half rotated 180°, with its own names and dressing so it never reads as a copy. */
const north: Record<string, Partial<Box>> = {
  'perim-s-2': { label: 'TOLU FASHION HOUSE', color: '#bfa27c' }, 'perim-s-4': { label: 'ỌJỌ́ OJÚỌMỌ BAKERY', color: '#d6b98f' },
  'van-w': { kind: 'bus', style: 'danfo', label: 'OJUELEGBA • OBALENDE' }, 'van-e': { kind: 'bus', style: 'danfo', label: 'IDUMOTA • OJUELEGBA' },
  'booth-sw': { style: 'booth', label: 'DANFO PARK' }, 'barricade-w': { style: 'barrier' }, 'barricade-e': { style: 'barrier' },
  unity: { label: 'KOLA PRINTING PRESS', color: '#bfc7b8' }, records: { label: 'ADUNNI HOTEL & SUITES', color: '#d0b48c', style: 'hotel' },
  mamatee: { label: 'BUKKA 24/7', color: '#c79a6c' }, 'yard-n-a': { label: 'SIGNAL 9 TELECOM • AUTHORISED ACCESS ONLY' },
  'yard-car': { color: '#a8a39a' }, 'yard-container': { style: 'shelter', color: '#c8c2b4' }, 'yard-cabinet': { style: 'relay' }, 'yard-stand': { style: 'mast' },
  'kiosk-sw': { label: 'MAMA PUT • RICE & BEANS' }, 'stall-plaza-a': { style: 'market' }, 'car-ew': { color: '#9c8a4a' }
};
const rotate: Record<string, Box['face']> = { n: 's', s: 'n', e: 'w', w: 'e' };
function mirrored(b: Box): Box {
  // Exact ids take every override; parts of a shell only take its colour and signage.
  const exact = north[b.id], root = Object.keys(north).find(key => b.id.startsWith(`${key}-`));
  const part = !exact && root && (b.kind === 'shell' || b.style === 'upper') ? { color: north[root].color ?? b.color, label: b.label ? north[root].label ?? b.label : undefined } : {};
  return { ...b, ...exact, ...part, id: `${b.id}~n`, x: -b.x, z: -b.z, face: b.face ? rotate[b.face] : undefined };
}
export const WORLD: Box[] = [
  { id: 'ground', x: 0, y: -0.5, z: 0, w: 96, h: 1, d: 80, kind: 'ground' },
  { id: 'flyover', x: 0, y: 7.6, z: 0, w: 11, h: 1.2, d: 84, kind: 'deck', style: 'flyover', label: 'OJUELEGBA' },
  ...half, ...half.map(mirrored)
];
WORLD_BOUNDS.set(WORLD, ARENA);
/** Every playable collision world by name. Story missions pick one with `map`; multiplayer is always Ojuelegba. */
// ── Emergency shelter (Chapter 2 opening): a damaged community hall about two kilometres from the junction.
// Its north window looks back toward the city; the only way out is the east door. The skyline the renderer draws
// around every map sits beyond the open north side, where the smoke rises.
const shelter: Box[] = []; into = shelter;
put('ground', 'ground', -20, 20, -20, 20, 1, {}, -1);
shell('hall', -7, 7, -5, 5, [['e', 0, 1.8], ['n', 0, 3.4]], { color: '#cfc8b4', style: 'shop', label: 'YABA COMMUNITY HALL' }, 0.6);
put('hall-sill', 'shell', -1.7, 1.7, 4.7, 5, 1.05, { color: '#cfc8b4', style: 'sill' });
put('hall-cot-a', 'prop', -5.6, -3.8, -4.4, -3.6, 0.42, { style: 'bench' }); put('hall-cot-b', 'prop', -5.6, -3.8, -2.4, -1.6, 0.42, { style: 'bench' });
put('hall-cot-c', 'prop', -1.9, -0.1, -4.4, -3.6, 0.42, { style: 'bench' }); put('hall-table', 'cover', 2.2, 4.2, -1.4, -0.6, 0.95, { style: 'counter' });
put('hall-cartons', 'prop', 4.6, 5.8, 2.6, 3.8, 0.9, { style: 'cartons' }); put('hall-crates', 'prop', -6.6, -5.2, 2.8, 4.4, 1.2, { style: 'crates' });
put('hall-shelf', 'prop', 5.6, 6.6, -4.6, -2.8, 2.1, { style: 'shelf' }); put('hall-drums', 'prop', -6.5, -5.5, -0.6, 0.6, 1, { style: 'drums' });
put('hall-debris', 'prop', 0.8, 2, 2.4, 3.2, 0.45, { style: 'cartons' });
// Outside: a fenced service yard past the east door, and the street wall beyond the window.
put('yard-fence-n', 'fence', 7, 13, 3.8, 4, 2.4, { style: 'fence' }); put('yard-fence-s', 'fence', 7, 13, -4, -3.8, 2.4, { style: 'fence' }); put('yard-fence-e', 'fence', 12.8, 13, -3.8, 3.8, 2.4, { style: 'fence' });
put('street-wall', 'wall', -14, 14, 10.7, 11, 1.4, { style: 'compound' });
put('block-w', 'building', -14, -9, -12, 10.7, 10, { style: 'tenement', face: 'e', color: '#a89a82' }); put('block-s', 'building', -9, 14, -12, -8, 8, { style: 'warehouse', face: 'n', color: '#9a978c' });
put('block-e', 'building', 13, 14, -8, 10.7, 7, { style: 'office', face: 'w', color: '#aaa596' });
put('car-wreck', 'vehicle', 3, 5, 7, 8.2, 1.45, { style: 'car', color: '#5a4a3a' });
into = half;
export const SHELTER: Box[] = shelter;
WORLD_BOUNDS.set(SHELTER, { halfX: 14, halfZ: 12 });
export const MAPS: Record<string, { world: Box[]; name: string }> = { ojuelegba: { world: WORLD, name: 'Ojuelegba Junction' }, shelter: { world: SHELTER, name: 'Emergency shelter, Yaba' } };
export const SPAWNS: [Vec3[], Vec3[]] = [
  [{ x: -4, y: 0, z: -29 }, { x: 4, y: 0, z: -29 }, { x: -9, y: 0, z: -27.5 }, { x: 9, y: 0, z: -27.5 }],
  [{ x: 4, y: 0, z: 29 }, { x: -4, y: 0, z: 29 }, { x: 9, y: 0, z: 27.5 }, { x: -9, y: 0, z: 27.5 }]
];
/** A clear north–south lane at x = 7 used by automated multiplayer checks. */
export const TEST_LANE = { x: 7, spawnZ: 27 } as const;
export const ROAD = { ns: 8, ew: 6 } as const;
