import { expect, it } from 'vitest';
import { MISSIONS, CAMPAIGN, MAPS, StorySession, TrainingSession, Agent, arenaNav, navFor, clearPosition, groundHeight, neutral, RULES, eyeHeight, worldRayHit, type InputFrame, type Vec3 } from '@lastbus/shared';
const mission = MISSIONS['signal-lost'];
const nav = arenaNav();
const at = (p: Vec3) => ({ x: p.x, y: groundHeight(p.x, p.z, (p.y ?? 0) + 0.6), z: p.z });
function frame(session: StorySession | TrainingSession, extra: Partial<InputFrame> = {}): InputFrame { const p = session.player; return { ...neutral(0, p.life, 0), yaw: p.yaw, pitch: p.pitch, ...extra }; }
it('every mission position is standable and every interactable is reachable from the start', () => {
  for (const m of Object.values(MISSIONS)) {
    const world = MAPS[m.map ?? 'ojuelegba'].world, grid = navFor(world), stand = (p: Vec3) => ({ x: p.x, y: groundHeight(p.x, p.z, 0.6, world), z: p.z });
    const points = [m.start.at, ...m.objectives.flatMap(o => [o.at, o.checkpoint?.at].filter(Boolean) as Vec3[]), ...Object.values(m.groups).flat().map(d => d.at), ...m.interactables.filter(i => !i.at.y).map(i => i.at)];
    for (const p of points) expect(clearPosition(stand(p), world), `${m.id} ${p.x},${p.z}`).toBe(true);
    for (const item of [...m.interactables.map(i => i.at), ...Object.values(m.groups).flat().filter(d => d.role !== 'holder').map(d => d.at)]) expect(grid.path(m.start.at, item), `${m.id} ${item.x},${item.z}`).not.toBeNull();
  }
  expect(CAMPAIGN.chapters.filter(c => c.status === 'playable').every(c => c.missions.every(id => MISSIONS[id]))).toBe(true);
});
it('navigation paths avoid solid geometry', () => {
  const path = nav.path({ x: 0, y: 0, z: -28 }, { x: -36, y: 0, z: 14 })!; expect(path.length).toBeGreaterThan(10);
  for (const p of path) expect(clearPosition({ x: p.x, y: p.y + RULES.stepHeight + 0.05, z: p.z })).toBe(true);
});
it('agents cannot see the player through a wall, but do in the open', () => {
  const session = new StorySession(mission, 'normal', 'Ada'); const p = session.player;
  const agent = new Agent({ id: 'probe', at: { x: 0, y: 0, z: 0 }, yaw: Math.PI, role: 'guard' }, session.sim.add('probe', 'probe', 1), nav, 'normal');
  session.sim.ready('probe');
  // Player inside Unity Electricals, probe outside the solid west building: wall between them.
  Object.assign(p, { x: -16, y: 0, z: -15 }); Object.assign(agent.player, { x: -32, y: 0, z: -15, yaw: Math.PI / 2 });
  for (let i = 0; i < 60; i++) agent.think(p, [agent], i * RULES.dt, RULES.dt); expect(agent.seesTarget).toBe(false); expect(agent.awareness).toBe(0);
  Object.assign(agent.player, { x: -20, z: -4, yaw: 0 }); Object.assign(p, { x: -20, z: 3 });
  let fired = false; for (let i = 0; i < 90; i++) fired ||= agent.think(p, [agent], 3 + i * RULES.dt, RULES.dt).fire;
  expect(agent.seesTarget).toBe(true); expect(agent.awareness).toBe(1); expect(fired).toBe(true);
});
it('the mission plays from briefing objective to completion through its real conditions', () => {
  let s = new StorySession(mission, 'normal', 'Ada'); expect(s.objective?.id).toBe('junction');
  const walk = (to: Vec3) => Object.assign(s.player, at(to), { vx: 0, vz: 0 });
  const face = (to: Vec3) => { s.player.yaw = Math.atan2(to.x - s.player.x, to.z - s.player.z); };
  const run = (ticks: number, input: Partial<InputFrame> = {}, interact = false) => { for (let i = 0; i < ticks && s.state === 'playing'; i++) { s.player.health = 100; s.step(frame(s, { yaw: s.player.yaw, ...input }), interact); } };
  const interact = (id: string) => { const item = mission.interactables.find(i => i.id === id)!; walk({ x: item.at.x, y: 0, z: item.at.z - 0.6 * Math.sign(item.at.z || 1) }); face(item.at); run(Math.ceil(item.hold * 30) + 5, {}, true); };
  const clear = (groups: string[]) => { for (const a of s.agents.values()) if (groups.includes(a.group)) a.player.health = 0; run(2); };
  walk({ x: 0, y: 0, z: -3 }); run(2); expect(s.objective?.id).toBe('danfo');
  // Holding E for less than the full time does not complete; releasing resets progress.
  const danfo = mission.interactables.find(i => i.id === 'danfo')!; walk({ x: danfo.at.x, y: 0, z: danfo.at.z - 0.5 }); face(danfo.at); run(20, {}, true); run(2); expect(s.objective?.id).toBe('danfo');
  interact('danfo'); expect(s.objective?.id).toBe('yard'); expect(s.checkpoint).toBe(2);
  expect([...s.agents.values()].filter(a => a.group === 'yard')).toHaveLength(s.roster('yard').length);
  run(5); expect(s.objective?.id).toBe('yard'); clear(['yard']); expect(s.objective?.id).toBe('relay');
  interact('relay'); expect(s.relay).toBe(true); expect(s.objective?.id).toBe('defend');
  // Defending outside the zone does not advance the timer.
  walk({ x: -10, y: 0, z: 0 }); run(30 * 50); expect(s.objective?.id).toBe('defend'); clear(['wave1', 'wave2']); expect(s.objective?.id).toBe('defend');
  walk({ x: -29.5, y: 0, z: 16 }); run(30 * 46); clear(['wave1', 'wave2']); run(2); expect(s.objective?.id).toBe('femi');
  // Death fails the mission; retry restores the checkpoint with fresh enemies and a full loadout.
  s.player.guns.rifle.ammo = 3; s.player.health = 0; s.step(frame(s), false); expect(s.state).toBe('failed');
  s = s.retry(); expect(s.state).toBe('playing'); expect(s.objective?.id).toBe('femi'); expect(s.player.guns.rifle.ammo).toBe(30); expect(s.relay).toBe(true);
  expect([...s.agents.values()].map(a => a.group)).toEqual(s.roster('press').map(() => 'press'));
  clear(['press']); interact('femi'); expect(s.following).toBe(true); expect(s.objective?.id).toBe('park');
  clear(['park']); expect(s.objective?.id).toBe('board');
  // The bus does not leave without Femi.
  const board = mission.objectives.find(o => o.id === 'board')!.at!; walk(board); s.npc!.x = board.x - 9; s.npc!.z = board.z - 5; s.player.yaw = 0; for (let i = 0; i < 3; i++) s.step(frame(s, { yaw: 0 }), false); expect(s.state).toBe('playing');
  Object.assign(s.npc!, { x: board.x - 1, z: board.z - 1.5 }); walk(board); s.step(frame(s), false);
  // The bus leaves with Femi: its collision is gone, the city comes back on, and Ada walks back to the checkpoint.
  expect(s.objective?.id).toBe('walkback'); expect(s.cutscenes).toContain('outro'); expect(s.npcView()).toBeUndefined();
  expect([...s.flags]).toEqual(expect.arrayContaining(['bus-gone', 'city', 'night'])); expect(s.sim.world.some(b => b.id === 'van-w~n')).toBe(false); expect(s.clock).toMatch(/22:41/);
  walk({ x: 8.4, y: 0, z: -26 }); s.step(frame(s), false); expect(s.state).toBe('complete'); expect(s.cutscenes).toContain('sky'); expect(s.flags.has('blackout')).toBe(true);
  expect(s.stats.time).toBeGreaterThan(0);
});
it('a fresh session after completion has no stale state', () => {
  const a = new StorySession(mission, 'hard', 'Ada'); a.player.kills = 9; const b = a.restart();
  expect(b.index).toBe(0); expect(b.agents.size).toBe(0); expect(b.player.kills).toBe(0); expect(b.relay).toBe(false); expect(b.sim).not.toBe(a.sim);
});
it('an engaged enemy fights back and can down an idle player over time', () => {
  const s = new StorySession(mission, 'hard', 'Ada'); Object.assign(s.player, { x: 0, y: 0, z: -2 });
  const p = s.player; const agent = (s as unknown as { addAgent(d: object, t: number, g: string): Agent }).addAgent({ id: 'shooter', at: { x: 0, y: 0, z: 12 }, yaw: Math.PI, role: 'guard', weapon: 'rifle' }, 1, 'test');
  for (let i = 0; i < 30 * 15 && s.state === 'playing'; i++) s.step(frame(s), false);
  expect(agent.awareness).toBe(1); expect(p.health).toBeLessThan(100); void eyeHeight;
});
it('training targets stay put and respawn; bots are labelled and never real players', () => {
  const t = new TrainingSession('targets', 'You', 'normal'); const target = t.sim.players.get('target-0')!; const home = { x: target.x, z: target.z };
  target.health = 0; target.respawnAt = t.sim.now; for (let i = 0; i < 3; i++) t.step(frame(t)); expect(target.health).toBe(100); expect(target.x).toBeCloseTo(home.x); expect(target.z).toBeCloseTo(home.z);
  const bots = new TrainingSession('bots', 'You', 'easy'); expect([...bots.sim.players.values()].filter(p => p.id !== 'you').every(p => p.name.startsWith('BOT'))).toBe(true);
  for (let i = 0; i < 30 * 5; i++) bots.step(frame(bots)); expect([...bots.agents.values()].some(a => Math.hypot(a.player.vx, a.player.vz) > 0.5 || a.player.x !== a.def.at.x)).toBe(true);
});
it('cutscenes queue at the right beats, reference real lines, and are skipped on checkpoint retries', () => {
  for (const scene of Object.values(mission.cutscenes)) for (const shot of scene.shots) { expect(shot.seconds).toBeGreaterThan(0); if (shot.line) expect(mission.lines[shot.line], shot.line).toBeDefined(); }
  for (const o of mission.objectives) for (const a of [...(o.onStart ?? []), ...(o.onComplete ?? [])]) if ('cutscene' in a) expect(mission.cutscenes[a.cutscene]).toBeDefined();
  const s = new StorySession(mission, 'normal', 'Ada'); expect(s.cutscenes).toEqual(['checkpoint', 'intro']);
  s.finishCutscene(); s.finishCutscene(); expect(s.cutscenes).toEqual([]);
  const retry = new StorySession(mission, 'normal', 'Ada', 2, 1); expect(retry.cutscenes).toEqual([]);
  // Recorded voice lengths extend how long a subtitle stays up, never shorten it.
  s.voiceSeconds = { c2: 9 }; expect(s.duration('c2', 5)).toBeCloseTo(9.35); expect(s.duration('a1', 4)).toBe(4);
});

