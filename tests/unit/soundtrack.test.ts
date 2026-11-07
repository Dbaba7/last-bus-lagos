import { expect, it } from 'vitest';
import { MISSIONS, StorySession, type CineCue, type Cutscene } from '@lastbus/shared';
import { Director } from '../../apps/client/src/cinema.js';
import { Radio, TRACKS, moodFor, placeholderLength, renderPlaceholder, trackFor, wavFile, type RadioOutput } from '../../apps/client/src/soundtrack.js';
const prologue = MISSIONS['the-passenger'], licensed = [{ id: 'song', title: '', artist: '', credit: '', src: 'song', placeholder: 'gen', licensed: true, cueIn: 12, cueOut: 70, unlock: '' }, { id: 'gen', title: '', artist: '', credit: '', placeholder: 'gen', licensed: true, cueIn: 0, cueOut: 90, unlock: '' }];
/** Everything the radio asks the sound engine to do, in order. */
function bench(url = 'blob:groove') {
  const log: string[] = []; let fail = () => {};
  const out: RadioOutput = { radioOn: () => log.push('on'), radioOff: click => log.push(click ? 'off click' : 'off'), radioSet: s => log.push(`set ${s.signal}`), radioBlip: () => log.push('blip'), tape: (u, _, __, failed) => { log.push(`tape ${u ?? 'stop'}`); fail = failed; } };
  const radio = new Radio(out, () => Promise.resolve(url)); return { radio, log, fail: () => fail() };
}
const settle = () => new Promise(resolve => setTimeout(resolve));
const scenes = (...ids: string[]) => ids.map(id => prologue.cutscenes[id]);
/** Runs scenes through the director the way the game does, skipped or played, and returns the moods it asked for. */
function direct(radio: Radio, chain: Cutscene[], skip: boolean) {
  const moods: string[] = [];
  for (const scene of chain) { const d = new Director(scene, shot => shot.seconds, { radio: (cue, skipping) => radio.cue(cue, skipping), ambience: mood => moods.push(mood) }, { 'danfo-247': { x: 0, z: 0, yaw: 0 } }); if (skip) d.skip(); else while (!d.done) { d.update(1 / 30); radio.flush(); } radio.flush(); }
  return moods;
}
it('a track with no file or no licence plays the placeholder, and a file never plays without both', () => {
  const song = TRACKS.find(t => t.id === 'radio-song')!; expect(song.licensed).toBe(false); expect(song.src).toBeUndefined();
  expect(trackFor('radio-song', true)).toMatchObject({ track: { id: 'danfo-groove' }, url: undefined });
  expect(trackFor('radio-song', true, { 'radio-song': 'x.mp3' })?.url).toBeUndefined();
  expect(trackFor('song', true, {}, licensed)).toMatchObject({ track: { id: 'gen' }, url: undefined });
  expect(trackFor('song', true, { song: 'song.mp3' }, licensed)).toMatchObject({ track: { id: 'song' }, url: 'song.mp3' });
  expect(trackFor('news', true)).toBeUndefined();
});
it('the streamer setting swaps a licensed track for the placeholder', () => {
  expect(trackFor('song', false, { song: 'song.mp3' }, licensed)).toMatchObject({ track: { id: 'gen' }, url: undefined });
});
it('the placeholder is 90 seconds, original to the game, the same every time, loud enough and never clipped', () => {
  const pcm = renderPlaceholder(), again = renderPlaceholder(), peak = pcm.reduce((p, v) => Math.max(p, Math.abs(v)), 0);
  expect(pcm.length / 16000).toBeCloseTo(90, 0); expect(pcm.length).toBe(placeholderLength()); expect(pcm.every((v, i) => v === again[i])).toBe(true);
  expect(peak).toBeGreaterThan(12000); expect(peak).toBeLessThan(32767);
  const rms = Math.sqrt(pcm.reduce((s, v) => s + v * v, 0) / pcm.length); expect(rms).toBeGreaterThan(1500);
  const file = wavFile(pcm); expect(file.size).toBe(44 + pcm.byteLength); expect(file.type).toBe('audio/wav');
  expect(TRACKS.find(t => t.id === 'danfo-groove')!.credit).toContain('Original');
});
it('a station already playing is left alone, so going through a scene again does not restart the song', async () => {
  const { radio, log } = bench(); radio.cue({ radio: 'play', station: 'radio-song' }); radio.flush(); await settle();
  expect(log.filter(l => l.startsWith('tape'))).toEqual(['tape blob:groove']);
  radio.cue({ radio: 'play', station: 'radio-song' }); radio.cue({ radio: 'play', signal: 0.5 }); radio.flush(); await settle();
  expect(log.filter(l => l.startsWith('tape'))).toEqual(['tape blob:groove']); expect(log).toContain('set 0.5');
});
it('retrying the prologue from a checkpoint queues no radio scene, and the song does not come back', async () => {
  const { radio, log } = bench(); const retry = new StorySession(prologue, 'normal', 'Femi', 2);
  expect(retry.cutscenes).toEqual([]); radio.off(); radio.flush(); await settle(); expect(log.filter(l => l.startsWith('tape blob'))).toEqual([]);
  const carrying = new StorySession(prologue, 'normal', 'Femi', 2); expect(moodFor(carrying.flags, false)).toBe('dusk');
});
it('skipping the whole ride never loads the song, and leaves the radio off and the street going quiet', async () => {
  const { radio, log } = bench(); const moods = direct(radio, scenes('ride', 'jam', 'stop'), true); await settle();
  expect(radio.state.on).toBe(false); expect(log.filter(l => l.startsWith('tape blob'))).toEqual([]); expect(moods.at(-1)).toBe('still');
  expect(moodFor(new StorySession(prologue, 'normal', 'Femi', 1).flags, false)).toBe('dusk');
});
it('skipping only the ride still leaves the song on for the jam, which then kills it with a click', async () => {
  const { radio, log } = bench(); direct(radio, scenes('ride'), true); await settle();
  expect(radio.state).toMatchObject({ on: true, station: 'radio-song', muffled: false }); expect(log).toContain('tape blob:groove');
  direct(radio, scenes('jam'), false); await settle(); expect(radio.state.on).toBe(false); expect(log).toContain('off click'); expect(log.at(-1)).toBe('tape stop');
});
it('playing the scenes breaks the signal down in order and ends the song before the street goes', () => {
  const { radio, log } = bench(), moods = direct(radio, scenes('ride', 'jam', 'stop'), false), signals = log.filter(l => l.startsWith('set')).map(l => Number(l.slice(4)));
  expect(signals.slice(-4)).toEqual([0.8, 0.55, 0.2, 0]); expect(moods).toEqual(['ride', 'hush', 'still']); expect(radio.state.on).toBe(false); expect(log.filter(l => l === 'blip')).toHaveLength(2);
});
it('leaving a mission silences the radio at once and stops the song', async () => {
  const { radio, log } = bench(); radio.cue({ radio: 'play', station: 'radio-song' }); radio.flush(); await settle(); radio.off(); await settle();
  expect(radio.state.on).toBe(false); expect(log.slice(-2)).toEqual(['off', 'tape stop']);
});
it('leaving while the placeholder is still being made does not start it afterwards', async () => {
  const { radio, log } = bench(); radio.cue({ radio: 'play', station: 'radio-song' }); radio.flush(); radio.off(); await settle(); expect(log).not.toContain('tape blob:groove');
});
it('a file that will not play falls back to the placeholder without a sound', async () => {
  const out = { log: [] as string[], fail: () => {} }, sink: RadioOutput = { radioOn() {}, radioOff() {}, radioSet() {}, radioBlip() {}, tape: (u, _, __, failed) => { out.log.push(u ?? 'stop'); out.fail = failed; } };
  const radio = new Radio(sink, () => Promise.resolve('blob:groove')); let picked = 0; radio.cue({ radio: 'play', station: 'radio-song' }); radio.flush(); await settle(); picked = out.log.length;
  expect(out.log).toEqual(['blob:groove']); expect(picked).toBe(1); out.fail(); radio.flush(); await settle(); expect(out.log).toEqual(['blob:groove']);
});
it('the mood follows the story: the live flag, the restored city, the blackout and the shelter', () => {
  const flags = (...f: string[]) => new Set(f);
  expect(moodFor(flags('live'), false)).toBe('live'); expect(moodFor(flags(), false)).toBe('dusk'); expect(moodFor(flags('city'), false)).toBe('restored');
  expect(moodFor(flags('city', 'blackout'), false)).toBe('dusk'); expect(moodFor(flags('live'), true)).toBe('shelter');
});
it('the song is heard for 45 to 60 seconds before 18:40 takes it', () => {
  const ride = prologue.cutscenes.ride, jam = prologue.cutscenes.jam, cues = (s: Cutscene) => s.cues ?? [], start = cues(ride).find((c): c is Extract<CineCue, { radio: unknown }> & { shot: number } => 'radio' in c && c.station === 'radio-song')!;
  const dead = cues(jam).find(c => 'radio' in c && c.signal === 0)!, heard = ride.shots.slice(start.shot).reduce((s, shot) => s + shot.seconds, 0) + jam.shots.slice(0, dead.shot).reduce((s, shot) => s + shot.seconds, 0) + (dead.at ?? 0);
  expect(heard).toBeGreaterThanOrEqual(45); expect(heard).toBeLessThanOrEqual(60);
});
it('news and the advert come out of the bus radio, in order, before the song', () => {
  const { lines, cutscenes: { ride } } = prologue, order = ride.shots.map(s => s.line); expect(lines.p8.station && lines.p11.station).toBe(true);
  const song = ride.cues!.find(c => 'radio' in c && c.station === 'radio-song')!.shot; expect(order.indexOf('p8')).toBeLessThan(order.indexOf('p11')); expect(order.indexOf('p11')).toBeLessThan(song);
});
it('Ada\'s opening is alive until 18:40 and hands over to the dead junction, even skipped', () => {
  const moods: string[] = [], d = new Director(MISSIONS['signal-lost'].cutscenes.checkpoint, shot => shot.seconds, { ambience: mood => moods.push(mood) }); d.skip(); expect(moods).toEqual(['live', 'dusk']);
});
it('a skipped scene still applies the live and jam effects, and only those', () => {
  const log: string[] = [], d = new Director({ id: 'fx', shots: [{ from: { x: 0, y: 2, z: 0 }, to: { x: 0, y: 2, z: 1 }, look: { x: 0, y: 1, z: 5 }, seconds: 2 }], cues: [{ shot: 0, at: 1, fx: 'live' }, { shot: 0, at: 1.2, fx: 'dust' }, { shot: 0, at: 1.4, fx: 'jam' }] }, shot => shot.seconds, { fx: kind => log.push(kind) });
  d.skip(); expect(log).toEqual(['live', 'jam']);
});
it('Danfo 247 only hisses from the search until the relay is back, on a retry too', () => {
  const mission = MISSIONS['signal-lost'], index = (id: string) => mission.objectives.findIndex(o => o.id === id);
  expect(new StorySession(mission, 'normal', 'Ada', index('danfo')).flags.has('dead-radio')).toBe(true); expect(new StorySession(mission, 'normal', 'Ada', index('yard')).flags.has('dead-radio')).toBe(true);
  expect(new StorySession(mission, 'normal', 'Ada', index('defend')).flags.has('dead-radio')).toBe(false);
});
it('the bus set is staged out of reach of the map, and everything in the ride uses recorded keys only', () => {
  const { ride, jam, stop } = prologue.cutscenes;
  for (const scene of [ride, jam, stop]) { const inside = scene.shots.filter(s => s.from.z > 250); expect(inside.length).toBeGreaterThan(2); for (const s of inside) { expect(Math.abs(s.from.z - 300)).toBeLessThan(5); expect(Math.abs(s.look.z - 300)).toBeLessThan(5); } }
  for (const scene of Object.values(prologue.cutscenes)) for (const shot of scene.shots) if (shot.line) expect(prologue.lines[shot.line], shot.line).toBeDefined();
});
it('skipping the attack still leaves the bag gone and Femi\'s phone on the floor, and the phone overlay is never left up', () => {
  const stop = prologue.cutscenes.stop, states: string[] = [], phones: string[] = [], d = new Director(stop, shot => shot.seconds, { cabin: state => states.push(state), phone: state => phones.push(state) }, { 'danfo-247': { x: 0, z: 0, yaw: 0 } }); d.skip();
  expect(states.at(-1)).toBe('attacked'); expect(d.actors.get('femi-in')!.bag).toBe(false); expect(phones.at(-1)).toBe('off');
  const ride: string[] = [], r = new Director(prologue.cutscenes.ride, shot => shot.seconds, { phone: state => ride.push(state) }, { 'danfo-247': { x: 0, z: 0, yaw: 0 } }); r.skip(); expect(ride).toEqual(['photo', 'sending', 'off']);
  const jam: string[] = [], j = new Director(prologue.cutscenes.jam, shot => shot.seconds, { phone: state => jam.push(state) }, { 'danfo-247': { x: 0, z: 0, yaw: 0 } }); j.skip(); expect(jam.at(-1)).toBe('dead');
});
it('the Sergeant is off the bus before the attack and is not in the jam or the stop', () => {
  const { ride, jam, stop } = prologue.cutscenes; expect(ride.cues!.some(c => 'actor' in c && c.actor === 'sergeant' && c.hide)).toBe(true);
  for (const scene of [jam, stop]) expect(scene.cast!.some(a => a.variant === 'sergeant')).toBe(false);
});
it('18:40 lands about six seconds after the buzz, and the streak reaches the ground as the blast goes off', () => {
  const { jam } = prologue.cutscenes, at = (c: CineCue) => jam.shots.slice(0, c.shot).reduce((s, shot) => s + shot.seconds, 0) + (c.at ?? 0), cues = jam.cues!;
  const buzz = cues.find(c => 'radio' in c && c.signal === 0.8)!, zero = cues.find(c => 'fx' in c && c.fx === 'jam')!, dead = cues.find(c => 'radio' in c && c.signal === 0)!; expect(at(zero) - at(buzz)).toBeCloseTo(6, 0); expect(at(dead) - at(zero)).toBeCloseTo(1.5, 0);
  const sky = MISSIONS['signal-lost'].cutscenes.sky, streak = sky.cues!.find((c): c is Extract<CineCue, { fx: unknown }> & { shot: number } => 'fx' in c && c.fx === 'streak')!, blast = sky.cues!.find(c => 'fx' in c && c.fx === 'explosion')!;
  const gap = sky.shots.slice(streak.shot, blast.shot).reduce((s, shot) => s + shot.seconds, 0); expect(Math.abs(gap - streak.seconds!)).toBeLessThan(0.6);
});
it('the sound of the blast arrives with the dust, well after the light', () => {
  const sky = MISSIONS['signal-lost'].cutscenes.sky, time = (c: CineCue) => sky.shots.slice(0, c.shot).reduce((s, shot) => s + shot.seconds, 0) + (c.at ?? 0), find = (test: (c: CineCue) => boolean) => sky.cues!.find(test)!;
  const light = find(c => 'fx' in c && c.fx === 'explosion'), wave = find(c => 'fx' in c && c.fx === 'wave') as Extract<CineCue, { fx: unknown }>, boom = find(c => 'sound' in c && c.sound === 'boom');
  expect(time(boom) - time(light)).toBeGreaterThan(5); expect(Math.abs(time(wave) + wave.seconds! - time(boom))).toBeLessThan(0.3);
});
