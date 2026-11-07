import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { DynamicTexture } from '@babylonjs/core/Materials/Textures/dynamicTexture';
import { Texture } from '@babylonjs/core/Materials/Textures/texture';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import type { Scene } from '@babylonjs/core/scene';
import type { CabinState } from '@lastbus/shared';
import { Batches, Materials } from './kit.js';
/** Where the set stands: well outside the playable map and the camera's reach from it, so neither can ever see the other. */
export const BUS_SET = { x: 0, z: 300, reach: 240 };
const seeded = (seed: number) => () => (seed = seed * 16807 % 2147483647) / 2147483647;
const SPEED: Record<CabinState, number> = { rolling: 1, slowing: 0.3, stopped: 0, open: 0, attacked: 0, text: 0 };
/**
 * The inside of Danfo 247, a visual-only set offstage. The bus runs along x with its nose at +x, and the side door is on the -z
 * side. The street is two long painted strips standing outside the window holes, so the view really shifts as the camera moves;
 * they scroll to make the bus move. Built the first time a scene looks at it, so nothing else ever pays for it.
 */
export class BusInterior {
  private root?: TransformNode; private street: Texture[] = []; private door?: TransformNode; private dropped?: Mesh; private lit?: StandardMaterial; private dial?: StandardMaterial; private glow?: DynamicTexture;
  private travel = 0; private speed = 1; private target = 1; private rate = 1; private doorAt = 0; private doorTo = 0; private dim = 1;
  /** Streetlights and shopfronts sliding over the faces in the bus; 1 at the brightest. */
  flicker = 1;
  constructor(private scene: Scene, private detail: 'low' | 'high' = 'high') {}
  /** The state of the bus for the current scene. A skipped scene lands here with no time to ease. */
  state(state: CabinState, seconds = 1) {
    this.target = SPEED[state]; this.rate = 1 / Math.max(0.01, seconds); if (seconds <= 0.02) this.speed = this.target;
    this.doorTo = state === 'attacked' || state === 'open' || state === 'text' ? 1 : 0; if (seconds <= 0.02) this.doorAt = this.doorTo; this.wanted = state; this.props();
  }
  private wanted: CabinState = 'rolling';
  /** Femi's phone stays on the floor from the attack on, and lights up when his own message reaches it. */
  private props() { const down = this.wanted === 'attacked' || this.wanted === 'text'; this.dropped?.setEnabled(down); if (this.lit) this.lit.emissiveTexture = this.wanted === 'text' ? this.glow ?? null : null; }
  /** Shows or hides the set and runs the street past it. `dark` is the city with the network gone. */
  update(show: boolean, dt: number, dark: boolean) {
    if (show && !this.root) this.build(); this.root?.setEnabled(show); if (!show || !this.root) return;
    this.speed += Math.sign(this.target - this.speed) * Math.min(Math.abs(this.target - this.speed), dt * this.rate); this.travel += this.speed * dt * 0.16;
    this.doorAt += Math.sign(this.doorTo - this.doorAt) * Math.min(Math.abs(this.doorTo - this.doorAt), dt * 3); if (this.door) this.door.position.x = -0.4 - this.doorAt * 1;
    this.street.forEach((t, i) => { t.uOffset = (i ? -1 : 1) * this.travel; }); this.dim += ((dark ? 0.5 : 1) - this.dim) * Math.min(1, dt * 1.5);
    for (const t of this.street) t.level = this.dim;
    if (this.dial) this.dial.emissiveColor = Color3.FromHexString(dark ? '#180c04' : '#ffb04a');
    const t = this.travel * 40; this.flicker = this.speed < 0.02 ? 0.72 : 0.68 + 0.32 * Math.max(0, Math.sin(t * 2.1) * Math.sin(t * 0.73 + 1));
  }
  /** One long dusk street, painted once: sky, buildings with lit windows, shop signs, poles, and the kerb. */
  private strip(name: string, seed: number) {
    const width = this.detail === 'low' ? 1024 : 2048, height = 256, tex = new DynamicTexture(`bus-street-${name}`, { width, height }, this.scene, true), ctx = tex.getContext() as unknown as CanvasRenderingContext2D, r = seeded(seed);
    const sky = ctx.createLinearGradient(0, 0, 0, height * 0.7); sky.addColorStop(0, '#6d5a6a'); sky.addColorStop(0.55, '#d98e5e'); sky.addColorStop(1, '#f3c07e'); ctx.fillStyle = sky; ctx.fillRect(0, 0, width, height);
    const base = height * 0.74;
    for (let layer = 0; layer < 2; layer++) for (let x = -40; x < width;) {
      const w = (layer ? 90 : 120) + r() * 130, h = (layer ? 120 : 70) + r() * 80, shade = layer ? ['#3f3433', '#4a3a33', '#352f33', '#55443a'][Math.floor(r() * 4)] : '#7d6660';
      ctx.fillStyle = shade; ctx.fillRect(x, base - h, w, h);
      if (layer) {
        for (let wy = base - h + 12; wy < base - 56; wy += 26) for (let wx = x + 10; wx < x + w - 14; wx += 24) { ctx.fillStyle = r() < 0.42 ? ['#ffd28a', '#ffbd6b', '#ffe6b0'][Math.floor(r() * 3)] : '#241f22'; ctx.fillRect(wx, wy, 12, 15); }
        ctx.fillStyle = ['#c23a2e', '#f2b705', '#2f7a57', '#2a5aa0', '#d9d2c0'][Math.floor(r() * 5)]; ctx.fillRect(x + 8, base - 50, w - 16, 16);
        ctx.fillStyle = '#ffdca0'; ctx.fillRect(x + 12, base - 30, w - 24, 26); ctx.fillStyle = '#2a2320'; for (let p = x + 18; p < x + w - 20; p += 16 + r() * 22) ctx.fillRect(p, base - 26 - r() * 6, 7, 22 + r() * 6);
      }
      x += w + (layer ? 2 : 30);
    }
    ctx.fillStyle = '#4a4744'; ctx.fillRect(0, base, width, height - base); ctx.fillStyle = '#6a665f'; ctx.fillRect(0, base, width, 7);
    for (let x = 30; x < width; x += 240 + r() * 220) { ctx.fillStyle = '#231f1f'; ctx.fillRect(x, 26, 6, base - 26); ctx.fillRect(x - 26, 34, 58, 3); ctx.fillStyle = '#ffe2a8'; ctx.fillRect(x - 28, 37, 12, 4); }
    tex.wrapU = Texture.WRAP_ADDRESSMODE; tex.update(); return tex;
  }
  /** Text painted or stuck on inside the bus, on a small shared sheet. */
  private stickers() {
    const tex = new DynamicTexture('bus-stickers', { width: 512, height: 256 }, this.scene, true), ctx = tex.getContext() as unknown as CanvasRenderingContext2D;
    ctx.fillStyle = '#f2b705'; ctx.fillRect(0, 0, 512, 128); ctx.fillStyle = '#141414'; ctx.font = 'bold 54px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('NO CHANGE, NO ENTER', 256, 64, 490);
    ctx.fillStyle = '#efe7cf'; ctx.fillRect(0, 128, 256, 128); ctx.fillStyle = '#b3261e'; ctx.font = 'bold 34px sans-serif'; ctx.fillText('NO SHOUTING', 128, 170, 240); ctx.fillText('GOD DEY', 128, 214, 240);
    ctx.fillStyle = '#1a3a7a'; ctx.fillRect(256, 128, 256, 128); ctx.fillStyle = '#fff'; ctx.font = 'bold 40px sans-serif'; ctx.fillText('JESUS IS LORD', 384, 192, 240); tex.update(); return tex;
  }
  private build() {
    const scene = this.scene, root = this.root = new TransformNode('bus-set', scene), mats = new Materials(scene, 256), B = new Batches(scene); root.position.set(BUS_SET.x, 0, BUS_SET.z);
    const m = { paint: mats.get('bus-paint', { color: '#c79a24', specular: 0.14, gloss: 40 }), trim: mats.get('bus-trim', { color: '#1c1a18' }), floor: mats.get('bus-floor', { color: '#37332e', specular: 0.1 }), roof: mats.get('bus-roof', { color: '#8d8672' }), vinyl: mats.get('bus-vinyl', { color: '#4a2a18', specular: 0.1, gloss: 28 }), torn: mats.get('bus-torn', { color: '#a58a58' }), steel: mats.get('bus-steel', { color: '#9a9c9c', specular: 0.5, gloss: 60 }), dash: mats.get('bus-dash', { color: '#24211f', specular: 0.12 }), dial: this.dial = mats.get('bus-dial', { color: '#000000', emissive: '#ffb04a', unlit: true }), lamp: mats.get('bus-lamp', { color: '#000000', emissive: '#ffdca8', unlit: true }), cloth: mats.get('bus-cloth', { color: '#8c3a3a' }) };
    const L = 6, W = 2.24, H = 2.06, sill = 1, top = 1.72, hw = W / 2;
    B.box(m.floor, 0, -0.02, 0, L, 0.04, W); for (let z = -0.9; z <= 0.9; z += 0.3) B.box(m.trim, 0, 0.005, z, L, 0.012, 0.04);
    B.box(m.roof, 0, H + 0.02, 0, L, 0.04, W); for (const x of [-2.2, -0.9, 0.4, 1.7]) B.box(m.trim, x, H - 0.015, 0, 0.05, 0.03, W);
    // Walls: below and above the windows, and a pillar between each. The holes are real, so the street outside shifts with the camera.
    for (const z of [-hw, hw]) { const near = z < 0;
      for (const [from, to] of near ? [[-3, -0.9], [0.1, 3]] : [[-3, 3]]) { const mid = (from + to) / 2, length = to - from; B.box(m.paint, mid, sill / 2, z, length, sill, 0.05); }
      B.box(m.paint, 0, (top + H) / 2, z, L, H - top, 0.05); B.box(m.trim, 0, sill + 0.02, z, L, 0.04, 0.09); B.box(m.trim, 0, top - 0.02, z, L, 0.04, 0.09);
      for (const x of near ? [-2.9, -1.75, -0.95, 0.15, 1.2, 2.3] : [-2.9, -1.75, -0.6, 0.55, 1.7, 2.75]) B.box(m.paint, x, (sill + top) / 2, z, 0.14, top - sill, 0.05);
    }
    // Nose and tail.
    B.box(m.paint, -3, sill / 2, 0, 0.05, sill, W); B.box(m.paint, -3, (top + H) / 2, 0, 0.05, H - top, W); for (const z of [-hw + 0.1, hw - 0.1, 0]) B.box(m.paint, -3, (sill + top) / 2, z, 0.05, top - sill, 0.16);
    B.box(m.dash, 2.72, 0.5, 0, 0.6, 1, W - 0.08); B.box(m.dash, 2.5, 1.02, 0, 0.5, 0.08, W - 0.1); B.box(m.paint, 3.02, 1.92, 0, 0.05, 0.3, W); for (const z of [-1.05, 1.05]) B.box(m.paint, 3, 1.4, z, 0.08, 1.1, 0.12);
    // The radio in the dash, its dial still lit until the network dies, and the wheel.
    B.box(m.trim, 2.42, 1.12, -0.08, 0.08, 0.2, 0.62); B.box(m.dial, 2.375, 1.15, -0.16, 0.012, 0.07, 0.34); for (const z of [-0.26, 0.16]) B.cylinder(m.dash, 2.37, 1.08, -0.08 + z, 0.09, 0.05, { rz: Math.PI / 2 });
    B.torus(m.trim, 2.08, 1.02, 0.6, 0.42, 0.035, { rz: Math.PI / 2 - 0.3 }); B.cylinder(m.trim, 2.32, 0.86, 0.6, 0.05, 0.5, { rz: Math.PI / 2 - 0.3 });
    // Benches: two together on the window side, one by the aisle, each a cushion and a back with split vinyl.
    const seat = (x: number, z: number, wide: number) => { B.box(m.vinyl, x, 0.4, z, 0.46, 0.1, wide); B.box(m.vinyl, x - 0.25, 0.78, z, 0.08, 0.66, wide); B.box(m.steel, x - 0.2, 0.18, z, 0.04, 0.36, wide - 0.08); B.box(m.torn, x + 0.02, 0.455, z + wide * 0.2, 0.2, 0.012, 0.09); B.box(m.steel, x - 0.25, 1.12, z, 0.03, 0.03, wide); };
    for (const x of [-1.5, -0.3, 0.9]) seat(x, 0.45, 1.22); seat(-1.5, -0.72, 0.62); seat(0.9, -0.72, 0.62); seat(1.95, 0.6, 0.6); seat(1.95, -0.42, 1.0); B.box(m.vinyl, -2.55, 0.4, 0, 0.46, 0.1, W - 0.2); B.box(m.vinyl, -2.8, 0.78, 0, 0.08, 0.66, W - 0.2);
    // Grab rails, a pole by the door, a roof lamp that barely works, and what the driver has hung up.
    for (const z of [-0.42, 0.42]) { B.cylinder(m.steel, 0, 1.88, z, 0.03, 5, { rz: Math.PI / 2 }); for (const x of [-2, 0, 2]) B.box(m.steel, x, 1.97, z, 0.02, 0.18, 0.02); }
    B.cylinder(m.steel, 0.2, 1, -0.95, 0.04, 2.05); B.cylinder(m.steel, -1.02, 1, -0.95, 0.04, 2.05); B.box(m.lamp, 0, H - 0.02, 0, 0.9, 0.025, 0.07); B.box(m.lamp, -2, H - 0.02, 0, 0.5, 0.025, 0.07);
    B.rod(m.cloth, new Vector3(2.62, 1.94, 0.1), new Vector3(2.6, 1.62, 0.12), 0.012); B.sphere(m.cloth, 2.6, 1.58, 0.12, 0.09); B.box(m.cloth, 0, 2.03, 0.8, 5.2, 0.015, 0.5);
    B.build(mesh => { mesh.parent = root; mesh.isPickable = false; });
    // The street, one painted strip down each side. Unlit: they are the brightest thing there is.
    for (const [i, z] of [hw + 1.6, -hw - 1.6].entries()) {
      const tex = this.strip(i ? 'right' : 'left', 411 + i * 97), mat = new StandardMaterial(`bus-street-${i}`, scene); mat.diffuseColor = Color3.Black(); mat.specularColor = Color3.Black(); mat.emissiveTexture = tex; mat.disableLighting = true; mat.fogEnabled = false; tex.uScale = (i ? -1 : 1) * 0.42;
      const plane = MeshBuilder.CreatePlane(`bus-street-${i}`, { width: 26, height: 5, sideOrientation: 2 }, scene); plane.parent = root; plane.position.set(0, 1.75, z); plane.material = mat; plane.isPickable = false; this.street.push(tex);
    }
    const roadTex = new DynamicTexture('bus-road', { width: 512, height: 256 }, scene, true), rc = roadTex.getContext() as unknown as CanvasRenderingContext2D, sky = rc.createLinearGradient(0, 0, 0, 120); sky.addColorStop(0, '#7a6470'); sky.addColorStop(1, '#f0bd80'); rc.fillStyle = sky; rc.fillRect(0, 0, 512, 256);
    rc.fillStyle = '#463a38'; for (const [x, w, h] of [[0, 190, 80], [340, 172, 96], [190, 40, 34], [300, 44, 44]]) rc.fillRect(x, 124 - h, w, h); rc.fillStyle = '#4a4744'; rc.beginPath(); rc.moveTo(0, 256); rc.lineTo(216, 124); rc.lineTo(296, 124); rc.lineTo(512, 256); rc.fill(); rc.fillStyle = '#d9c88a'; for (let y = 134; y < 256; y += 30) rc.fillRect(254 - (y - 124) * 0.03, y, 6 + (y - 124) * 0.06, 12 + (y - 124) * 0.06); roadTex.update();
    // Ahead, the road; behind, the street it has just left.
    const ends: [number, number, Texture][] = [[4.6, Math.PI / 2, roadTex], [-4.6, -Math.PI / 2, this.street[0]]];
    for (const [x, ry, tex] of ends) { const mat = new StandardMaterial(`bus-end-${x}`, scene); mat.diffuseColor = Color3.Black(); mat.specularColor = Color3.Black(); mat.emissiveTexture = tex; mat.disableLighting = true; mat.fogEnabled = false; const plane = MeshBuilder.CreatePlane(`bus-end-${x}`, { width: 6.5, height: 3.4 }, scene); plane.parent = root; plane.position.set(x, 1.5, 0); plane.rotation.y = ry; plane.material = mat; plane.isPickable = false; }
    // Stickers, the sliding door and the phone that ends up under a seat.
    const sticks = new StandardMaterial('bus-stickers', scene); sticks.diffuseTexture = this.stickers(); sticks.specularColor = Color3.Black(); sticks.emissiveColor = new Color3(0.25, 0.25, 0.25);
    const sticker = (name: string, x: number, y: number, z: number, w: number, h: number, ry: number, uv: [number, number, number, number]) => { const plane = MeshBuilder.CreatePlane(name, { width: w, height: h }, scene), data = plane.getVerticesData('uv')!; for (let i = 0; i < data.length; i += 2) { data[i] = uv[0] + data[i] * (uv[2] - uv[0]); data[i + 1] = uv[1] + data[i + 1] * (uv[3] - uv[1]); } plane.setVerticesData('uv', data); plane.parent = root; plane.position.set(x, y, z); plane.rotation.y = ry; plane.material = sticks; plane.isPickable = false; };
    sticker('bus-sticker-a', 2.96, 1.88, 0, 1.2, 0.24, Math.PI / 2, [0, 0.5, 1, 1]); sticker('bus-sticker-b', -1.1, 1.86, hw - 0.04, 0.42, 0.21, 0, [0, 0, 0.5, 0.5]); sticker('bus-sticker-c', 1.1, 1.86, -hw + 0.04, 0.42, 0.21, Math.PI, [0.5, 0, 1, 0.5]);
    const door = this.door = new TransformNode('bus-door', scene); door.parent = root; door.position.set(-0.4, 0, -hw + 0.04); for (const [name, y, height] of [['low', sill / 2, sill], ['high', top + (H - top) / 2, H - top]] as const) { const part = MeshBuilder.CreateBox(`bus-door-${name}`, { width: 1.02, height, depth: 0.03 }, scene); part.parent = door; part.position.y = y; part.material = m.paint; part.isPickable = false; } const edge = MeshBuilder.CreateBox('bus-door-edge', { width: 0.05, height: top - sill, depth: 0.03 }, scene); edge.parent = door; edge.position.set(0.49, (sill + top) / 2, 0); edge.material = m.trim; edge.isPickable = false;
    const glow = this.glow = new DynamicTexture('bus-phone-glow', { width: 128, height: 256 }, scene, true), g = glow.getContext() as unknown as CanvasRenderingContext2D; g.fillStyle = '#0d1016'; g.fillRect(0, 0, 128, 256); g.fillStyle = '#2f62b4'; for (const [y, h] of [[60, 56], [126, 44]]) g.fillRect(14, y, 100, h); g.fillStyle = '#dfe6f2'; for (const y of [72, 88, 100, 138, 154]) g.fillRect(24, y, 76 - (y % 3) * 12, 6); glow.update();
    const phone = this.dropped = MeshBuilder.CreateBox('bus-phone', { width: 0.075, height: 0.012, depth: 0.15 }, scene), screen = MeshBuilder.CreateBox('bus-phone-screen', { width: 0.066, height: 0.002, depth: 0.135 }, scene), shell = new StandardMaterial('bus-phone', scene), lit = this.lit = new StandardMaterial('bus-phone-screen', scene);
    shell.diffuseColor = Color3.FromHexString('#16181c'); lit.diffuseColor = Color3.Black(); lit.emissiveColor = Color3.FromHexString('#0a0d12'); lit.disableLighting = true; phone.material = shell; screen.material = lit; screen.parent = phone; screen.position.y = 0.007; phone.parent = root; phone.position.set(-0.16, 0.012, 0.3); phone.rotation.y = 0.5; phone.isPickable = false; this.props();
  }
}