it('lower difficulties face fewer enemies, reinforcements arrive one by one with a warning', () => {
  const count = (level: 'easy' | 'normal' | 'hard') => { const s = new StorySession(mission, level, 'Ada'); return Object.keys(mission.groups).reduce((n, g) => n + s.roster(g).length, 0); };
  expect(count('easy')).toBeLessThan(count('normal')); expect(count('normal')).toBeLessThanOrEqual(count('hard'));
  const s = new StorySession(mission, 'hard', 'Ada', 4, 1); Object.assign(s.player, { x: -29.5, z: 16 });
  for (let i = 0; i < 30 * 4; i++) { s.player.health = 100; s.step({ ...neutral(0, s.player.life, 0), yaw: 0 }, false); }
  expect([...s.agents.values()].filter(a => a.group === 'wave1')).toHaveLength(1); expect(s.hud().notice).toMatch(/Hostiles incoming from the (north|north-east|north-west)/);
  for (let i = 0; i < 30 * 4; i++) { s.player.health = 100; s.step({ ...neutral(0, s.player.life, 0), yaw: 0 }, false); }
  expect([...s.agents.values()].filter(a => a.group === 'wave1').length).toBeGreaterThan(1);
});
it('cutlass attackers close in and strike at arm length but never shoot', () => {
  const s = new StorySession(mission, 'normal', 'Ada'); Object.assign(s.player, { x: 0, y: 0, z: -2 }); const ammo = 0;
  const blade = (s as unknown as { addAgent(d: object, t: number, g: string): Agent }).addAgent({ id: 'blade', at: { x: 0, y: 0, z: 9 }, yaw: Math.PI, role: 'rusher', weapon: 'sidearm', melee: true }, 1, 't');
  let shots = 0, slashes = 0;
  for (let i = 0; i < 30 * 12 && s.state === 'playing'; i++) for (const e of s.step({ ...neutral(0, s.player.life, 0), yaw: 0 }, false)) { if (e.type === 'shot' && e.player === 'blade') shots++; if (e.type === 'hit' && e.melee) slashes++; }
  expect(shots).toBe(ammo); expect(slashes).toBeGreaterThan(0); expect(Math.hypot(blade.player.x, blade.player.z + 2)).toBeLessThan(2.5);
});
it('easy regenerates faster than hard', () => {
  const session = (level: 'easy' | 'hard') => new StorySession(mission, level, 'Ada');
  const heal = (level: 'easy' | 'hard') => { const s = session(level); s.player.health = 30; for (let i = 0; i < 30; i++) s.step({ ...neutral(0, s.player.life, 0), yaw: 0 }, false); return s.player.health; };
  expect(heal('easy')).toBeGreaterThan(heal('hard') + 15); expect(session('easy').sim.options.regenDelay).toBeLessThan(session('hard').sim.options.regenDelay);
});

