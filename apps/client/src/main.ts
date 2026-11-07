import { RULES, BRAND, WEAPONS, TEAMS, WORLD, CAMPAIGN, MISSIONS, MOVE, chapterDone, openingMission, traverseHint, groundHeight, arenaNav, StorySession, TrainingSession, spreadCone, accuracy, type GameEvent, type InputFrame, type Player, type Snapshot, type TrainingKind, type Vec3, type Cutscene, type AgentView, type CineActor, type PhoneState, type SoundMood } from '@lastbus/shared';
import { Vector3, Matrix } from '@babylonjs/core/Maths/math.vector';
import { predictPlayer } from './prediction.js';
import { GameRenderer, type Extra } from './renderer.js';
import { GameConnection } from './network.js';
import { InputController } from './input.js';
import { TouchControls } from './touch.js';
import { GameAudio, type Sound } from './audio.js';
import { Radio, moodFor, placeholderUrl, type RadioCue } from './soundtrack.js';
import { load, save, keyName } from './settings.js';
import { markup, RIFLE_ICON, PISTOL_ICON } from './ui/markup.js';
import { SettingsView } from './ui/settingsView.js';
import { loadVoices, prefetchVoices, waitForVoices, onVoice, hasVoice, speak, radioLine, wording } from './voice.js';
import { Director } from './cinema.js';
import { surfaceOf } from './render/effects.js';
import './styles.css';
const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const escape = (value: string) => value.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
const clock = (s: number) => `${Math.floor(s / 60).toString().padStart(2, '0')}:${Math.floor(s % 60).toString().padStart(2, '0')}`;
const canvas = $<HTMLCanvasElement>('game');
$('app').innerHTML = markup();
const touchDefault = matchMedia('(pointer: coarse)').matches;
/**
 * Interface scale. Layouts are designed around 1600×900; on larger screens (1440p,
 * ultrawide, 4K) the whole interface layer is scaled up so text and the HUD stay a
 * comfortable size instead of shrinking into the corners. Smaller screens use the
 * responsive layouts in styles.css at native size.
 */
