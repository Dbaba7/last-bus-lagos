import type { GameAudio } from './audio.js';
/**
 * Recorded dialogue. Drop `<line key>.mp3` (or .m4a, .wav, .ogg) files into `src/voice/` (see
 * docs/voice-script.md) and they are bundled automatically; a line without a
 * file simply plays as a subtitle with a radio blip. Nothing is fetched that
 * does not exist, so missing recordings never produce network errors.
 */
const files = import.meta.glob('./voice/*.{mp3,m4a,wav,ogg}', { query: '?url', import: 'default', eager: true }) as Record<string, string>;
const urls = new Map(Object.entries(files).map(([path, url]) => [path.slice(8).replace(/\.[^.]+$/, ''), url]));
export const voiceCount = () => urls.size;
/** True when a recording exists for this file key. */
export const hasVoice = (key: string) => urls.has(key);
/**
 * Loads items a few at a time, most-wanted first. Kept apart from fetch and Web Audio so the
 * ordering, batching and waiting can be tested. Keys it does not know about count as settled.
 */
export class VoiceQueue<T> {
  readonly ready = new Map<string, T>(); readonly failed = new Set<string>();
  private pending: string[]; private active = 0; private started = false; private known: Set<string>;
  private waiters = new Set<() => void>();
  constructor(keys: Iterable<string>, private load: (key: string) => Promise<T>, private batch = 6, private onReady?: (key: string, value: T) => void) { this.pending = [...keys]; this.known = new Set(this.pending); }
  settled(key: string) { return !this.known.has(key) || this.ready.has(key) || this.failed.has(key); }
  /** Moves these keys to the front of the queue, in the order given. */
  prioritize(keys: string[]) { const want = keys.filter(k => this.pending.includes(k)); if (want.length) this.pending = [...want, ...this.pending.filter(k => !want.includes(k))]; }
  /** Starts (or keeps) `batch` loads running in parallel until the queue is empty. */
  start() { this.started = true; while (this.active < this.batch && this.pending.length) this.run(this.pending.shift()!); }
  private run(key: string) {
    this.active++;
    this.load(key).then(value => { this.ready.set(key, value); this.onReady?.(key, value); }, error => { this.failed.add(key); console.warn(`Voice line ${key} could not be decoded; using its subtitle only.`, error); })
      .finally(() => { this.active--; for (const w of [...this.waiters]) w(); if (this.started) this.start(); });
  }
  /** Resolves once every key is decoded or has failed, reporting progress as it goes. These keys jump the queue. */
  wait(keys: string[], progress?: (done: number, total: number) => void) {
    const want = [...new Set(keys)].filter(k => this.known.has(k)); this.prioritize(want);
    return new Promise<void>(resolve => {
      const check = () => { const done = want.filter(k => this.settled(k)).length; progress?.(done, want.length); if (done === want.length) { this.waiters.delete(check); resolve(); } };
      this.waiters.add(check); check();
    });
  }
}
// Downloading needs no gesture, so the queue starts at page load; decoding waits for the audio context, which
// the first gesture creates. Until then the six most-wanted files download and wait, so they decode at once.
const listeners = new Set<(key: string, seconds: number) => void>();
let gesture!: (audio: GameAudio) => void; const unlocked = new Promise<GameAudio>(resolve => { gesture = resolve; });
const queue = new VoiceQueue(urls.keys(), async key => {
  const response = await fetch(urls.get(key)!); if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const data = await response.arrayBuffer(); return (await unlocked).decode(data);
}, 6, (key, buffer) => { for (const l of listeners) l(key, buffer.duration); });
/** Starts downloading recordings, these keys first. No decoding happens until `loadVoices`. */
export function prefetchVoices(first: string[] = []) { queue.prioritize(first); queue.start(); }
/** Allows decoding (call on the first user gesture, once the audio context may exist) and keeps six loads running. */
export function loadVoices(audio: GameAudio) { gesture(audio); queue.start(); }
/** Calls back with each recording's length as soon as it is decoded (and at once for those already decoded). */
export function onVoice(listener: (key: string, seconds: number) => void) { listeners.add(listener); for (const [key, buffer] of queue.ready) listener(key, buffer.duration); return () => listeners.delete(listener); }
/** Waits until these recordings are ready (or failed); they jump the queue. */
export function waitForVoices(audio: GameAudio, keys: string[], progress?: (done: number, total: number) => void) { const p = queue.wait(keys, progress); loadVoices(audio); return p; }
const RADIO = new Set(['CONTROL', 'UNIT SEVEN', 'RADIO']);
/** True when a line is heard over a police radio and gets the handset filter. A broadcast comes out of the bus radio instead. */
export const radioLine = (line: { speaker: string; radio?: boolean; station?: boolean }) => !line.station && (line.radio ?? RADIO.has(line.speaker));
/** Which recording and wording to use: the clean alternative when Mature language is off. */
export function wording(key: string, line: { text: string; clean?: string }, mature: boolean) { return !mature && line.clean ? { key: `${key}-clean`, text: line.clean } : { key, text: line.text }; }
/** Plays a line if a recording exists. Returns false so the caller can fall back to a radio blip. `overlap` talks over a line already playing. */
export function speak(audio: GameAudio, key: string, line: { speaker: string; radio?: boolean; station?: boolean }, overlap = false) {
  const buffer = queue.ready.get(key); if (!buffer) return false;
  audio.speak(buffer, line.station ? 'station' : radioLine(line) ? 'handset' : 'room', overlap); return true;
}