it('every cutscene cue names a real line, actor or prop, and a checkpoint retry on the walk back restores the world', () => {
  for (const m of Object.values(MISSIONS)) for (const scene of Object.values(m.cutscenes)) {
    const cast = new Set((scene.cast ?? []).map(a => a.id));
    for (const cue of scene.cues ?? []) {
      expect(cue.shot, `${scene.id}`).toBeLessThan(scene.shots.length);
      if ('actor' in cue) expect(cast.has(cue.actor), `${scene.id} ${cue.actor}`).toBe(true);
      if ('prop' in cue) expect(['last-bus', 'danfo-247']).toContain(cue.prop);
      if ('say' in cue) expect(m.lines[cue.say], cue.say).toBeDefined();
    }
    for (const shot of scene.shots) if (shot.line) expect(m.lines[shot.line], shot.line).toBeDefined();
  }
  for (const m of Object.values(MISSIONS)) for (const o of m.objectives) for (const a of [...(o.onStart ?? []), ...(o.onComplete ?? [])]) if ('say' in a) for (const key of a.say) expect(m.lines[key], key).toBeDefined();
  const walkback = mission.objectives.findIndex(o => o.id === 'walkback'), retry = new StorySession(mission, 'normal', 'Ada', walkback, 1);
  expect(retry.objective?.id).toBe('walkback'); expect(retry.flags.has('city')).toBe(true); expect(retry.sim.world.some(b => b.id === 'van-w~n')).toBe(false); expect(retry.npcView()).toBeUndefined();
  // The kept lines and recordings from the original chapter are still there.
  for (const key of ['i1', 'i2', 'o1', 'c1', 'c2', 'a1', 'a2', 'a3', 'a4', 'a5', 'a6', 'c3', 'c4', 's1', 'c5', 'c6', 'f1', 'a7', 'f2', 'c7', 'a8', 'c8']) expect(mission.lines[key], key).toBeDefined();
  expect(mission.ending?.cards.map(c => c.kind)).toEqual(['complete', 'time', 'chapter']);
});
it('delayed lines arrive later, and lines with clean wording keep the strong version as the default text', () => {
  const s = new StorySession(mission, 'normal', 'Ada', mission.objectives.findIndex(o => o.id === 'walkback'), 0);
  s.finishCutscene(); const said: string[] = [];
  for (let i = 0; i < 30 * 8; i++) { s.step(frame(s), false); const sub = s.hud().subtitle; if (sub && !said.includes(sub.key)) said.push(sub.key); }
  expect(said).toContain('a13'); expect(said).not.toContain('a14');
  expect(mission.lines.a17.text).toMatch(/hell/); expect(mission.lines.a17.clean).not.toMatch(/hell/);
});

