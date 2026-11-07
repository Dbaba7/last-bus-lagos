import { expect, it } from 'vitest';
import { writeFileSync } from 'node:fs';
import { MISSIONS, StorySession, arenaNav, neutral, RULES, type Difficulty } from '@lastbus/shared';
const m = MISSIONS['the-passenger'], nav = arenaNav(), LEVELS: Difficulty[] = ['easy', 'normal', 'hard'], ESCAPE = m.objectives.findIndex(o => o.id === 'off-road');
/** The chase, from the moment Femi lands on the road. */
const escape = (level: Difficulty) => { const s = new StorySession(m, level, 'Femi', ESCAPE); s.cutscenes.length = 0; return s; };
type Style = 'sprint' | 'hesitant' | 'patient' | 'idle';
/**
 * Plays the route. `sprint` never reacts; `hesitant` is a first-timer who looks around for three seconds before moving; `patient`
 * holds still, low, while an unaware hunter is close to its next stretch; `idle` never moves. Everything the fairness rules care
 * about is measured: when a hunter first shows a warning, when one first starts to shout, and when the first grab lands.
 */
function play(level: Difficulty, style: Style, limit = 120) {
  const s = escape(level); let t = 0, seq = 0, warned = -1, shouted = -1, grabbed = -1, waited = 0, path: { x: number; z: number }[] = [], routed = '';
  while (t < limit && s.state === 'playing') {
    const p = s.player, o = s.objective!, target = o.at ?? m.interactables[0].at, views = s.agentViews(), hunted = views.some(a => a.state === 'engage');
    if (warned < 0 && views.some(a => a.awareness >= 0.12)) warned = t;
    if (shouted < 0 && views.some(a => a.windup)) shouted = t;
    if (grabbed < 0 && s.stats.damageTaken > 0) grabbed = t;
    const via = o.id === 'press' && p.x < 10 ? { x: 10.2, z: 15 } : o.id === 'press' && p.x < 12.5 ? { x: 13, z: 15 } : target;
    if (routed !== o.id + via.x || seq % 8 === 0) { path = nav.path(p, { x: via.x, y: 0, z: via.z }) ?? []; routed = o.id + via.x; }
    const next = path.find(w => Math.hypot(w.x - p.x, w.z - p.z) > 1.5) ?? via, there = o.kind === 'interact' && Math.hypot(target.x - p.x, target.z - p.z) < 1.4;
    const yaw = o.kind === 'interact' ? Math.atan2(target.x - p.x, target.z - p.z) : Math.atan2(next.x - p.x, next.z - p.z), frame = { ...neutral(++seq, p.life, 0), yaw, pitch: 0 };
    const hold = style === 'idle' || style === 'hesitant' && t < 3 || style === 'patient' && !hunted && views.some(a => a.awareness < 1 && (Math.hypot(a.x - next.x, a.z - next.z) < 7 || Math.hypot(a.x - p.x, a.z - p.z) < 6));
    if (hold) { frame.crouch = style === 'patient'; waited += RULES.dt; } else { frame.z = there ? 0 : 1; frame.sprint = true; }
    s.step(frame, o.kind === 'interact' && style !== 'idle'); t += RULES.dt;
  }
  return { s, t, warned, shouted, grabbed, waited };
}
it('nobody can touch a player who stands still for the first ten seconds, on any level', () => {
  for (const level of LEVELS) { const { s, t, grabbed } = play(level, 'idle', 10); expect(s.state).toBe('playing'); expect(t).toBeGreaterThan(9.9); expect(grabbed).toBe(-1); }
});
it('a grab is never the first warning: a marker shows and the hunter shouts well before it lands', () => {
  for (const level of LEVELS) for (const style of ['sprint', 'hesitant', 'patient'] as Style[]) {
    const { warned, shouted, grabbed } = play(level, style);
    if (grabbed < 0) continue;
    expect(warned, `${level} ${style}`).toBeGreaterThanOrEqual(0); expect(shouted, `${level} ${style}`).toBeGreaterThanOrEqual(0);
    expect(grabbed - warned, `${level} ${style}`).toBeGreaterThan(1.2); expect(grabbed - shouted, `${level} ${style}`).toBeGreaterThanOrEqual(0.85);
  }
}, 30000);
it('a player who waits for the patrols reaches the press on every level, and a clean sprint gets through on Easy and Normal', () => {
  for (const level of LEVELS) { const { s, t } = play(level, 'patient'); expect(s.objective?.id ?? 'done', level).toMatch(/text|done/); expect(t, level).toBeGreaterThan(15); expect(t, level).toBeLessThan(120); }
  for (const level of ['easy', 'normal'] as Difficulty[]) expect(play(level, 'sprint').s.state, level).toBe('complete');
}, 30000);
it('hunters are never faster than Femi, and a chase can be lost', () => {
  for (const level of LEVELS) expect(m.pursuit!.hunters[level]).toBeLessThanOrEqual(m.pursuit!.pace);
  const s = escape('normal'), a = [...s.agents.values()][0]; let seq = 0;
  a.awareness = 1; a.lastSeen = { x: 0, y: 0, z: 0 }; a.lastSeenAt = 0; (a as unknown as { state: string }).state = 'engage';
  for (let i = 0; i < 30 * 5; i++) { s.player.x = -14; s.player.z = -12; s.step({ ...neutral(++seq, s.player.life, 0), yaw: 0, pitch: 0 }, false); }
  expect(a.state).not.toBe('engage');
});
it('a grab can be shaken off once, except on Hard, and nothing is ever shot at the player', () => {
  for (const [level, grabs] of [['easy', 2], ['normal', 2], ['hard', 1]] as const) {
    const s = escape(level) as unknown as { struck(): void; player: { health: number } };
    for (let i = 0; i < grabs - 1; i++) s.struck(); expect(s.player.health, level).toBeGreaterThan(0); s.struck(); expect(s.player.health, level).toBe(0);
  }
  expect(Object.values(m.groups).flat().every(d => d.melee && d.chase)).toBe(true);
});
it('every group spawns whole on Easy, and Signal Lost keeps its normal speed and rosters', () => {
  const s = escape('easy'); expect(s.roster('junction')).toHaveLength(m.groups.junction.length); expect(s.sim.paceScale.get('you')).toBe(m.pursuit!.pace);
  const ada = new StorySession(MISSIONS['signal-lost'], 'easy', 'Ada'); expect(ada.sim.paceScale.size).toBe(0); expect(ada.roster('yard').length).toBeLessThan(MISSIONS['signal-lost'].groups.yard.length);
});
it('the recorded Ada barks never play, and a retry starts from the last gate with a moment of grace', () => {
  const run = play('hard', 'sprint'); expect(run.s.hud().subtitle?.key ?? '').not.toMatch(/^bark/);
  const s = new StorySession(m, 'normal', 'Femi', m.objectives.findIndex(o => o.id === 'kerb'), 1); expect(s.objective?.id).toBe('kerb'); expect(Math.hypot(s.player.x + 1, s.player.z + 18)).toBeLessThan(1); expect(s.agents.size).toBeGreaterThan(0);
  let seq = 0; for (let i = 0; i < 30 * 2.5; i++) s.step({ ...neutral(++seq, s.player.life, 0), yaw: 0, pitch: 0 }, false); expect(s.agentViews().every(a => a.awareness === 0)).toBe(true);
});
it('reports the run lengths', () => {
  const rows = LEVELS.flatMap(level => (['sprint', 'hesitant', 'patient'] as Style[]).map(style => { const r = play(level, style); return `${level} ${style}: ${r.s.state} at ${r.t.toFixed(1)}s on ${r.s.objective?.id ?? 'done'}, waited ${r.waited.toFixed(1)}s, warned ${r.warned.toFixed(1)}, shouted ${r.shouted.toFixed(1)}, grabbed ${r.grabbed.toFixed(1)}`; }));
  if (process.env.OUT) writeFileSync(process.env.OUT, rows.join('\n'));
}, 30000);
it('the walk comes first: the street is alive, the Sergeant follows and the bus waits at the park, and the attack changes all of it', () => {
  const s = new StorySession(m, 'normal', 'Femi'); expect(s.objective?.id).toBe('walk'); expect(s.cutscenes).toEqual(['opening']); expect(s.flags.has('live')).toBe(true); expect(s.flags.has('parked')).toBe(true); expect(s.relay).toBe(true); expect(s.agents.size).toBe(0); expect(s.following).toBe(true); expect(s.npcView()?.seated).toBe(false);
  s.cutscenes.length = 0; s.devSkip(); expect(s.objective?.id).toBe('off-road'); expect(s.cutscenes).toEqual(['boarding', 'ride', 'jam', 'stop']); expect(s.flags.has('live')).toBe(false); expect(s.flags.has('danfo-forced')).toBe(true); expect(s.relay).toBe(false); expect(s.npcView()).toBeUndefined(); expect(Math.hypot(s.player.x + 14, s.player.z + 5.2)).toBeLessThan(0.1); expect(s.moved).toBe(true);
});
it('Femi ends up where Ada finds him, and the script keeps its mysteries off the page', () => {
  const hide = m.cutscenes.hide.cast![0], npc = MISSIONS['signal-lost'].npc!; expect([hide.at.x, hide.at.z]).toEqual([npc.at.x, npc.at.z]); expect(hide.yaw).toBe(npc.yaw); expect(hide.pose).toBe('seated');
  const text = Object.values(m.lines).map(l => l.text).join(' '); expect(text).not.toMatch(/witness list|drive/i); expect(m.lines.p5.text).toBe('Command.'); expect(m.lines.p6.text).toBe('Which command?');
  expect(Object.keys(m.lines)).toHaveLength(24); for (const scene of Object.values(m.cutscenes)) for (const shot of scene.shots) if (shot.line) expect(m.lines[shot.line], shot.line).toBeDefined();
});
it('the park aisle is clear from where Femi starts all the way to the bus', () => {
  const s = new StorySession(m, 'normal', 'Femi'); s.cutscenes.length = 0; let seq = 0, t = 0;
  while (s.objective?.id === 'walk' && t < 40) { const p = s.player; s.step({ ...neutral(++seq, p.life, 0), yaw: p.x > 11 ? Math.atan2(10 - p.x, 25.75 - p.z) : Math.atan2(-0.7 - p.x, 25.2 - p.z), pitch: 0, z: 1 }, false); t += RULES.dt; }
  expect(s.objective?.id).toBe('off-road'); expect(t).toBeGreaterThan(10); expect(t).toBeLessThan(20);
});