let uiScale = 1;
function fitInterface() {
  uiScale = Math.max(1, Math.min(2.6, Math.min(innerWidth / 1600, innerHeight / 900)));
  ($('app').style as CSSStyleDeclaration & { zoom: string }).zoom = String(uiScale);
  document.documentElement.style.setProperty('--vh', `${innerHeight / uiScale}px`);
}
fitInterface(); addEventListener('resize', fitInterface); addEventListener('orientationchange', () => setTimeout(fitInterface, 200));
const pref = load(touchDefault);
let renderer: GameRenderer;
try { renderer = new GameRenderer(canvas, pref); }
catch (error) { $('menu').hidden = true; $('status').textContent = 'This browser could not start the 3D renderer. Enable hardware acceleration and try current Chrome, Edge or Firefox.'; $('status').classList.add('visible', 'error'); throw error; }
const input = new InputController(canvas), audio = new GameAudio(), radio = new Radio(audio), network = new GameConnection();
// ── Session state. Exactly one of online / story / training is live at a time.
type Mode = 'menu' | 'online' | 'story' | 'training';
let mode: Mode = 'menu', story: StorySession | undefined, training: TrainingSession | undefined;
let snapshot: Snapshot | undefined, predicted: Player | undefined, ownId = '', sequence = 0, pending: InputFrame[] = [], busy = false, lastPhase = '', lastLife = -1, leaving = false;
let paused = false, ended = false, endTimer = 0, accumulator = 0, previousFrame = performance.now(), uiAt = 0, toastTimer: ReturnType<typeof setTimeout>, predictionTime = 0;
let prev = { x: 0, y: 0, z: 0 }, lastObjective = '', lastCheckpoint = -1, wasGrounded = true, airVy = 0, nextStep = 0, diagnosticsOn = pref.diagnostics, relayShown = false;
let hit = { until: 0, kind: '' }, damageUntil = 0, missionId = 'signal-lost';
let cinema: { id: string; director: Director } | undefined, skipHeld = 0, lineHeard = true;
/** Recording lengths by file key, filled live as each one decodes; sessions share this object, so shot lengths update mid-scene. */
const voiceSeconds: Record<string, number> = {};
const corrections: number[] = [], remoteSteps = new Map<string, number>(), feed: { html: string; until: number }[] = [], indicators: { angle: number; until: number }[] = [];
const local = () => story ?? training;
const own = (): Player | undefined => local()?.player ?? predicted;
function toast(message: string, error = false) { const s = $('status'); s.textContent = message; s.classList.toggle('error', error); s.classList.add('visible'); clearTimeout(toastTimer); toastTimer = setTimeout(() => s.classList.remove('visible'), error ? 9000 : 4000); }
// ── Preferences → systems.
function applyPrefs() {
  Object.assign(input, { sensitivityX: pref.sensitivityX, sensitivityY: pref.sensitivityY, aimMultiplier: pref.aimMultiplier, invertY: pref.invertY, toggleAim: pref.toggleAim, toggleCrouch: pref.toggleCrouch, toggleSprint: pref.toggleSprint, bindings: pref.bindings });
  audio.level('master', pref.master); audio.level('music', pref.music); audio.level('effects', pref.effects); audio.level('ambience', pref.ambience); audio.level('dialogue', pref.dialogue); audio.level('ui', Math.min(1, pref.effects + 0.1)); radio.allow(pref.licensedMusic);
  renderer.apply(pref); document.documentElement.style.setProperty('--hud', String(pref.hudScale));
  document.body.classList.remove('subs-small', 'subs-medium', 'subs-large'); document.body.classList.add(`subs-${pref.subtitleSize}`);
  $('prompt-key').textContent = keyName(pref.bindings.interact[0] ?? 'KeyE');
}
const settingsView = new SettingsView($('settings-tabs'), $('settings-body'), pref, input, key => {
  if (key.startsWith('controls:')) setControls(key.slice(9));
  if (key === 'diagnostics') diagnosticsOn = pref.diagnostics;
  applyPrefs(); if (!save(pref)) toast('Preferences could not be saved on this browser.');
}, () => input.touchMode ? 'touch' : 'mouse');
const touch = new TouchControls(input, $('touch-controls'), () => { input.pause(); showScores(true); });
function setControls(value: string) {
  input.setTouchMode(value === 'touch'); document.body.classList.toggle('touch-mode', input.touchMode); $('scores-close').hidden = !input.touchMode;
  try { localStorage.setItem('lastbus-controls', value); } catch { /* Storage is optional. */ }
  controlSummary(); touch.sync();
}
let controlMode = touchDefault ? 'touch' : 'mouse';
try { const saved = localStorage.getItem('lastbus-controls'); if (saved === 'touch' || saved === 'mouse') controlMode = saved; } catch { /* Storage is optional. */ }
setControls(controlMode); applyPrefs();
function controlSummary() {
  const b = (a: keyof typeof pref.bindings) => pref.bindings[a].map(keyName).join(' / ') || '—';
  $('control-summary').innerHTML = input.touchMode ? '<p>Left stick moves, drag the right side to aim, hold Fire to shoot. AIM and CROUCH toggle; hold USE to interact.</p>'
    : `<table><tbody>${[['Move', `${b('forward')} ${b('left')} ${b('back')} ${b('right')}`], ['Fire / aim', 'Left / right mouse'], ['Sprint · Jump · Crouch', `${b('sprint')} · ${b('jump')} · ${b('crouch')}`], ['Reload · Interact', `${b('reload')} · ${b('interact')}`], ['Weapons', `${b('rifle')} / ${b('sidearm')} or wheel`], ['Scores · Pause', `${b('scores')} · Esc`]].map(([a, k]) => `<tr><td>${a}</td><td><kbd>${escape(k)}</kbd></td></tr>`).join('')}</tbody></table>`;
}
const nickname = $<HTMLInputElement>('nickname'); nickname.value = pref.callsign;
nickname.oninput = () => { pref.callsign = nickname.value.slice(0, 20); save(pref); };
$('build-label').textContent = `${import.meta.env.DEV ? 'DEVELOPMENT BUILD' : 'BUILD'} ${BRAND.build} · PROTOCOL ${network.endpoint ? 'ONLINE' : 'LOCAL'}`;
// ── Campaign progress (local storage, best-effort).
interface RunStats { time: number; kills: number; accuracy: number; headshots: number; damage: number; retries: number; difficulty: string }
interface Progress { completed: Record<string, { best: number; difficulty: string; last?: RunStats }>; checkpoint?: { mission: string; index: number; difficulty: string } }
let progress: Progress = { completed: {} };
try { const raw = JSON.parse(localStorage.getItem('lastbus-campaign') ?? 'null'); if (raw && typeof raw === 'object' && raw.completed) progress = raw; } catch { /* Fresh progress. */ }
const saveProgress = () => { try { localStorage.setItem('lastbus-campaign', JSON.stringify(progress)); } catch { /* Progress is optional. */ } };
missionId = openingMission(CAMPAIGN.chapters[0], progress.completed, progress.checkpoint?.mission);
// ── Menu navigation.
const screens = ['menu', 'screen-story', 'screen-multiplayer', 'screen-training'];
let current = 'menu', focus = 0;
const navItems = () => [...document.querySelectorAll<HTMLButtonElement>('#main-nav .nav-item')];
function show(screen: string) {
  current = screen; $('topbar').hidden = false; for (const id of screens) $(id).hidden = id !== (screen === 'menu' ? 'menu' : `screen-${screen}`);
  if (screen === 'story') renderMission(); if (screen === 'multiplayer') void serverStatus(); if (screen === 'training') controlSummary();
  audio.play('ui');
}
function focusNav(i: number) { const items = navItems(); focus = (i + items.length) % items.length; items.forEach((el, k) => el.classList.toggle('focus', k === focus)); feature(items[focus].dataset.screen!); }
for (const [i, item] of navItems().entries()) { item.onmouseenter = () => { if (focus !== i) audio.play('ui-move'); focusNav(i); }; item.onclick = () => open(item.dataset.screen!); }
function open(screen: string) { if (screen === 'settings') showSettings(); else show(screen); }
for (const back of document.querySelectorAll<HTMLButtonElement>('[data-back]')) back.onclick = () => show('menu');
let serverOk: boolean | undefined, serverRooms = 0;
async function serverStatus() {
  const result = await network.health(); serverOk = result.ok; serverRooms = result.rooms ?? 0;
  for (const id of ['server-status', 'server-status-mp']) { const tag = $(id); tag.className = `tag ${result.ok ? 'live' : 'off'}`; tag.innerHTML = `<span class="dot"></span><span class="label">${result.ok ? `Server online · ${serverRooms} active room${serverRooms === 1 ? '' : 's'}` : 'Server unreachable · story and training still work'}</span><span class="short">${result.ok ? 'Online' : 'Offline'}</span>`; }
  for (const id of ['play', 'create']) $<HTMLButtonElement>(id).disabled = !result.ok;
  if (current === 'menu') feature(navItems()[focus].dataset.screen!);
}
function feature(screen: string) {
  const m = MISSIONS[missionId], done = progress.completed[missionId], cp = progress.checkpoint;
  const html: Record<string, string> = {
    story: `<div class="eyebrow">Chapter ${chapterOf(missionId).number} · ${chapterOf(missionId).title}</div><h3>${m.title}</h3><p>${m.summary}</p><div class="meta"><span class="tag">${m.location}</span>${done ? `<span class="tag live">Completed · ${clock(done.best)}</span>` : cp?.mission === missionId ? '<span class="tag">Checkpoint saved</span>' : '<span class="tag">Not started</span>'}</div>`,
    multiplayer: `<div class="eyebrow">Street Wars</div><h3><span class="police-text">Police</span> vs <span class="bandits-text">Bandits</span></h3><p>Team elimination for up to eight players on ${BRAND.map}. Server-authoritative hits and scoring.</p><div class="meta"><span class="tag ${serverOk ? 'live' : serverOk === false ? 'off' : ''}">${serverOk === undefined ? 'Checking server…' : serverOk ? `Online · ${serverRooms} rooms` : 'Server unreachable'}</span></div>`,
    training: '<div class="eyebrow">Offline</div><h3>Training range</h3><p>Measured target lanes and AI bots. Runs on this device only and never touches the online server.</p>',
    settings: `<div class="eyebrow">Your setup</div><h3>Settings</h3><p>Sensitivity ${pref.sensitivityX.toFixed(2)} · FOV ${pref.fov}° · ${pref.quality} quality · ${pref.difficulty} difficulty.</p>`
  };
  $('feature').innerHTML = html[screen] ?? '';
}
document.addEventListener('keydown', e => {
  if (input.capture) return;
  if (phoneOpen) { if (e.code === 'Escape' || e.code === 'Enter') { e.preventDefault(); closePhone(); } return; }
  if (cinema) { if (e.code === 'Space') { e.preventDefault(); if (!skipHeld) skipHeld = performance.now(); } if (e.code === 'Enter' || e.code === 'Escape') { cinema.director.skip(); endCinema(); } return; }
  if (e.code === 'Escape') {
    if (!$('confirm').hidden) { $('confirm').hidden = true; return; }
    if (!$('settings').hidden) { closeSettings(); return; }
    if (!$('briefing').hidden) { $('briefing').hidden = true; return; }
    if (mode === 'menu' && current !== 'menu') { show('menu'); return; }
  }
  if (mode === 'menu' && current === 'menu' && $('settings').hidden && document.activeElement !== nickname) {
    if (['ArrowDown', 'KeyS'].includes(e.code)) { focusNav(focus + 1); audio.play('ui-move'); e.preventDefault(); }
    if (['ArrowUp', 'KeyW'].includes(e.code)) { focusNav(focus - 1); audio.play('ui-move'); e.preventDefault(); }
    if (e.code === 'Enter') open(navItems()[focus].dataset.screen!);
  }
  if (!$('briefing').hidden && e.code === 'Enter') $('brief-start').click();
  if (e.code === 'F3' && (pref.diagnostics || import.meta.env.DEV)) { diagnosticsOn = !diagnosticsOn; e.preventDefault(); }
  if (import.meta.env.DEV) {
    if (e.code === 'F4') { debugBoxes = !debugBoxes; renderer.debug(debugBoxes); }
    if (e.code === 'F8' && story) { story = story.restart(); beginPlay(); toast('Development: mission restarted'); }
    if (e.code === 'F9' && story) { story.devSkip(); toast('Development: objective skipped'); }
  }
});
let debugBoxes = false;
// The first gesture unlocks audio and starts decoding every recording (the bytes are already downloading), so lines are ready long before a scene needs them.
document.addEventListener('pointerdown', () => { void audio.unlock().then(menuAudio); loadVoices(audio); }, { once: true });
document.addEventListener('keydown', () => { void audio.unlock().then(menuAudio); loadVoices(audio); }, { once: true });
function menuAudio() { if (mode === 'menu') { audio.score('menu'); audio.ambience(true, renderer.arena.handles.generators.map(v => ({ x: v.x, y: v.y, z: v.z }))); } }
function showSettings() { input.pause(); settingsView.render(); $('settings').hidden = false; }
function closeSettings() { $('settings').hidden = true; input.capture = undefined; if (mode === 'menu') feature(navItems()[focus].dataset.screen!); controlSummary(); }
$('settings-top').onclick = showSettings; $('settings-close').onclick = closeSettings; $('pause-settings').onclick = showSettings;
let confirmAction: (() => void) | undefined;
function confirm(title: string, text: string, action: () => void) { $('confirm-title').textContent = title; $('confirm-text').textContent = text; confirmAction = action; $('confirm').hidden = false; }
$('confirm-yes').onclick = () => { $('confirm').hidden = true; confirmAction?.(); }; $('confirm-no').onclick = () => { $('confirm').hidden = true; };
// ── Story screen. A chapter unlocks once every mission of the one before it is complete.
const chapterOf = (id: string) => CAMPAIGN.chapters.find(c => c.missions.includes(id)) ?? CAMPAIGN.chapters[0];
function unlocked(index: number) { const c = CAMPAIGN.chapters[index]; return c.status === 'playable' && c.missions.length > 0 && (index === 0 || chapterDone(CAMPAIGN.chapters[index - 1], progress.completed)); }
function selectChapter(id: string) { const i = CAMPAIGN.chapters.findIndex(c => c.id === id); if (i >= 0 && unlocked(i)) missionId = openingMission(CAMPAIGN.chapters[i], progress.completed, progress.checkpoint?.mission); }
function renderChapters() {
  $('chapter-list').innerHTML = CAMPAIGN.chapters.map((c, i) => {
    const open = unlocked(i), done = chapterDone(c, progress.completed), count = c.missions.filter(id => !MISSIONS[id]?.prologue).length, tag = !open ? (c.status === 'playable' && c.missions.length ? `Finish ${CAMPAIGN.chapters[i - 1].title}` : 'In development') : done ? 'Complete' : `${count} mission${count === 1 ? '' : 's'}`;
    return `<button class="chapter ${open ? 'playable' : 'locked'} ${chapterOf(missionId).id === c.id ? 'selected' : ''}" ${open ? '' : 'disabled aria-disabled="true"'} data-chapter="${c.id}"><span class="n">${c.number}</span><span><strong>${c.title}</strong><small>${c.logline}</small></span><span class="tag ${done ? 'live' : ''}">${tag}</span></button>`;
  }).join('');
  for (const b of $('chapter-list').querySelectorAll<HTMLButtonElement>('.chapter.playable')) b.onclick = () => { selectChapter(b.dataset.chapter!); audio.play('ui'); renderMission(); };
}
function renderMission() {
  renderChapters();
  const m = MISSIONS[missionId], done = progress.completed[m.id], cp = progress.checkpoint?.mission === m.id ? progress.checkpoint : undefined, chapter = chapterOf(m.id), last = done?.last;
  const picker = chapter.missions.length > 1 ? `<div class="segmented mission-picker" id="mission-picker">${chapter.missions.map(id => `<button data-m="${id}" aria-pressed="${id === m.id}">${MISSIONS[id].prologue ? 'Prologue' : MISSIONS[id].title}</button>`).join('')}</div>` : '';
  $('mission-card').innerHTML = `${picker}<div class="eyebrow">${m.prologue ? 'Prologue' : `Chapter ${chapter.number}`} · ${m.location}</div><h2>${m.title}</h2><div class="stamp">${m.time}</div><p style="margin-top:12px">${m.summary}</p>
    <ol class="objectives-list">${(m.prologue ? m.intel : m.objectives.map(o => o.text)).map(text => `<li>${text}</li>`).join('')}</ol>
    <div class="field"><span>Difficulty</span><div class="segmented" id="difficulty">${(['easy', 'normal', 'hard'] as const).map(d => `<button data-d="${d}" aria-pressed="${pref.difficulty === d}">${d}</button>`).join('')}</div></div>
    ${done ? `<div class="progress-note"><span class="badge-done">✓ COMPLETED</span> Best time ${clock(done.best)} on ${done.difficulty}</div>` : ''}
    ${last ? `<div class="stats compact">${[['Last run', clock(last.time)], ['Eliminations', last.kills], ['Accuracy', `${last.accuracy}%`], ['Headshots', last.headshots], ['Damage taken', last.damage], ['Retries', last.retries]].map(([k, v]) => `<div><small>${k}</small><b>${v}</b></div>`).join('')}</div>` : ''}
    ${cp ? `<div class="progress-note">Checkpoint saved: <b style="color:var(--text)">${m.objectives[cp.index]?.text ?? ''}</b></div>` : ''}
    <div class="stack"><button class="btn primary wide" id="story-start">${cp ? 'Continue from checkpoint' : m.prologue ? (done ? 'Replay prologue' : 'Start prologue') : done ? 'Replay mission' : 'Start mission'} <span class="key">→</span></button>${cp ? '<button class="btn wide" id="story-fresh">Start from the beginning</button>' : ''}</div>`;
  for (const b of $('mission-card').querySelectorAll<HTMLButtonElement>('#difficulty button')) b.onclick = () => { pref.difficulty = b.dataset.d as typeof pref.difficulty; save(pref); renderMission(); audio.play('ui'); };
  for (const b of $('mission-card').querySelectorAll<HTMLButtonElement>('#mission-picker button')) b.onclick = () => { missionId = b.dataset.m!; audio.play('ui'); renderMission(); };
  // A prologue is a cold open: it goes straight in, with no briefing to spoil it.
  $('story-start').onclick = () => { if (m.prologue) playMission(0); else briefing(cp?.index ?? 0); }; const fresh = document.getElementById('story-fresh'); if (fresh) fresh.onclick = () => briefing(0);
}
let briefingFrom = 0;
function briefing(from: number) {
  const m = MISSIONS[missionId]; briefingFrom = from;
  $('brief-chapter').textContent = `Chapter ${chapterOf(m.id).number} · ${chapterOf(m.id).title}`; $('brief-title').textContent = m.title; $('brief-stamp').textContent = `${m.location.toUpperCase()} · ${m.time.toUpperCase()} · ${pref.difficulty.toUpperCase()}${from ? ' · FROM CHECKPOINT' : ''}`;
  $('brief-text').innerHTML = m.briefing.map(p => `<p>${p}</p>`).join(''); $('brief-intel').innerHTML = m.intel.map(i => `<li>${i}</li>`).join('');
  $('brief-objectives').innerHTML = `<li>${m.objectives[from].text}</li><li class="muted">Further objectives are revealed as you go.</li>`;
  $('briefing').hidden = false; $('brief-start').focus();
}
$('brief-cancel').onclick = () => { $('briefing').hidden = true; };
function playMission(from: number, black = false) { $('briefing').hidden = true; void launch('story', () => { story = new StorySession(MISSIONS[missionId], pref.difficulty, nickname.value || 'Ada', from); }, black); }
$('brief-start').onclick = () => playMission(briefingFrom);
$('practice').onclick = () => void launch('training', () => { training = new TrainingSession('targets', nickname.value, pref.difficulty); });
$('bots').onclick = () => void launch('training', () => { training = new TrainingSession('bots' as TrainingKind, nickname.value, pref.difficulty); });
/** Single entry point for local modes. The busy flag prevents double launches while loading. */
async function launch(kind: 'story' | 'training', create: () => void, black = false) {
  if (busy) return; busy = true; $('loading-title').textContent = kind === 'story' ? MISSIONS[missionId].title : 'Training range'; $('loading-text').textContent = kind === 'story' ? 'Building the junction, routes and encounters…' : 'Setting up the range…'; $('loading').hidden = false;
  try {
    void audio.unlock(); await leave(true); if (black) fade(1, 0); await new Promise(r => setTimeout(r, 30));
    renderer.useMap(kind === 'story' ? MISSIONS[missionId].map ?? 'ojuelegba' : 'ojuelegba');
    create(); if (story && kind === 'story') { await sceneVoices(story.cutscenes); if (Object.values(MISSIONS[missionId].cutscenes).some(s => s.cues?.some(c => 'radio' in c))) await placeholderUrl(); } mode = kind; beginPlay();
  } catch (error) { console.error(error); toast('That mode failed to start. Please try again.', true); await leave(); }
  finally { $('loading').hidden = true; busy = false; }
}
/**
 * Holds the loading screen until the opening scenes' recordings are decoded, so its first line is heard
 * rather than shown as a subtitle only. Gives up after a few seconds on a stalled network; a line that
 * arrives later is still picked up by the director mid-shot.
 */