it('chapter 2 opens in the shelter unarmed, is searched in any order, and ends at the door', () => {
  const m = MISSIONS.aftermath; let s = new StorySession(m, 'normal', 'Ada');
  expect(s.sim.world).toBe(MAPS.shelter.world); expect(s.armed).toBe(false); expect(s.cutscenes).toEqual(['wake']); s.finishCutscene();
  const run = (ticks: number, extra: Partial<InputFrame> = {}, use = false) => { const events = []; for (let i = 0; i < ticks; i++) events.push(...s.step(frame(s, { yaw: s.player.yaw, ...extra }), use)); return events; };
  // No weapon: pulling the trigger does nothing until the pistol is recovered.
  expect(run(10, { fire: true, trigger: true }).filter(e => e.type === 'shot')).toHaveLength(0);
  const go = (to: Vec3) => Object.assign(s.player, { x: to.x, y: groundHeight(to.x, to.z, 0.6, s.sim.world), z: to.z, vx: 0, vz: 0 });
  go({ x: 0, y: 0, z: 3.9 }); run(2); expect(s.objective?.id).toBe('search'); expect(s.cutscenes).toContain('window'); s.finishCutscene();
  const use = (id: string) => { const item = m.interactables.find(i => i.id === id)!; const from = { x: item.at.x, y: 0, z: item.at.z + (item.at.z < 0 ? 0.9 : -0.9) }; go(from); s.player.yaw = Math.atan2(item.at.x - from.x, item.at.z - from.z); run(Math.ceil(item.hold * 30) + 4, {}, true); };
  use('phone'); expect(s.messages).toEqual(['phone']); expect(s.hud().objective?.progress).toBeCloseTo(1 / 3);
  use('radio'); expect(s.objective?.id).toBe('search'); use('pistol'); expect(s.armed).toBe(true); expect(s.player.weapon).toBe('sidearm'); expect(s.player.guns.rifle.reserve).toBe(0);
  expect(s.objective?.id).toBe('exit');
  // A retry from the search checkpoint is armed only once the pistol is found again.
  const retry = s.retry(); expect(retry.objective?.id).toBe('search'); expect(retry.armed).toBe(false);
  go({ x: 6.6, y: 0, z: 0 }); run(2); expect(s.state).toBe('complete'); expect(s.cutscenes).toContain('doorway');
  expect(m.ending?.cards[0].text).toMatch(/Third Mainland Bridge/); expect(CAMPAIGN.chapters[1].missions).toEqual(['aftermath']);
  // Kasali stays out of the story, and nobody is named as the one behind it.
  for (const mission of Object.values(MISSIONS)) for (const line of Object.values(mission.lines)) expect(line.text).not.toMatch(/kasali/i);
  s = new StorySession(m, 'normal', 'Ada'); expect(s.player.y).toBeCloseTo(0, 3);
});
it('no cutscene camera sits in or against geometry, and nothing nearby blocks what it looks at', () => {
  const problems: string[] = [], at = (a: Vec3, b: Vec3, t: number) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: a.z + (b.z - a.z) * t });
  for (const m of Object.values(MISSIONS)) {
    // Boxes a mission removes (the bus that drives away) are gone by the time the shots that cross them play.
    const removed = new Set(m.objectives.flatMap(o => [...o.onStart ?? [], ...o.onComplete ?? []]).flatMap(a => 'remove' in a ? a.remove : []));
    const world = MAPS[m.map ?? 'ojuelegba'].world.filter(b => !removed.has(b.id));
    for (const scene of Object.values(m.cutscenes)) scene.shots.forEach((s, i) => {
      for (const t of [0, 0.5, 1]) {
        const p = at(s.from, s.to, t), look = at(s.look, s.lookTo ?? s.look, t), name = `${m.id}/${scene.id} shot ${i + 1} at ${t}`;
        for (const b of world) if (b.kind !== 'ground' && Math.abs(p.x - b.x) < b.w / 2 + 0.2 && Math.abs(p.y - b.y) < b.h / 2 + 0.2 && Math.abs(p.z - b.z) < b.d / 2 + 0.2) problems.push(`${name}: camera against ${b.id}`);
        const d = { x: look.x - p.x, y: look.y - p.y, z: look.z - p.z }, length = Math.hypot(d.x, d.y, d.z), hit = worldRayHit(p, { x: d.x / length, y: d.y / length, z: d.z / length }, length, world);
        // Far skyline buildings may cross a shot aimed at the sky; anything within 20 m is a wall in the face.
        if (hit.box && hit.distance < Math.min(20, length * 0.8, length - 0.6)) problems.push(`${name}: view blocked at ${hit.distance.toFixed(1)} m by ${hit.box.id}`);
      }
    });
  }
  expect(problems).toEqual([]);
});
it('Ada stays at the checkpoint in the opening: a new scene and voices, the old recordings untouched, and her radio dies on a line she has already recorded', () => {
  const m = MISSIONS['signal-lost'], scene = m.cutscenes.checkpoint, keys = scene.shots.flatMap(s => s.line ? [s.line] : []);
  expect(m.objectives[0].onStart?.filter(a => 'cutscene' in a)).toEqual([{ cutscene: 'checkpoint' }, { cutscene: 'intro' }]);
  expect(keys).toEqual(['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'h7', 'h8', 'h9', 'h10', 'h11', 'h12', 'h13', 'a16']);
  for (const key of keys.filter(k => k.startsWith('h') && m.lines[k].speaker === 'CORPORAL')) expect(m.lines[key].voice).toBe('UNIT_SEVEN');
  expect(m.briefing.join(' ')).not.toMatch(/stalled/);
  expect(scene.cues?.some(c => 'fx' in c && c.fx === 'jam')).toBe(true);
});
