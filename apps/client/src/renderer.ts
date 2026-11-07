import { Engine } from '@babylonjs/core/Engines/engine';
import { Scene } from '@babylonjs/core/scene';
import { FreeCamera } from '@babylonjs/core/Cameras/freeCamera';
import { Camera } from '@babylonjs/core/Cameras/camera';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { Color3, Color4 } from '@babylonjs/core/Maths/math.color';
import { HemisphericLight } from '@babylonjs/core/Lights/hemisphericLight';
import { DirectionalLight } from '@babylonjs/core/Lights/directionalLight';
import { PointLight } from '@babylonjs/core/Lights/pointLight';
import { ShadowGenerator } from '@babylonjs/core/Lights/Shadows/shadowGenerator';
import '@babylonjs/core/Lights/Shadows/shadowGeneratorSceneComponent';
import { RenderTargetTexture } from '@babylonjs/core/Materials/Textures/renderTargetTexture';
import { DynamicTexture } from '@babylonjs/core/Materials/Textures/dynamicTexture';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { ImageProcessingConfiguration } from '@babylonjs/core/Materials/imageProcessingConfiguration';
import { ColorCurves } from '@babylonjs/core/Materials/colorCurves';
import { DefaultRenderingPipeline } from '@babylonjs/core/PostProcesses/RenderPipeline/Pipelines/defaultRenderingPipeline';
import '@babylonjs/core/PostProcesses/RenderPipeline/postProcessRenderPipelineManagerSceneComponent';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import { RULES, WORLD, SPAWNS, MAPS, MOVE, eyeHeight, traverseProgress, worldRayHit, type Player, type GameEvent, type Snapshot, type Vec3, type Grade, type CineFx, type CineLight } from '@lastbus/shared';
import { Arena, type CityState } from './world.js';
import { Character, CAST_LAYER, type Faction, type Pose, type Variant } from './render/characters.js';
import { Spectacle } from './render/spectacle.js';
import { BUS_SET, BusInterior } from './render/bus.js';
import { Viewmodel, type Cue } from './render/viewmodel.js';
import { Effects, hitNormal, surfaceOf } from './render/effects.js';
import type { Preferences } from './settings.js';
export interface Extra { id: string; pose: Pose; faction: Faction; name?: string; variant?: Variant }
/** Colour grades: exposure, contrast and vignette on the image, plus a hue tint, its strength and saturation (ColorCurves units). */
const GRADES: Record<Grade, { exposure: number; contrast: number; vignette: number; hue: number; density: number; saturation: number }> = {
  dusk: { exposure: 1.08, contrast: 1.18, vignette: 1.2, hue: 30, density: 0, saturation: 0 },
  cold: { exposure: 1.12, contrast: 1.16, vignette: 1.6, hue: 210, density: 18, saturation: -22 },
  restored: { exposure: 1.3, contrast: 1.1, vignette: 1.1, hue: 32, density: 12, saturation: 10 },
  night: { exposure: 1.38, contrast: 1.1, vignette: 1.4, hue: 215, density: 14, saturation: -8 },
  flash: { exposure: 5, contrast: 0.6, vignette: 0, hue: 45, density: 25, saturation: -70 },
  aftermath: { exposure: 1.1, contrast: 1.04, vignette: 2.0, hue: 35, density: 22, saturation: -50 },
  shelter: { exposure: 1.15, contrast: 1.22, vignette: 2.4, hue: 190, density: 14, saturation: -34 }
};
/** Scene lighting for the time of day: dusk sun or night, with the city carrying the light. */
const SUN_DIRECTION = new Vector3(0.78, -0.42, 0.3).normalize(), BLAST_DIRECTION = new Vector3(0, -0.28, -0.96).normalize();
const MOODS = {
  dusk: { sun: 2.1, sunColor: '#ffc58a', sky: 0.62, skyColor: '#b7c6e0', ground: '#7a5c44', sodium: 0.9, fog: [0.8, 0.64, 0.53] },
  night: { sun: 0.45, sunColor: '#8aa2d4', sky: 0.48, skyColor: '#5a6c98', ground: '#3a3028', sodium: 1.9, fog: [0.09, 0.1, 0.15] }
} as const;
export interface Frame {
  players: Player[]; ownId: string; own?: Player; yaw: number; pitch: number; now: number;
  interpolate: boolean; playing: boolean; teamTags: boolean; extras?: Extra[]; look: { x: number; y: number };
  /** Cutscene camera: overrides the first-person view and shows the player's own body unless `hide` lists it. */
  cinematic?: { pos: Vec3; look: Vec3; fov: number; roll?: number; hide?: Set<string>; exposure?: number; light?: CineLight };
  /** Ids of solo-mode enemies carrying cutlasses rather than guns. */
  melee?: Set<string>;
  /** Story moments where Ada has no weapon in hand: the first-person weapon is not drawn. */
  unarmed?: boolean;
}
const MENU_PATH = [
  [new Vector3(-34, 2.2, -1.5), new Vector3(0, 3, 0)], [new Vector3(-16, 1.8, 3.5), new Vector3(0, 3, 0)], [new Vector3(-6, 1.7, -3), new Vector3(6, 3, 8)],
  [new Vector3(5.8, 2.0, -15), new Vector3(-2, 3, 2)], [new Vector3(4, 3.2, -28.5), new Vector3(0, 3, 0)]
] as const;
const catmull = (a: number, b: number, c: number, d: number, t: number) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t * t + (-a + 3 * b - 3 * c + d) * t * t * t);
/**
 * Owns the Babylon scene: dusk lighting, baked sun shadows, post-processing,
 * the arena, characters, first-person view and combat effects. It renders
 * simulation state and never mutates it.
 */
