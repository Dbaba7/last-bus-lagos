import { RULES } from '../config.js';
import { bounds, clearPosition, groundHeight } from '../physics.js';
import { ARENA, WORLD, WORLD_BOUNDS, type Box, type Vec3 } from '../world.js';
/**
 * Ground-level navigation grid built from the same collision boxes as the
 * simulation. Agents only plan through cells where a standing body fits, and
 * through steps no taller than the movement step-up, so a path is always one
 * the solver can actually walk.
 */
export class NavGrid {
  readonly cell = 0.5; readonly cols: number; readonly rows: number; readonly x0: number; readonly z0: number;
  readonly height: Float32Array; readonly walkable: Uint8Array; readonly cover: Vec3[] = [];
  constructor(readonly world: Box[] = WORLD, area: { halfX: number; halfZ: number } = WORLD_BOUNDS.get(world) ?? ARENA) {
    this.x0 = -area.halfX; this.z0 = -area.halfZ; this.cols = Math.round(area.halfX * 2 / this.cell); this.rows = Math.round(area.halfZ * 2 / this.cell);
    this.height = new Float32Array(this.cols * this.rows); this.walkable = new Uint8Array(this.cols * this.rows);
    // Inflate by a few centimetres so paths keep a little clearance from walls.
    // Ledges low enough for the step-up are walkable terrain, not obstacles.
    const margin = 0.08, inflated = world.filter(b => b.kind !== 'ground' && b.y + b.h / 2 > RULES.stepHeight + 0.2).map(b => ({ ...b, w: b.w + margin * 2, d: b.d + margin * 2 }));
    for (let r = 0; r < this.rows; r++) for (let c = 0; c < this.cols; c++) {
      const { x, z } = this.center(c, r), h = groundHeight(x, z, 0.62, world), i = r * this.cols + c;
      this.height[i] = h; this.walkable[i] = Number.isFinite(h) && clearPosition({ x, y: h + 0.02, z }, inflated) ? 1 : 0;
    }
    this.findCover();
  }
  center(c: number, r: number) { return { x: this.x0 + (c + 0.5) * this.cell, z: this.z0 + (r + 0.5) * this.cell }; }
  index(x: number, z: number) { const c = Math.floor((x - this.x0) / this.cell), r = Math.floor((z - this.z0) / this.cell); return c < 0 || r < 0 || c >= this.cols || r >= this.rows ? -1 : r * this.cols + c; }
  open(x: number, z: number) { const i = this.index(x, z); return i >= 0 && this.walkable[i] === 1; }
  /** Nearest walkable cell to a point, searching outward in rings. */
  nearest(x: number, z: number, radius = 6): Vec3 | null {
    const i = this.index(x, z); if (i >= 0 && this.walkable[i]) { const p = this.center(i % this.cols, Math.floor(i / this.cols)); return { x: p.x, y: this.height[i], z: p.z }; }
    for (let ring = 1; ring <= radius / this.cell; ring++) for (let dr = -ring; dr <= ring; dr++) for (let dc = -ring; dc <= ring; dc++) {
      if (Math.max(Math.abs(dr), Math.abs(dc)) !== ring) continue;
      const j = this.index(x + dc * this.cell, z + dr * this.cell); if (j >= 0 && this.walkable[j]) { const p = this.center(j % this.cols, Math.floor(j / this.cols)); return { x: p.x, y: this.height[j], z: p.z }; }
    }
    return null;
  }
  /** Cells right beside solid, waist-high-or-taller obstacles: candidate cover spots for agents. */
  private findCover() {
    const solid = this.world.filter(b => b.kind !== 'ground' && b.kind !== 'kerb' && b.kind !== 'deck' && b.kind !== 'floor' && b.kind !== 'rail' && b.kind !== 'fence' && b.kind !== 'pole' && b.kind !== 'ladder' && b.h >= 0.95 && b.y - b.h / 2 < 0.3);
    for (let r = 0; r < this.rows; r += 2) for (let c = 0; c < this.cols; c += 2) {
      const i = r * this.cols + c; if (!this.walkable[i]) continue; const { x, z } = this.center(c, r);
      if (solid.some(b => { const { min, max } = bounds(b); const dx = Math.max(min.x - x, 0, x - max.x), dz = Math.max(min.z - z, 0, z - max.z); return Math.hypot(dx, dz) < 0.75; })) this.cover.push({ x, y: this.height[i], z });
    }
  }
  /** A* over the 8-connected grid; refuses diagonal corner cuts. Returns world waypoints. */
  path(from: Vec3, to: Vec3, limit = 24000): Vec3[] | null {
    const start = this.nearest(from.x, from.z, 2), goal = this.nearest(to.x, to.z, 4); if (!start || !goal) return null;
    const s = this.index(start.x, start.z), g = this.index(goal.x, goal.z); if (s === g) return [goal];
    const cols = this.cols, open = new MinHeap(), cost = new Map<number, number>([[s, 0]]), came = new Map<number, number>(), gc = g % cols, gr = Math.floor(g / cols);
    const h = (i: number) => { const dc = Math.abs(i % cols - gc), dr = Math.abs(Math.floor(i / cols) - gr); return Math.max(dc, dr) + 0.414 * Math.min(dc, dr); };
    open.push(s, h(s)); let expanded = 0;
    while (open.size && expanded++ < limit) {
      const current = open.pop(); if (current === g) break;
      const cc = current % cols, cr = Math.floor(current / cols), base = cost.get(current)!;
      for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
        if (!dr && !dc) continue; const nc = cc + dc, nr = cr + dr; if (nc < 0 || nr < 0 || nc >= cols || nr >= this.rows) continue;
        const n = nr * cols + nc; if (!this.walkable[n] || Math.abs(this.height[n] - this.height[current]) > RULES.stepHeight) continue;
        if (dr && dc && (!this.walkable[cr * cols + nc] || !this.walkable[nr * cols + cc])) continue;
        const next = base + (dr && dc ? 1.414 : 1); if (next >= (cost.get(n) ?? Infinity)) continue;
        cost.set(n, next); came.set(n, current); open.push(n, next + h(n));
      }
    }
    if (!came.has(g)) return null;
    const cells: number[] = []; for (let at: number | undefined = g; at !== undefined && at !== s; at = came.get(at)) cells.push(at);
    return cells.reverse().filter((_, i, all) => i % 2 === 1 || i === all.length - 1).map(i => { const p = this.center(i % cols, Math.floor(i / cols)); return { x: p.x, y: this.height[i], z: p.z }; });
  }
  /** True when a straight walk between two points stays on walkable cells. */
  walkLine(a: Vec3, b: Vec3) {
    const steps = Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) / (this.cell * 0.5));
    for (let i = 1; i <= steps; i++) { const t = i / steps; if (!this.open(a.x + (b.x - a.x) * t, a.z + (b.z - a.z) * t)) return false; }
    return true;
  }
}
class MinHeap {
  private items: number[] = []; private keys: number[] = [];
  get size() { return this.items.length; }
  push(item: number, key: number) { this.items.push(item); this.keys.push(key); let i = this.items.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (this.keys[p] <= this.keys[i]) break; this.swap(i, p); i = p; } }
  pop() { const top = this.items[0], lastItem = this.items.pop()!, lastKey = this.keys.pop()!; if (this.items.length) { this.items[0] = lastItem; this.keys[0] = lastKey; let i = 0; for (;;) { const l = i * 2 + 1, r = l + 1; let m = i; if (l < this.items.length && this.keys[l] < this.keys[m]) m = l; if (r < this.items.length && this.keys[r] < this.keys[m]) m = r; if (m === i) break; this.swap(i, m); i = m; } } return top; }
  private swap(a: number, b: number) { [this.items[a], this.items[b]] = [this.items[b], this.items[a]]; [this.keys[a], this.keys[b]] = [this.keys[b], this.keys[a]]; }
}
const grids = new WeakMap<readonly Box[], NavGrid>();
/** Grids are immutable, so every solo session on the same map shares one instance. */
export function navFor(world: Box[]) { let grid = grids.get(world); if (!grid) { grid = new NavGrid(world); grids.set(world, grid); } return grid; }
/** The Ojuelegba arena grid. */
export function arenaNav() { return navFor(WORLD); }