async function sceneVoices(ids: string[]) {
  const keys = ids.flatMap(sceneKeys); if (!keys.length) return;
  const text = $('loading-text'), base = text.textContent;
  await Promise.race([waitForVoices(audio, keys, (done, total) => { text.textContent = done < total ? `Loading dialogue… ${done}/${total}` : base; }), new Promise(r => setTimeout(r, 8000))]);
  text.textContent = base;
}
/** The recordings a cutscene speaks, in the order it speaks them. */
function sceneKeys(id: string | undefined) {
  const scene = id ? MISSIONS[missionId].cutscenes[id] : undefined; if (!scene) return [];
  return [...scene.shots.map(s => s.line), ...(scene.cues ?? []).map(c => 'say' in c ? c.say : undefined)].filter((k): k is string => !!k).map(voiceKey).filter(hasVoice);
}
/** The recording a line key plays, honouring the Mature language setting. */
function voiceKey(key: string) { const line = MISSIONS[missionId].lines[key]; return line ? wording(key, line, pref.matureLanguage).key : key; }
onVoice((key, seconds) => {
  voiceSeconds[key] = seconds;
  // A shot whose line was still decoding at the cut gets it now, with the shot stretched to fit.
  const d = cinema?.director, line = d?.current.line;
  if (d && line && !lineHeard && voiceKey(line) === key && d.lateLine(line)) lineHeard = voice(line);
});
// Download the default mission's opening lines first; they decode the moment the player first clicks.
prefetchVoices((MISSIONS[missionId].objectives[0]?.onStart ?? []).flatMap(a => 'cutscene' in a ? sceneKeys(a.cutscene) : []));
/** Prepares the HUD and input for a fresh local session (first start, retry or restart). */
function beginPlay() {
  if (story) story.voiceSeconds = voiceSeconds; endCinema(true); radio.off();
  const p = local()!.player; renderer.reset(); ended = false; endTimer = 0; paused = false; lastObjective = ''; lastCheckpoint = story?.checkpoint ?? -1; relayShown = !story?.relay; feed.length = 0; indicators.length = 0;
  for (const id of [...screens, 'topbar']) $(id).hidden = true; for (const id of ['pause', 'mission-end', 'results', 'lobby', 'scoreboard']) $(id).hidden = true;
  document.body.classList.add('playing'); $('hud').hidden = false; $('scorebar').hidden = mode !== 'training'; $('objective').hidden = mode !== 'story'; $('location').textContent = mode === 'story' ? `${MISSIONS[missionId].location.toUpperCase()} · ${MISSIONS[missionId].time.toUpperCase()}` : `${BRAND.map.toUpperCase()} · TRAINING`;
  input.enabled = true; input.reset(p); prev = { x: p.x, y: p.y, z: p.z }; renderer.arena.setRelay(!!story?.relay); renderer.viewmodel.civilian(!!story && !!MISSIONS[missionId].prologue);
  // The prologue opens on an ordinary evening, with nothing under it but the street.
  audio.score(fightScore()); syncWorld(true); fade(0, 0);
  if (story?.checkpoint && !MISSIONS[missionId].prologue) { progress.checkpoint = { mission: missionId, index: story.checkpoint, difficulty: pref.difficulty }; saveProgress(); }
  void enter();
}
async function enter() {
  if (mode === 'menu' || ended) return; void audio.unlock();
  if (mode === 'online' && (!predicted || snapshot?.phase !== 'ACTIVE')) return;
  try { await input.lock(); } catch (error) { showPause(); toast((error as Error).message, true); }
}
let inspecting = false, god = false;
/** Development-only scripted input for automated walkthroughs (see lastBusDev.drive). */
const drive: { ticks: number; input: (left: number) => Partial<InputFrame> } = { ticks: 0, input: () => ({}) };
function showPause() {
  if (mode === 'menu' || ended || inspecting || cinema) return;
  paused = mode !== 'online'; const s = mode === 'story';
  $('pause-tag').textContent = s ? `${MISSIONS[missionId].title} · ${pref.difficulty}` : mode === 'training' ? 'Training range' : 'Street Wars';
  $('pause-title').textContent = 'Paused'; $('pause-caption').textContent = mode === 'online' ? 'The match keeps running while this menu is open.' : s ? `Objective: ${story?.objective?.text ?? ''}` : 'The range is paused.';
  $('pause-checkpoint').hidden = !s || !story?.checkpoint; $('pause-restart').hidden = !s; $('leave-game').textContent = s ? 'Abandon mission' : mode === 'training' ? 'Leave range' : 'Leave match';
  $('resume').hidden = mode === 'online' && !network.connected; $('pause').hidden = false;
}
input.onLockChange = active => {
  if (active) { $('pause').hidden = true; paused = false; }
  else if (mode !== 'menu' && !ended && $('settings').hidden && (mode !== 'online' || snapshot?.phase === 'ACTIVE')) showPause();
  touch.sync();
};
$('resume').onclick = () => void enter();
$('pause-checkpoint').onclick = () => confirm('Restart from checkpoint?', 'Enemies, objectives and ammunition reset to the last checkpoint.', () => { story = story!.retry(); beginPlay(); });
$('pause-restart').onclick = () => confirm('Restart mission?', 'You will lose checkpoint progress for this run.', () => { story = story!.restart(); beginPlay(); });
$('leave-game').onclick = () => {
  if (mode === 'training') { void leave(); return; }
  confirm(mode === 'story' ? 'Abandon mission?' : 'Leave match?', mode === 'story' ? 'Your last checkpoint stays saved for Continue.' : 'You will leave the room. You can rejoin with the invitation while it stays open.', () => void leave());
};
// ── Mission end.
function missionEnd(complete: boolean) {
  if (!story || ended) return; ended = true; input.pause(); const s = story.stats, m = MISSIONS[missionId];
  if (complete) {
    const best = progress.completed[m.id]?.best, last: RunStats = { time: s.time, kills: s.kills, accuracy: accuracy(s), headshots: s.headshots, damage: Math.round(s.damageTaken), retries: story.retries, difficulty: pref.difficulty };
    progress.completed[m.id] = { best: best ? Math.min(best, s.time) : s.time, difficulty: pref.difficulty, last }; if (!m.prologue) delete progress.checkpoint; saveProgress();
    // A chapter ending replaces the results screen; the stats wait on the campaign screen.
    if (m.ending) { audio.score('none'); chapterEnding(m.ending); return; }
  }
  $('end-tag').textContent = complete ? 'Mission complete' : 'Mission failed'; $('end-title').textContent = complete ? m.title : m.failure?.title ?? 'You were downed';
  $('end-text').textContent = complete ? m.outro : m.failure?.text ?? 'STATIC still hold the junction. Your last checkpoint is waiting.';
  $('end-stats').innerHTML = [['Time', clock(s.time)], ['Eliminations', s.kills], ['Accuracy', `${accuracy(s)}%`], ['Headshots', s.headshots], ['Damage taken', Math.round(s.damageTaken)], ['Retries', story.retries]].map(([k, v]) => `<div><small>${k}</small><b>${v}</b></div>`).join('');
  // Combat stats mean nothing to an unarmed runner.
  $('end-stats').hidden = !!m.pursuit;
  $('end-primary').textContent = complete ? 'Replay mission' : 'Retry from checkpoint'; $('end-secondary').textContent = complete ? 'Main menu' : 'Restart mission';
  $('mission-end').hidden = false; audio.play(complete ? 'objective' : 'denied'); audio.score('none');
}
$('end-primary').onclick = () => { if (!story) return; const complete = story.state === 'complete'; story = complete ? new StorySession(MISSIONS[missionId], pref.difficulty, nickname.value, 0) : story.retry(); beginPlay(); };
$('end-secondary').onclick = () => { if (!story) return; if (story.state === 'complete') void leave(); else { story = story.restart(); beginPlay(); } };
$('end-menu').onclick = () => void leave().then(() => show('story'));
/** Title cards on black, one after another; a click moves on. Afterwards the campaign screen opens on the next chapter. */
function chapterEnding(ending: NonNullable<(typeof MISSIONS)[string]['ending']>) {
  const el = $('chapter-card'); let i = -1, timer: ReturnType<typeof setTimeout> | undefined, busy = false;
  $('hud').hidden = true; fade(1, 0); el.hidden = false; el.className = 'chapter-card';
  const next = () => {
    if (busy) return; busy = true; clearTimeout(timer); el.classList.remove('in');
    setTimeout(() => {
      busy = false; i++; const card = ending.cards[i];
      if (!card) {
        el.hidden = true; el.onclick = null; const then = ending.continue;
        // Into the next mission on black, unless a replay would run over somewhere the player has already got to.
        if (then && !progress.completed[then] && progress.checkpoint?.mission !== then) { missionId = then; playMission(0, true); return; }
        void leave().then(() => { if (then) missionId = then; if (ending.next) selectChapter(ending.next); show('story'); }); return;
      }
      el.className = `chapter-card ${card.kind ?? ''}`; el.innerHTML = `<div class="card-text">${escape(card.text)}</div>${card.sub ? `<div class="card-sub">${escape(card.sub)}</div>` : ''}<div class="card-hint">${input.touchMode ? 'Tap' : 'Click'} to continue</div>`;
      void el.offsetWidth; el.classList.add('in'); if (card.kind === 'chapter') audio.sting('title'); else if (card.kind === 'complete') audio.play('objective');
      timer = setTimeout(next, (card.hold ?? 4.5) * 1000);
    }, i < 0 ? 400 : 900);
  };
  el.onclick = next; next();
}
let meleeCache = { size: -1, ids: new Set<string>() };
/** Cutlass carriers in the current solo session, recomputed only when the roster changes. */
function meleeIds() { const views = local()?.agentViews() ?? []; if (views.length !== meleeCache.size) meleeCache = { size: views.length, ids: new Set(views.filter(v => v.melee).map(v => v.id)) }; return meleeCache.ids; }
// ── Cutscenes. The session is not stepped while one plays, so nothing in the world moves on without the player.
// The director runs shots and cues; this layer turns its state into subtitles, voice, sound, letterbox and fades.
function lineHtml(key: string) {
  const line = MISSIONS[missionId].lines[key]; if (!line) return { html: '', line: undefined, voice: key };
  const said = wording(key, line, pref.matureLanguage);
  return { html: `<b class="${line.speaker.toLowerCase().replace(/\s+/g, '-')}">${escape(line.speaker)}</b>${escape(said.text)}`, line, voice: said.key };
}
/** Speaks a line; returns whether its recording played (false: subtitle only, with a radio blip for radio lines). */
function voice(key: string, overlap = false) {
  const { line, voice: file } = lineHtml(key); if (!line) return true;
  if (speak(audio, file, line, overlap)) return true;
  if (radioLine(line)) audio.play('radio'); return !hasVoice(file);
}
let captionTimer: ReturnType<typeof setTimeout> | undefined;
/** A place or time card over a scene; an empty text clears it. */
function showCaption(text: string, sub: string | undefined, seconds: number) {
  const el = $('cinema-caption'); clearTimeout(captionTimer); el.classList.remove('in'); if (!text) return;
  el.innerHTML = `<b>${escape(text)}</b>${sub ? `<span>${escape(sub)}</span>` : ''}`; void el.offsetWidth; el.classList.add('in'); captionTimer = setTimeout(() => el.classList.remove('in'), seconds * 1000);
}
/** Femi's phone over a scene. It shows a name on a grey square and never the picture, and it never says who the picture is going to. */
function showPhone(state: PhoneState) {
  const el = $('cinema-phone'); el.hidden = state === 'off'; if (state === 'off') return;
  const bars = { photo: 4, sending: 4, failing: 1, dead: 0, message: 1 }[state], status = $('cp-status'), message = state === 'message';
  $('cp-bars').dataset.n = String(bars); $('cp-net').textContent = bars ? 'Signal 9' : 'No service';
  $('cp-body').innerHTML = message ? '<p>Relay 07 is jammed from inside the Signal 9 yard.</p><p>I got away. Hiding where the presses are.</p>' : '<div class="cp-thumb">IMG_0247</div>';
  status.textContent = message ? 'Delivered' : state === 'photo' ? '' : 'Sending…'; status.className = state === 'sending' || state === 'failing' ? 'stuck' : state === 'dead' ? 'fail' : '';
  if (state === 'photo') { const flash = $('cinema-flash'); flash.classList.remove('go'); void flash.offsetWidth; flash.classList.add('go'); }
}
/** The low pulse under play. It waits for the opening scenes to finish: 18:31 is an ordinary evening, and a score under it would give the game away. */
const fightScore = (ending = 0) => mode === 'story' && !MISSIONS[missionId].prologue && (story?.cutscenes.length ?? 0) <= ending ? 'tension' : 'none';
function startCinema(id: string) {
  const scene = MISSIONS[missionId].cutscenes[id]; if (!scene || !story) { story?.finishCutscene(); return; }
  skipHeld = 0; input.clear(); audio.hush(); extraLines.length = 0;
  const director = new Director(scene, shot => story!.duration(shot.line ? voiceKey(shot.line) : '', shot.seconds), {
    shot: (_, shot) => { $('cinema-line').innerHTML = shot.line ? lineHtml(shot.line).html : ''; lineHeard = shot.line ? voice(shot.line) : true; },
    say: key => { const { html, line } = lineHtml(key); if (!line) return; extraLines.push({ html, until: performance.now() + story!.duration(voiceKey(key), line.seconds) * 1000 }); voice(key, true); },
    caption: (text, sub, seconds) => showCaption(text, sub, seconds),
    sound: (kind, at, volume) => audio.cine(kind, at, volume), sting: kind => audio.sting(kind), duck: (level, seconds) => audio.duck(level, seconds, true),
    grade: (grade, seconds) => renderer.setGrade(grade, seconds), fx: (kind, from, to, seconds) => renderer.fx(kind, from, to, seconds),
    ambience: (mood, seconds) => audio.ambience(true, generators(), mood, seconds), radio: (cue, skipping) => radio.cue(cue, skipping), cabin: (state, seconds) => renderer.bus.state(state, seconds), phone: state => showPhone(state)
  }, Object.fromEntries([...renderer.arena.movers].map(([key, m]) => [key, scene.props?.[key] ?? { ...m.home, door: doorOf(key) }])), pref.cameraShake);
  // The bus is only shown after it has left if this scene is the one driving it away.
  const lastBus = director.props.get('last-bus'); if (lastBus) lastBus.hidden = story.flags.has('bus-gone') && !scene.cues?.some(c => 'prop' in c && c.prop === 'last-bus');
  cinema = { id, director };
  $('hud').hidden = true; $('cinema').hidden = false; $('prompt').hidden = true;
}
function endCinema(silent = false) {
  if (!cinema) return; const { director } = cinema; cinema = undefined; skipHeld = 0; $('cinema').hidden = true; audio.hush(); audio.duck(1, 0.6); extraLines.length = 0; showCaption('', undefined, 0);
  // A scene still queued carries on from this one, whatever the story has already moved on to. The last one hands the world back.
  if (silent || (story?.cutscenes.length ?? 0) <= 1) { audio.score(mode === 'menu' ? 'none' : fightScore(1)); showPhone('off'); renderer.setCity(cityState()); renderer.arena.setCrowd(!!story?.flags.has('live')); if (mode !== 'menu') audio.ambience(true, generators(), soundMood(), 5); }
  if (silent) { fade(0, 0); return; }
  // Characters a scene stood up or moved stay where it left them.
  const npc = MISSIONS[missionId].npc;
  for (const a of director.actors.values()) if (a.keep && npc && a.id === npc.id) story?.placeNpc(a.x, a.z, a.yaw, a.pose === 'seated');
  story?.finishCutscene(); input.clear(); $('hud').hidden = mode === 'menu';
  const black = director.fade.alpha > 0.5;
  if (story?.cutscenes.length) { fade(black ? 1 : 0, 0); startCinema(story.cutscenes[0]); }
  else if (story?.state === 'complete') { fade(black ? 1 : 0, 0); missionEnd(true); }
  else { fade(black ? 1 : director.fade.alpha, 0); fade(0, 0.9); renderer.setGrade(gradeFor(), 1.5); if (!input.active && mode === 'story' && !ended) showPause(); }
}
/** Full-screen fade overlay, kept outside the cutscene layer so a scene can end on black and hand over to title cards. */
function fade(alpha: number, seconds: number, color = 'black') { const el = $('fade'); el.style.transition = seconds ? `opacity ${seconds}s ease` : 'none'; el.style.background = color === 'white' ? '#fff8ec' : '#000'; el.style.opacity = String(alpha); }
const extraLines: { html: string; until: number }[] = [];
function cinemaFrame(dt: number) {
  if (!cinema || !story) { endCinema(true); return undefined; }
  const d = cinema.director, pose = d.update(dt), now = performance.now();
  const c = $('cinema'); c.style.setProperty('--lb', d.letterbox.value.toFixed(3));
  const f = $('fade'); f.style.transition = 'none'; f.style.background = d.fade.color === 'white' ? '#fff8ec' : '#000'; f.style.opacity = d.fade.alpha.toFixed(3);
  const live = extraLines.filter(l => l.until > now); $('cinema-extra').innerHTML = live.map(l => `<span>${l.html}</span>`).join('');
  for (const p of d.props.values()) renderer.arena.setMover(p.id, p.x, p.z, p.yaw, p.door, !p.hidden);
  if (skipHeld) { const held = (now - skipHeld) / 700; $('cinema-skip').style.setProperty('--p', String(Math.min(1, held))); if (held >= 1) { d.skip(); endCinema(); return pose; } }
  if (d.done) { endCinema(); }
  return pose;
}
/** Staged cutscene characters as renderer extras, and which real bodies they stand in for. */
function stagedActors(): { extras: Extra[]; hide: Set<string> } {
  const hide = new Set<string>(), extras: Extra[] = [], npc = MISSIONS[missionId].npc; if (!cinema) return { extras, hide };
  // Whoever is speaking the shot's line moves their mouth while the recording (or its written length) lasts.
  const d = cinema.director, key = d.current.line, line = key ? MISSIONS[missionId].lines[key] : undefined;
  const speaking = line && key && d.t >= d.lineAt && d.t - d.lineAt < (voiceSeconds[voiceKey(key)] ?? (line.seconds ?? 3) * 0.8) ? line.speaker.toLowerCase() : '';
  for (const a of cinema.director.actors.values()) {
    if (a.id === 'you' || a.id === npc?.id) hide.add(a.id);
    if (a.hidden) continue;
    const faction = a.look === 'static' ? 1 : a.look === 'femi' || a.look === 'civilian' ? 2 : 0;
    extras.push({ id: `cine-${a.id}`, faction, variant: a.variant ?? (a.look === 'ada' ? 'ada' : a.look === 'femi' ? 'femi' : 'default'), pose: { talk: speaking === (a.speaker ?? a.look), folder: a.folder, bag: a.bag, clean: a.clean, x: a.x, y: a.y, z: a.z, yaw: a.yaw, pitch: a.gesture === 'look-up' ? 0.4 * a.gestureT : 0, vx: a.vx, vz: a.vz, grounded: true, crouched: a.pose === 'crouch', aiming: false, weapon: a.weapon === 'sidearm' ? 'sidearm' : 'rifle', health: 100, reloading: 0, equipping: 0, seated: a.pose === 'seated', relaxed: a.pose === 'relaxed', lying: a.pose === 'down', unarmed: a.weapon === 'none', gesture: a.gesture, gestureT: a.gestureT } });
  }
  return { extras, hide };
}
/** Someone standing about, as a renderer extra. */
function standing(a: CineActor): Extra {
  return { id: `by-${a.id}`, faction: a.look === 'static' ? 1 : a.look === 'civilian' ? 2 : 0, variant: a.variant ?? 'default', pose: { x: a.at.x, y: 0, z: a.at.z, yaw: a.yaw, pitch: 0, vx: 0, vz: 0, grounded: true, crouched: false, aiming: false, weapon: 'rifle', health: 100, reloading: 0, equipping: 0, seated: a.pose === 'seated', relaxed: true, unarmed: true } };
}
// A click (or tap) in a cutscene moves on to the next line; the last line ends the scene.
document.addEventListener('pointerdown', e => { if (!cinema || e.button !== 0) return; audio.hush(); cinema.director.next(); }, true);
document.addEventListener('keyup', e => { if (e.code === 'Space') { skipHeld = 0; $('cinema-skip').style.setProperty('--p', '0'); } });
// ── Phone messages. Reading one pauses the session, like a cutscene, until it is put away.
let phoneOpen = false;
function openPhone(id: string) {
  const msg = MISSIONS[missionId].phone?.[id]; if (!msg) return;
  phoneOpen = true; input.clear(); audio.play('ui'); $('hud').hidden = true;
  $('phone-from').textContent = msg.from; $('phone-time').textContent = msg.time;
  $('phone-body').innerHTML = msg.body.map((line, i) => `<p class="${i === msg.body.length - 1 ? 'alarm' : ''}">${escape(line)}</p>`).join('');
  const photo = $<HTMLCanvasElement>('phone-photo'); photo.hidden = !msg.photo; if (msg.photo) drawDanfoPhoto(photo);
  $('phone').hidden = false; $('phone-close').focus();
}
function closePhone() { if (!phoneOpen) return; phoneOpen = false; $('phone').hidden = true; $('hud').hidden = mode === 'menu'; input.clear(); if (mode === 'story' && !input.active && !ended) showPause(); }
$('phone-close').onclick = () => closePhone();
/**
 * The photo in the anonymous message: the inside of Danfo 247 at night, taken from a seat. In the
 * window glass, behind the photographer, a blurred figure in a police cap. Drawn once, procedurally.
 */