export class GameRenderer {
  readonly engine: Engine; readonly scene: Scene; readonly camera: FreeCamera; arena: Arena; private arenas = new Map<string, Arena>(); private mapId = 'ojuelegba'; private textureSize: number; readonly viewmodel: Viewmodel; readonly effects: Effects;
  private sun: DirectionalLight; private shadows?: ShadowGenerator; private pipeline: DefaultRenderingPipeline; private flashLight: PointLight;
  private actors = new Map<string, Character>(); private histories = new Map<string, { at: number; p: Player }[]>(); private receivedAt = performance.now(); private serverNow = 0;
  private renderTime = 0; private frameSamples: number[] = []; private lastFrame = performance.now(); private frameDrawCalls = 0; private playingBefore = false;
  readonly spectacle: Spectacle; readonly bus: BusInterior; private inBus = false; private blastT = 0; private dust = 0; private dustTo = 0; private flickT = 0; private fogBase = 0.0075; private skyLight!: HemisphericLight; private sodium!: PointLight; private skyMat!: StandardMaterial; private skies: DynamicTexture[] = []; private sunDisc!: Mesh;
  private grade = { ...GRADES.dusk }; private gradeTo = GRADES.dusk; private gradeRate = 0; private curves = new ColorCurves(); private night = 0; private nightTo = 0; private nightRate = 1; private flashT = 0;
  /** Cutscene key and rim lights; they reach character meshes only (CAST_LAYER), so world materials keep a four-light budget. */
  private key!: DirectionalLight; private rim!: DirectionalLight; private rig = { on: 0, key: 0, rim: 0, floor: 0 };
  private eye = RULES.eye; private feel = { dip: 0, roll: 0, nod: 0, fov: 0 }; private shake = 0; private fovNow = 1.57; private debugMeshes: Mesh[] = [];
  fov = 90; comfort = { bob: 0.6, shake: 1 }; zoom = 1;
  onCue?: (cue: Cue) => void;
  constructor(canvas: HTMLCanvasElement, pref: Preferences) {
    this.engine = new Engine(canvas, true, { preserveDrawingBuffer: false, stencil: true, powerPreference: 'high-performance', antialias: true }, false);
    const scene = this.scene = new Scene(this.engine); scene.skipPointerMovePicking = true; scene.clearColor = new Color4(0.83, 0.66, 0.54, 1);
    scene.fogMode = Scene.FOGMODE_EXP2; scene.fogColor = new Color3(0.8, 0.64, 0.53); scene.fogDensity = 0.0075;
    scene.setRenderingAutoClearDepthStencil(1, true, true, false);
    this.camera = new FreeCamera('eyes', new Vector3(-30, 2.2, -14), scene); this.camera.minZ = 0.05; this.camera.maxZ = 260; this.camera.fovMode = Camera.FOVMODE_HORIZONTAL_FIXED; this.camera.inputs.clear();
    const sky = this.skyLight = new HemisphericLight('sky', new Vector3(0, 1, 0), scene); sky.intensity = 0.62; sky.diffuse = Color3.FromHexString('#b7c6e0'); sky.groundColor = Color3.FromHexString('#7a5c44'); sky.specular = Color3.Black();
    // Low sun from the west: long shadows across the junction and warm light on the east-facing fronts.
    this.sun = new DirectionalLight('sun', SUN_DIRECTION.clone(), scene); this.sun.position = this.sun.direction.scale(-90); this.sun.intensity = 2.1; this.sun.diffuse = Color3.FromHexString('#ffc58a'); this.sun.specular = Color3.FromHexString('#ffdcb0');
    const sodium = this.sodium = new PointLight('sodium', new Vector3(0, 6.2, 0), scene); sodium.diffuse = Color3.FromHexString('#ffab55'); sodium.intensity = 0.9; sodium.range = 16; sodium.specular = Color3.Black();
    this.flashLight = new PointLight('muzzle-light', Vector3.Zero(), scene); this.flashLight.diffuse = Color3.FromHexString('#ffbf6a'); this.flashLight.intensity = 0; this.flashLight.range = 9;
    for (const name of ['key', 'rim'] as const) { const l = this[name] = new DirectionalLight(`cine-${name}`, new Vector3(0, -1, 0), scene); l.intensity = 0; l.includeOnlyWithLayerMask = CAST_LAYER; l.setEnabled(false); }
    this.key.diffuse = Color3.FromHexString('#ffe7cf'); this.key.specular = Color3.FromHexString('#806a58');
    const ip = scene.imageProcessingConfiguration; ip.toneMappingEnabled = true; ip.toneMappingType = ImageProcessingConfiguration.TONEMAPPING_ACES; ip.exposure = 1.08; ip.contrast = 1.18;
    ip.vignetteEnabled = true; ip.vignetteWeight = 1.2; ip.vignetteColor = new Color4(0.08, 0.04, 0.02, 0);
    // Colour curves stay enabled from the start so changing grade only moves uniforms and never recompiles shaders.
    ip.colorCurvesEnabled = true; ip.colorCurves = this.curves;
    this.sky();
    this.textureSize = pref.quality === 'low' ? 256 : 512; this.arena = new Arena(scene, this.textureSize); this.arenas.set('ojuelegba', this.arena);
    for (const material of scene.materials) if (material instanceof StandardMaterial && !material.name.startsWith('character')) material.maxSimultaneousLights = 4;
    this.viewmodel = new Viewmodel(scene, this.camera); this.viewmodel.onCue = cue => this.onCue?.(cue);
    this.effects = new Effects(scene); this.spectacle = new Spectacle(scene); this.bus = new BusInterior(scene, pref.quality === 'low' ? 'low' : 'high');
    this.pipeline = new DefaultRenderingPipeline('post', true, scene, [this.camera]);
    this.pipeline.bloomThreshold = 0.82; this.pipeline.bloomWeight = 0.28; this.pipeline.bloomKernel = 48; this.pipeline.bloomScale = 0.5;
    this.pipeline.imageProcessingEnabled = false;
    this.apply(pref);
    window.addEventListener('resize', () => this.engine.resize());
  }
  private sky() {
    // Two gradients: dusk, and night with the city's sodium glow on the horizon. The dome swaps between them with the mood.
    this.skies = [[[0, '#2c4466'], [0.32, '#6f87a6'], [0.47, '#d9a785'], [0.5, '#efb27a'], [0.56, '#c78f6e'], [1, '#6b5040']], [[0, '#03060d'], [0.3, '#0b1424'], [0.45, '#1f2638'], [0.5, '#5a3e30'], [0.56, '#2a2220'], [1, '#141010']]].map((stops, i) => {
      const t = new DynamicTexture(`sky-gradient-${i}`, { width: 16, height: 256 }, this.scene, false), ctx = t.getContext() as unknown as CanvasRenderingContext2D, g = ctx.createLinearGradient(0, 0, 0, 256);
      for (const [at, color] of stops) g.addColorStop(at as number, color as string); ctx.fillStyle = g; ctx.fillRect(0, 0, 16, 256); t.update(); return t;
    });
    const t = this.skies[0];
    const dome = MeshBuilder.CreateSphere('sky', { diameter: 480, segments: 16, sideOrientation: 1 }, this.scene); const m = this.skyMat = new StandardMaterial('sky', this.scene);
    m.emissiveTexture = t; m.diffuseColor = Color3.Black(); m.specularColor = Color3.Black(); m.disableLighting = true; m.fogEnabled = false; dome.material = m; dome.infiniteDistance = true; dome.isPickable = false;
    const sunDisc = this.sunDisc = MeshBuilder.CreateDisc('sun-disc', { radius: 9, tessellation: 24 }, this.scene); const sm = new StandardMaterial('sun-disc', this.scene); sm.emissiveColor = new Color3(1.6, 1.15, 0.7); sm.disableLighting = true; sm.fogEnabled = false; sunDisc.material = sm;
    sunDisc.position = this.sun.direction.scale(-210); sunDisc.lookAt(Vector3.Zero()); sunDisc.infiniteDistance = true; sunDisc.isPickable = false;
  }
  /** Applies graphics preferences. Shadows are baked once from static geometry; changing size re-bakes. */
  apply(pref: Pick<Preferences, 'quality' | 'shadows' | 'renderScale' | 'postEffects' | 'fov' | 'headBob' | 'cameraShake'>) {
    this.engine.setHardwareScalingLevel(1 / Math.max(0.5, Math.min(1, pref.renderScale)) / (window.devicePixelRatio > 1 && pref.quality === 'high' ? Math.min(window.devicePixelRatio, 1.5) : 1));
    this.fov = pref.fov; this.comfort = { bob: pref.headBob, shake: pref.cameraShake };
    const size = pref.shadows === 'high' ? 4096 : pref.shadows === 'low' ? 2048 : 0;
    if (!size) { this.shadows?.dispose(); this.shadows = undefined; this.scene.shadowsEnabled = false; }
    else if (!this.shadows || this.shadows.getShadowMap()!.getSize().width !== size) {
      this.shadows?.dispose(); this.scene.shadowsEnabled = true;
      const sg = this.shadows = new ShadowGenerator(size, this.sun); sg.usePercentageCloserFiltering = true; sg.filteringQuality = ShadowGenerator.QUALITY_MEDIUM; sg.bias = 0.0012; sg.normalBias = 0.02; sg.darkness = 0.25;
      this.sun.autoUpdateExtends = true; this.sun.autoCalcShadowZBounds = true;
      for (const mesh of this.arena.shadowCasters) sg.addShadowCaster(mesh, false);
      sg.getShadowMap()!.refreshRate = RenderTargetTexture.REFRESHRATE_RENDER_ONCE;
    }
    this.pipeline.fxaaEnabled = pref.postEffects; this.pipeline.bloomEnabled = pref.postEffects && pref.quality !== 'low'; this.pipeline.sharpenEnabled = pref.quality === 'high' && pref.postEffects;
    if (this.pipeline.sharpenEnabled) { this.pipeline.sharpen.edgeAmount = 0.25; }
    this.fogBase = this.scene.fogDensity = pref.quality === 'low' ? 0.009 : 0.0075; this.spectacle.detail = pref.quality === 'low' ? 0.55 : pref.quality === 'medium' ? 0.8 : 1;
  }
  snapshot(snapshot: Snapshot) {
    this.serverNow = snapshot.now; this.receivedAt = performance.now();
    for (const p of snapshot.players) { const history = this.histories.get(p.id) ?? []; if (history.length && history.at(-1)!.p.life !== p.life) history.length = 0; history.push({ at: snapshot.now, p: structuredClone(p) }); if (history.length > 10) history.shift(); this.histories.set(p.id, history); }
  }
  /** Presentation for simulation events: tracers, impacts, recoil kick and hit flinches. */
  feedback(event: GameEvent, ownId: string, suppressLocal = false) {
    if (event.type === 'shot') {
      const own = event.player === ownId;
      if (own && !suppressLocal) this.localShot();
      if (event.position && event.end) {
        const from = own ? this.viewmodel.muzzleWorld() : this.actors.get(event.player)?.muzzle() ?? new Vector3(event.position.x, event.position.y - 0.1, event.position.z);
        if (!own) this.actors.get(event.player)?.fired();
        // Shots at the local player would streak straight into the camera; the damage indicator covers them.
        if (event.target !== ownId) this.effects.tracer(from, event.end, own ? 0.5 : 0.9);
        if (event.target) this.effects.impact(event.end, { x: event.position.x - event.end.x, y: 0, z: event.position.z - event.end.z }, 'flesh');
        else {
          const d = { x: event.end.x - event.position.x, y: event.end.y - event.position.y, z: event.end.z - event.position.z }, length = Math.hypot(d.x, d.y, d.z) || 1;
          const hit = worldRayHit(event.position, { x: d.x / length, y: d.y / length, z: d.z / length }, length + 0.05);
          if (hit.box && hit.distance <= length + 0.02) this.effects.impact(event.end, hitNormal(hit.box, event.end), surfaceOf(hit.box), hit.box);
        }
      }
    }
    if (event.type === 'hit' && event.target && event.position) { const target = this.actors.get(event.target); target?.hit(Math.atan2(event.position.x - target.root.position.x, event.position.z - target.root.position.z)); }
    if (event.type === 'melee') this.actors.get(event.player)?.slashed();
    if (event.type === 'hit' && event.target === ownId) this.shake = Math.min(1, this.shake + (event.melee ? 0.8 : 0.5));
  }
  /** Immediate local shot presentation, called on the predicted frame the trigger is pulled. */
  localShot() { this.viewmodel.shot(); this.shake = Math.min(1, this.shake + 0.12); this.flashLight.intensity = 1.4; const right = this.camera.getDirection(Vector3.Right()); this.effects.brass(this.viewmodel.muzzleWorld().subtract(this.camera.getDirection(Vector3.Forward()).scale(0.4)), right); }
  land(speed: number) { this.viewmodel.land(speed); this.shake = Math.min(1, this.shake + Math.min(0.3, speed * 0.03)); }
  render(frame: Frame) {
    const now = performance.now(), dt = Math.min((now - this.lastFrame) / 1000, 0.1); this.lastFrame = now; this.renderTime += dt;
    const { own, playing } = frame;
    if (playing) { if (!this.playingBefore) this.frameSamples.length = 0; this.frameSamples.push(dt * 1000); if (this.frameSamples.length > 18000) this.frameSamples.shift(); }
    if (!frame.cinematic) this.lightRig(undefined, dt);
    this.atmosphere(dt);
    if (frame.cinematic) {
      const c = frame.cinematic; this.camera.position.set(c.pos.x, c.pos.y, c.pos.z); this.camera.setTarget(new Vector3(c.look.x, c.look.y, c.look.z)); this.camera.rotation.z = c.roll ?? 0;
      this.camera.fov = c.fov * Math.PI / 180; this.fovNow = this.fov * Math.PI / 180; this.flashLight.intensity = 0; this.shake = 0;
      this.lightRig(c, dt);
      this.viewmodel.update({ health: 0 } as Player, 0, dt, frame.look, this.comfort, false);
    } else if (playing && own) {
      const alive = own.health > 0, targetEye = alive ? eyeHeight(own) : 0.4;
      this.eye += (targetEye - this.eye) * Math.min(1, dt * 14);
      this.shake *= Math.exp(-dt * 7); const s = this.shake * this.comfort.shake * 0.012;
      // Traversal feel: the head tucks and rolls over a vault, nods over a mantle, sways on a ladder and leans into a slide.
      const kind = own.traverse, t = traverseProgress(own), bump = Math.sin(t * Math.PI), want = { dip: 0, roll: 0, nod: 0, fov: 0 };
      if (kind === MOVE.vault) Object.assign(want, { dip: -Math.min(0.8, Math.max(0, own.ledgeY - own.fromY)) * 0.6 * bump, roll: 0.05 * bump, nod: 0.07 * bump });
      else if (kind === MOVE.mantle) Object.assign(want, { dip: -0.32 * Math.sin(Math.min(1, t / 0.7) * Math.PI), nod: 0.16 * bump, roll: -0.02 * bump });
      else if (kind === MOVE.climb) Object.assign(want, { roll: Math.sin(own.y * 3.4) * 0.018 });
      else if (kind === MOVE.slide) Object.assign(want, { roll: -0.07 * (1 - t), fov: 0.09 * (1 - t), dip: -0.08 });
      const ease = Math.min(1, dt * (kind ? 22 : 10)) * this.comfort.shake + (1 - this.comfort.shake);
      for (const key of ['dip', 'roll', 'nod', 'fov'] as const) this.feel[key] += (want[key] * (key === 'dip' || key === 'fov' ? 1 : this.comfort.shake) - this.feel[key]) * Math.min(1, ease);
      this.camera.position.set(own.x + (Math.random() - 0.5) * s, own.y + this.eye + this.feel.dip + (Math.random() - 0.5) * s, own.z);
      this.camera.rotation.set(-frame.pitch - own.recoil + this.feel.nod, frame.yaw + own.recoilYaw, alive ? this.feel.roll : 0.25);
      const ads = this.viewmodel.adsBlend, target = (this.fov * Math.PI / 180) / (1 + (this.zoom - 1) * ads) + (Math.hypot(own.vx, own.vz) > 6 ? 0.04 : 0) + this.feel.fov;
      this.fovNow += (target - this.fovNow) * Math.min(1, dt * 16); this.camera.fov = this.fovNow;
      this.viewmodel.update(own, frame.now, dt, frame.look, this.comfort, !frame.unarmed);
      this.flashLight.position.copyFrom(this.viewmodel.muzzleWorld()); this.flashLight.intensity *= Math.exp(-dt * 60);
    } else {
      this.viewmodel.update({ health: 0 } as Player, 0, dt, frame.look, this.comfort, false);
      // Menu: a slow dolly through the junction at street height.
      // Ping-pong along an open route so the camera never passes through a building.
      const n = MENU_PATH.length - 1, wave = (this.renderTime * 0.012) % 2, t = (wave < 1 ? wave : 2 - wave) * n * 0.9999, i = Math.floor(t), f = t - i, at = (k: number) => MENU_PATH[Math.max(0, Math.min(n, k))];
      const pos = new Vector3(...(['x', 'y', 'z'] as const).map(axis => catmull(at(i - 1)[0][axis], at(i)[0][axis], at(i + 1)[0][axis], at(i + 2)[0][axis], f)) as [number, number, number]);
      const look = new Vector3(...(['x', 'y', 'z'] as const).map(axis => catmull(at(i - 1)[1][axis], at(i)[1][axis], at(i + 1)[1][axis], at(i + 2)[1][axis], f)) as [number, number, number]);
      this.camera.position.copyFrom(pos); this.camera.setTarget(look); this.camera.fov = 1.35; this.fovNow = this.fov * Math.PI / 180; this.flashLight.intensity = 0;
    }
    this.playingBefore = playing;
    const seen = new Set<string>(), targetTime = this.serverNow + (now - this.receivedAt) / 1000 - 0.1;
    const ownTeam = frame.own?.team;
    for (const player of frame.players) {
      if (player.id === frame.ownId && playing && !frame.cinematic) continue; if (frame.cinematic?.hide?.has(player.id)) continue; seen.add(player.id);
      let actor = this.actors.get(player.id);
      if (!actor) { actor = new Character(this.scene, player.team as Faction, player.id, frame.teamTags && player.team === ownTeam ? player.name : '', frame.melee?.has(player.id)); this.actors.set(player.id, actor); }
      let p: Player = player;
      if (frame.interpolate) { const history = this.histories.get(player.id) ?? []; for (let i = 0; i < history.length - 1; i++) { const a = history[i], b = history[i + 1]; if (a.at <= targetTime && b.at >= targetTime) { const k = (targetTime - a.at) / Math.max(0.001, b.at - a.at); p = { ...b.p, x: a.p.x + (b.p.x - a.p.x) * k, y: a.p.y + (b.p.y - a.p.y) * k, z: a.p.z + (b.p.z - a.p.z) * k, yaw: lerpAngle(a.p.yaw, b.p.yaw, k), pitch: a.p.pitch + (b.p.pitch - a.p.pitch) * k }; break; } } }
      actor.setEnabled(player.ready); actor.showTag(frame.teamTags && player.team === ownTeam);
      actor.update({ ...p, reloading: p.reloadUntil > frame.now ? 1 - (p.reloadUntil - frame.now) / 2 : 0, equipping: p.equipUntil > frame.now ? 1 : 0, traverseP: traverseProgress(p) }, dt);
    }
    for (const extra of frame.extras ?? []) {
      seen.add(extra.id); let actor = this.actors.get(extra.id);
      if (actor && actor.variant !== (extra.variant ?? 'default')) { actor.dispose(); actor = undefined; }
      if (!actor) { actor = new Character(this.scene, extra.faction, extra.id, extra.name ?? '', false, extra.variant); this.actors.set(extra.id, actor); }
      actor.update(extra.pose, dt);
    }
    for (const [id, actor] of this.actors) if (!seen.has(id)) { actor.dispose(); this.actors.delete(id); this.histories.delete(id); }
    for (const id of this.histories.keys()) if (!frame.players.some(p => p.id === id)) this.histories.delete(id);
    // Inside the bus the city is switched off altogether, so the interior shots are the cheapest in the prologue.
    const inBus = !!frame.cinematic && Math.abs(frame.cinematic.pos.z - BUS_SET.z) < 40; if (inBus !== this.inBus) { this.inBus = inBus; this.arena.setEnabled(!inBus); }
    this.bus.update(inBus, dt, this.arena.shown.city === 'dead');
    this.arena.update(this.renderTime, dt); this.effects.update(dt); this.spectacle.update(dt, this.camera.position);
    const before = this.engine._drawCalls.current; this.scene.render(); this.frameDrawCalls = this.engine._drawCalls.current - before;
  }
  /** Removes every dynamic actor and effect, used when leaving a mode so nothing stale carries over. */
  reset() { for (const actor of this.actors.values()) actor.dispose(); this.actors.clear(); this.histories.clear(); this.effects.clear(); this.spectacle.clear(); this.shake = 0; this.flashT = 0; this.blastT = 0; this.dust = 0; this.dustTo = 0; this.flickT = 0; }
  /**
   * Shows one map's arena. Other maps are built the first time they are needed (a story chapter set
   * elsewhere), then kept; switching re-bakes the sun shadows and moves the scene's warm lamp to suit.
   */
  useMap(id: string) {
    if (id === this.mapId || !MAPS[id]) return; this.mapId = id;
    let arena = this.arenas.get(id);
    if (!arena) { arena = new Arena(this.scene, this.textureSize, MAPS[id].world, id === 'ojuelegba' ? 'junction' : 'interior'); this.arenas.set(id, arena); for (const material of this.scene.materials) if (material instanceof StandardMaterial && !material.name.startsWith('character')) material.maxSimultaneousLights = 4; }
    for (const other of this.arenas.values()) other.setEnabled(other === arena);
    this.arena = arena;
    if (this.shadows) { const map = this.shadows.getShadowMap()!; map.renderList = [...arena.shadowCasters]; map.refreshRate = RenderTargetTexture.REFRESHRATE_RENDER_ONCE; }
    const inside = id !== 'ojuelegba'; this.sodium.position.set(0, inside ? 3.2 : 6.2, 0); this.sodium.range = inside ? 13 : 16; this.sodium.diffuse = Color3.FromHexString(inside ? '#d6e6ff' : '#ffab55');
  }
  /** Blends to a colour grade over `seconds`. */
  setGrade(grade: Grade, seconds = 1) { this.gradeTo = GRADES[grade]; this.gradeRate = 1 / Math.max(0.01, seconds); if (seconds <= 0.02) Object.assign(this.grade, this.gradeTo); }
  /** Blends the lighting between dusk and night over `seconds`. */
  setMood(mood: 'dusk' | 'night', seconds = 0) { this.nightTo = mood === 'night' ? 1 : 0; this.nightRate = 1 / Math.max(0.01, seconds); if (seconds <= 0) this.night = this.nightTo; }
  /** City life and lighting; see Arena.setCity. */
  setCity(state: CityState) { this.arena.setCity(state); }
  /** Story effects from cutscenes and mission beats. The blast also flashes the whole scene and blacks the city out. */
  fx(kind: CineFx, from?: Vec3, to?: Vec3, seconds?: number) {
    const at = from ?? { x: 0, y: 0, z: 0 };
    if (kind === 'skylight') this.spectacle.skylight(at, to ?? at, seconds);
    else if (kind === 'streak') this.spectacle.streak(at, to ?? at, seconds);
    else if (kind === 'explosion') { this.spectacle.explosion(at); this.flashT = 1; this.blastT = 1; }
    else if (kind === 'shatter') this.spectacle.shatter(at);
    else if (kind === 'dust') { this.spectacle.dust(at, to ?? this.camera.position); this.dustTo = 1; }
    else if (kind === 'wave') this.spectacle.wave(at, to ?? at, seconds ?? 3);
    else if (kind === 'embers') this.spectacle.embers(true);
    else if (kind === 'sparks') this.spectacle.sparks(at);
    else if (kind === 'flicker') this.flickT = seconds ?? 1.6;
    else if (kind === 'smoke') this.spectacle.smokeColumn(at, seconds ?? 30);
    else if (kind === 'blackout') this.arena.setCity('blackout');
    else if (kind === 'night') this.setMood('night', seconds ?? 6);
    else if (kind === 'city') this.arena.setCity('restored');
    else if (kind === 'live') { this.arena.setCity('restored'); this.arena.setRelay(true); this.arena.setCrowd(true); }
    else if (kind === 'jam') { this.flickT = 0; this.arena.setCity('dead'); this.arena.setRelay(false); }
  }
  /**
   * Cutscene lighting. The key sits 40° to one side of the camera and 30° up, so faces get shape; the rim comes
   * from behind the subject on the other side and separates the cast from a dark street. Both grow at night, when
   * the scene lights alone leave characters as silhouettes, and the exposure floor keeps the frame readable.
   */
  private lightRig(c: Frame['cinematic'], dt: number) {
    const r = this.rig, n = this.night, k = Math.min(1, dt * 4);
    r.on += ((c ? 1 : 0) - r.on) * (c ? 1 : k);
    r.key += ((c ? (c.light?.key ?? 1) * (0.9 + n * 0.75) : 0) - r.key) * k; r.rim += ((c ? (c.light?.rim ?? 1) * (1.0 + n * 0.9) : 0) - r.rim) * k;
    r.floor = c ? c.exposure ?? 1.12 + n * 0.3 : 0;
    const on = r.on > 0.01; this.key.setEnabled(on); this.rim.setEnabled(on); if (!on) return;
    if (c) {
      const fx = c.look.x - c.pos.x, fz = c.look.z - c.pos.z, h = Math.hypot(fx, fz) || 1, f = { x: fx / h, z: fz / h }, side = c.light?.side ?? 1, right = { x: f.z * side, z: -f.x * side };
      const dir = (back: number, across: number, up: number) => { const x = back * f.x + across * right.x, z = back * f.z + across * right.z, l = Math.hypot(x, z) || 1, e = Math.cos(up); return new Vector3(x / l * e, -Math.sin(up), z / l * e); };
      // Directions are where the light travels: the key from camera side toward the subject, the rim from beyond it toward the camera.
      this.key.direction = dir(Math.cos(0.7), -Math.sin(0.7), 0.52); this.rim.direction = dir(-Math.cos(0.6), Math.sin(0.6), 0.35);
      this.rim.diffuse = Color3.Lerp(Color3.FromHexString('#ffd4a6'), Color3.FromHexString('#a9c2ff'), n); this.rim.specular = this.rim.diffuse.scale(0.6);
    }
    // In the bus the light on a face comes and goes with what the windows are passing.
    this.key.intensity = r.key * r.on * (this.inBus ? this.bus.flicker : 1); this.rim.intensity = r.rim * r.on * (this.inBus ? 0.6 + this.bus.flicker * 0.5 : 1);
  }
  /** Grade, time-of-day and flash blending, once per frame. */
  private atmosphere(dt: number) {
    const g = this.grade, to = this.gradeTo, k = Math.min(1, dt * this.gradeRate * 3);
    for (const key of Object.keys(g) as (keyof typeof g)[]) g[key] += (to[key] - g[key]) * k;
    this.flashT *= Math.exp(-dt * 3.2); if (this.flashT < 0.002) this.flashT = 0;
    // The blast is a second sun: it lights the city from the north, orange, and takes a long time to go down.
    this.blastT *= Math.exp(-dt * 0.3); if (this.blastT < 0.002) this.blastT = 0; this.dust += (this.dustTo - this.dust) * Math.min(1, dt * 1.6);
    if (this.flickT > 0) { this.flickT -= dt; this.arena.setRelay(this.flickT <= 0 || Math.random() < 0.55); }
    const ip = this.scene.imageProcessingConfiguration; ip.exposure = Math.max(g.exposure, this.rig.floor * this.rig.on) + this.flashT * 2.4; ip.contrast = g.contrast; ip.vignetteWeight = g.vignette;
    this.curves.globalHue = g.hue; this.curves.globalDensity = g.density; this.curves.globalSaturation = g.saturation - this.flashT * 60;
    if (this.night !== this.nightTo) this.night += Math.sign(this.nightTo - this.night) * Math.min(Math.abs(this.nightTo - this.night), dt * this.nightRate);
    this.arena.ambientLight(this.night);
    const n = this.night, d = MOODS.dusk, m = MOODS.night, mix = (a: number, b: number) => a + (b - a) * n, color = (a: string, b: string) => Color3.Lerp(Color3.FromHexString(a), Color3.FromHexString(b), n);
    const b = this.blastT; this.sun.intensity = mix(d.sun, m.sun) + b * 3.4; this.sun.diffuse = Color3.Lerp(color(d.sunColor, m.sunColor), Color3.FromHexString('#ff9a4a'), Math.min(1, b * 1.6)); this.sun.direction.copyFrom(Vector3.Lerp(SUN_DIRECTION, BLAST_DIRECTION, Math.min(1, b * 2)).normalize()); this.skyLight.intensity = mix(d.sky, m.sky) + this.flashT * 5 + b * 0.5; this.skyLight.diffuse = color(d.skyColor, m.skyColor); this.skyLight.groundColor = color(d.ground, m.ground);
    // Indoors the lamp is a failing fluorescent tube: it stutters now and then.
    const stutter = this.mapId !== 'ojuelegba' && Math.sin(this.renderTime * 13) * Math.sin(this.renderTime * 2.3) > 0.82 ? 0.25 : 1;
    this.sodium.intensity = mix(d.sodium, m.sodium) * stutter * (1 - this.dust * 0.7); const fire = Math.min(1, b * 1.3) * (1 - this.dust), tint = (i: number, a: number, c: number) => (mix(d.fog[i], m.fog[i]) * (1 - fire) + a * fire) * (1 - this.dust) + c * this.dust;
    this.scene.fogColor.set(tint(0, 0.82, 0.38), tint(1, 0.36, 0.28), tint(2, 0.12, 0.2)); this.scene.fogDensity = this.fogBase + this.dust * 0.05; this.scene.clearColor.set(this.scene.fogColor.r, this.scene.fogColor.g, this.scene.fogColor.b, 1);
    const dip = n < 0.5 ? 1 - n * 1.4 : 0.3 + (n - 0.5) * 1.4; const dome = this.skyMat.emissiveTexture = this.skies[n > 0.5 ? 1 : 0]; dome.level = dip + b * 1.1 + this.flashT; this.sunDisc.setEnabled(n < 0.5);
  }
  /** Development overlay: collision boxes and spawn points drawn as wireframes. */
  debug(show: boolean) {
    for (const mesh of this.debugMeshes) mesh.dispose(); this.debugMeshes = []; if (!show) return;
    const wire = new StandardMaterial('debug-wire', this.scene); wire.wireframe = true; wire.emissiveColor = new Color3(0.2, 1, 0.4); wire.disableLighting = true;
    for (const b of WORLD) { if (b.kind === 'ground') continue; const mesh = MeshBuilder.CreateBox('debug', { width: b.w, height: b.h, depth: b.d }, this.scene); mesh.position.set(b.x, b.y, b.z); mesh.material = wire; mesh.isPickable = false; this.debugMeshes.push(mesh); }
    const spawn = new StandardMaterial('debug-spawn', this.scene); spawn.emissiveColor = new Color3(1, 0.8, 0.1); spawn.disableLighting = true;
    for (const [team, points] of SPAWNS.entries()) for (const p of points) { const mesh = MeshBuilder.CreateCylinder('debug-spawn', { diameter: 0.7, height: 1.8 }, this.scene); mesh.position.set(p.x, 0.9, p.z); mesh.material = team ? wire : spawn; mesh.isPickable = false; this.debugMeshes.push(mesh); }
  }
  diagnostics() { const samples = [...this.frameSamples].sort((a, b) => a - b); return { ready: this.scene.isReady(), samples: samples.length, medianMs: samples[Math.floor(samples.length * 0.5)] ?? 0, p95Ms: samples[Math.floor(samples.length * 0.95)] ?? 0, fps: this.engine.getFps(), meshes: this.scene.meshes.length, activeMeshes: this.scene.getActiveMeshes().length, drawCalls: this.frameDrawCalls, actors: this.actors.size }; }
  listener(): Vec3 & { yaw: number } { const p = this.camera.position; return { x: p.x, y: p.y, z: p.z, yaw: this.camera.rotation.y }; }
}
function lerpAngle(a: number, b: number, t: number) { let d = b - a; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return a + d * t; }
