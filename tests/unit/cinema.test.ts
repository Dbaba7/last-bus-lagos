import { expect, it } from 'vitest';
import type { Cutscene } from '@lastbus/shared';
import { Director } from '../../apps/client/src/cinema.js';
const C = (x: number, y: number, z: number) => ({ x, y, z });
const scene: Cutscene = {
  id: 'test', fadeIn: 0.5, fadeOut: 0.4,
  cast: [{ id: 'femi', look: 'femi', at: C(0, 0, 0), yaw: 0, pose: 'seated', keep: true }, { id: 'ada', look: 'ada', at: C(2, 0, 0), yaw: 0 }],
  shots: [
    { from: C(0, 2, -5), to: C(0, 2, -4), look: C(0, 1, 0), seconds: 2, line: 'a' },
    { from: C(5, 2, 0), to: C(5, 2, 1), look: C(0, 1, 0), seconds: 2, blend: 1, fov: 40, fovTo: 30 },
    { from: C(0, 3, 3), to: C(0, 3, 3), look: C(0, 1, 0), seconds: 1.5 }
  ],
  cues: [
    { shot: 0, at: 0.5, actor: 'femi', pose: 'stand' }, { shot: 0, at: 1, actor: 'femi', to: C(0, 0, 3), face: Math.PI, speed: 2 },
    { shot: 0, at: 1.5, sound: 'door' }, { shot: 1, at: 0.2, prop: 'last-bus', path: [C(10, 0, 0), C(40, 0, 0)], speed: 8, door: 1 },
    { shot: 1, at: 0.5, fade: 1, seconds: 0.2, color: 'white' }, { shot: 1, at: 1, grade: 'cold', seconds: 2 }, { shot: 2, at: 0.1, actor: 'ada', gesture: 'look-up' }
  ]
};
function play(lengths: Record<string, number> = {}) {
  const log: string[] = [];
  const d = new Director(scene, shot => Math.max(shot.seconds, lengths[shot.line ?? ''] ?? 0), { shot: i => log.push(`shot ${i}`), sound: k => log.push(`sound ${k}`), grade: g => log.push(`grade ${g}`) }, { 'last-bus': { x: 0, z: 0, yaw: Math.PI / 2 } });
  return { d, log };
}
it('fires cues at their times, moves staged actors and fades in from black', () => {
  const { d, log } = play(); expect(d.fade.alpha).toBe(1); expect(log).toEqual(['shot 0']);
  for (let i = 0; i < 34; i++) d.update(1 / 30);
  expect(d.fade.alpha).toBeLessThan(0.1); expect(d.actors.get('femi')!.pose).toBe('stand'); expect(d.actors.get('femi')!.z).toBeGreaterThan(0);
  for (let i = 0; i < 72; i++) d.update(1 / 30); expect(log).toContain('sound door');
  expect(d.shot).toBe(1); expect(d.actors.get('femi')!.z).toBeCloseTo(3, 1); expect(d.actors.get('femi')!.yaw).toBeCloseTo(Math.PI, 1);
});
it('a recorded line longer than the written timing holds the shot until it has been spoken', () => {
  const { d } = play({ a: 3.5 }); for (let i = 0; i < 90; i++) d.update(1 / 30); expect(d.shot).toBe(0); for (let i = 0; i < 20; i++) d.update(1 / 30); expect(d.shot).toBe(1);
});
it('a click ends the shot: its state cues land at once, its one-off sounds are dropped', () => {
  const { d, log } = play(); d.update(0.1); d.next();
  expect(d.shot).toBe(1); expect(d.actors.get('femi')).toMatchObject({ pose: 'stand', z: 3 }); expect(d.actors.get('femi')!.yaw).toBeCloseTo(Math.PI);
  expect(log).not.toContain('sound door');
});
it('holding skip lands every remaining state cue, including props and grades, and ends on black', () => {
  const { d, log } = play(); d.update(0.1); d.skip();
  expect(d.done).toBe(true); expect(d.props.get('last-bus')).toMatchObject({ x: 40, z: 0, door: 1 }); expect(d.actors.get('ada')!.gesture).toBe('look-up');
  expect(log).toContain('grade cold'); expect(d.fade.alpha).toBe(1); expect(d.actors.get('femi')!.keep).toBe(true);
});
it('a blended shot moves on from where the camera was instead of cutting, and pushes in its field of view', () => {
  const { d } = play(); for (let i = 0; i < 54; i++) d.update(1 / 30); d.next();
  const first = d.update(1 / 60); expect(first.pos.x).toBeLessThan(1); expect(first.pos.z).toBeLessThan(-3);
  for (let i = 0; i < 50; i++) d.update(1 / 30); const later = d.update(1 / 60); expect(later.pos.x).toBeCloseTo(5, 1); expect(later.fov).toBeLessThan(40);
});
it('a moving prop accelerates along its path', () => {
  const { d } = play(); d.next(); for (let i = 0; i < 15; i++) d.update(1 / 30); const early = d.props.get('last-bus')!.x;
  for (let i = 0; i < 15; i++) d.update(1 / 30); const later = d.props.get('last-bus')!.x; expect(later - early).toBeGreaterThan(early); expect(later).toBeGreaterThan(0);
});
it('a line whose recording arrives mid-shot restarts from then, stretching the shot without the camera jumping back', () => {
  const lengths: Record<string, number> = {}, { d } = (() => { const d = new Director(scene, shot => Math.max(shot.seconds, lengths[shot.line ?? ''] ?? 0)); return { d }; })();
  for (let i = 0; i < 15; i++) d.update(1 / 30); const before = d.update(1 / 60).pos.z;
  lengths.a = 3; expect(d.lateLine('b')).toBe(false); expect(d.lateLine('a')).toBe(true); expect(d.lateLine('a')).toBe(false);
  expect(d.span).toBeCloseTo(d.t + 3, 2); const after = d.update(1 / 60).pos.z; expect(after).toBeGreaterThanOrEqual(before);
  for (let i = 0; i < 80; i++) d.update(1 / 30); expect(d.shot).toBe(0); for (let i = 0; i < 20; i++) d.update(1 / 30); expect(d.shot).toBe(1);
  expect(d.update(0).pos.x).toBeGreaterThan(0);
});
it('a line is not restarted once most of its shot has played', () => {
  const d = new Director(scene, shot => shot.seconds); for (let i = 0; i < 80; i++) d.update(1 / 60); expect(d.lateLine('a')).toBe(false);
});
it('the voice queue loads in parallel batches, puts wanted keys first and waits for them', async () => {
  const { VoiceQueue } = await import('../../apps/client/src/voice.js');
  const started: string[] = [], resolvers = new Map<string, (v: number) => void>();
  const q = new VoiceQueue(['a', 'b', 'c', 'd', 'e'], key => new Promise<number>((resolve, reject) => { started.push(key); key === 'e' ? reject(new Error('bad')) : resolvers.set(key, resolve); }), 2);
  const progress: string[] = []; const waited = q.wait(['d', 'e', 'missing'], (done, total) => progress.push(`${done}/${total}`));
  q.start(); expect(started).toEqual(['d', 'e']);
  await Promise.resolve(); await Promise.resolve(); expect(started).toEqual(['d', 'e', 'a']);
  resolvers.get('d')!(1.5); await waited; expect(q.ready.get('d')).toBe(1.5); expect(q.failed.has('e')).toBe(true); expect(progress.at(-1)).toBe('2/2');
  for (let i = 0; i < 6; i++) await Promise.resolve(); expect(started).toEqual(['d', 'e', 'a', 'b']);
});
it('a caption shows at its time and is dropped when its shot is skipped', () => {
  const quiet: Cutscene = { id: 'caption', shots: [{ from: C(0, 2, 0), to: C(0, 2, 1), look: C(0, 1, 5), seconds: 3 }, { from: C(0, 2, 0), to: C(0, 2, 1), look: C(0, 1, 5), seconds: 3 }], cues: [{ shot: 0, at: 0.5, caption: 'South checkpoint', sub: '18:31', seconds: 2 }, { shot: 1, at: 0.5, caption: '18:40' }] };
  const shown: string[] = [], d = new Director(quiet, shot => shot.seconds, { caption: (text, sub, seconds) => shown.push(`${text}|${sub}|${seconds}`) });
  for (let i = 0; i < 20; i++) d.update(1 / 30); expect(shown).toEqual(['South checkpoint|18:31|2']); d.next(); d.skip(); expect(shown).toHaveLength(1);
});
it('staged actors carry who they speak for and what they hold', () => {
  const d = new Director({ id: 'cast', shots: scene.shots, cast: [{ id: 'corporal', look: 'police', speaker: 'corporal', at: C(0, 0, 0), yaw: 0 }, { id: 'ada', look: 'ada', at: C(1, 0, 0), yaw: 0, folder: true }] }, shot => shot.seconds);
  expect(d.actors.get('corporal')).toMatchObject({ speaker: 'corporal' }); expect(d.actors.get('ada')).toMatchObject({ folder: true });
});