function drawDanfoPhoto(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext('2d')!, w = canvas.width = 360, h = canvas.height = 240; let seed = 247; const rand = () => (seed = seed * 16807 % 2147483647) / 2147483647;
  const g = ctx.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#2a2418'); g.addColorStop(1, '#0d0b08'); ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  // Window: night outside, two streetlights smeared by motion, the glass catching the cabin light.
  ctx.fillStyle = '#0b1220'; ctx.fillRect(40, 30, 220, 110); for (const [x, y, r] of [[90, 70, 26], [205, 58, 18]]) { const l = ctx.createRadialGradient(x, y, 1, x, y, r); l.addColorStop(0, 'rgba(255,190,110,.9)'); l.addColorStop(1, 'rgba(255,190,110,0)'); ctx.fillStyle = l; ctx.fillRect(x - r * 2, y - r, r * 4, r * 2); }
  ctx.strokeStyle = '#a88a2a'; ctx.lineWidth = 7; ctx.strokeRect(40, 30, 220, 110); ctx.fillStyle = '#a88a2a'; ctx.fillRect(148, 30, 6, 110);
  // The reflection: a figure behind the photographer, peaked cap and shoulders, soft and pale in the glass.
  ctx.save(); ctx.filter = 'blur(3px)'; ctx.globalAlpha = 0.38; ctx.fillStyle = '#c9d4e6';
  ctx.beginPath(); ctx.ellipse(212, 86, 13, 16, 0, 0, Math.PI * 2); ctx.fill(); ctx.fillRect(194, 66, 36, 7); ctx.fillRect(200, 62, 26, 6);
  ctx.beginPath(); ctx.moveTo(182, 140); ctx.quadraticCurveTo(186, 104, 212, 102); ctx.quadraticCurveTo(238, 104, 244, 140); ctx.fill(); ctx.restore();
  // Seats: torn vinyl rows, and the edge of the photographer's knee.
  for (let i = 0; i < 3; i++) { ctx.fillStyle = ['#5a3f1f', '#4d3519', '#3f2b14'][i]; ctx.fillRect(20 + i * 8, 150 + i * 24, w - 40 - i * 16, 22); ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.fillRect(20 + i * 8, 168 + i * 24, w - 40 - i * 16, 4); }
  ctx.fillStyle = '#1a1c22'; ctx.beginPath(); ctx.ellipse(w - 30, h + 10, 70, 46, -0.4, 0, Math.PI * 2); ctx.fill();
  // Low-light grain and a timestamp, like a phone camera at night.
  const img = ctx.getImageData(0, 0, w, h); for (let i = 0; i < img.data.length; i += 4) { const n = (rand() - 0.5) * 34; img.data[i] += n; img.data[i + 1] += n; img.data[i + 2] += n; } ctx.putImageData(img, 0, 0);
  ctx.fillStyle = 'rgba(255,255,255,.6)'; ctx.font = '11px monospace'; ctx.fillText('IMG_0247 · 18:37', 10, h - 10);
}
// ── World state the session asks the client to present: lighting, city life, the bus that left, ambience.
let worldShown = '';
function gradeFor() { const f = story?.flags; return f?.has('blackout') ? 'aftermath' : f?.has('night') ? (f.has('city') ? 'restored' : 'night') : MISSIONS[missionId].map === 'shelter' ? 'shelter' : 'dusk'; }
function cityState() { const f = story?.flags; return f?.has('blackout') ? 'blackout' : f?.has('city') || f?.has('live') ? 'restored' : 'dead'; }
const soundMood = () => moodFor(story?.flags ?? new Set<string>(), MISSIONS[missionId].map === 'shelter' && mode === 'story');
/** Danfo 247's side door stays where the attack left it. */
const doorOf = (key: string) => key === 'danfo-247' && story?.flags.has('danfo-forced') ? 1 : 0;
function syncWorld(force = false) {
  const flags = story ? [...story.flags].sort().join(',') + `|${MISSIONS[missionId].map ?? ''}` : '', key = `${mode}|${flags}`; if (key === worldShown && !force) return;
  const first = worldShown === '' || force; worldShown = key; const f = story?.flags ?? new Set<string>();
  renderer.setMood(f.has('night') || MISSIONS[missionId].map === 'shelter' && mode === 'story' ? 'night' : 'dusk', first ? 0 : 6);
  renderer.setCity(cityState());
  if (!cinema) renderer.setGrade(mode === 'story' ? gradeFor() : 'dusk', first ? 0.01 : 3);
  if (!cinema) for (const [key, m] of renderer.arena.movers) { const parked = MISSIONS[missionId].parked, at = f.has('parked') && parked?.id === key ? parked : m.home; renderer.arena.setMover(key, at.x, at.z, at.yaw, doorOf(key), key !== 'last-bus' || !f.has('bus-gone')); }
  renderer.arena.setCrowd(f.has('live'));
  if (mode !== 'menu') audio.ambience(true, generators(), soundMood(), first ? 0.4 : 4);
  const dead = renderer.arena.movers.get('danfo-247')?.home; audio.deadRadio(f.has('dead-radio') && dead ? { x: dead.x, y: 1.2, z: dead.z } : undefined);
}
const generators = () => renderer.arena.handles.generators.map(v => ({ x: v.x, y: v.y, z: v.z }));
// ── Online play.
function receive(next: Snapshot) {
  const player = next.players.find(p => p.id === ownId); snapshot = next;
  if (player) {
    const changedLife = player.life !== lastLife, previous = predicted;
    if (changedLife) { pending = []; lastLife = player.life; input.reset(player); }
    predicted = structuredClone(player); pending = pending.filter(frame => frame.seq > player.ack && frame.life === player.life && frame.round === next.round);
    predictionTime = next.now;
    if (next.phase === 'ACTIVE' && player.health > 0) for (const frame of pending) { predictionTime += RULES.dt; predictPlayer(predicted, frame, predictionTime); }
    if (previous && !changedLife && next.phase === 'ACTIVE') { corrections.push(Math.hypot(predicted.x - previous.x, predicted.y - previous.y, predicted.z - previous.z)); if (corrections.length > 18000) corrections.shift(); }
    if (changedLife || !previous) prev = { x: predicted.x, y: predicted.y, z: predicted.z };
  }
  renderer.snapshot(next);
  if (next.phase !== lastPhase) {
    lastPhase = next.phase; input.clear(); audio.play('match');
    document.body.classList.toggle('playing', next.phase === 'ACTIVE');
    if (next.phase === 'ACTIVE') { $('lobby').hidden = true; $('results').hidden = true; $('hud').hidden = false; $('scorebar').hidden = false; $('objective').hidden = true; input.enabled = true; ended = false; if (!input.active) showPause(); }
    else { input.enabled = false; ended = true; input.pause(); $('pause').hidden = true; $('hud').hidden = true; $('results').hidden = next.phase !== 'RESULTS'; $('lobby').hidden = next.phase === 'RESULTS'; ended = false; }
    touch.sync();
  }
}
network.onSnapshot = receive; network.onEvent = e => handle(e);
network.onStatus = (message, failed) => { if (leaving) return; toast(message, failed); if (!network.connected && failed) { input.enabled = false; input.pause(); $('pause-title').textContent = 'Connection ended'; $('pause-caption').textContent = message; $('resume').hidden = true; $('pause').hidden = false; } };
network.onInvite = invitation;
function invitation(token: string) { const url = new URL(location.href); url.hash = `room=${token}`; $<HTMLInputElement>('invite-link').value = url.toString(); $('invite-box').hidden = false; }
async function join(kind: 'public' | 'private' | 'invite', token = '') {
  if (busy) return; busy = true; $('loading-title').textContent = 'Street Wars'; $('loading-text').textContent = kind === 'public' ? 'Finding a public room…' : kind === 'private' ? 'Creating your private room…' : 'Checking your invitation…'; $('loading').hidden = false;
  try {
    void audio.unlock(); await leave(true); await network.join(kind, nickname.value, token);
    mode = 'online'; ownId = network.id; lastPhase = ''; lastLife = -1; sequence = 0; pending = []; feed.length = 0;
    for (const id of [...screens, 'topbar']) $(id).hidden = true; $('lobby').hidden = false; $('invite-box').hidden = !network.invite; if (network.invite) invitation(network.invite);
    $('resume').hidden = false; audio.score('none'); audio.ambience(true, renderer.arena.handles.generators.map(v => ({ x: v.x, y: v.y, z: v.z })));
  } catch (error) { await network.leave(); mode = 'menu'; toast(error instanceof Error ? error.message : 'Could not join. Please try again.', true); }
  finally { $('loading').hidden = true; busy = false; }
}
$('play').onclick = () => void join('public'); $('create').onclick = () => void join('private');
$('join-open').onclick = () => $<HTMLInputElement>('room-code').focus();
$('join-form').onsubmit = e => { e.preventDefault(); let token = $<HTMLInputElement>('room-code').value.trim(); try { if (token.includes('://')) token = new URLSearchParams(new URL(token).hash.slice(1)).get('room') ?? ''; } catch { toast('That link does not look valid.', true); return; } if (!/^[\w-]{22}$/.test(token)) { toast('That invitation code is not valid. Check the link you were sent.', true); return; } void join('invite', token); };
$('start-match').onclick = () => network.start(); $('switch-team').onclick = () => network.switchTeam();
for (const id of ['opt-duration', 'opt-kills']) $(id).onchange = () => network.configure(Number($<HTMLSelectElement>('opt-duration').value), Number($<HTMLSelectElement>('opt-kills').value));
$('copy-invite').onclick = async () => { const field = $<HTMLInputElement>('invite-link'); try { await navigator.clipboard.writeText(field.value); toast('Invitation copied. Send it to your crew.'); } catch { field.select(); toast('Select and copy the invitation above.'); } };
$('leave-lobby').onclick = () => void leave(); $('leave-results').onclick = () => void leave();
$('return-lobby').onclick = () => { if (snapshot?.phase === 'WAITING') { $('results').hidden = true; $('lobby').hidden = false; } };
$('scores-close').onclick = () => showScores(false);
input.onScoreboard = showScores;
function showScores(visible: boolean) { $('scoreboard').hidden = !visible || mode !== 'online' || snapshot?.phase !== 'ACTIVE'; if (!$('scoreboard').hidden) $('score-table').innerHTML = scoreTable(snapshot!.players); }
function openInvitationFromUrl() {
  const token = new URLSearchParams(location.hash.slice(1)).get('room'); if (!token) return;
  $<HTMLInputElement>('room-code').value = token;
  if (mode !== 'menu' || busy) { toast('Leave your current game, then use the invitation from Multiplayer.'); return; }
  show('multiplayer'); $<HTMLInputElement>('room-code').focus();
}
window.addEventListener('hashchange', openInvitationFromUrl); openInvitationFromUrl();
/** Leaves whatever mode is live and returns to a clean menu. Nothing from the previous session survives. */
async function leave(silent = false) {
  leaving = true; endCinema(true); radio.off(); input.enabled = false; input.pause(); ended = false; paused = false;
  await network.leave(); story = undefined; training = undefined; snapshot = undefined; predicted = undefined; ownId = ''; pending = []; sequence = 0; lastPhase = ''; lastLife = -1;
  feed.length = 0; indicators.length = 0; corrections.length = 0; remoteSteps.clear(); renderer.reset(); renderer.useMap('ojuelegba'); renderer.arena.setRelay(false); mode = 'menu'; syncWorld(true); closePhone(); fade(0, 0); $('chapter-card').hidden = true;
  for (const id of ['lobby', 'pause', 'results', 'scoreboard', 'mission-end', 'confirm', 'briefing']) $(id).hidden = true; $('hud').hidden = true; document.body.classList.remove('playing');
  $('resume').hidden = false; leaving = false; touch.sync();
  if (!silent) { show(current === 'menu' ? 'menu' : current); if (current !== 'menu') show(current); menuAudio(); void serverStatus(); }
}
// ── Event presentation (shared by online and local modes).
function handle(event: GameEvent) {
  const me = own(), predictedOwn = event.player === ownId && mode === 'online', ownShot = event.player === (mode === 'online' ? ownId : 'you');
  renderer.feedback(event, mode === 'online' ? ownId : 'you', predictedOwn);
  const players = mode === 'online' ? snapshot?.players : [...(local()?.sim.players.values() ?? [])];
  const by = players?.find(p => p.id === event.player), target = players?.find(p => p.id === event.target), meId = mode === 'online' ? ownId : 'you';
  if (event.type === 'shot' && !predictedOwn) audio.play((event.weapon ?? 'rifle') as Sound, ownShot ? undefined : event.position);
  if (event.type === 'hit') {
    if (event.player === meId) { hit = { until: performance.now() + 140, kind: event.head ? 'head' : '' }; audio.play(event.head ? 'headshot' : 'hit'); }
    if (event.target === meId && event.position && me) { damageUntil = performance.now() + 260; indicators.push({ angle: Math.atan2(event.position.x - me.x, event.position.z - me.z), until: performance.now() + 1100 }); indicators.splice(0, Math.max(0, indicators.length - 4)); audio.play('hurt'); }
  }
  if (event.type === 'kill') {
    const name = (p?: Player) => p ? `<span class="${p.team === 0 ? 'police-text' : 'bandits-text'}">${escape(p.id === meId ? 'You' : p.name)}</span>` : 'Player';
    feed.unshift({ html: `${name(by)}<span class="k">${event.melee ? 'CUTLASS' : WEAPONS[event.weapon ?? 'rifle'].name}${event.head ? ' · HEAD' : ''}</span>${name(target)}`, until: performance.now() + 6000 }); feed.splice(5);
    if (event.player === meId) { hit = { until: performance.now() + 260, kind: 'kill' }; audio.play('kill'); }
  }
  if (event.type === 'respawn' && event.player === meId) audio.play('respawn');
  if (event.type === 'melee') audio.play('slash', event.position);
}
renderer.onCue = cue => audio.play(cue);
// ── Fixed-step simulation.
function tick() {
  const session = local(); let me = own(); if (!me) return;
  if (session) {
    // A session being launched waits (for its opening scene's recordings) before anything plays.
    if (busy) return;
    if (story && !cinema && story.cutscenes.length) startCinema(story.cutscenes[0]);
    if (story && !cinema && !phoneOpen && story.messages.length) openPhone(story.messages.shift()!);
    if (paused || cinema || phoneOpen) return;
    if (story?.moved) { story.moved = false; me = story.player; input.reset(me); prev = { x: me.x, y: me.y, z: me.z }; }
    const frame = input.frame(++sequence, me, 0); prev = { x: me.x, y: me.y, z: me.z };
    if (import.meta.env.DEV && drive.ticks > 0) { drive.ticks--; Object.assign(frame, drive.input(drive.ticks), { yaw: input.yaw, pitch: input.pitch }); }
    if (frame.trigger && me.guns[me.weapon].ammo === 0 && me.guns[me.weapon].reserve === 0) audio.play('empty');
    if (god && import.meta.env.DEV) me.health = 100;
    for (const e of story ? story.step(frame, input.interactHeld()) : training!.step(frame)) handle(e);
    me = session.player;
    if (story) {
      if (story.state === 'failed' && !ended) { endTimer += RULES.dt; if (endTimer > 1.6) missionEnd(false); }
      if (story.state === 'complete' && !ended && !story.cutscenes.length && story.sim.now - story.completedAt > 1.5) missionEnd(true);
      if (story.checkpoint !== lastCheckpoint) { lastCheckpoint = story.checkpoint; if (!MISSIONS[missionId].prologue) { progress.checkpoint = { mission: missionId, index: story.checkpoint, difficulty: pref.difficulty }; saveProgress(); } }
      // Scenes still queued play out the world as it was; what the story just changed arrives when they finish.
      if (!story.cutscenes.length) { if (story.relay !== relayShown) { relayShown = story.relay; renderer.arena.setRelay(story.relay); } syncWorld(); }
    }
  } else if (snapshot && predicted && network.connected) {
    const frame = input.frame(++sequence, predicted, snapshot.round);
    network.send(frame); pending.push(frame); if (pending.length > 120) pending = [];
    if (snapshot.phase === 'ACTIVE' && predicted.health > 0) {
      prev = { x: predicted.x, y: predicted.y, z: predicted.z }; predictionTime += RULES.dt;
      if (frame.trigger && predicted.guns[predicted.weapon].ammo === 0 && predicted.guns[predicted.weapon].reserve === 0) audio.play('empty');
      if (predictPlayer(predicted, frame, predictionTime) === 'shot') { renderer.localShot(); audio.play(predicted.weapon); }
    }
    me = predicted;
  } else return;
  // Footsteps from real movement, landing from real fall speed.
  const now = performance.now(), speed = Math.hypot(me.vx, me.vz);
  traversalAudio(me, true);
  if (me.health > 0 && me.grounded && !me.traverse && speed > 1.2 && now > nextStep) { audio.play(surfaceUnder(me), undefined, me.crouched ? 0.35 : speed > 6 ? 1.2 : 0.8); nextStep = now + (me.crouched ? 560 : speed > 6 ? 300 : 400); }
  if (!me.grounded) airVy = Math.min(airVy, me.vy);
  if (me.grounded && !wasGrounded && airVy < -4) { audio.play('land', undefined, Math.min(1.4, -airVy / 8)); renderer.land(-airVy); }
  if (me.grounded) airVy = 0; wasGrounded = me.grounded;
  const others = mode === 'online' ? snapshot?.players ?? [] : [...(session?.sim.players.values() ?? [])];
  for (const p of others) if (p.id !== (mode === 'online' ? ownId : 'you')) traversalAudio(p, false);
  for (const p of others) if (p.id !== (mode === 'online' ? ownId : 'you') && p.health > 0 && p.grounded && !p.traverse && Math.hypot(p.vx, p.vz) > 1.5 && now > (remoteSteps.get(p.id) ?? 0)) { audio.play(surfaceUnder(p), { x: p.x, y: p.y, z: p.z }, p.crouched ? 0.3 : 0.9); remoteSteps.set(p.id, now + (Math.hypot(p.vx, p.vz) > 6 ? 300 : 420)); }
}
const traversals = new Map<string, { kind: number; rung: number }>();
const pipes = WORLD.filter(b => b.kind === 'ladder');
/** Traversal sounds from real state changes: a vault, a mantle, a slide, and a clank for each rung climbed. */
function traversalAudio(p: Player, self: boolean) {
  const last = traversals.get(p.id) ?? { kind: 0, rung: p.y }, at = self ? undefined : { x: p.x, y: p.y, z: p.z };
  if (p.traverse !== last.kind) {
    if (p.traverse === MOVE.vault) audio.play('vault', at); else if (p.traverse === MOVE.mantle) audio.play('mantle', at); else if (p.traverse === MOVE.slide) audio.play('slide', at);
    last.kind = p.traverse; last.rung = p.y;
  }
  if (p.traverse === MOVE.climb && Math.abs(p.y - last.rung) > 0.3) { last.rung = p.y; const pipe = pipes.find(b => Math.abs(b.x - p.x) < 0.8 && Math.abs(b.z - p.z) < 0.8)?.style === 'drainpipe'; audio.play(pipe ? 'pipe' : 'rung', at, 0.8); }
  traversals.set(p.id, last);
}
/** Footstep sound for what a body stands on: a box's material, or the ground (road, paving and plazas are hard; open ground is earth; the shelter hall is tiled). */
function surfaceUnder(p: Player): Sound {
  const world = local()?.sim.world ?? WORLD, box = world.find(b => b.kind !== 'ground' && Math.abs(b.y + b.h / 2 - p.y) < 0.06 && Math.abs(p.x - b.x) <= b.w / 2 && Math.abs(p.z - b.z) <= b.d / 2);
  if (box) { const s = surfaceOf(box); return s === 'metal' ? 'step-metal' : s === 'wood' ? 'step-wood' : 'step'; }
  if (world !== WORLD) return Math.abs(p.x) < 7 && Math.abs(p.z) < 5 ? 'step-tile' : 'step-dirt';
  const road = Math.abs(p.x) < 8 || Math.abs(p.z) < 6, paved = Math.abs(Math.abs(p.z) - 28) < 4 || Math.abs(Math.abs(p.x) - 25) < 15 && Math.abs(p.z - Math.sign(p.x) * 16) < 8;
  return road || paved ? 'step' : 'step-dirt';
}
// ── HUD.
const compass = $('compass'); compass.innerHTML = Array.from({ length: 72 }, (_, i) => i * 5).map(d => d % 45 === 0 ? `<b data-a="${d}" class="${d % 90 === 0 ? 'cardinal' : ''}">${['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'][d / 45]}</b>` : d % 15 === 0 ? `<i data-a="${d}"></i>` : '').join('') + '<span class="obj" id="compass-obj" hidden>◆</span>';
const compassMarks = [...compass.querySelectorAll<HTMLElement>('[data-a]')];
const wrap = (a: number) => { while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2; return a; };
function project(point: Vec3) {
  const engine = renderer.engine, w = engine.getRenderWidth(), h = engine.getRenderHeight(), v = Vector3.Project(new Vector3(point.x, point.y, point.z), Matrix.Identity(), renderer.scene.getTransformMatrix(), renderer.camera.viewport.toGlobal(w, h));
  const forward = renderer.camera.getDirection(Vector3.Forward()), to = new Vector3(point.x, point.y, point.z).subtract(renderer.camera.position);
  return Vector3.Dot(forward, to) > 0 ? { x: v.x / w * innerWidth, y: v.y / h * innerHeight } : null;
}
/**
 * What each hunter knows, drawn over its head: a ring filling as it notices, amber while it looks for the player, red once it has
 * them. Hunters off screen or behind are pinned around the edge of the view, so nothing comes from nowhere.
 */
