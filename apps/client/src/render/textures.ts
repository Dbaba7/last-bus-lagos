import { DynamicTexture } from '@babylonjs/core/Materials/Textures/dynamicTexture';
import { Texture } from '@babylonjs/core/Materials/Textures/texture';
import type { Scene } from '@babylonjs/core/scene';
/**
 * Procedural, tileable surface textures. Each recipe paints a colour layer and a
 * height layer; the height becomes a tangent-space normal map so concrete,
 * corrugation and paving respond to the sun instead of reading as flat paint.
 */
type RGB = [number, number, number];
class Noise {
  private lattice: Float32Array;
  constructor(private size: number, seed: number) {
    this.lattice = new Float32Array(size * size); let s = seed >>> 0 || 1;
    for (let i = 0; i < this.lattice.length; i++) { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; this.lattice[i] = (s >>> 0) / 4294967295; }
  }
  /** Periodic value noise in [0,1]; `period` lattice cells span the texture so it tiles. */
  at(u: number, v: number, period: number) {
    const x = u * period, y = v * period, xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi;
    const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy), n = this.size, p = period;
    const g = (a: number, b: number) => this.lattice[(((a % p) + p) % p % n) + (((b % p) + p) % p % n) * n];
    const a = g(xi, yi), b = g(xi + 1, yi), c = g(xi, yi + 1), d = g(xi + 1, yi + 1);
    return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
  }
  fbm(u: number, v: number, period: number, octaves = 4) { let sum = 0, amp = 0.5, total = 0; for (let o = 0; o < octaves; o++) { sum += this.at(u, v, period << o) * amp; total += amp; amp *= 0.5; } return sum / total; }
}
export interface Surface { diffuse: Texture; normal?: Texture }
type Painter = (u: number, v: number, n: Noise) => { c: RGB; h: number };
const clamp = (v: number) => Math.max(0, Math.min(255, v));
const mix = (a: RGB, b: RGB, t: number): RGB => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const recipes: Record<string, Painter> = {
  concrete: (u, v, n) => { const m = n.fbm(u, v, 6, 5), pit = n.at(u, v, 128) > 0.93 ? -0.4 : 0, stain = Math.max(0, n.fbm(u * 0.5, v, 3, 3) - 0.55) * 1.6; const g = 150 + (m - 0.5) * 70 - stain * 45 + pit * 50; return { c: [g, g * 0.98, g * 0.94], h: m * 0.5 + pit }; },
  plaster: (u, v, n) => {
    const m = n.fbm(u, v, 5, 5), streak = Math.max(0, n.fbm(u * 3, v * 0.6, 4, 3) - 0.6) * 1.4, chip = n.fbm(u, v, 24, 3) > 0.83, blot = n.fbm(u, v, 2, 3);
    const base: RGB = chip ? [176, 172, 164] : [238 - streak * 40 - blot * 18, 234 - streak * 42 - blot * 20, 224 - streak * 46 - blot * 24];
    const g = (m - 0.5) * 26; return { c: [base[0] + g, base[1] + g, base[2] + g], h: (chip ? -0.3 : 0) + m * 0.25 };
  },
  asphalt: (u, v, n) => { const m = n.fbm(u, v, 8, 5), agg = n.at(u, v, 256), patch = n.fbm(u, v, 2, 2) > 0.62 ? -10 : 0, crack = Math.abs(n.fbm(u, v, 4, 4) - 0.5) < 0.012 ? -30 : 0; const g = 62 + (m - 0.5) * 28 + (agg > 0.88 ? 26 : 0) + patch + crack; return { c: [g, g, g * 1.02], h: agg * 0.4 + m * 0.2 + crack / 60 }; },
  paving: (u, v, n) => {
    const x = u * 8, y = v * 8, row = Math.floor(y), off = row % 2 ? 0.5 : 0, fx = (x + off) % 1, fy = y % 1, groove = Math.min(fx, 1 - fx, fy, 1 - fy) < 0.04;
    const tint = n.at(Math.floor(x + off) / 8, row / 8, 64) > 0.7 ? [168, 118, 92] as RGB : [178, 172, 160] as RGB, m = n.fbm(u, v, 8, 3);
    const c = groove ? [90, 86, 80] as RGB : mix(tint, [120, 112, 100], Math.max(0, m - 0.55) * 1.5); return { c, h: groove ? 0 : 0.6 + m * 0.2 };
  },
  dirt: (u, v, n) => { const m = n.fbm(u, v, 6, 5), pebble = n.at(u, v, 200) > 0.9; const c: RGB = mix([142, 118, 90], [104, 88, 70], m); return { c: pebble ? [170, 160, 146] : c, h: m * 0.5 + (pebble ? 0.3 : 0) }; },
  corrugated: (u, v, n) => { const wave = Math.sin(u * Math.PI * 2 * 12) * 0.5 + 0.5, rust = Math.max(0, n.fbm(u, v, 5, 4) - 0.55) * 2.4; const c = mix([170, 172, 168], [138, 74, 42], Math.min(1, rust)); const g = wave * 24 - 12; return { c: [c[0] + g, c[1] + g, c[2] + g], h: wave }; },
  shutter: (u, v, n) => { const rib = (v * 24) % 1, groove = rib < 0.12, dirt = n.fbm(u, v, 4, 4); const g = groove ? 120 : 196 - dirt * 50; return { c: [g, g * 1.01, g * 0.98], h: groove ? 0 : 0.7 }; },
  metal: (u, v, n) => { const m = n.fbm(u, v, 6, 4), scratch = n.at(u * 3, v * 0.1, 64) > 0.95 ? 30 : 0; const g = 200 + (m - 0.5) * 30 + scratch; return { c: [g, g, g], h: m * 0.2 }; },
  paint: (u, v, n) => { const m = n.fbm(u, v, 5, 4), dirt = Math.max(0, n.fbm(u, v * 0.4, 4, 3) - 0.5) * 1.4, scuff = n.at(u, v, 96) > 0.96; const g = 244 - dirt * 70 + (m - 0.5) * 14; return { c: scuff ? [150, 146, 140] : [g, g, g * 0.97], h: scuff ? -0.2 : 0 }; },
  wood: (u, v, n) => { const plank = Math.floor(v * 6), grain = n.fbm(u * 0.3 + plank * 0.17, v * 6, 8, 4), seam = (v * 6) % 1 < 0.05; const c = mix([150, 104, 66], [96, 64, 40], grain); return { c: seam ? [58, 40, 26] : c, h: seam ? 0 : 0.5 + grain * 0.3 }; },
  tiles: (u, v, n) => { const fx = (u * 6) % 1, fy = (v * 6) % 1, grout = Math.min(fx, 1 - fx, fy, 1 - fy) < 0.03, m = n.fbm(u, v, 6, 3); const g = 210 - m * 40; return { c: grout ? [120, 116, 108] : [g, g * 0.96, g * 0.9], h: grout ? 0 : 0.5 }; },
  fabric: (u, v, n) => { const weave = (Math.sin(u * 600) * Math.sin(v * 600)) * 6, m = n.fbm(u, v, 6, 3); const g = 220 + weave - m * 30; return { c: [g, g, g], h: 0.5 + weave / 30 }; },
  rubber: (u, v, n) => { const tread = Math.sin(v * Math.PI * 2 * 20) > 0.3, m = n.fbm(u, v, 8, 3); const g = 34 + m * 14 + (tread ? 6 : 0); return { c: [g, g, g], h: tread ? 0.8 : 0.2 }; },
  stucco: (u, v, n) => { const m = n.fbm(u, v, 12, 5); const g = 210 + (m - 0.5) * 60; return { c: [g, g * 0.98, g * 0.95], h: m }; },
  brick: (u, v, n) => {
    const y = v * 16, row = Math.floor(y), x = u * 8 + (row % 2 ? 0.5 : 0), fx = x % 1, fy = y % 1, mortar = fx < 0.05 || fy < 0.1;
    const t = n.at(Math.floor(x) / 8, row / 16, 64); const c: RGB = mortar ? [176, 170, 160] : mix([150, 96, 70], [110, 70, 52], t); return { c, h: mortar ? 0 : 0.6 };
  }
};
const cache = new Map<string, Surface>();
export function surface(scene: Scene, name: string, size = 512): Surface {
  const key = `${name}:${size}`; const existing = cache.get(key); if (existing) return existing;
  const painter = recipes[name]; const noise = new Noise(256, name.split('').reduce((a, c) => a * 31 + c.charCodeAt(0), 7));
  const colour = new DynamicTexture(`tex-${name}`, { width: size, height: size }, scene, true);
  const ctx = colour.getContext() as unknown as CanvasRenderingContext2D, image = ctx.createImageData(size, size), height = new Float32Array(size * size);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const { c, h } = painter(x / size, y / size, noise), i = (y * size + x) * 4; height[y * size + x] = h;
    image.data[i] = clamp(c[0]); image.data[i + 1] = clamp(c[1]); image.data[i + 2] = clamp(c[2]); image.data[i + 3] = 255;
  }
  ctx.putImageData(image, 0, 0); colour.update(true); colour.wrapU = colour.wrapV = Texture.WRAP_ADDRESSMODE; colour.anisotropicFilteringLevel = 8;
  const normal = new DynamicTexture(`nrm-${name}`, { width: size, height: size }, scene, true), nctx = normal.getContext() as unknown as CanvasRenderingContext2D, nimg = nctx.createImageData(size, size), strength = 2.2;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const h = (px: number, py: number) => height[((py + size) % size) * size + ((px + size) % size)];
    const dx = (h(x + 1, y) - h(x - 1, y)) * strength, dy = (h(x, y + 1) - h(x, y - 1)) * strength, len = Math.hypot(dx, dy, 1), i = (y * size + x) * 4;
    nimg.data[i] = (-dx / len * 0.5 + 0.5) * 255; nimg.data[i + 1] = (dy / len * 0.5 + 0.5) * 255; nimg.data[i + 2] = (1 / len * 0.5 + 0.5) * 255; nimg.data[i + 3] = 255;
  }
  nctx.putImageData(nimg, 0, 0); normal.update(true); normal.wrapU = normal.wrapV = Texture.WRAP_ADDRESSMODE;
  const result = { diffuse: colour, normal }; cache.set(key, result); return result;
}
/** Chain-link mesh with real transparency, alpha-tested so it stays cheap. */
export function chainLink(scene: Scene) {
  const t = new DynamicTexture('tex-chainlink', { width: 128, height: 128 }, scene, true), ctx = t.getContext() as unknown as CanvasRenderingContext2D;
  ctx.clearRect(0, 0, 128, 128); ctx.strokeStyle = 'rgba(170,176,172,1)'; ctx.lineWidth = 5;
  for (let i = -128; i <= 256; i += 32) { ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i + 128, 128); ctx.stroke(); ctx.beginPath(); ctx.moveTo(i, 128); ctx.lineTo(i + 128, 0); ctx.stroke(); }
  t.hasAlpha = true; t.update(true); t.wrapU = t.wrapV = Texture.WRAP_ADDRESSMODE; return t;
}
/**
 * One shared canvas atlas for every painted sign, poster and number plate so
 * signage costs a single draw call. `paint` returns the UV rectangle.
 */
