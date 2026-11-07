import type { CineSound, SoundMood, Vec3 } from '@lastbus/shared';
import { wavFile, type RadioOutput, type RadioState } from './soundtrack.js';
export type Sound = 'rifle' | 'sidearm' | 'empty' | 'magout' | 'magin' | 'bolt' | 'slide' | 'switch' | 'hit' | 'headshot' | 'kill' | 'hurt' | 'step' | 'step-metal' | 'step-wood' | 'step-dirt' | 'step-tile' | 'land' | 'noticed' | 'spotted' | 'ui' | 'ui-move' | 'respawn' | 'match' | 'objective' | 'radio' | 'impact' | 'denied' | 'slash' | 'vault' | 'mantle' | 'rung' | 'pipe' | 'slide';
export type Bus = 'music' | 'ambience' | 'effects' | 'ui' | 'dialogue';
/** The acoustic space sounds play in: the open junction (long tail, slapback off the buildings) or a room. */
export type Space = 'street' | 'interior';
const SPACES: Record<Space, { seconds: number; decay: number; taps: number[]; slap: number; slapGain: number; send: number }> = {
  street: { seconds: 2.4, decay: 3.4, taps: [0.07, 0.13, 0.22, 0.36], slap: 0.17, slapGain: 0.26, send: 1 },
  interior: { seconds: 0.9, decay: 4.5, taps: [0.012, 0.021, 0.034], slap: 0.03, slapGain: 0.12, send: 0.8 }
};
type Layer = 'traffic' | 'hiss' | 'wind' | 'murmur' | 'walla' | 'room' | 'tube' | 'mains' | 'hum' | 'engine' | 'generators';
interface Bed { fades: GainNode[]; filter?: BiquadFilterNode; level: number; stop(): void; timer?: ReturnType<typeof setTimeout> }
/** Looping layers: source, filter and how fast a slow swell moves through them. The other layers are built in `bed()`. */
const BEDS: Partial<Record<Layer, { buffer: 'noise' | 'brown' | 'crowd'; type: BiquadFilterType; frequency: number; lfo: number }>> = {
  traffic: { buffer: 'brown', type: 'lowpass', frequency: 320, lfo: 0.05 }, hiss: { buffer: 'noise', type: 'bandpass', frequency: 520, lfo: 0.13 }, wind: { buffer: 'noise', type: 'lowpass', frequency: 380, lfo: 0.07 },
  murmur: { buffer: 'brown', type: 'bandpass', frequency: 520, lfo: 0.9 }, walla: { buffer: 'crowd', type: 'bandpass', frequency: 1100, lfo: 0.21 }, room: { buffer: 'brown', type: 'lowpass', frequency: 160, lfo: 0.03 }, tube: { buffer: 'noise', type: 'bandpass', frequency: 120, lfo: 0.5 }
};
/**
 * What each mood sounds like. A level is a gain, or a gain and a filter frequency for that layer. `every` is the least wait and the
 * spread between random events in ms, `reach` how far off they happen, `stagger` scales how long a layer takes to reach its level.
 * 'dusk' is the dead-network junction: traffic bed, wind and positional generators. 'restored' is the city back on air at night.
 * 'shelter' is a damaged room. 'live' is the ordinary evening: heavier traffic, market, crowd and hawkers close by. 'ride' is that
 * from inside a bus, with its engine. 'hush' is the street emptying out, the first things to go going fastest, as a low hum rises.
 * 'still' is what is left when the engine dies.
 */
const MOODS: Record<SoundMood, { layers: Partial<Record<Layer, number | [number, number]>>; every: [number, number]; reach?: number; space?: Space; stagger?: Partial<Record<Layer, number>> }> = {
  dusk: { layers: { traffic: [0.22, 320], hiss: 0.012, wind: 0.03, generators: 1 }, every: [3000, 6000] },
  restored: { layers: { traffic: [0.32, 420], hiss: 0.02, wind: 0.03, murmur: 0.06, generators: 1 }, every: [1200, 2800] },
  shelter: { layers: { room: 0.16, tube: 0.01, mains: 0.004 }, every: [4000, 6000], space: 'interior' },
  live: { layers: { traffic: [0.34, 520], hiss: 0.024, wind: 0.02, murmur: 0.07, walla: 0.2, generators: 1 }, every: [700, 1700], reach: 30 },
  ride: { layers: { traffic: [0.26, 320], hiss: 0.016, murmur: 0.05, walla: 0.13, engine: 0.05 }, every: [1400, 2400], reach: 40 },
  hush: { layers: { traffic: [0.04, 220], wind: 0.016, engine: 0.05, hum: 0.04 }, every: [7000, 6000], reach: 70, stagger: { walla: 0.45, murmur: 0.45, hiss: 0.6, hum: 1.3 } },
  still: { layers: { traffic: [0.008, 200], wind: 0.01, hum: 0.03 }, every: [60000, 0] }
};
/** First two formants of the five vowels, shared by the crowd and the hawkers. */
const VOWELS = [[730, 1090], [270, 2290], [530, 1840], [570, 840], [300, 870]];
/** A crowd too far off to make out: fourteen invented voices saying vowels at speaking pace, wrapped so the loop has no seam. */
function crowdSamples(rate: number, seconds: number) {
  const data = new Float32Array(Math.floor(rate * seconds));
  for (let v = 0; v < 14; v++) {
    const f0 = 95 + Math.random() * 130; let at = Math.floor(Math.random() * data.length), left = data.length;
    while (left > 0) {
      const length = Math.floor((0.11 + Math.random() * 0.17) * rate), gap = Math.floor((Math.random() < 0.16 ? 0.4 : 0.02) * rate), [a, b] = VOWELS[Math.floor(Math.random() * VOWELS.length)], level = 0.5 + Math.random() * 0.5;
      const r = 0.965, ca = 2 * r * Math.cos(2 * Math.PI * a / rate), cb = 2 * r * Math.cos(2 * Math.PI * b / rate); let phase = 0, a1 = 0, a2 = 0, b1 = 0, b2 = 0;
      for (let i = 0; i < length; i++) {
        phase += f0 * (1 + 0.1 * Math.sin(i / length * Math.PI)) / rate; const pulse = phase >= 1 ? 1 : 0; if (pulse) phase -= 1;
        const ya = ca * a1 - r * r * a2 + pulse, yb = cb * b1 - r * r * b2 + pulse; a2 = a1; a1 = ya; b2 = b1; b1 = yb;
        data[(at + i) % data.length] += (ya + yb * 0.6) * Math.sin(i / length * Math.PI) * level;
      }
      at += length + gap; left -= length + gap;
    }
  }
  const peak = data.reduce((p, v) => Math.max(p, Math.abs(v)), 0) || 1; for (let i = 0; i < data.length; i++) data[i] /= peak; return data;
}
const RADIO_OPEN = 3100, RADIO_MUFFLED = 620;
interface Speaker { input: GainNode; low: BiquadFilterNode; gate: GainNode; out: GainNode; panner: PannerNode; dispose(): void }
interface Deck { music: Speaker; talk: Speaker; song: GainNode; hiss: GainNode; buzz: GainNode; signal: number; from: number; to: number; at: number; seconds: number; timer: ReturnType<typeof setInterval>; dispose(): void }
/**
 * Fully synthesized audio, so there are no files to go missing. Each category
 * has its own bus and volume. World sounds use HRTF panners driven by the
 * camera position and can send to a shared space (convolution reverb plus a
 * slapback delay) that returns into the effects bus; the mix is compressed so
 * gunfire never clips.
 */