let alarmLevel = 0;
function alarms(me: Player, yaw: number, views: AgentView[]) {
  let html = '', level = 0; const cx = innerWidth / 2 / uiScale, cy = innerHeight / 2 / uiScale;
  for (const a of views) {
    const hunting = a.state === 'engage' || a.windup, looking = a.state === 'investigate' || a.state === 'search';
    if (!hunting && !looking && a.awareness < 0.12) continue;
    level = Math.max(level, hunting ? 2 : a.awareness >= 0.3 || looking ? 1 : 0);
    const seen = project({ x: a.x, y: a.y + 2.25, z: a.z }), rel = wrap(Math.atan2(a.x - me.x, a.z - me.z) - yaw), on = seen && seen.x > 0 && seen.x < innerWidth && seen.y > 0 && seen.y < innerHeight;
    const x = on ? seen.x / uiScale : cx + Math.sin(rel) * cx * 0.72, y = on ? seen.y / uiScale : cy - Math.cos(rel) * cy * 0.62;
    html += hunting ? `<div class="alarm hunt ${a.windup ? 'windup' : ''}" style="left:${x}px;top:${y}px">!</div>` : looking ? `<div class="alarm look" style="left:${x}px;top:${y}px">?</div>` : `<div class="alarm ring" style="left:${x}px;top:${y}px;--a:${a.awareness.toFixed(2)}"></div>`;
  }
  $('markers').insertAdjacentHTML('beforeend', html);
  if (level > alarmLevel) audio.play(level === 2 ? 'spotted' : 'noticed'); alarmLevel = level;
}
function hudFrame(me: Player, yaw: number) {
  const now = performance.now();
  // Compass: bearings are measured like yaw, clockwise from +z, which is drawn as north.
  const width = compass.clientWidth || 520, span = 1.9;
  for (const el of compassMarks) { const rel = wrap(Number(el.dataset.a) * Math.PI / 180 - yaw); el.style.left = `${width / 2 + rel / span * width}px`; el.style.display = Math.abs(rel) < span / 1.6 ? '' : 'none'; }
  const objective = story?.hud().objective, marker = objective?.marker, dot = $('compass-obj');
  if (marker) { const rel = wrap(Math.atan2(marker.x - me.x, marker.z - me.z) - yaw); dot.hidden = false; dot.style.left = `${width / 2 + Math.max(-span / 2.1, Math.min(span / 2.1, rel)) / span * width}px`; } else dot.hidden = true;
  // Easy and Normal mark alerted enemies within 40 m on the compass, so attacks never come from nowhere.
  // In a pursuit every level hears hunters close by, because the player has to judge them around corners.
  const hunted = !!story?.mission.pursuit, views = story?.agentViews().filter(a => a.health > 0) ?? [];
  const threats = hunted ? views.filter(a => Math.hypot(a.x - me.x, a.z - me.z) < 20) : pref.difficulty !== 'hard' ? views.filter(a => a.awareness >= 0.5 && Math.hypot(a.x - me.x, a.z - me.z) < 40) : [];
  let pool = compass.querySelectorAll<HTMLElement>('.threat');
  while (pool.length < threats.length) { compass.insertAdjacentHTML('beforeend', '<span class="threat">▼</span>'); pool = compass.querySelectorAll<HTMLElement>('.threat'); }
  pool.forEach((el, i) => { const a = threats[i]; el.hidden = !a; if (a) { const rel = wrap(Math.atan2(a.x - me.x, a.z - me.z) - yaw); el.style.left = `${width / 2 + Math.max(-span / 2.1, Math.min(span / 2.1, rel)) / span * width}px`; el.style.opacity = Math.abs(rel) > span / 2.1 ? '0.5' : '1'; } });
  if (input.touchMode) radar(me, yaw, threats, marker);
  const markers = $('markers'); if (marker && me.health > 0) { const p = project({ x: marker.x, y: (marker.y ?? 0) + 1.6, z: marker.z }); const d = Math.round(Math.hypot(marker.x - me.x, marker.z - me.z)); markers.innerHTML = p && d > 3 ? `<div class="marker" style="left:${p.x / uiScale}px;top:${p.y / uiScale}px">${d} M</div>` : ''; } else markers.innerHTML = '';
  if (hunted && me.health > 0) alarms(me, yaw, views);
  // Crosshair gap reflects the real spread cone; aiming down sights hides it in favour of the sights.
  const cone = spreadCone(me), gap = Math.max(4, Math.tan(cone) / Math.tan(pref.fov * Math.PI / 360) * innerWidth / 2 / uiScale), ads = renderer.viewmodel.adsBlend;
  const lines = $('crosshair').children as HTMLCollectionOf<HTMLElement>;
  lines[0].style.top = `${-gap - 7}px`; lines[1].style.top = `${gap}px`; lines[2].style.left = `${-gap - 7}px`; lines[3].style.left = `${gap}px`;
  $('crosshair').style.opacity = me.health <= 0 ? '0' : String(Math.max(0, 1 - ads * 1.6) * (Math.hypot(me.vx, me.vz) > 6 ? 0.35 : 1));
  const hm = $('hit-marker'); hm.style.opacity = now < hit.until ? '1' : '0'; hm.className = hit.kind;
  $('damage').style.opacity = now < damageUntil ? '0.55' : me.health < 35 && me.health > 0 ? '0.25' : '0';
  const live = indicators.filter(i => i.until > now); $('indicators').innerHTML = live.map(i => `<div class="indicator" style="transform:rotate(${wrap(i.angle - yaw)}rad);opacity:${Math.min(1, (i.until - now) / 500)}"><i></i></div>`).join('');
}
/**
 * Touch radar, 35 m across its radius, rotated so the top is where you face. Solo modes show
 * enemies that are aware of you (Easy and Normal) and the objective; online it shows teammates
 * only, never opponents, so it gives no information the server would not.
 */