export class SignAtlas {
  readonly texture: DynamicTexture; private ctx: CanvasRenderingContext2D; private x = 0; private y = 0; private row = 0;
  overflowed = false;
  constructor(scene: Scene, readonly size = 4096) {
    this.texture = new DynamicTexture('sign-atlas', { width: size, height: size }, scene, true); this.ctx = this.texture.getContext() as unknown as CanvasRenderingContext2D;
    this.ctx.clearRect(0, 0, size, size); this.texture.hasAlpha = true; this.texture.anisotropicFilteringLevel = 8;
  }
  private slot(w: number, h: number) { if (this.x + w > this.size) { this.x = 0; this.y += this.row + 4; this.row = 0; } if (this.y + h > this.size) this.overflowed = true; const at = { x: this.x, y: this.y }; this.x += w + 4; this.row = Math.max(this.row, h); return at; }
  /** Paints a sign with a main line and optional sub-line. Returns [u0, v0, u1, v1] for a quad's bottom-left and top-right. */
  paint(text: string, opts: { sub?: string; bg?: string; fg?: string; accent?: string; w?: number; h?: number; style?: 'board' | 'painted' | 'plate' | 'poster' | 'stencil' | 'lightbox' | 'spray' } = {}): [number, number, number, number] {
    const w = opts.w ?? 512, h = opts.h ?? 128, { x, y } = this.slot(w, h), ctx = this.ctx, style = opts.style ?? 'board';
    ctx.save(); ctx.translate(x, y); ctx.beginPath(); ctx.rect(0, 0, w, h); ctx.clip();
    if (style === 'spray') {
      // A flat line, one spike, flat again: a signal dying. Sprayed fast, with a soft edge and a few drips.
      ctx.clearRect(0, 0, w, h); ctx.lineCap = 'round'; ctx.lineJoin = 'round'; const line = [[0.04, 0.55], [0.4, 0.55], [0.47, 0.12], [0.55, 0.9], [0.61, 0.55], [0.96, 0.55]];
      for (const [width, alpha] of [[0.13, 0.22], [0.075, 0.9]]) { ctx.strokeStyle = `rgba(176,32,24,${alpha})`; ctx.lineWidth = h * width; ctx.beginPath(); for (const [px, py] of line) ctx.lineTo(px * w, py * h); ctx.stroke(); }
      ctx.fillStyle = 'rgba(176,32,24,0.8)'; for (const px of [0.18, 0.33, 0.72, 0.86]) ctx.fillRect(px * w, h * 0.55, h * 0.02, h * (0.12 + px * 0.28));
      ctx.restore(); return [x / this.size, 1 - (y + h) / this.size, (x + w) / this.size, 1 - y / this.size];
    }
    if (style !== 'stencil') { ctx.fillStyle = opts.bg ?? '#e8c63a'; ctx.fillRect(0, 0, w, h); }
    else { ctx.clearRect(0, 0, w, h); ctx.fillStyle = 'rgba(0,0,0,0)'; }
    if (style === 'board' || style === 'lightbox') { ctx.strokeStyle = opts.accent ?? 'rgba(0,0,0,0.55)'; ctx.lineWidth = h * 0.06; ctx.strokeRect(h * 0.04, h * 0.04, w - h * 0.08, h - h * 0.08); }
    if (style === 'poster') { ctx.fillStyle = opts.accent ?? '#b8352b'; ctx.fillRect(0, 0, w, h * 0.22); }
    const lines = opts.sub ? 2 : 1, main = Math.min(h * (lines === 2 ? 0.46 : 0.62), (w * 0.92) / Math.max(4, text.length) * 1.75);
    ctx.fillStyle = opts.fg ?? '#1b1d1c'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = `${style === 'painted' ? 'italic ' : ''}800 ${main}px "Bahnschrift", "Arial Narrow", "Roboto Condensed", Impact, sans-serif`;
    ctx.fillText(text, w / 2, lines === 2 ? h * 0.38 : h * 0.54, w * 0.92);
    if (opts.sub) { ctx.font = `600 ${h * 0.2}px "Bahnschrift", "Segoe UI", sans-serif`; ctx.fillText(opts.sub, w / 2, h * 0.76, w * 0.9); }
    // Weathering: sun fade and grime so signs belong to the street.
    if (style !== 'lightbox' && style !== 'stencil') {
      const grime = ctx.createLinearGradient(0, 0, 0, h); grime.addColorStop(0, 'rgba(60,45,30,0)'); grime.addColorStop(1, 'rgba(60,45,30,0.28)'); ctx.fillStyle = grime; ctx.fillRect(0, 0, w, h);
      for (let i = 0; i < w * h / 900; i++) { ctx.fillStyle = `rgba(${Math.random() < 0.5 ? '255,250,235' : '40,30,20'},${Math.random() * 0.12})`; ctx.fillRect(Math.random() * w, Math.random() * h, 1 + Math.random() * 4, 1 + Math.random() * 3); }
    }
    ctx.restore();
    // Uploaded with invertY, so canvas row y sits at v = 1 - y / size; v0 is the quad's bottom edge.
    return [x / this.size, 1 - (y + h) / this.size, (x + w) / this.size, 1 - y / this.size];
  }
  /** Lit-window strip for distant skyline blocks. */
  windows(cols: number, rows: number, seed: number): [number, number, number, number] {
    const w = cols * 16, h = rows * 24, { x, y } = this.slot(w, h), ctx = this.ctx; let s = seed;
    ctx.fillStyle = '#20262b'; ctx.fillRect(x, y, w, h);
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) { s = (s * 16807) % 2147483647; const lit = s % 100 < 32; ctx.fillStyle = lit ? (s % 3 ? '#ffcf86' : '#cfe5ff') : '#3a444b'; ctx.fillRect(x + c * 16 + 4, y + r * 24 + 5, 8, 13); }
    return [x / this.size, 1 - (y + h) / this.size, (x + w) / this.size, 1 - y / this.size];
  }
  commit() { if (this.overflowed) console.warn('Sign atlas is full; some signage will render incorrectly.'); this.texture.update(true); }
}