export class GameAudio implements RadioOutput {
  private ctx?: AudioContext; private out?: GainNode; private buses = new Map<Bus, GainNode>();
  private levels: Record<Bus | 'master', number> = { master: 0.7, music: 0.45, ambience: 0.6, effects: 0.85, ui: 0.8, dialogue: 0.9 };
  private noise?: AudioBuffer; private brown?: AudioBuffer; private voices = 0;
  private beds = new Map<Layer, Bed>(); private ambientTimer?: ReturnType<typeof setTimeout>; private playing?: SoundMood; private chatter?: AudioBuffer;
  private deaf?: BiquadFilterNode; private deck?: Deck; private tapeEl?: HTMLAudioElement; private tapeNode?: MediaElementAudioSourceNode; private tapeStart = 0; private tapeEnd = 0; private dead?: () => void;
  private music?: { stop(): void; kind: string };
  private listener: Vec3 & { yaw: number } = { x: 0, y: 1.6, z: 0, yaw: 0 };
  private send?: GainNode; private reverb?: ConvolverNode; private slap?: DelayNode; private slapGain?: GainNode; private space: Space = 'street'; private meter?: AnalyserNode;
  get ready() { return this.ctx?.state === 'running'; }
  level(bus: Bus | 'master', value: number) {
    this.levels[bus] = value; if (!this.ctx) return;
    if (bus === 'master') this.out?.gain.setTargetAtTime(value, this.ctx.currentTime, 0.02); else this.buses.get(bus)?.gain.setTargetAtTime(value, this.ctx.currentTime, 0.02);
  }
  async unlock() {
    if (!this.ctx) {
      const ctx = this.ctx = new AudioContext(); const compressor = ctx.createDynamicsCompressor();
      compressor.threshold.value = -14; compressor.ratio.value = 4; compressor.attack.value = 0.003; compressor.release.value = 0.2;
      // After the glue compressor, a fast limiter and a soft clip catch transients (the blast, a pistol at point blank) it lets through.
      const limiter = ctx.createDynamicsCompressor(); limiter.threshold.value = -3; limiter.knee.value = 0; limiter.ratio.value = 20; limiter.attack.value = 0.001; limiter.release.value = 0.08;
      const clip = ctx.createWaveShaper(), curve = new Float32Array(1024); for (let i = 0; i < curve.length; i++) { const x = i / 512 - 1; curve[i] = Math.tanh(x * 1.2) / Math.tanh(1.2) * 0.97; } clip.curve = curve;
      this.out = ctx.createGain(); this.out.gain.value = this.levels.master; this.deaf = ctx.createBiquadFilter(); this.deaf.type = 'lowpass'; this.deaf.frequency.value = 20000; this.out.connect(this.deaf); this.deaf.connect(compressor); compressor.connect(limiter); limiter.connect(clip); clip.connect(ctx.destination);
      this.meter = ctx.createAnalyser(); this.meter.fftSize = 2048; this.meter.smoothingTimeConstant = 0; clip.connect(this.meter);
      for (const bus of ['music', 'ambience', 'effects', 'ui', 'dialogue'] as Bus[]) { const gain = ctx.createGain(); gain.gain.value = this.levels[bus]; gain.connect(this.out); this.buses.set(bus, gain); }
      this.noise = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate); const white = this.noise.getChannelData(0); for (let i = 0; i < white.length; i++) white[i] = Math.random() * 2 - 1;
      this.brown = ctx.createBuffer(1, ctx.sampleRate * 4, ctx.sampleRate); const brown = this.brown.getChannelData(0); let last = 0;
      for (let i = 0; i < brown.length; i++) { last = (last + (Math.random() * 2 - 1) * 0.02) / 1.02; brown[i] = last * 3.5; }
      // The shared space: a reverb and a darker slapback, both returning into the effects bus so its volume and ducking apply.
      const effects = this.buses.get('effects')!; this.send = ctx.createGain(); this.reverb = ctx.createConvolver(); const wet = ctx.createGain(); wet.gain.value = 0.5;
      this.send.connect(this.reverb); this.reverb.connect(wet); wet.connect(effects);
      this.slap = ctx.createDelay(1); const tone = ctx.createBiquadFilter(); tone.type = 'lowpass'; tone.frequency.value = 1800; this.slapGain = ctx.createGain();
      this.send.connect(this.slap); this.slap.connect(tone); tone.connect(this.slapGain); this.slapGain.connect(effects);
      this.environment(this.space, true);
      // Phones only let an audio element play later if it first played inside a gesture, and this is one. Half a millisecond of silence does it.
      const tape = this.tapeEl = new Audio(); tape.src = URL.createObjectURL(wavFile(new Int16Array(8))); void tape.play().then(() => tape.pause()).catch(() => { /* Autoplay policy; the scene plays on without a song. */ });
    }
    if (this.ctx.state === 'suspended') { try { await this.ctx.resume(); } catch { /* Autoplay policy; the next gesture retries. */ } }
  }
  /** Switches the acoustic space; the impulse response is rebuilt from noise, early reflections and an exponential decay. */
  environment(space: Space, force = false) {
    if (space === this.space && !force) return; this.space = space; if (!this.ctx || !this.reverb) return;
    const ctx = this.ctx, s = SPACES[space], length = Math.floor(ctx.sampleRate * s.seconds), ir = ctx.createBuffer(2, length, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const data = ir.getChannelData(c);
      for (let i = 0; i < length; i++) { const t = i / ctx.sampleRate; data[i] = (Math.random() * 2 - 1) * Math.exp(-t * s.decay) * (t < 0.008 ? t / 0.008 : 1) * 0.5; }
      for (const tap of s.taps) { const i = Math.floor((tap + c * 0.004) * ctx.sampleRate); if (i < length) data[i] += (c ? -0.6 : 0.6) * Math.exp(-tap * 2); }
    }
    this.reverb.buffer = ir; this.slap!.delayTime.value = s.slap; this.slapGain!.gain.value = s.slapGain;
  }
  /** Development: the current output peak (0..1), for checking levels and ducking in automated runs. */
  peak() { if (!this.meter) return 0; const data = new Float32Array(this.meter.fftSize); this.meter.getFloatTimeDomainData(data); let p = 0; for (const v of data) p = Math.max(p, Math.abs(v)); return p; }
  setListener(position: Vec3, yaw: number) {
    if (![position.x, position.y, position.z, yaw].every(Number.isFinite)) return;
    // Copy fields explicitly: spreading a Babylon Vector3 copies its private storage, not x/y/z.
    this.listener = { x: position.x, y: position.y, z: position.z, yaw }; const l = this.ctx?.listener; if (!l || !this.ctx) return; this.dashboard();
    const t = this.ctx.currentTime;
    if (l.positionX) { l.positionX.setValueAtTime(position.x, t); l.positionY.setValueAtTime(position.y, t); l.positionZ.setValueAtTime(-position.z, t); l.forwardX.setValueAtTime(Math.sin(yaw), t); l.forwardY.setValueAtTime(0, t); l.forwardZ.setValueAtTime(-Math.cos(yaw), t); l.upX.setValueAtTime(0, t); l.upY.setValueAtTime(1, t); l.upZ.setValueAtTime(0, t); }
    else l.setPosition(position.x, position.y, -position.z);
  }
  /**
   * Destination for one sound: the bus directly, or an HRTF panner placed in the world. Babylon is left-handed, Web
   * Audio right-handed, so z is mirrored for both. `send` feeds the shared space; far sounds send more, so a distant
   * shot is mostly echo.
   */
  private route(bus: Bus, at?: Vec3, reach = 60, send = 0) {
    const ctx = this.ctx!, target = this.buses.get(bus)!, input = ctx.createGain(), nodes: AudioNode[] = [input];
    let tail: AudioNode = input, distance = 0, panner: PannerNode | undefined;
    if (at) {
      panner = ctx.createPanner(); panner.panningModel = 'HRTF'; panner.distanceModel = 'inverse'; panner.refDistance = 3; panner.rolloffFactor = 1.1; panner.maxDistance = reach;
      if (panner.positionX) { panner.positionX.value = at.x; panner.positionY.value = at.y; panner.positionZ.value = -at.z; } else panner.setPosition(at.x, at.y, -at.z);
      // Distant sounds lose their high end over the street.
      distance = Math.hypot(at.x - this.listener.x, at.z - this.listener.z); const filter = ctx.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = Math.max(900, 16000 - distance * 260);
      input.connect(filter); filter.connect(panner); tail = panner; nodes.push(filter, panner);
    }
    tail.connect(target);
    if (send > 0 && this.send) { const s = ctx.createGain(); s.gain.value = send * SPACES[this.space].send * (1 + distance / 30); tail.connect(s); s.connect(this.send); nodes.push(s); }
    return { node: input as AudioNode, panner, dispose: () => { for (const n of nodes) n.disconnect(); } };
  }
  private burst(dest: AudioNode, start: number, length: number, gain: number, type: BiquadFilterType, frequency: number, q = 0.8, sweep?: number) {
    const ctx = this.ctx!, source = ctx.createBufferSource(), filter = ctx.createBiquadFilter(), amp = ctx.createGain();
    source.buffer = this.noise!; source.playbackRate.value = 0.8 + Math.random() * 0.4; filter.type = type; filter.frequency.setValueAtTime(frequency, start); filter.Q.value = q;
    if (sweep) filter.frequency.exponentialRampToValueAtTime(sweep, start + length);
    amp.gain.setValueAtTime(0.0001, start); amp.gain.exponentialRampToValueAtTime(gain, start + 0.002); amp.gain.exponentialRampToValueAtTime(0.0001, start + length);
    source.connect(filter); filter.connect(amp); amp.connect(dest); source.start(start, Math.random()); source.stop(start + length + 0.02);
    return source;
  }
  private toneAt(dest: AudioNode, start: number, length: number, gain: number, type: OscillatorType, from: number, to = from) {
    const ctx = this.ctx!, osc = ctx.createOscillator(), amp = ctx.createGain();
    osc.type = type; osc.frequency.setValueAtTime(from, start); if (to !== from) osc.frequency.exponentialRampToValueAtTime(to, start + length);
    amp.gain.setValueAtTime(0.0001, start); amp.gain.exponentialRampToValueAtTime(gain, start + 0.004); amp.gain.exponentialRampToValueAtTime(0.0001, start + length);
    osc.connect(amp); amp.connect(dest); osc.start(start); osc.stop(start + length + 0.02);
    return osc;
  }
  /** Small metal clinks of kit on a moving body: sling swivels, magazines in pouches. */
  private rattle(dest: AudioNode, start: number, count: number, gain: number) { const parts: AudioScheduledSourceNode[] = []; for (let i = 0; i < count; i++) parts.push(this.burst(dest, start + Math.random() * 0.12, 0.018, gain * (0.6 + Math.random() * 0.4), 'bandpass', 4200 + Math.random() * 2400, 7)); return parts; }
  play(kind: Sound, at?: Vec3, volume = 1) {
    if (!this.ctx || this.ctx.state !== 'running' || this.voices > 40) return;
    const bus: Bus = ['hit', 'headshot', 'kill', 'ui', 'ui-move', 'objective', 'match', 'denied', 'noticed', 'spotted'].includes(kind) ? 'ui' : kind === 'radio' ? 'dialogue' : 'effects';
    const gun = kind === 'rifle' || kind === 'sidearm', send = gun ? 0.6 : kind === 'impact' || kind === 'land' ? 0.25 : kind.startsWith('step') ? 0.08 : bus === 'effects' ? 0.12 : 0;
    const { node, dispose } = this.route(bus, at, gun ? 140 : 40, send), t = this.ctx.currentTime, v = volume * (0.92 + Math.random() * 0.16), parts: AudioScheduledSourceNode[] = [];
    const step = (heel: number, ...extra: AudioScheduledSourceNode[]) => parts.push(this.toneAt(node, t, 0.05, 0.07 * v, 'sine', 95, 55), this.burst(node, t, 0.05, heel * v, 'lowpass', 700 + Math.random() * 300, 0.8), ...extra, ...(v > 1 ? this.rattle(node, t + 0.02, 2, 0.05 * v) : []));
    switch (kind) {
      // Gunfire: supersonic crack, the report's body, a sub thump, the action cycling and a tail that the space carries on.
      case 'rifle':
        parts.push(this.burst(node, t, 0.035, 0.85 * v, 'highpass', 3200), this.burst(node, t, 0.13, 1.0 * v, 'bandpass', 950, 0.6, 380), this.toneAt(node, t, 0.16, 0.95 * v, 'sine', 120, 36), this.toneAt(node, t, 0.22, 0.35 * v, 'triangle', 62, 30),
          this.burst(node, t + 0.028, 0.02, 0.22 * v, 'bandpass', 2700, 3), this.toneAt(node, t + 0.03, 0.035, 0.05 * v, 'triangle', 1900), this.burst(node, t + 0.03, 0.65, 0.26 * v, 'lowpass', 1100, 0.5, 180)); break;
      case 'sidearm':
        parts.push(this.burst(node, t, 0.025, 0.9 * v, 'highpass', 4200), this.burst(node, t, 0.08, 0.85 * v, 'bandpass', 1700, 0.7, 650), this.toneAt(node, t, 0.1, 0.7 * v, 'sine', 170, 55),
          this.burst(node, t + 0.02, 0.016, 0.2 * v, 'bandpass', 3300, 3), this.burst(node, t + 0.02, 0.4, 0.16 * v, 'lowpass', 1300, 0.5, 260)); break;
      case 'empty': parts.push(this.burst(node, t, 0.012, 0.25 * v, 'highpass', 5000), this.toneAt(node, t, 0.03, 0.05 * v, 'square', 2400), this.burst(node, t + 0.02, 0.03, 0.1 * v, 'bandpass', 1800, 2)); break;
      // Reload foley: catch, slide, seat and latch, each a separate little event a few milliseconds apart.
      case 'magout': parts.push(this.burst(node, t, 0.012, 0.45 * v, 'bandpass', 3200, 4), this.burst(node, t + 0.012, 0.09, 0.3 * v, 'bandpass', 1500, 1.2, 2600), this.toneAt(node, t + 0.015, 0.14, 0.06 * v, 'triangle', 1650, 1480), this.burst(node, t + 0.05, 0.08, 0.18 * v, 'lowpass', 600)); break;
      case 'magin': parts.push(this.burst(node, t, 0.06, 0.22 * v, 'bandpass', 1200, 1, 2000), this.burst(node, t + 0.06, 0.025, 0.8 * v, 'bandpass', 2400, 2), this.burst(node, t + 0.09, 0.01, 0.5 * v, 'highpass', 4200), this.toneAt(node, t + 0.06, 0.09, 0.07 * v, 'triangle', 1900), this.toneAt(node, t + 0.06, 0.06, 0.12 * v, 'sine', 160, 90)); break;
      case 'bolt': parts.push(this.burst(node, t, 0.08, 0.35 * v, 'bandpass', 1800, 1, 3200), this.toneAt(node, t, 0.08, 0.03 * v, 'triangle', 900, 1400), this.burst(node, t + 0.11, 0.03, 0.85 * v, 'bandpass', 2600, 1.5), this.toneAt(node, t + 0.11, 0.12, 0.09 * v, 'triangle', 1350), this.burst(node, t + 0.115, 0.05, 0.2 * v, 'lowpass', 500)); break;
      case 'slide': parts.push(this.burst(node, t, 0.05, 0.4 * v, 'bandpass', 2400, 1, 3600), this.burst(node, t + 0.075, 0.025, 0.75 * v, 'bandpass', 3200, 1.5), this.toneAt(node, t + 0.075, 0.07, 0.06 * v, 'triangle', 2100)); break;
      case 'switch': parts.push(this.burst(node, t, 0.18, 0.2 * v, 'bandpass', 700, 0.6, 1100), this.burst(node, t + 0.12, 0.02, 0.4 * v, 'bandpass', 2600, 2), ...this.rattle(node, t + 0.05, 3, 0.08 * v)); break;
      case 'impact': parts.push(this.burst(node, t, 0.05, 0.35 * v, 'bandpass', 1900 + Math.random() * 900, 1.2), this.burst(node, t + 0.01, 0.12, 0.12 * v, 'lowpass', 900)); break;
      // Footsteps by surface: a heel thud with a surface layer on top, and kit rattling at a run.
      case 'step': step(0.2, this.burst(node, t + 0.06, 0.035, 0.08 * v, 'bandpass', 2300, 0.9)); break;
      case 'step-dirt': step(0.16, ...[0, 0.02, 0.045, 0.07].map(o => this.burst(node, t + o, 0.025, 0.09 * v, 'bandpass', 3000 + Math.random() * 1500, 0.7))); break;
      case 'step-wood': step(0.16, this.toneAt(node, t, 0.09, 0.08 * v, 'triangle', 190, 150), this.burst(node, t, 0.07, 0.12 * v, 'bandpass', 600, 1.4)); break;
      case 'step-tile': step(0.14, this.burst(node, t, 0.02, 0.14 * v, 'highpass', 2600), this.burst(node, t + 0.05, 0.03, 0.06 * v, 'bandpass', 1500, 1.5)); break;
      case 'step-metal': step(0.12, this.burst(node, t, 0.05, 0.2 * v, 'bandpass', 1400, 1.5), this.toneAt(node, t, 0.16, 0.05 * v, 'triangle', 420, 380), this.toneAt(node, t, 0.1, 0.02 * v, 'triangle', 1230)); break;
      case 'land': parts.push(this.burst(node, t, 0.12, 0.35 * v, 'lowpass', 400), this.toneAt(node, t, 0.12, 0.25 * v, 'sine', 80, 45), this.burst(node, t + 0.02, 0.06, 0.1 * v, 'bandpass', 2400, 0.8), ...this.rattle(node, t + 0.03, 4, 0.07 * v)); break;
      case 'hit': parts.push(this.toneAt(node, t, 0.05, 0.16 * v, 'triangle', 2600, 2300)); break;
      case 'headshot': parts.push(this.toneAt(node, t, 0.05, 0.16 * v, 'triangle', 3100, 2900), this.toneAt(node, t + 0.045, 0.07, 0.14 * v, 'triangle', 3600, 3300)); break;
      case 'kill': parts.push(this.toneAt(node, t, 0.06, 0.15 * v, 'triangle', 2700), this.toneAt(node, t + 0.05, 0.3, 0.09 * v, 'sine', 880, 860)); break;
      case 'hurt': parts.push(this.toneAt(node, t, 0.18, 0.35 * v, 'sine', 110, 55), this.burst(node, t, 0.12, 0.25 * v, 'lowpass', 600), this.burst(node, t, 0.08, 0.08 * v, 'bandpass', 1400, 0.7)); break;
      case 'ui': parts.push(this.toneAt(node, t, 0.06, 0.06 * v, 'sine', 880, 990)); break;
      case 'ui-move': parts.push(this.toneAt(node, t, 0.03, 0.025 * v, 'sine', 1320)); break;
      // Being noticed: a quiet rising pair, then a hard stab when a hunter has you.
      case 'noticed': parts.push(this.toneAt(node, t, 0.14, 0.05 * v, 'sine', 320, 420), this.toneAt(node, t + 0.12, 0.16, 0.05 * v, 'sine', 420, 540)); break;
      case 'spotted': parts.push(this.toneAt(node, t, 0.3, 0.16 * v, 'sawtooth', 196, 185), this.toneAt(node, t, 0.3, 0.13 * v, 'sawtooth', 208, 196), this.burst(node, t, 0.12, 0.2 * v, 'lowpass', 500)); break;
      case 'denied': parts.push(this.toneAt(node, t, 0.12, 0.06 * v, 'square', 220, 180)); break;
      case 'respawn': parts.push(this.toneAt(node, t, 0.35, 0.05 * v, 'sine', 440, 660)); break;
      case 'match': parts.push(this.toneAt(node, t, 0.5, 0.07 * v, 'sine', 523), this.toneAt(node, t + 0.12, 0.5, 0.06 * v, 'sine', 784)); break;
      case 'objective': parts.push(this.toneAt(node, t, 0.4, 0.07 * v, 'sine', 659), this.toneAt(node, t + 0.1, 0.6, 0.06 * v, 'sine', 988), this.toneAt(node, t + 0.1, 0.6, 0.02 * v, 'triangle', 1976)); break;
      case 'slash': parts.push(this.burst(node, t, 0.22, 0.45 * v, 'bandpass', 900, 1.2, 4200), this.burst(node, t + 0.05, 0.12, 0.25 * v, 'highpass', 3000)); break;
      // Traversal: cloth moving, a hand slapping the top, the body landing; rungs ring, pipes boom hollow, a slide scrapes.
      case 'vault': parts.push(this.burst(node, t, 0.18, 0.22 * v, 'bandpass', 900, 0.7, 2200), this.burst(node, t + 0.05, 0.025, 0.4 * v, 'bandpass', 1200, 0.8), this.burst(node, t + 0.09, 0.05, 0.45 * v, 'lowpass', 700), this.toneAt(node, t + 0.09, 0.07, 0.12 * v, 'sine', 120, 70), ...this.rattle(node, t + 0.1, 2, 0.06 * v)); break;
      case 'mantle': parts.push(this.burst(node, t, 0.05, 0.4 * v, 'lowpass', 800), this.burst(node, t, 0.025, 0.3 * v, 'bandpass', 1300, 0.8), this.burst(node, t + 0.04, 0.32, 0.12 * v, 'bandpass', 1400, 0.8, 700), this.burst(node, t + 0.3, 0.06, 0.3 * v, 'lowpass', 500)); break;
      case 'rung': parts.push(this.burst(node, t, 0.03, 0.35 * v, 'bandpass', 2100, 3), this.toneAt(node, t, 0.2, 0.06 * v, 'triangle', 760, 730), this.toneAt(node, t, 0.12, 0.02 * v, 'triangle', 2290)); break;
      case 'pipe': parts.push(this.burst(node, t, 0.04, 0.3 * v, 'bandpass', 1300, 2), this.toneAt(node, t, 0.3, 0.05 * v, 'triangle', 330, 320), this.toneAt(node, t, 0.25, 0.03 * v, 'sine', 165)); break;
      case 'slide': parts.push(this.burst(node, t, 0.65, 0.3 * v, 'bandpass', 1500, 0.5, 500), this.burst(node, t, 0.08, 0.25 * v, 'lowpass', 500), ...[0.1, 0.22, 0.35, 0.5].map(o => this.burst(node, t + o, 0.03, 0.08 * v, 'bandpass', 3500, 0.8))); break;
      case 'radio': parts.push(this.burst(node, t, 0.12, 0.18 * v, 'bandpass', 2200, 1.4), this.toneAt(node, t + 0.02, 0.05, 0.04 * v, 'square', 1800)); break;
    }
    this.voices++; let open = parts.length;
    for (const part of parts) part.onended = () => { part.disconnect(); if (--open === 0) { this.voices--; setTimeout(dispose, gun ? 2600 : 600); } };
  }
  /**
   * Layered ambience. Each mood is a set of levels for named layers, and moving between moods fades every layer to its new
   * level on its own, so a layer two moods share never restarts. Saying the same mood again does nothing. `seconds` is how long
   * the change takes. Random events (horns, dogs, okadas) come from whichever mood is current. See MOODS for what each one is.
   */
  ambience(on: boolean, generators: Vec3[] = [], mood: SoundMood = 'dusk', seconds = 2.5) {
    if (!this.ctx) return; const next = on ? mood : undefined; if (next === this.playing) return; this.playing = next;
    const ctx = this.ctx, t = ctx.currentTime, def = next ? MOODS[next] : undefined, wanted = def?.layers ?? {}; clearTimeout(this.ambientTimer);
    if (next && def) { this.mood = next; this.environment(def.space ?? 'street'); }
    for (const name of new Set([...this.beds.keys(), ...Object.keys(wanted) as Layer[]])) {
      const spec = wanted[name], [gain, frequency] = Array.isArray(spec) ? spec : [spec ?? 0], span = Math.max(0.05, on ? seconds * (def?.stagger?.[name] ?? 1) : 0.3);
      if (!gain && !this.beds.has(name)) continue;
      const bed = this.beds.get(name) ?? this.bed(name, generators), first = !this.beds.has(name); this.beds.set(name, bed); clearTimeout(bed.timer); bed.level = gain;
      for (const fade of bed.fades) fade.gain.setTargetAtTime(gain, t, span / 3);
      if (frequency && bed.filter) { if (first) bed.filter.frequency.value = frequency; else bed.filter.frequency.setTargetAtTime(frequency, t, span / 3); }
      if (!gain) bed.timer = setTimeout(() => { bed.stop(); this.beds.delete(name); }, span * 1600 + 500);
    }
    if (!def) return;
    const schedule = () => {
      const [least, spread] = MOODS[this.mood].every;
      this.ambientTimer = setTimeout(() => {
        if (!this.ctx || this.ctx.state !== 'running') return schedule();
        const list = this.events[this.mood], total = list.reduce((s, [w]) => s + w, 0); let pick = Math.random() * total;
        if (list.length) {
          const [, play] = list.find(([w]) => (pick -= w) < 0) ?? list[0], reach = MOODS[this.mood].reach ?? 55;
          const angle = Math.random() * Math.PI * 2, at = { x: this.listener.x + Math.sin(angle) * reach, y: 2, z: this.listener.z + Math.cos(angle) * reach }, { node, dispose } = this.route('ambience', at, 120, 0.3);
          play(node, ctx.currentTime); setTimeout(dispose, 8000);
        }
        schedule();
      }, least + Math.random() * spread);
    };
    schedule();
  }
  /** Starts one layer silent. Generators are placed in the world, so that layer is several sounds with a fade each. */
  private bed(name: Layer, generators: Vec3[]): Bed {
    const ctx = this.ctx!, target = this.buses.get('ambience')!, stops: (() => void)[] = [], fades: GainNode[] = []; let filter: BiquadFilterNode | undefined;
    const fader = (dest: AudioNode) => { const fade = ctx.createGain(); fade.gain.value = 0; fade.connect(dest); fades.push(fade); stops.push(() => fade.disconnect()); return fade; };
    const loop = (buffer: AudioBuffer, type: BiquadFilterType, frequency: number, lfo: number, dest: AudioNode, gain = 1) => {
      const source = ctx.createBufferSource(), f = ctx.createBiquadFilter(), amp = ctx.createGain(); source.buffer = buffer; source.loop = true; f.type = type; f.frequency.value = frequency; amp.gain.value = gain;
      source.connect(f); f.connect(amp); amp.connect(dest); source.start(0, Math.random() * 2); filter ??= f;
      let mod: OscillatorNode | undefined;
      if (lfo) { mod = ctx.createOscillator(); const depth = ctx.createGain(); mod.frequency.value = lfo; depth.gain.value = gain * 0.45; mod.connect(depth); depth.connect(amp.gain); mod.start(); }
      stops.push(() => { source.stop(); mod?.stop(); source.disconnect(); amp.disconnect(); });
    };
    const drone = (type: OscillatorType, hz: number, cutoff: number, gain: number, dest: AudioNode) => {
      const osc = ctx.createOscillator(), f = ctx.createBiquadFilter(), amp = ctx.createGain(); osc.type = type; osc.frequency.value = hz; f.type = 'lowpass'; f.frequency.value = cutoff; amp.gain.value = gain;
      osc.connect(f); f.connect(amp); amp.connect(dest); osc.start(); stops.push(() => { osc.stop(); osc.disconnect(); f.disconnect(); amp.disconnect(); });
    };
    const bed = BEDS[name];
    if (bed) loop(bed.buffer === 'crowd' ? this.crowd() : bed.buffer === 'brown' ? this.brown! : this.noise!, bed.type, bed.frequency, bed.lfo, fader(target));
    else if (name === 'mains') drone('sawtooth', 100, 20000, 1, fader(target));
    // Whatever the jammer is doing to the air: two tones a shade apart, with enough overtone to survive a phone speaker.
    else if (name === 'hum') { const out = fader(target); drone('sawtooth', 58, 420, 0.8, out); drone('sawtooth', 58.7, 420, 0.5, out); drone('sine', 174, 2000, 0.3, out); }
    // The bus idling: firing pulses, a low body and diesel clatter.
    else if (name === 'engine') { const out = fader(target); drone('sawtooth', 46, 340, 1, out); drone('square', 23, 180, 0.5, out); loop(this.noise!, 'bandpass', 1500, 23, out, 0.12); }
    else for (const at of generators.slice(0, 4)) {
      const { node, dispose } = this.route('ambience', { ...at, y: 0.6 }, 26), out = fader(node); stops.push(dispose);
      drone('sawtooth', 49 + Math.random() * 3, 260, 0.11, out); loop(this.noise!, 'bandpass', 2400, 24, out, 0.01);
    }
    return { fades, filter, level: 0, stop: () => { for (const stop of stops) stop(); } };
  }
  /** Eight seconds of a crowd nobody can quite make out, built once, the first time a street needs it. */
  private crowd() { if (!this.chatter) { const data = crowdSamples(16000, 8), buffer = this.chatter = this.ctx!.createBuffer(1, data.length, 16000); buffer.getChannelData(0).set(data); } return this.chatter; }
  /** Random street events by mood: weight, then what happens. */
  private events: Record<SoundMood, [number, (node: AudioNode, t: number) => void][]> = {
    dusk: [[3, (n, t) => this.horn(n, t, 0.05)], [2, () => this.pass('okada')], [1.5, (n, t) => this.bark(n, t)], [1.5, (n, t) => { for (let i = 0; i < 6; i++) this.toneAt(n, t + i * 0.09, 0.05, 0.012, 'sine', 4200 + Math.random() * 300); }],
      [1, (n, t) => { for (let i = 0; i < 4; i++) this.toneAt(n, t + i * 0.16 + Math.random() * 0.05, 0.07, 0.015, 'sine', 2600 + Math.random() * 1400, 3600 + Math.random() * 900); }]],
    restored: [[4, (n, t) => this.horn(n, t, 0.05)], [3, () => this.pass(Math.random() < 0.5 ? 'okada' : 'car')], [1.2, (n, t) => { for (let i = 0; i < 8; i++) this.toneAt(n, t + i * 0.18, 0.16, 0.012, 'triangle', [392, 440, 523, 587][(i * 3) % 4]); }], [0.6, (n, t) => this.siren(n, t, 0.02)]],
    shelter: [[2, (n, t) => this.siren(n, t, 0.02)], [4, (n, t) => { for (let i = 0; i < 3; i++) this.toneAt(n, t + i * (1.4 + Math.random()), 0.09, 0.02, 'sine', 1400 + Math.random() * 500, 900); }], [1, (n, t) => this.helicopter(n, t)]],
    live: [[5, (n, t) => this.horn(n, t, 0.05)], [4, () => this.pass(Math.random() < 0.6 ? 'okada' : 'car')], [4, (n, t) => this.hawker(n, t)], [1.5, (n, t) => { for (let i = 0; i < 5; i++) this.toneAt(n, t + i * 0.14, 0.09, 0.02, 'triangle', 2100 + Math.random() * 60); }], [1, (n, t) => { for (let i = 0; i < 8; i++) this.toneAt(n, t + i * 0.18, 0.16, 0.012, 'triangle', [392, 440, 523, 587][(i * 3) % 4]); }]],
    ride: [[4, (n, t) => this.horn(n, t, 0.05)], [3, () => this.pass(Math.random() < 0.6 ? 'okada' : 'car')], [2, (n, t) => this.hawker(n, t)]],
    hush: [[1, (n, t) => this.horn(n, t, 0.016)]],
    still: []
  };
  /** A hawker calling a few notes down the road: a sung phrase through two moving vowel formants, ending on a long falling note. */
  private hawker(dest: AudioNode, t: number) {
    const ctx = this.ctx!, osc = ctx.createOscillator(), first = ctx.createBiquadFilter(), second = ctx.createBiquadFilter(), amp = ctx.createGain(), notes = 3 + Math.floor(Math.random() * 3), base = 190 + Math.random() * 120;
    osc.type = 'sawtooth'; first.type = second.type = 'bandpass'; first.Q.value = 5; second.Q.value = 7; amp.gain.setValueAtTime(0.0001, t); let at = t;
    for (let i = 0; i < notes; i++) {
      const last = i === notes - 1, length = last ? 0.55 + Math.random() * 0.3 : 0.17 + Math.random() * 0.1, [a, b] = VOWELS[Math.floor(Math.random() * VOWELS.length)], pitch = base * (i % 2 ? 1.19 : 1) * (last ? 1.12 : 1);
      osc.frequency.setValueAtTime(pitch, at); if (last) osc.frequency.exponentialRampToValueAtTime(pitch * 0.74, at + length);
      first.frequency.setTargetAtTime(a, at, 0.025); second.frequency.setTargetAtTime(b, at, 0.025);
      amp.gain.exponentialRampToValueAtTime(0.2, at + 0.03); amp.gain.setValueAtTime(0.2, at + length * 0.7); amp.gain.exponentialRampToValueAtTime(0.012, at + length); at += length + 0.03;
    }
    osc.connect(first); osc.connect(second); first.connect(amp); second.connect(amp); amp.connect(dest); osc.start(t); osc.stop(at); osc.onended = () => { osc.disconnect(); first.disconnect(); second.disconnect(); amp.disconnect(); };
  }
  /** A danfo horn: two detuned squares, a short toot and a long one. */
  private horn(dest: AudioNode, t: number, gain: number) { const pitch = 380 + Math.random() * 140; for (const [offset, length] of [[0, 0.22], [0.3, 0.3 + Math.random() * 0.4]]) { this.toneAt(dest, t + offset, length, gain, 'square', pitch); this.toneAt(dest, t + offset, length, gain * 0.7, 'square', pitch * 1.26); } }
  /** A dog somewhere down the road: two or three barks through a throat-like band. */
  private bark(dest: AudioNode, t: number) {
    const ctx = this.ctx!, f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 900; f.Q.value = 2; f.connect(dest);
    for (let i = 0; i < 2 + Math.floor(Math.random() * 2); i++) { const s = t + i * (0.28 + Math.random() * 0.1); this.toneAt(f, s, 0.11, 0.06, 'sawtooth', 520, 340); this.burst(f, s, 0.08, 0.04, 'bandpass', 1200, 1); }
    setTimeout(() => f.disconnect(), 3000);
  }
  /** A motorbike or car driving past: the source moves across the listener with a Doppler drop in pitch. */
  private pass(kind: 'okada' | 'car') {
    const ctx = this.ctx!, t = ctx.currentTime, side = Math.random() < 0.5 ? -1 : 1, across = 18 + Math.random() * 20, seconds = kind === 'okada' ? 3.4 : 4.5;
    const a = { x: this.listener.x - 40 * side, y: 0.8, z: this.listener.z + across }, b = { x: this.listener.x + 40 * side, y: 0.8, z: this.listener.z + across };
    const { node, panner, dispose } = this.route('ambience', a, 120, 0.25); if (!panner?.positionX) { dispose(); return; }
    panner.positionX.setValueAtTime(a.x, t); panner.positionX.linearRampToValueAtTime(b.x, t + seconds);
    const base = kind === 'okada' ? 95 + Math.random() * 30 : 55 + Math.random() * 15, osc = ctx.createOscillator(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    osc.type = 'sawtooth'; osc.frequency.setValueAtTime(base * 1.08, t); osc.frequency.setValueAtTime(base * 1.08, t + seconds * 0.45); osc.frequency.exponentialRampToValueAtTime(base * 0.9, t + seconds * 0.6);
    f.type = 'lowpass'; f.frequency.value = kind === 'okada' ? 900 : 420; g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(kind === 'okada' ? 0.05 : 0.08, t + seconds * 0.5); g.gain.exponentialRampToValueAtTime(0.0001, t + seconds);
    osc.connect(f); f.connect(g); g.connect(node); osc.start(t); osc.stop(t + seconds + 0.05);
    this.burst(node, t, seconds, kind === 'okada' ? 0.03 : 0.06, 'lowpass', kind === 'okada' ? 1400 : 600, 0.5);
    osc.onended = () => { osc.disconnect(); g.disconnect(); setTimeout(dispose, 200); };
  }
  /** A helicopter far off: a rotor's low beat over a wash of turbine noise. */
  private helicopter(dest: AudioNode, t: number) {
    const ctx = this.ctx!, source = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain(), lfo = ctx.createOscillator(), depth = ctx.createGain();
    source.buffer = this.brown!; source.loop = true; f.type = 'lowpass'; f.frequency.value = 260; lfo.frequency.value = 11; depth.gain.value = 0.03;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.04, t + 2.5); g.gain.exponentialRampToValueAtTime(0.0001, t + 7);
    lfo.connect(depth); depth.connect(g.gain); source.connect(f); f.connect(g); g.connect(dest); source.start(t); lfo.start(t); source.stop(t + 7.1); lfo.stop(t + 7.1);
    source.onended = () => { source.disconnect(); g.disconnect(); lfo.disconnect(); };
  }
  /** Restrained score: a dusk pad and talking-drum pulse on the menu, a low pulse under combat. */
  score(kind: 'menu' | 'tension' | 'none') {
    if (this.music?.kind === kind) return; this.music?.stop(); this.music = undefined;
    if (kind === 'none' || !this.ctx) return;
    const ctx = this.ctx, bus = this.buses.get('music')!, out = ctx.createGain(); out.gain.value = 0; out.gain.setTargetAtTime(1, ctx.currentTime, 1.2); out.connect(bus);
    const filter = ctx.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = kind === 'menu' ? 1100 : 500; filter.connect(out);
    const chords = kind === 'menu' ? [[220, 261.6, 329.6], [196, 246.9, 293.7], [174.6, 220, 261.6], [196, 246.9, 329.6]] : [[110, 164.8], [103.8, 155.6]];
    const pads: OscillatorNode[] = []; const gains: GainNode[] = [];
    for (let i = 0; i < 3; i++) for (const detune of [-6, 6]) { const osc = ctx.createOscillator(), g = ctx.createGain(); osc.type = 'sawtooth'; osc.detune.value = detune; g.gain.value = kind === 'menu' ? 0.016 : 0.022; osc.connect(g); g.connect(filter); osc.start(); pads.push(osc); gains.push(g); }
    let bar = 0;
    const beat = kind === 'menu' ? 60 / 88 : 60 / 100;
    const step = () => {
      const t = ctx.currentTime, chord = chords[bar % chords.length];
      pads.forEach((osc, i) => { const f = chord[Math.floor(i / 2) % chord.length]; osc.frequency.setTargetAtTime(f / (kind === 'menu' ? 1 : 2), t, 0.4); });
      const pattern = kind === 'menu' ? [0, 1.5, 2, 3, 3.5] : [0, 2];
      for (const at of pattern) this.toneAt(out, t + at * beat, 0.32, kind === 'menu' ? 0.06 : 0.09, 'sine', kind === 'menu' ? (at === 1.5 || at === 3.5 ? 190 : 150) : 70, kind === 'menu' ? 95 : 45);
      bar++;
    };
    step(); const timer = setInterval(step, beat * 4 * 1000);
    this.music = { kind, stop: () => { clearInterval(timer); const t = ctx.currentTime; out.gain.setTargetAtTime(0, t, 0.4); setTimeout(() => { for (const p of pads) p.stop(); out.disconnect(); gains.forEach(g => g.disconnect()); }, 1600); } };
  }
  private mood: SoundMood = 'dusk';
  /** Lowers ambience and music (and optionally effects) to `level` of their set volume; 1 restores them. */
  duck(level: number, seconds = 0.3, effects = false) {
    if (!this.ctx) return; const t = this.ctx.currentTime;
    for (const bus of ['ambience', 'music'] as Bus[]) this.buses.get(bus)?.gain.setTargetAtTime(this.levels[bus] * level, t, seconds / 3);
    this.buses.get('effects')?.gain.setTargetAtTime(this.levels.effects * (effects ? level : 1), t, seconds / 3);
  }
  /** Short scored hits for story beats: a low unease swell, a rising reveal, the blast impact, the chapter title and a falling dread. */
  sting(kind: 'unease' | 'reveal' | 'impact' | 'title' | 'dread') {
    if (!this.ctx || this.ctx.state !== 'running') return;
    const ctx = this.ctx, t = ctx.currentTime, out = this.buses.get('music')!, f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 1400; f.connect(out);
    const pad = (freqs: number[], length: number, gain: number, attack = 0.8) => { for (const freq of freqs) for (const detune of [-7, 7]) { const o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'sawtooth'; o.frequency.value = freq; o.detune.value = detune; g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(gain, t + attack); g.gain.exponentialRampToValueAtTime(0.0001, t + length); o.connect(g); g.connect(f); o.start(t); o.stop(t + length + 0.05); o.onended = () => { o.disconnect(); g.disconnect(); }; } };
    if (kind === 'unease') pad([110, 116.5, 164.8], 5, 0.02, 1.8);
    if (kind === 'reveal') { pad([146.8, 220, 293.7], 4, 0.025, 1.2); this.toneAt(f, t + 0.8, 2.5, 0.03, 'sine', 587, 880); }
    if (kind === 'dread') { pad([98, 103.8], 6, 0.03, 0.6); this.toneAt(f, t, 4, 0.05, 'sine', 196, 98); }
    if (kind === 'impact') { this.toneAt(out, t, 3.5, 0.5, 'sine', 70, 24); this.burst(out, t, 2.5, 0.4, 'lowpass', 400, 0.5, 80); }
    if (kind === 'title') { pad([220, 261.6, 329.6, 440], 7, 0.022, 2); for (const at of [0, 0.75, 1.1, 1.5]) this.toneAt(f, t + 2 + at, 0.35, 0.06, 'sine', at === 0.75 ? 190 : 150, 95); }
    setTimeout(() => f.disconnect(), 8000);
  }
  /** A police siren: a rising and falling wail, the way Lagos patrol vans run them, optionally drifting in pitch as it moves. */
  private siren(dest: AudioNode, t: number, gain: number, cycles = 4, doppler = 1) {
    const ctx = this.ctx!, osc = ctx.createOscillator(), amp = ctx.createGain(), f = ctx.createBiquadFilter(); osc.type = 'square'; f.type = 'lowpass'; f.frequency.value = 2200;
    for (let i = 0; i < cycles; i++) { const k = doppler === 1 ? 1 : 1 + (doppler - 1) * (i / cycles); osc.frequency.setValueAtTime(620 * k, t + i * 1.1); osc.frequency.linearRampToValueAtTime(880 * k, t + i * 1.1 + 0.55); osc.frequency.linearRampToValueAtTime(620 * k, t + i * 1.1 + 1.1); }
    const end = t + cycles * 1.1; amp.gain.setValueAtTime(0.0001, t); amp.gain.exponentialRampToValueAtTime(gain, t + 0.6); amp.gain.setValueAtTime(gain, end - 0.8); amp.gain.exponentialRampToValueAtTime(0.0001, end);
    osc.connect(f); f.connect(amp); amp.connect(dest); osc.start(t); osc.stop(end + 0.1); osc.onended = () => { osc.disconnect(); f.disconnect(); amp.disconnect(); };
  }
  /**
   * One-off cutscene sound design, synthesized like everything else: the last bus (door and engine), the sky's
   * rumble, the object's whoosh, the blast and what follows (glass, crashes, horns and sirens), and the radio.
   */
  cine(kind: CineSound, at?: Vec3, volume = 1) {
    if (!this.ctx || this.ctx.state !== 'running') return;
    if (kind === 'radio') { this.play('radio', at, volume); return; }
    // The ears giving out: everything goes dull, then the world comes back from the top down over several seconds.
    if (kind === 'deafen') { const t = this.ctx.currentTime, f = this.deaf!.frequency; f.cancelScheduledValues(t); f.setValueAtTime(240, t + 0.02); f.setValueAtTime(240, t + 1); f.exponentialRampToValueAtTime(20000, t + 6); return; }
    const near = kind === 'ringing' || kind === 'breath' || kind === 'static' || kind === 'shutter', send = near ? 0 : kind === 'boom' ? 0.9 : kind === 'engine' || kind === 'door' ? 0.2 : 0.5;
    const { node, dispose } = this.route(near ? 'dialogue' : 'effects', at, 400, send), t = this.ctx.currentTime, v = volume;
    switch (kind) {
      // Not thunder: a sub-bass swell that beats against itself, with dry crackle high above it.
      case 'rumble':
        this.toneAt(node, t, 5, 0.42 * v, 'sine', 36, 29); this.toneAt(node, t + 0.3, 4.5, 0.25 * v, 'sine', 38.5, 30); this.burst(node, t, 5, 0.35 * v, 'lowpass', 150, 0.6, 55); this.toneAt(node, t + 0.5, 3.8, 0.12 * v, 'sawtooth', 55, 41);
        for (let i = 0; i < 14; i++) this.burst(node, t + 0.6 + Math.random() * 3.5, 0.03, 0.04 * v, 'highpass', 5000); break;
      // The object coming in: a rising roar that peaks as it passes, then the pitch falls away.
      case 'whoosh':
        this.burst(node, t, 2.4, 0.5 * v, 'bandpass', 220, 0.7, 2800); this.burst(node, t + 1.8, 1.2, 0.4 * v, 'bandpass', 2800, 0.6, 300); this.toneAt(node, t, 2.2, 0.1 * v, 'sawtooth', 90, 340); this.toneAt(node, t + 2.1, 0.9, 0.12 * v, 'sawtooth', 600, 140); this.toneAt(node, t + 1.6, 1.6, 0.3 * v, 'sine', 70, 40); break;
      // The blast: a crack, the body, a sub drop that takes seconds, then the city answering as rolling echoes.
      case 'boom':
        this.burst(node, t, 0.08, 1 * v, 'highpass', 1500); this.burst(node, t, 0.5, 1 * v, 'lowpass', 2500, 0.4, 260); this.toneAt(node, t, 5.5, 1 * v, 'sine', 64, 17); this.toneAt(node, t, 2.5, 0.5 * v, 'triangle', 45, 20);
        this.burst(node, t + 0.05, 6, 0.7 * v, 'lowpass', 600, 0.5, 55); this.burst(node, t + 0.3, 3, 0.25 * v, 'bandpass', 1200, 0.4, 200);
        for (const [delay, level] of [[0.6, 0.35], [1.25, 0.28], [2.1, 0.2], [3.2, 0.13]]) this.burst(node, t + delay, 1.4, level * v, 'lowpass', 420, 0.5, 90);
        for (let i = 0; i < 18; i++) this.burst(node, t + 0.4 + Math.random() * 2.5, 0.05 + Math.random() * 0.1, 0.06 * v, 'bandpass', 900 + Math.random() * 2500, 1.2); break;
      // Every window at once: a big shatter, then shards raining down and tinkling for a couple of seconds.
      case 'glass':
        this.burst(node, t, 0.3, 0.5 * v, 'highpass', 2500); this.burst(node, t, 0.15, 0.3 * v, 'bandpass', 5200, 1.5);
        for (let i = 0; i < 30; i++) { const s = t + 0.05 + Math.random() * Math.random() * 2.2; this.burst(node, s, 0.06 + Math.random() * 0.1, 0.16 * v, 'highpass', 4000 + Math.random() * 3000); this.toneAt(node, s, 0.18 + Math.random() * 0.2, 0.025 * v, 'triangle', 2500 + Math.random() * 3500); } break;
      case 'horns': for (let i = 0; i < 7; i++) this.horn(node, t + Math.random() * 2.2, 0.045 * v); this.toneAt(node, t + 0.8, 2.4, 0.03 * v, 'square', 1200, 1250); break;
      // A car into something solid: the crunch, the grind of panels, glass, a dropped bumper.
      case 'crash':
        this.burst(node, t, 0.5, 0.6 * v, 'bandpass', 900, 0.6, 300); this.toneAt(node, t, 0.6, 0.15 * v, 'square', 180, 90); this.toneAt(node, t, 0.25, 0.4 * v, 'sine', 90, 40);
        this.burst(node, t + 0.1, 0.9, 0.22 * v, 'bandpass', 500, 2, 1400); this.burst(node, t + 0.15, 0.8, 0.3 * v, 'highpass', 3000);
        for (let i = 0; i < 8; i++) this.toneAt(node, t + 0.2 + Math.random() * 0.8, 0.15, 0.03 * v, 'triangle', 3000 + Math.random() * 2500); this.burst(node, t + 1.1, 0.12, 0.25 * v, 'bandpass', 1600, 1.5); break;
      case 'static': this.burst(node, t, 0.9, 0.35 * v, 'bandpass', 2400, 0.4); this.burst(node, t + 0.2, 0.5, 0.2 * v, 'highpass', 5000); for (let i = 0; i < 10; i++) this.burst(node, t + Math.random() * 0.9, 0.02, 0.2 * v, 'bandpass', 1800 + Math.random() * 2000, 2); break;
      // Blast deafness: two close tones beating against each other, fading over seven seconds.
      case 'ringing': this.toneAt(node, t, 7, 0.06 * v, 'sine', 3800, 3700); this.toneAt(node, t, 6, 0.035 * v, 'sine', 3807, 3705); break;
      case 'breath': for (let i = 0; i < 3; i++) { this.burst(node, t + i * 1.6, 0.7, 0.14 * v, 'bandpass', 900, 0.5, 600); this.burst(node, t + i * 1.6 + 0.75, 0.8, 0.12 * v, 'bandpass', 600, 0.5, 380); } break;
      // The last bus pulling away: idle, a rev through first gear, the change, second gear, fading into traffic.
      case 'engine': {
        const ctx = this.ctx, osc = ctx.createOscillator(), sub = ctx.createOscillator(), f = ctx.createBiquadFilter(), g = ctx.createGain(); osc.type = 'sawtooth'; sub.type = 'square'; f.type = 'lowpass';
        const rpm: [number, number][] = [[0, 40], [0.6, 42], [1.9, 92], [2.15, 64], [3.8, 104], [5.5, 96]];
        osc.frequency.setValueAtTime(40, t); sub.frequency.setValueAtTime(20, t);
        for (const [at2, hz] of rpm) { osc.frequency.linearRampToValueAtTime(hz, t + at2); sub.frequency.linearRampToValueAtTime(hz / 2, t + at2); }
        f.frequency.setValueAtTime(320, t); f.frequency.linearRampToValueAtTime(950, t + 1.9); f.frequency.linearRampToValueAtTime(600, t + 2.15); f.frequency.linearRampToValueAtTime(1000, t + 3.6); f.frequency.exponentialRampToValueAtTime(220, t + 5.5);
        g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.16 * v, t + 0.3); g.gain.setValueAtTime(0.18 * v, t + 3.4); g.gain.exponentialRampToValueAtTime(0.0001, t + 5.6);
        osc.connect(f); sub.connect(f); f.connect(g); g.connect(node); osc.start(t); sub.start(t); osc.stop(t + 5.7); sub.stop(t + 5.7); osc.onended = () => { osc.disconnect(); sub.disconnect(); f.disconnect(); g.disconnect(); };
        // Diesel clatter and the exhaust puffing as it pulls off.
        for (let i = 0; i < 24; i++) this.burst(node, t + i * 0.09, 0.03, 0.04 * v * (i < 18 ? 1 : 0.4), 'bandpass', 1500, 1.4);
        this.burst(node, t + 0.6, 4.8, 0.12 * v, 'lowpass', 260, 0.7, 500); break;
      }
      // A danfo's sliding door: rolling on its track, the slam, a rattle of loose panels.
      case 'door': this.burst(node, t, 0.45, 0.28 * v, 'bandpass', 600, 1.2, 950); this.burst(node, t + 0.46, 0.08, 0.6 * v, 'lowpass', 700); this.burst(node, t + 0.46, 0.03, 0.4 * v, 'bandpass', 2100, 2); this.rattle(node, t + 0.5, 4, 0.12 * v); break;
      // A phone camera's fake shutter.
      case 'shutter': this.burst(node, t, 0.03, 0.3 * v, 'highpass', 3000); this.burst(node, t + 0.07, 0.04, 0.26 * v, 'bandpass', 2200, 2); break;
      // Air being pushed ahead of the blast: almost nothing, then a roar climbing through the floor, cut off by what comes after it.
      case 'pressure': this.toneAt(node, t, 3.4, 0.3 * v, 'sine', 24, 58); this.burst(node, t + 0.4, 3, 0.34 * v, 'lowpass', 90, 0.7, 900); this.burst(node, t + 1.8, 1.6, 0.2 * v, 'bandpass', 300, 0.6, 2600); this.toneAt(node, t, 3.2, 0.012 * v, 'sine', 5200, 6800); break;
      // Every car on the street, a beat apart and out of step with each other.
      case 'alarms': for (let i = 0; i < 4; i++) { const s = t + i * 0.4 + Math.random() * 0.2, hz = 820 + Math.random() * 500; for (let n = 0; n < 12; n++) this.toneAt(node, s + n * 0.28, 0.2, 0.05 * v, 'square', n % 2 ? hz : hz * 1.3); } break;
      case 'siren': this.siren(node, t, 0.06 * v, 5, 0.96); this.siren(node, t + 1.7, 0.03 * v, 4, 1.04); break;
      // A palm on a dashboard radio: a flat thump, the plastic buzzing, something loose inside.
      case 'slap': this.burst(node, t, 0.05, 0.7 * v, 'lowpass', 900); this.toneAt(node, t, 0.08, 0.25 * v, 'triangle', 170, 90); this.burst(node, t + 0.01, 0.04, 0.3 * v, 'bandpass', 2400, 2); this.rattle(node, t + 0.05, 3, 0.08 * v); break;
      // The diesel giving up: firing slows and stumbles, and the body rocks once on its springs.
      case 'stall': {
        for (let i = 0, at2 = 0; i < 9; i++) { at2 += 0.08 + i * i * 0.012; this.burst(node, t + at2, 0.05, 0.35 * v * (1 - i / 11), 'lowpass', 340, 1); this.toneAt(node, t + at2, 0.07, 0.14 * v * (1 - i / 11), 'sine', 70, 42); }
        this.burst(node, t + 1.5, 0.3, 0.08 * v, 'bandpass', 700, 1); this.rattle(node, t + 1.55, 3, 0.05 * v); break;
      }
      // Boots on grit, unhurried, in a street quiet enough to hear them.
      case 'steps': for (let i = 0; i < 4; i++) { const s = t + i * 0.52 + Math.random() * 0.04; this.toneAt(node, s, 0.05, 0.09 * v, 'sine', 95, 55); this.burst(node, s, 0.05, 0.2 * v, 'lowpass', 800, 0.8); for (const o of [0.02, 0.045, 0.07]) this.burst(node, s + o, 0.025, 0.08 * v, 'bandpass', 3400, 0.7); } break;
    }
    setTimeout(dispose, 10000);
  }
  /** One side of the bus radio: a small speaker, its echo off the cabin, and the dashboard position, feeding one bus. */
  private speaker(bus: Bus): Speaker {
    const ctx = this.ctx!, input = ctx.createGain(), high = ctx.createBiquadFilter(), presence = ctx.createBiquadFilter(), low = ctx.createBiquadFilter(), drive = ctx.createWaveShaper(), gate = ctx.createGain(), out = ctx.createGain();
    // An odd-length curve has a sample at exactly zero; an even one puts a DC offset on the output.
    const echo = ctx.createDelay(0.1), wet = ctx.createGain(), panner = ctx.createPanner(), curve = new Float32Array(257);
    high.type = 'highpass'; high.frequency.value = 420; presence.type = 'peaking'; presence.frequency.value = 1900; presence.gain.value = 6; low.type = 'lowpass'; low.frequency.value = RADIO_OPEN;
    for (let i = 0; i < 257; i++) { const x = i / 128 - 1; curve[i] = Math.tanh(x * 2.4) / Math.tanh(2.4); } drive.curve = curve;
    echo.delayTime.value = 0.019; wet.gain.value = 0.3; panner.panningModel = 'equalpower'; panner.refDistance = 1; panner.rolloffFactor = 0.4;
    input.connect(high); high.connect(presence); presence.connect(low); low.connect(drive); drive.connect(gate); gate.connect(out); gate.connect(echo); echo.connect(wet); wet.connect(out); out.connect(panner); panner.connect(this.buses.get(bus)!);
    return { input, low, gate, out, panner, dispose: () => { for (const node of [input, high, presence, low, drive, gate, echo, wet, out, panner]) node.disconnect(); } };
  }
  /** Keeps the radio on a dashboard just ahead of whoever is listening. The camera is riding the bus, wherever the picture shows. */
  private dashboard() {
    const d = this.deck; if (!d) return; const { x, y, z, yaw } = this.listener, ahead = 1.3, left = 0.5, px = x + Math.sin(yaw) * ahead - Math.cos(yaw) * left, pz = z + Math.cos(yaw) * ahead + Math.sin(yaw) * left;
    for (const { panner } of [d.music, d.talk]) { if (panner.positionX) { panner.positionX.value = px; panner.positionY.value = y - 0.2; panner.positionZ.value = -pz; } else panner.setPosition(px, y - 0.2, -pz); }
  }
  /** Turns the radio on: the two speakers, its carrier hiss and the interference that the signal stage brings in. Off until asked for. */
  radioOn() {
    if (!this.ctx || this.deck) return;
    const ctx = this.ctx, music = this.speaker('music'), talk = this.speaker('dialogue'), song = ctx.createGain(), hiss = ctx.createGain(), buzz = ctx.createGain(), noise = ctx.createBufferSource(), band = ctx.createBiquadFilter(), tone = ctx.createOscillator(), pulse = ctx.createOscillator(), depth = ctx.createGain();
    song.connect(music.input); noise.buffer = this.noise!; noise.loop = true; band.type = 'bandpass'; band.frequency.value = 2400; band.Q.value = 0.4; noise.connect(band); band.connect(hiss); hiss.connect(talk.input); hiss.gain.value = 0; noise.start();
    // The buzz a phone puts through a speaker hunting for a mast: a 217 Hz burst train, chopped.
    tone.type = 'square'; tone.frequency.value = 217; pulse.type = 'square'; pulse.frequency.value = 8.3; depth.gain.value = 0; buzz.gain.value = 0; tone.connect(depth); pulse.connect(depth.gain); depth.connect(buzz); buzz.connect(talk.input); tone.start(); pulse.start();
    const d: Deck = this.deck = { music, talk, song, hiss, buzz, signal: 1, from: 1, to: 1, at: 0, seconds: 0, timer: setInterval(() => this.signalStage(d), 70), dispose: () => { clearInterval(d.timer); noise.stop(); tone.stop(); pulse.stop(); this.tapeNode?.disconnect(); for (const node of [noise, band, hiss, tone, pulse, depth, buzz, song]) node.disconnect(); music.dispose(); talk.dispose(); } };
    this.dashboard();
  }
  /** Fades to what the radio should be doing. */
  radioSet(state: RadioState, seconds: number) {
    const d = this.deck; if (!d || !this.ctx) return; const t = this.ctx.currentTime, span = Math.max(0.02, seconds) / 3;
    Object.assign(d, { from: d.signal, to: state.signal, at: performance.now(), seconds: seconds * 1000 });
    for (const speaker of [d.music, d.talk]) { speaker.out.gain.setTargetAtTime(state.level, t, span); speaker.low.frequency.setTargetAtTime(state.muffled ? RADIO_MUFFLED : RADIO_OPEN, t, span); }
    if (!seconds) this.signalStage(d);
  }
  /** The signal stage, stepped a few times a second: as the signal falls the buzz comes and goes, static rises, the sound drives harder, dropouts start and the pitch wobbles. */
  private signalStage(d: Deck) {
    if (!this.ctx) return; const t = this.ctx.currentTime, s = d.signal = d.from + (d.to - d.from) * Math.min(1, d.seconds ? (performance.now() - d.at) / d.seconds : 1), lost = 1 - s, tape = this.tapeEl;
    d.hiss.gain.setTargetAtTime(0.02 + 0.11 * lost * lost, t, 0.03); d.buzz.gain.setTargetAtTime(Math.sin(Math.PI * lost) * 0.06, t, 0.03); d.song.gain.setTargetAtTime(Math.min(1, s / 0.2), t, 0.03);
    for (const speaker of [d.music, d.talk]) speaker.input.gain.setTargetAtTime(0.7 + lost * 0.8, t, 0.03);
    if (s < 0.9 && Math.random() < lost * 0.35) { const dip = t + 0.04 + Math.random() * 0.1; for (const speaker of [d.music, d.talk]) { speaker.gate.gain.setTargetAtTime(0.04 + s * 0.4, t, 0.004); speaker.gate.gain.setTargetAtTime(1, dip, 0.01); } }
    if (tape) {
      const wobble = Math.max(0, 0.6 - s) / 0.6, rate = wobble ? 1 + Math.sin(performance.now() * 0.011) * 0.05 * wobble + (Math.random() - 0.5) * 0.03 * wobble : 1; if (rate !== tape.playbackRate) tape.playbackRate = rate;
      if (this.tapeEnd && tape.currentTime >= this.tapeEnd) tape.currentTime = this.tapeStart;
    }
  }
  /** The dial going past something on the way to the next station. */
  radioBlip() { const d = this.deck; if (!d || !this.ctx) return; const t = this.ctx.currentTime; this.burst(d.talk.input, t, 0.24, 0.9, 'bandpass', 900, 1.4, 3200); this.toneAt(d.talk.input, t + 0.03, 0.14, 0.08, 'square', 1400, 700); }
  radioOff(click: boolean) {
    const d = this.deck; if (!d || !this.ctx) return; this.deck = undefined; clearInterval(d.timer); const t = this.ctx.currentTime;
    if (click) { this.burst(d.talk.out, t, 0.014, 0.7, 'highpass', 2600); this.toneAt(d.talk.out, t, 0.03, 0.2, 'triangle', 240, 110); }
    d.song.gain.setTargetAtTime(0, t, 0.005); d.hiss.gain.setTargetAtTime(0, t, 0.005); d.buzz.gain.setTargetAtTime(0, t, 0.005); setTimeout(d.dispose, 240);
  }
  /** Streams a track through an audio element, rather than decoding a whole song, into the music side of the radio. No url stops it. */
  tape(url: string | undefined, cueIn: number, cueOut: number, failed: () => void) {
    const tape = this.tapeEl ??= new Audio(), d = this.deck; tape.onerror = null;
    if (!url || !d || !this.ctx) { tape.pause(); tape.removeAttribute('src'); this.tapeEnd = 0; return; }
    this.tapeNode ??= this.ctx.createMediaElementSource(tape); this.tapeNode.disconnect(); this.tapeNode.connect(d.song); this.tapeStart = cueIn; this.tapeEnd = cueOut;
    tape.onerror = failed; tape.preload = 'auto'; tape.loop = true; tape.preservesPitch = false; tape.playbackRate = 1; tape.src = url;
    if (cueIn) tape.addEventListener('loadedmetadata', () => { tape.currentTime = cueIn; }, { once: true });
    void tape.play().catch(() => { /* Blocked or replaced by the next tune; the scene carries on without it. */ });
  }
  /** Danfo 247's dead radio, still on and hissing to itself. Quiet and placed, so only someone standing at the bus hears it. */
  deadRadio(at?: Vec3) {
    if (!this.ctx) return; if (!at) { this.dead?.(); this.dead = undefined; return; } if (this.dead) return;
    const ctx = this.ctx, { node, panner, dispose } = this.route('ambience', { ...at, y: 1.2 }, 40), source = ctx.createBufferSource(), band = ctx.createBiquadFilter(), fade = ctx.createGain(), wow = ctx.createOscillator(), depth = ctx.createGain();
    if (panner) { panner.refDistance = 1; panner.rolloffFactor = 1.6; } source.buffer = this.noise!; source.loop = true; band.type = 'bandpass'; band.frequency.value = 2600; band.Q.value = 0.5; fade.gain.value = 0; fade.gain.setTargetAtTime(0.05, ctx.currentTime, 0.5);
    wow.frequency.value = 0.4; depth.gain.value = 0.015; wow.connect(depth); depth.connect(fade.gain); source.connect(band); band.connect(fade); fade.connect(node); source.start(); wow.start();
    this.dead = () => { fade.gain.setTargetAtTime(0, ctx.currentTime, 0.5); setTimeout(() => { source.stop(); wow.stop(); source.disconnect(); band.disconnect(); fade.disconnect(); wow.disconnect(); depth.disconnect(); dispose(); }, 2500); };
  }
  /** Development: what is sounding right now, for checks that cannot listen. */
  sounding() {
    const beds = Object.fromEntries([...this.beds].map(([name, bed]) => [name, bed.level])), tape = this.tapeEl;
    return { mood: this.playing ?? '', beds, radio: this.deck ? { signal: this.deck.signal } : undefined, tape: tape?.src && !tape.paused ? { seconds: tape.currentTime, rate: tape.playbackRate, url: tape.src.slice(0, 5) } : undefined, deadRadio: !!this.dead };
  }
  /** Development: the output's level now, overall and by band (below 300 Hz, up to 3.5 kHz, above that), in decibels. */
  probe() {
    if (!this.meter || !this.ctx) return undefined; const size = this.meter.frequencyBinCount, bins = new Float32Array(size), wave = new Float32Array(this.meter.fftSize); this.meter.getFloatFrequencyData(bins); this.meter.getFloatTimeDomainData(wave);
    const hz = this.ctx.sampleRate / 2 / size, band = (from: number, to: number) => { let sum = 0; for (let i = Math.floor(from / hz); i < Math.min(size, to / hz); i++) sum += 10 ** (bins[i] / 10); return Math.round(10 * Math.log10(sum + 1e-12)); };
    const rms = Math.sqrt(wave.reduce((s, v) => s + v * v, 0) / wave.length);
    return { rms: Math.round(1000 * rms) / 1000, low: band(0, 300), mid: band(300, 3500), high: band(3500, 20000) };
  }
  private speaking?: AudioBufferSourceNode; private talking = 0;
  async decode(data: ArrayBuffer) { if (!this.ctx) await this.unlock(); return this.ctx!.decodeAudioData(data); }
  /** Plays one recorded dialogue line, cutting off any line still playing. Handset lines are band-limited; station lines come out of the bus radio. */
  speak(buffer: AudioBuffer, channel: 'room' | 'handset' | 'station', overlap = false) {
    if (!this.ctx || this.ctx.state !== 'running') return; if (!overlap) this.hush();
    const ctx = this.ctx, source = ctx.createBufferSource(), bus = this.buses.get('dialogue')!; source.buffer = buffer;
    if (channel === 'station' && this.deck) { const talk = this.deck.talk.input; source.connect(talk); source.onended = () => source.disconnect(talk); }
    else if (channel === 'handset') {
      const high = ctx.createBiquadFilter(), low = ctx.createBiquadFilter(), drive = ctx.createWaveShaper(), curve = new Float32Array(256);
      high.type = 'highpass'; high.frequency.value = 380; low.type = 'lowpass'; low.frequency.value = 3200;
      for (let i = 0; i < 256; i++) { const x = i / 128 - 1; curve[i] = Math.tanh(x * 2.2) / Math.tanh(2.2); } drive.curve = curve;
      source.connect(high); high.connect(low); low.connect(drive); drive.connect(bus);
      source.onended = () => { source.disconnect(); high.disconnect(); low.disconnect(); drive.disconnect(); };
      this.play('radio');
    } else { source.connect(bus); source.onended = () => source.disconnect(); }
    // Ambience and music sit lower while anyone is talking, then come back up.
    this.talking++; this.duck(0.42, 0.25);
    const ended = source.onended; source.onended = e => { ended?.call(source, e); if (--this.talking <= 0) { this.talking = 0; this.duck(1, 0.9); } };
    source.start(); if (!overlap) this.speaking = source;
  }
  hush() { try { this.speaking?.stop(); } catch { /* Already finished. */ } this.speaking = undefined; }
  stop() { this.ambience(false); this.hush(); }
}