function radar(me: Player, yaw: number, threats: { x: number; z: number }[], marker?: Vec3) {
  const el = $('radar'), size = el.clientWidth || 110, half = size / 2, range = 35;
  const place = (x: number, z: number, clamp: boolean) => { const rel = Math.atan2(x - me.x, z - me.z) - yaw, d = Math.min(Math.hypot(x - me.x, z - me.z) / range, clamp ? 0.92 : 1); return d >= 1 ? null : { left: half + Math.sin(rel) * d * half, top: half - Math.cos(rel) * d * half }; };
  const allies = mode === 'online' ? (snapshot?.players ?? []).filter(p => p.id !== ownId && p.team === me.team && p.health > 0) : [];
  const points = [...threats.map(t => ({ ...place(t.x, t.z, false), cls: 'dot' })), ...allies.map(a => ({ ...place(a.x, a.z, false), cls: 'dot ally' })), ...(marker ? [{ ...place(marker.x, marker.z, true), cls: 'dot obj' }] : [])].filter(p => p.left !== undefined);
  let dots = el.querySelectorAll<HTMLElement>('.dot'); while (dots.length < points.length) { el.insertAdjacentHTML('beforeend', '<i class="dot"></i>'); dots = el.querySelectorAll<HTMLElement>('.dot'); }
  dots.forEach((dot, i) => { const p = points[i]; dot.hidden = !p; if (p) { dot.className = p.cls; dot.style.left = `${p.left}px`; dot.style.top = `${p.top}px`; } });
  const north = el.querySelector<HTMLElement>('.north')!; north.style.left = `${half - Math.sin(yaw) * (half - 9)}px`; north.style.top = `${half - Math.cos(yaw) * (half - 9)}px`;
}
function scoreTable(players: { id: string; name: string; team: number; kills: number; deaths: number; ping?: number }[]) {
  return [0, 1].map(team => `<table><thead><tr><th class="${team ? 'bandits-text' : 'police-text'}">${TEAMS[team].name.toUpperCase()}</th><th>K</th><th>D</th><th>PING</th></tr></thead><tbody>${players.filter(p => p.team === team).sort((a, b) => b.kills - a.kills || a.deaths - b.deaths).map(p => `<tr class="${p.id === ownId ? 'you' : ''}"><td><i class="team-dot ${team ? 'bandits-bg' : 'police-bg'}"></i>${escape(p.name)}${p.id === ownId ? '<small>YOU</small>' : ''}</td><td>${p.kills}</td><td>${p.deaths}</td><td>${p.ping === undefined ? '—' : `${p.ping}ms`}</td></tr>`).join('') || '<tr><td class="muted">No players</td><td></td><td></td><td></td></tr>'}</tbody></table>`).join('<div style="height:14px"></div>');
}
function hudText(me: Player) {
  const now = performance.now(), gun = me.guns[me.weapon], def = WEAPONS[me.weapon], simNow = local()?.sim.now ?? snapshot?.now ?? 0;
  const health = Math.ceil(me.health); $('health').textContent = String(health); $('vitals').classList.toggle('low', health < 35);
  [...$('health-segs').children].forEach((el, i) => el.classList.toggle('on', health > i * 10));
  const ammo = $('ammo'); ammo.textContent = String(gun.ammo); ammo.className = gun.ammo === 0 ? 'empty' : gun.ammo <= def.magazine * 0.25 ? 'low' : ''; $('reserve').textContent = String(gun.reserve);
  $('weapon-name').textContent = def.name; $('weapon-icon').innerHTML = me.weapon === 'rifle' ? RIFLE_ICON : PISTOL_ICON;
  $('weapon-status').textContent = me.reloadUntil > simNow ? 'RELOADING' : gun.ammo === 0 && gun.reserve === 0 ? 'NO AMMUNITION' : gun.ammo === 0 ? `RELOAD · ${keyName(pref.bindings.reload[0] ?? 'KeyR')}` : gun.ammo <= def.magazine * 0.25 ? 'LOW AMMO' : '';
  $('slot-1').classList.toggle('on', me.weapon === 'rifle'); $('slot-2').classList.toggle('on', me.weapon === 'sidearm');
  for (const w of ['rifle', 'sidearm'] as const) { $(`touch-${w}`).classList.toggle('on', me.weapon === w); $(`touch-ammo-${w}`).textContent = `${me.guns[w].ammo}/${me.guns[w].reserve}`; }
  $('feed').innerHTML = feed.filter(f => f.until > now).map(f => `<div>${f.html}</div>`).join('');
  // Context hint for traversal: what a jump (or walking forward, for a ladder) would do right now.
  const hint = me.health > 0 ? traverseHint(me, input.yaw) : undefined, hintEl = $('traverse-hint');
  hintEl.hidden = !hint; if (hint) hintEl.innerHTML = `<kbd>${escape(input.touchMode ? (hint === 'climb' ? '▲' : 'JUMP') : keyName((hint === 'climb' ? pref.bindings.forward : pref.bindings.jump)[0] ?? 'Space'))}</kbd>${hint.toUpperCase()}`;
  $('touch-jump').dataset.hint = hint && hint !== 'climb' ? hint.toUpperCase() : '';
  if (story) {
    const h = story.hud(), o = h.objective, panel = $('objective');
    if (o) { const id = o.text; if (id !== lastObjective) { if (lastObjective) { audio.play('objective'); panel.classList.remove('flash'); void panel.offsetWidth; panel.classList.add('flash'); } lastObjective = id; } }
    panel.innerHTML = o ? `<small>${lastObjective && o ? 'OBJECTIVE' : ''}</small><p>${escape(o.text)}</p>${o.progress !== undefined ? `<div class="bar"><i style="width:${Math.round(o.progress * 100)}%"></i></div>` : ''}${o.warning ? `<div class="warn">${escape(o.warning)}</div>` : ''}${h.optional.map(x => `<div class="optional ${x.done ? 'done' : ''}">${escape(x.text)}</div>`).join('')}` : '';
    // On touch screens subtitles sit directly under the objective, however tall it is, clear of the thumb controls.
    $('subtitle').style.top = input.touchMode ? `${panel.innerHTML ? panel.offsetTop + panel.offsetHeight + 6 : 8}px` : '';
    document.body.classList.toggle('can-use', !!h.prompt);
    const prompt = $('prompt'); prompt.hidden = !h.prompt; if (h.prompt) { $('prompt-text').textContent = h.prompt.text; $('prompt-ring').style.setProperty('--p', String(h.prompt.progress)); }
    const sub = $('subtitle'); sub.hidden = !h.subtitle; if (h.subtitle) sub.innerHTML = MISSIONS[missionId].lines[h.subtitle.key] ? lineHtml(h.subtitle.key).html : `<b class="${h.subtitle.speaker.toLowerCase()}">${escape(h.subtitle.speaker)}</b>${escape(h.subtitle.text)}`;
    if (h.subtitle && h.subtitle.key !== lastLine) { lastLine = h.subtitle.key; if (MISSIONS[missionId].lines[h.subtitle.key]) voice(h.subtitle.key); else if (!speak(audio, h.subtitle.key, h.subtitle)) audio.play('radio'); }
    $('location').textContent = `${MISSIONS[missionId].location.toUpperCase()} · ${story.clock.toUpperCase()}`;
    $('notice').hidden = !h.notice; $('notice').textContent = h.notice ?? '';
    $('death').hidden = true; $('net-label').textContent = '';
  } else { $('prompt').hidden = true; $('subtitle').hidden = true; $('notice').hidden = true; document.body.classList.remove('can-use'); }
  if (training) {
    const s = training.stats; $('score0').textContent = String(s.kills); $('score1').textContent = `${accuracy(s)}%`; $('timer').textContent = clock(s.time); $('limit').textContent = training.kind === 'targets' ? 'TARGET PRACTICE' : 'BOT SKIRMISH'; $('score0-label').textContent = 'HITS'; $('score1-label').textContent = 'ACCURACY'; $('score0').textContent = String(s.hits);
    $('death').hidden = me.health > 0; $('death-title').textContent = 'Down'; $('respawn-label').textContent = `Back in ${Math.max(0, Math.ceil(me.respawnAt - simNow))}s`; $('net-label').textContent = 'LOCAL · OFFLINE';
  }
  if (mode === 'online' && snapshot) {
    const remaining = Math.max(0, Math.ceil(snapshot.deadline - snapshot.now)), server = snapshot.players.find(p => p.id === ownId);
    $('score0').textContent = String(snapshot.score0); $('score1').textContent = String(snapshot.score1); $('score0-label').textContent = 'POLICE'; $('score1-label').textContent = 'BANDITS'; $('timer').textContent = clock(remaining); $('limit').textContent = `FIRST TO ${snapshot.killLimit}`;
    $('net-label').textContent = network.connected ? `${server?.ping ?? 0} MS · ${snapshot.players.length} PLAYERS` : 'RECONNECTING…';
    $('death').hidden = me.health > 0; $('death-title').textContent = 'Eliminated'; $('respawn-label').textContent = `Respawning in ${Math.max(0, Math.ceil((server?.respawnAt ?? 0) - snapshot.now))}s`;
    if (!$('scoreboard').hidden) $('score-table').innerHTML = scoreTable(snapshot.players);
  }
  $('diagnostics').hidden = !diagnosticsOn;
  if (diagnosticsOn) {
    const d = renderer.diagnostics(), agents = story ?? training;
    $('diagnostics').textContent = [`FPS ${d.fps.toFixed(0)}  median ${d.medianMs.toFixed(1)}ms  p95 ${d.p95Ms.toFixed(1)}ms`, `draws ${d.drawCalls}  meshes ${d.activeMeshes}/${d.meshes}  actors ${d.actors}`, `pos ${me.x.toFixed(2)} ${me.y.toFixed(2)} ${me.z.toFixed(2)}  ${me.grounded ? 'grounded' : 'air'}${me.crouched ? ' crouch' : ''}`,
      mode === 'online' ? `net ${network.connected ? 'connected' : 'down'}  ping ${snapshot?.players.find(p => p.id === ownId)?.ping ?? 0}ms  pending ${pending.length}` : `mode ${mode}${story ? `  objective ${story.objective?.id ?? 'done'}  checkpoint ${story.checkpoint}` : ''}`,
      ...(agents ? agents.agentViews().filter(a => a.health > 0).slice(0, 8).map(a => `${a.id.padEnd(14)} ${a.state.padEnd(11)} aware ${a.awareness.toFixed(2)}${a.sees ? ' SEES' : ''}`) : [])].join('\n');
  }
}
let lastLine = '';
function lobbyUI() {
  if (!snapshot || mode !== 'online') return; const me = snapshot.players.find(p => p.id === ownId); if (!me) return;
  const remaining = Math.max(0, Math.ceil(snapshot.deadline - snapshot.now)), host = snapshot.host === ownId, waiting = snapshot.phase === 'WAITING';
  if (snapshot.phase === 'WAITING' || snapshot.phase === 'COUNTDOWN') {
    const ready = snapshot.players.filter(p => p.connected && p.ready), teams = [0, 1].map(t => ready.some(p => p.team === t)), need = snapshot.private ? 2 : RULES.publicMinimum;
    $('lobby-type').textContent = `Street Wars · ${snapshot.private ? 'Private room' : 'Public room'} · ${BRAND.map}`;
    $('lobby-title').textContent = snapshot.phase === 'COUNTDOWN' ? 'Rolling out' : 'Waiting at the junction'; $('lobby-countdown').hidden = snapshot.phase !== 'COUNTDOWN'; $('lobby-countdown').textContent = String(remaining);
    $('lobby-caption').textContent = snapshot.phase === 'COUNTDOWN' ? 'Match starting. Get ready.' : ready.length < need ? `${ready.length} of ${need} players loaded. ${snapshot.private ? 'Invite a friend with the link below.' : 'Public matches start automatically.'}` : !teams[0] || !teams[1] ? 'Both Police and Bandits need at least one player.' : snapshot.private ? (host ? 'Ready. Start the match when your crew is set.' : 'Waiting for the host to start.') : 'Starting shortly…';
    $('roster').innerHTML = [0, 1].map(team => { const list = snapshot!.players.filter(p => p.team === team); return `<div class="team-col ${team ? 'bandits' : 'police'}"><h3><span>${TEAMS[team].name.toUpperCase()}</span><span>${list.length}/4</span></h3>${Array.from({ length: 4 }, (_, i) => { const p = list[i]; return p ? `<div class="slot ${p.id === ownId ? 'you' : ''}"><span>${escape(p.name)}${p.id === snapshot!.host && snapshot!.private ? ' ★' : ''}${p.id === ownId ? ' (you)' : ''}</span><small class="${!p.connected ? 'warn' : p.ready ? 'ready' : ''}">${!p.connected ? 'RECONNECTING' : p.ready ? `READY · ${p.ping}MS` : 'LOADING'}</small></div>` : '<div class="slot empty">Open seat</div>'; }).join('')}</div>`; }).join('');
    $('start-match').hidden = !snapshot.private || !host || !waiting; $<HTMLButtonElement>('start-match').disabled = !(ready.length >= 2 && teams[0] && teams[1]);
    $('switch-team').hidden = !waiting;
    $('match-settings').hidden = !snapshot.private; for (const id of ['opt-duration', 'opt-kills']) $<HTMLSelectElement>(id).disabled = !host || !waiting;
    if (document.activeElement?.id !== 'opt-duration') $<HTMLSelectElement>('opt-duration').value = String(snapshot.duration);
    if (document.activeElement?.id !== 'opt-kills') $<HTMLSelectElement>('opt-kills').value = String(snapshot.killLimit);
  }
  if (snapshot.phase === 'RESULTS') {
    const w = snapshot.winner; $('result-title').textContent = w === 'DRAW' ? 'An even fight' : w === 'ABANDONED' ? 'Match abandoned' : `${w === TEAMS[0].id ? 'Police take' : 'Bandits take'} the streets`;
    $('result-score').innerHTML = `<span class="police-text">${snapshot.score0}</span><small>—</small><span class="bandits-text">${snapshot.score1}</span>`;
    $('results-table').innerHTML = scoreTable(snapshot.results); $('result-caption').textContent = `Lobby opens in ${remaining}s. ${snapshot.private ? 'Your host can start another round.' : 'The next round starts when four players are ready.'}`;
    $('return-lobby').textContent = `Lobby in ${remaining}s`;
  }
}
// ── Render loop.
renderer.engine.runRenderLoop(() => {
  const now = performance.now(), dt = (now - previousFrame) / 1000; previousFrame = now;
  // A long stall (tab switch, breakpoint) is dropped rather than simulated, so nothing teleports.
  accumulator += Math.min(dt, 0.1); let steps = 0;
  while (accumulator >= RULES.dt && steps++ < 4) { tick(); accumulator -= RULES.dt; } if (steps >= 4) accumulator = 0;
  const me = own(), alpha = accumulator / RULES.dt, session = local();
  const playing = !!me && (mode === 'story' || mode === 'training' || snapshot?.phase === 'ACTIVE');
  const view = me ? { ...me, x: prev.x + (me.x - prev.x) * alpha, y: prev.y + (me.y - prev.y) * alpha, z: prev.z + (me.z - prev.z) * alpha } : undefined;
  if (view && Math.hypot(me!.x - prev.x, me!.z - prev.z) > 2) Object.assign(view, { x: me!.x, y: me!.y, z: me!.z });
  const npc = story?.npcView(), staged = stagedActors();
  // Only the near ones are animated people; the frozen crowd holds the distance, which keeps the park on budget.
  const bystanders = story?.flags.has('live') && !cinema ? (MISSIONS[missionId].bystanders ?? []).filter(a => Math.hypot(a.at.x - story!.player.x, a.at.z - story!.player.z) < 20) : [];
  const extras: Extra[] = npc && !staged.hide.has(npc.id) ? [{ id: npc.id, faction: 2, name: npc.name, variant: npc.id === 'femi' ? 'femi' : npc.id === 'sergeant' ? 'sergeant' : 'default', pose: { x: npc.x, y: npc.y, z: npc.z, yaw: npc.yaw, pitch: 0, vx: npc.vx, vz: npc.vz, grounded: npc.grounded, crouched: false, aiming: false, weapon: 'rifle', health: 100, reloading: 0, equipping: 0, seated: npc.seated } }] : [];
  renderer.zoom = me ? WEAPONS[me.weapon].zoom : 1;
  extras.push(...staged.extras, ...bystanders.map(standing));
  const shot = cinema ? cinemaFrame(Math.min(dt, 0.1)) : undefined, cinematic = shot && cinema ? { ...shot, hide: staged.hide, exposure: cinema.director.current.exposure ?? cinema.director.scene.exposure, light: { ...cinema.director.scene.light, ...cinema.director.current.light } } : shot ? { ...shot, hide: staged.hide } : undefined;
  renderer.render({ players: session ? [...session.sim.players.values()] : snapshot?.players ?? [], ownId: session ? 'you' : ownId, own: view, yaw: input.yaw, pitch: input.pitch, now: session?.sim.now ?? snapshot?.now ?? 0, interpolate: !session, playing, teamTags: mode === 'online', extras, look: input.lookDelta, cinematic, melee: meleeIds(), unarmed: !!story && !story.armed });
  document.body.classList.toggle('unarmed', !!story && !story.armed);
  input.lookDelta.x = 0; input.lookDelta.y = 0;
  audio.setListener(renderer.camera.position, renderer.camera.rotation.y); radio.flush();
  if (playing && me && !cinema) hudFrame(me, input.yaw + me.recoilYaw);
  if (now - uiAt > 100) { uiAt = now; if (playing && me && !cinema) hudText(me); lobbyUI(); }
});
document.addEventListener('visibilitychange', () => { accumulator = 0; previousFrame = performance.now(); });
focusNav(0); void serverStatus(); controlSummary();
// Build the shared navigation grid while the player is still on the menu, so missions start without a stall.
setTimeout(() => arenaNav(), 1500);
void renderer.scene.whenReadyAsync().then(() => { if (!busy) $('loading').hidden = true; });
// Read-only diagnostics: exposes no gameplay mutation, server authority, or secret.
Object.defineProperty(window, 'lastBusDiagnostics', { value: () => { const sorted = [...corrections].sort((a, b) => a - b), me = own(); return { ...renderer.diagnostics(), mode: mode === 'training' ? 'practice' : mode === 'online' ? 'multiplayer' : mode, phase: local() ? 'ACTIVE' : snapshot?.phase, players: local() ? local()!.sim.players.size : snapshot?.players.length ?? 0, connected: network.connected, correctionP95Metres: sorted[Math.floor(sorted.length * 0.95)] ?? 0, objective: story?.objective?.id, storyState: story?.state, simTime: local()?.sim.now, paused, agents: local()?.agentViews(), self: me ? { x: me.x, y: me.y, z: me.z, traverse: me.traverse, life: me.life, health: me.health, weapon: me.weapon, ammo: me.guns[me.weapon].ammo } : undefined }; }, writable: false });
// Development-only hooks for automated walkthroughs. Not present in production builds.
if (import.meta.env.DEV) Object.defineProperty(window, 'lastBusDev', { value: { teleport: (x: number, z: number, yaw?: number) => { const p = local()?.player; if (p) { drive.ticks = 0; Object.assign(p, { x, z, vx: 0, vy: 0, vz: 0, traverse: 0, grounded: true, y: Math.max(0, groundHeight(x, z, p.y + 0.6, local()!.sim.world)) }); if (yaw !== undefined) { p.yaw = yaw; input.yaw = yaw; } prev = { x: p.x, y: p.y, z: p.z }; } }, skip: () => story?.devSkip(), sfx: (kind: string, cine = false) => cine ? audio.cine(kind as never) : audio.play(kind as Sound), peak: () => audio.peak(), probe: () => audio.probe(), score: (kind: 'menu' | 'tension' | 'none') => audio.score(kind), ambience: (mood: SoundMood, seconds = 2) => audio.ambience(true, generators(), mood, seconds), radio: (cue: RadioCue) => radio.cue(cue), sound: () => ({ ...audio.sounding(), ...renderer.arena.shown, station: radio.state.on ? radio.state.station : '', muffled: radio.state.muffled }), mix: (bus: 'master' | 'music' | 'ambience' | 'effects' | 'ui' | 'dialogue', value: number) => audio.level(bus, value), stage: (scene: Cutscene) => { if (!story) return; MISSIONS[missionId].cutscenes[scene.id] = scene; endCinema(true); story.cutscenes.length = 0; startCinema(scene.id); }, play: (id: string, shot = 0, flags: string[] = []) => { if (!story) return; for (const f of flags) story.flags.add(f); syncWorld(true); endCinema(true); story.cutscenes.length = 0; startCinema(id); for (let i = 0; i < shot; i++) cinema?.director.next(); }, clearEnemies: () => { for (const a of local()?.agents.values() ?? []) a.player.health = 0; }, heal: () => { const p = local()?.player; if (p) p.health = 100; }, god: (on = true) => { god = on; }, kill: () => { god = false; const p = local()?.player; if (p) p.health = 0; }, inspect: (on = true) => { inspecting = on; if (on) { $('pause').hidden = true; paused = false; } }, look: (yaw: number, pitch = 0) => { input.yaw = yaw; input.pitch = pitch; }, phone: (id = 'phone') => openPhone(id), cinema: () => cinema ? { id: cinema.id, shot: cinema.director.shot, roll: renderer.camera.rotation.z, rx: renderer.camera.rotation.x } : undefined, unlockAll: (chapter: string) => { for (const c of CAMPAIGN.chapters) { if (c.id === chapter) break; for (const id of c.missions) progress.completed[id] ??= { best: 600, difficulty: 'normal' }; } saveProgress(); }, drive: (ticks: number, script: Partial<InputFrame> | ((left: number) => Partial<InputFrame>)) => { drive.ticks = ticks; drive.input = typeof script === 'function' ? script : () => script; } } });
