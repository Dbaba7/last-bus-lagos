import type { Vec3 } from '../world.js';
import type { AgentDef, Difficulty, Senses } from './ai.js';
import { aftermath } from './chapter2.js';
import { passenger } from './prologue.js';
/**
 * Campaign data. Missions are plain data: objectives, encounters, dialogue and
 * checkpoints are declared here and interpreted by StorySession, so new
 * missions are written without touching engine code.
 */
/**
 * One dialogue line. Its key doubles as the voice file name (voice/<key>.mp3); subtitles always show. `direction` is for the voice actor.
 * `voice` names the cast member when one speaker label has several voices (radio chatter, two STATIC). `radio` lines are played through
 * the handset filter (CONTROL always is). `clean` is the wording used when Mature language is off; its recording is `<key>-clean`.
 * `station` lines are a broadcast, heard through the bus radio's speaker instead of a handset.
 */
export interface Line { speaker: string; text: string; seconds?: number; direction?: string; voice?: string; radio?: boolean; clean?: string; unvoiced?: boolean; station?: boolean }
export type Ease = 'linear' | 'smooth' | 'in' | 'out' | 'hold';
/**
 * One camera move in a cutscene: the camera travels from -> to while its aim
 * travels look -> lookTo, with optional dialogue. Positions are world metres.
 * A shot normally cuts in; `blend` instead moves the camera on from where the
 * previous shot ended over that many seconds. `fovTo` gives a push-in or pull-out,
 * `shake` a handheld wobble (metres), `roll` a dutch angle (radians).
 */
/**
 * Cutscene lighting for the staged cast: `key` from beside the camera, `rim` from behind the subject (multipliers
 * of the rig's defaults, 0 turns one off) and `side` which side of the camera the key sits on (1 right, -1 left).
 */
export interface CineLight { key?: number; rim?: number; side?: 1 | -1 }
/** `exposure` is a floor for the image exposure during the shot, so night shots stay readable. */
export interface Shot { from: Vec3; to: Vec3; look: Vec3; lookTo?: Vec3; seconds: number; line?: string; fov?: number; fovTo?: number; ease?: Ease; blend?: number; shake?: number; roll?: number; exposure?: number; light?: CineLight }
export type ActorLook = 'ada' | 'femi' | 'police' | 'static' | 'civilian';
export type ActorPose = 'stand' | 'relaxed' | 'seated' | 'crouch' | 'down';
export type Gesture = 'point' | 'radio' | 'brace' | 'phone' | 'shrug' | 'wave' | 'look-up' | 'reach' | 'hold';
/**
 * A character staged for one scene. An actor with the player's id ('you') or the mission NPC's id
 * stands in for that body while the scene plays; `keep` hands its final position back to the NPC afterwards.
 */
export interface CineActor { id: string; look: ActorLook; at: Vec3; yaw: number; pose?: ActorPose; weapon?: 'rifle' | 'sidearm' | 'none'; hidden?: boolean; keep?: boolean; speaker?: string; folder?: boolean; bag?: boolean; clean?: boolean; variant?: 'sergeant' | 'trader' }
export type CineSound = 'rumble' | 'whoosh' | 'boom' | 'glass' | 'horns' | 'crash' | 'static' | 'ringing' | 'breath' | 'engine' | 'door' | 'siren' | 'radio' | 'slap' | 'stall' | 'steps' | 'pressure' | 'alarms' | 'deafen' | 'shutter';
/** How the street sounds. `live` is the ordinary evening, `ride` the same from inside a bus, `hush` and `still` the city emptying out. */
export type SoundMood = 'dusk' | 'restored' | 'shelter' | 'live' | 'ride' | 'hush' | 'still';
export type Sting = 'unease' | 'reveal' | 'impact' | 'title' | 'dread';
export type CineFx = 'skylight' | 'streak' | 'explosion' | 'shatter' | 'blackout' | 'dust' | 'smoke' | 'night' | 'city' | 'live' | 'jam' | 'wave' | 'embers' | 'sparks' | 'flicker';
/** What the bus is doing, for the interior set: `open` is stopped with the side door back, `attacked` the door forced and Femi's phone on the floor, `text` that phone lighting up. */
export type CabinState = 'rolling' | 'slowing' | 'stopped' | 'open' | 'attacked' | 'text';
/** What Femi's phone shows over a scene. The picture itself is never shown: `IMG_0247` is a name on a grey square. */
export type PhoneState = 'off' | 'photo' | 'sending' | 'failing' | 'dead' | 'message';
/** A colour grade preset; the renderer blends between them. */
export type Grade = 'dusk' | 'cold' | 'restored' | 'night' | 'flash' | 'aftermath' | 'shelter';
/**
 * A timed change during a cutscene, `at` seconds into shot `shot`. State cues (actors, props, fades,
 * grade, letterbox, ambience, radio, cabin, phone, and the `live` and `jam` effects) are applied immediately if the
 * shot is skipped, so a skipped scene still ends in the right place; one-off cues (sounds, stings,
 * other effects, shake) are simply dropped. `radio` drives the bus radio: `station` tunes it (a track
 * id, or any other name for talk), `signal` is 1 clean down to 0 nothing but hiss, `muffled` is for
 * shots outside the bus, and `seconds` is how long a change takes.
 */
export type CineCue = { shot: number; at?: number } & (
  | { actor: string; to?: Vec3; path?: Vec3[]; face?: Vec3 | number; pose?: ActorPose; gesture?: Gesture | ''; speed?: number; hide?: boolean; show?: boolean; bag?: boolean }
  | { prop: string; path?: Vec3[]; speed?: number; door?: number; hide?: boolean; show?: boolean; place?: Vec3; yaw?: number }
  | { fade: number; seconds?: number; color?: 'black' | 'white' }
  | { caption: string; sub?: string; seconds?: number }
  | { grade: Grade; seconds?: number }
  | { letterbox: number; seconds?: number }
  | { shake: number; seconds?: number }
  | { tumble: number }
  | { sound: CineSound; from?: Vec3; volume?: number }
  | { sting: Sting }
  | { duck: number; seconds?: number }
  | { say: string }
  | { fx: CineFx; from?: Vec3; to?: Vec3; seconds?: number }
  | { ambience: SoundMood; seconds?: number }
  | { cabin: CabinState; seconds?: number }
  | { phone: PhoneState }
  | { radio: 'play' | 'stop'; station?: string; level?: number; signal?: number; muffled?: boolean; seconds?: number }
);
/** A cutscene: camera shots in order, the cast and props it stages, and timed cues. Scenes fade in from and out to black over `fade` seconds when set. */
/** `exposure` and `light` set the scene's defaults; a shot's own values override them. */
export interface Cutscene { id: string; shots: Shot[]; cast?: CineActor[]; cues?: CineCue[]; fadeIn?: number; fadeOut?: number; grade?: Grade; exposure?: number; light?: CineLight; props?: Record<string, { x: number; z: number; yaw: number; door?: number }> }
/**
 * Mission actions. `flag` sets a named world state the client presents (`city`, `night`, `bus-gone`, `blackout`);
 * `remove` takes collision boxes out of this session's world (a vehicle that has driven away); `arm` gives or takes the
 * player's weapons; `say` with `delay` queues lines that many seconds later; `place` moves the player, for a story that jumps across the map.
 */
export type Action = { spawn: string; delay?: number } | { say: string[]; delay?: number } | { flag: string; off?: boolean } | { remove: string[] } | { relay: boolean } | { follow: boolean } | { cutscene: string } | { arm: boolean } | { notice: string } | { pace: number } | { place: Vec3; yaw: number };
export interface Interactable { id: string; at: Vec3; radius: number; prompt: string; hold: number; kind: 'examine' | 'device' | 'npc' | 'ammo' | 'phone'; repeat?: boolean; onUse?: Action[] }
/**
 * An objective. `collect` completes once every interactable in `items` has been used (in any order).
 * `clock` replaces the time shown on the HUD location line from this objective on (time has moved).
 */
export interface Objective {
  id: string; text: string; kind: 'reach' | 'interact' | 'defeat' | 'defend' | 'collect';
  at?: Vec3; radius?: number; interact?: string; items?: string[]; groups?: string[]; duration?: number; escort?: boolean; clock?: string;
  marker?: Vec3; checkpoint?: { at: Vec3; yaw: number }; onStart?: Action[]; onComplete?: Action[]; optional?: boolean;
}
export interface Mission {
  id: string; chapter: string; title: string; location: string; time: string; summary: string; briefing: string[]; intel: string[];
  start: { at: Vec3; yaw: number }; objectives: Objective[]; optional: Objective[]; interactables: Interactable[];
  groups: Record<string, AgentDef[]>; lines: Record<string, Line>; npc?: { id: string; name: string; at: Vec3; yaw: number; standing?: boolean };
  cutscenes: Record<string, Cutscene>; outro: string;
  /** Collision world: 'ojuelegba' (default) or another map in MAPS. */
  map?: string;
  /** The player starts without weapons until an `arm` action. */
  unarmed?: boolean;
  /** A short playable lead-in: no briefing, no saved checkpoint (it must not disturb the player's place in the campaign), and never needed to unlock anything. */
  prologue?: boolean;
  /**
   * A chapter ending shown instead of the results screen: title cards in order on black
   * (`hold` seconds each, click to move on). Stats are still saved and appear on the campaign screen. `next` opens that chapter
   * on the campaign screen afterwards; `continue` runs straight into that mission instead, if the player hasn't already started it.
   */
  ending?: { cards: { text: string; sub?: string; hold?: number; kind?: 'complete' | 'time' | 'chapter' | 'objective' }[]; next?: string; continue?: string };
  /**
   * An unarmed chase. The Senses set how enemies notice and pursue; `pace` and `hunters` scale how fast the player and (by
   * difficulty) the enemies move; `hint` is shown as play starts; `spotted` is the line a hunter calls when it sees the
   * player. Every group spawns whole at any difficulty (the route is choreographed) and the recorded barks stay off.
   */
  pursuit?: Senses & { pace: number; hunters: Record<Difficulty, number>; spotted: string };
  /** Where a movable vehicle waits while the `parked` flag is set, instead of its place on the map. */
  parked?: { id: string; x: number; z: number; yaw: number };
  /** People standing about in play while the `live` flag is set. Cutscenes stage their own. */
  bystanders?: CineActor[];
  /** Wording for the failure screen, when the default "You were downed" does not fit. */
  failure?: { title: string; text: string };
  /** A message shown on the player's phone when an interactable of kind 'phone' is used. */
  phone?: Record<string, { from: string; time: string; photo?: 'danfo-reflection'; body: string[] }>;
}
export interface Chapter { id: string; number: string; title: string; logline: string; missions: string[]; status: 'playable' | 'in-development' }
const P = (x: number, z: number, y = 0): Vec3 => ({ x, y, z });
/** Camera positions in cutscenes read naturally as (x, y, z). */
const C = (x: number, y: number, z: number): Vec3 => ({ x, y, z });
const signalLost: Mission = {
  id: 'signal-lost', chapter: 'dead-air', title: 'Signal Lost', location: 'Ojuelegba Junction, Lagos', time: '18:52 — dusk',
  summary: 'Every mast around Ojuelegba went silent at once. A protected witness was riding through the junction when it happened.',
  briefing: [
    'At 18:40 every radio, phone and data mast around Ojuelegba dropped at the same moment. Junction Response Unit lost contact with Danfo 247 — an unmarked bus carrying Femi Adeyemi, a Signal 9 engineer due to testify against the crew that calls itself STATIC.',
    'You are Inspector Ada Nwosu. You were told to leave the Adeyemi file alone, and every other unit at the south checkpoint was sent to Stadium. You stayed. You are the only officer inside the dead zone.',
    'Find the danfo. Find out what happened to Femi. Get the network back so Control can send help.'
  ],
  intel: ['STATIC jam police radio and phone networks, then rob and abduct inside the silence.', 'Expect armed crew with rifles and pistols. They wear red scarves.', 'Your health recovers if you avoid damage for a few seconds. Resupply crates refill ammunition.'],
  start: { at: P(0, -28.5), yaw: 0 },
  npc: { id: 'femi', name: 'Femi Adeyemi', at: P(19.4, 17.2), yaw: -Math.PI / 2 },
  interactables: [
    { id: 'danfo', at: P(-14, -4.5), radius: 1.9, prompt: 'Search the abandoned danfo', hold: 2.2, kind: 'examine' },
    { id: 'relay', at: P(-36.5, 12.5), radius: 1.6, prompt: 'Pull the jammer off Relay 07', hold: 3.2, kind: 'device' },
    { id: 'femi', at: P(19.4, 16.2), radius: 1.8, prompt: 'Help Femi up', hold: 1.8, kind: 'npc' },
    { id: 'crate-south', at: P(15, -26.9), radius: 1.6, prompt: 'Take ammunition from the police van', hold: 0.8, kind: 'ammo', repeat: true },
    { id: 'crate-yard', at: P(-28, 21.5), radius: 1.6, prompt: 'Take ammunition from the workbench', hold: 0.8, kind: 'ammo', repeat: true },
    { id: 'crate-press', at: P(13, 18.5), radius: 1.6, prompt: 'Take ammunition from the stockroom shelf', hold: 0.8, kind: 'ammo', repeat: true }
  ],
  objectives: [
    { id: 'junction', kind: 'reach', text: 'Reach the junction under the flyover', at: P(0, -3), radius: 4.5, onStart: [{ flag: 'danfo-forced' }, { cutscene: 'checkpoint' }, { cutscene: 'intro' }, { say: ['c2'] }], onComplete: [{ say: ['a1'] }] },
    // Its radio is still on, tuned to nothing, until the network comes back.
    { id: 'danfo', kind: 'interact', text: 'Search the abandoned danfo', interact: 'danfo', marker: P(-14, -4.5), onStart: [{ flag: 'dead-radio' }], onComplete: [{ say: ['a2', 'a3', 'a4'] }] },
    { id: 'yard', kind: 'defeat', text: 'Clear the STATIC crew from the Signal 9 yard', groups: ['yard'], marker: P(-31.7, 9.5), checkpoint: { at: P(-14, -6.2), yaw: -0.6 }, onStart: [{ spawn: 'yard' }, { say: ['a5'] }], onComplete: [{ say: ['a6'] }] },
    { id: 'relay', kind: 'interact', text: 'Pull the jammer off Relay 07', interact: 'relay', marker: P(-36.5, 12.5), onComplete: [{ relay: true }, { flag: 'dead-radio', off: true }, { cutscene: 'relay' }, { say: ['c4'] }] },
    { id: 'defend', kind: 'defend', text: 'Hold the yard while Relay 07 reboots', at: P(-29.5, 16), radius: 8.5, duration: 45, groups: ['wave1', 'wave2'], checkpoint: { at: P(-36, 13.6), yaw: 0.4 }, onStart: [{ relay: true }, { spawn: 'wave1', delay: 3 }, { spawn: 'wave2', delay: 22 }, { say: ['s1'] }], onComplete: [{ say: ['c5', 'c6'] }] },
    { id: 'femi', kind: 'interact', text: 'Find Femi inside Kola Printing Press', interact: 'femi', marker: P(16, 9.4), checkpoint: { at: P(-30.5, 9.6), yaw: 1.4 }, onStart: [{ relay: true }, { spawn: 'press' }], onComplete: [{ cutscene: 'femi' }, { say: ['f2'] }, { follow: true }] },
    { id: 'park', kind: 'defeat', text: 'Clear Danfo Park for the last bus', groups: ['park'], marker: P(4, 24), checkpoint: { at: P(16, 9.2), yaw: 0 }, onStart: [{ relay: true }, { follow: true }, { spawn: 'park' }, { say: ['c7'] }, { say: ['a9'], delay: 16 }, { say: ['c9'], delay: 23 }], onComplete: [{ say: ['a8'] }] },
    // Small things that do not add up on the way to the bus: an incomplete report, and Femi will not talk about the laptop.
    { id: 'board', kind: 'reach', text: 'Get Femi onto the last bus', at: P(15, 26.4), radius: 2.6, escort: true, onStart: [{ say: ['c11', 'a10'], delay: 3 }, { say: ['a11', 'f3'], delay: 13 }], onComplete: [{ cutscene: 'outro' }, { flag: 'bus-gone' }, { flag: 'femi-gone' }, { remove: ['van-w~n'] }, { follow: false }] },
    // Act II: the walk back through a city coming back to life, and what happens in the sky over it.
    { id: 'walkback', kind: 'reach', text: 'Return to the south checkpoint', at: P(8.4, -26), radius: 3.2, clock: '22:41 — night', checkpoint: { at: P(14, 24.6), yaw: Math.PI },
      onStart: [{ say: [] }, { relay: true }, { flag: 'night' }, { flag: 'city' }, { flag: 'bus-gone' }, { flag: 'femi-gone' }, { remove: ['van-w~n'] }, { follow: false }, { say: ['a13'], delay: 6 }, { say: ['a14'], delay: 24 }],
      onComplete: [{ cutscene: 'sky' }, { flag: 'blackout' }] }
  ],
  optional: [
    { id: 'resupply', kind: 'interact', text: 'Optional: grab ammunition from the police van', interact: 'crate-south', optional: true }
  ],
  groups: {
    yard: [
      { id: 'yard-gate', at: P(-31.8, 12.6), yaw: Math.PI, role: 'guard', weapon: 'rifle' },
      { id: 'yard-patrol', at: P(-36, 15), yaw: 0, role: 'patrol', weapon: 'rifle', patrol: [P(-36, 15), P(-28.5, 21), P(-28, 15.2)], melee: true },
      { id: 'yard-car', at: P(-33.6, 19), yaw: Math.PI, role: 'guard', weapon: 'sidearm' },
      { id: 'yard-alley', at: P(-23, 21), yaw: Math.PI, role: 'flanker', weapon: 'rifle' }
    ],
    wave1: [
      { id: 'w1-a', at: P(-28.5, 28.2), yaw: Math.PI, role: 'rusher', weapon: 'sidearm', alert: P(-32, 16), melee: true },
      { id: 'w1-b', at: P(-34.5, 28.5), yaw: Math.PI, role: 'guard', weapon: 'rifle', alert: P(-32, 18) }
    ],
    wave2: [
      { id: 'w2-a', at: P(-23, 25.5), yaw: Math.PI, role: 'flanker', weapon: 'rifle', alert: P(-26, 17.8) },
      { id: 'w2-b', at: P(-22.4, 23), yaw: Math.PI, role: 'rusher', weapon: 'sidearm', alert: P(-26, 17.8), melee: true }
    ],
    press: [
      { id: 'press-balcony', at: P(30.5, 11, 3), yaw: Math.PI, role: 'holder', weapon: 'rifle' },
      { id: 'press-road', at: P(14, 4.7), yaw: Math.PI, role: 'guard', weapon: 'rifle' },
      { id: 'press-inside', at: P(14.5, 12.2), yaw: Math.PI, role: 'guard', weapon: 'sidearm', melee: true }
    ],
    park: [
      { id: 'park-west', at: P(-4.5, 24.6), yaw: Math.PI, role: 'guard', weapon: 'rifle' },
      { id: 'park-east', at: P(4.5, 24.6), yaw: Math.PI, role: 'guard', weapon: 'rifle' },
      { id: 'park-rush', at: P(-11, 28), yaw: Math.PI, role: 'rusher', weapon: 'sidearm', melee: true }
    ]
  },
  cutscenes: {
    // Twenty minutes earlier, the same junction still alive. Ada has been told to leave the Femi file alone and sent to a checkpoint; she gets the last
    // of her officers sent away and stays anyway. Her radio dies at 18:40, and the existing intro picks up from Control's side.
    checkpoint: { id: 'checkpoint', fadeIn: 1.2, fadeOut: 0.9,
      cast: [
        { id: 'ada-street', look: 'ada', at: P(-7.7, -20.6), yaw: 0.1, pose: 'relaxed', weapon: 'none', folder: true },
        { id: 'corporal', look: 'police', speaker: 'corporal', at: P(-7.4, -14.2), yaw: 2.2, pose: 'relaxed' },
        { id: 'driver', look: 'civilian', at: P(-6.3, -15), yaw: -0.94, pose: 'stand' },
        { id: 'you', look: 'ada', at: P(0, -28.5), yaw: 0, pose: 'relaxed', weapon: 'none', folder: true, hidden: true }
      ],
      cues: [
        { shot: 0, fx: 'live' }, { shot: 0, ambience: 'live', seconds: 0.4 }, { shot: 0, prop: 'danfo-247', hide: true }, { shot: 0, at: 0.2, sound: 'horns', from: P(20, -4, 2), volume: 0.5 }, { shot: 0, at: 0.5, caption: 'South checkpoint', sub: '18:31', seconds: 3.4 },
        { shot: 0, at: 0.1, actor: 'ada-street', path: [P(-7.9, -16.2)], speed: 1.35, face: 0.245 },
        { shot: 1, actor: 'corporal', face: 3.39 },
        { shot: 3, at: 0.2, actor: 'driver', gesture: 'shrug' }, { shot: 3, at: 1.3, actor: 'driver', gesture: '', path: [P(-6.15, -11.2)], speed: 1.7 }, { shot: 3, at: 2.2, actor: 'driver', hide: true },
        { shot: 8, at: 0.5, actor: 'corporal', face: 0.9 },
        { shot: 9, actor: 'ada-street', gesture: 'radio', face: 2.6 }, { shot: 9, sound: 'radio' },
        { shot: 13, at: 0.1, actor: 'corporal', path: [P(-6.8, -15.6), P(-6.8, -19), P(-8.2, -24)], speed: 1.9 }, { shot: 13, at: 1.4, actor: 'ada-street', gesture: '' }, { shot: 13, at: 2.6, sound: 'engine', from: P(-20, -30, 1), volume: 0.5 }, { shot: 13, at: 3.3, actor: 'corporal', hide: true },
        { shot: 14, actor: 'ada-street', hide: true }, { shot: 14, actor: 'you', show: true }, { shot: 14, at: 0.1, actor: 'you', gesture: 'radio' },
        { shot: 16, at: 0.2, caption: '18:40', seconds: 2.4 }, { shot: 16, at: 1, fx: 'jam' }, { shot: 16, at: 1, ambience: 'dusk', seconds: 5 }, { shot: 16, at: 1, sound: 'static' }, { shot: 16, at: 1, duck: 0.45, seconds: 0.6 }, { shot: 17, at: 0.1, sound: 'static', volume: 0.5 }
      ],
      shots: [
        { from: C(-7, 2.1, -24.8), to: C(-6.9, 2.05, -24), look: C(-6.4, 1.3, -14), seconds: 4.4, fov: 60 },
        { from: C(-9.3, 1.7, -16.6), to: C(-9.2, 1.7, -16.48), look: C(-6.9, 1.54, -14.7), seconds: 3, line: 'h1', fov: 46 },
        { from: C(-8.68, 1.7, -14.09), to: C(-8.65, 1.7, -14.18), look: C(-7.77, 1.64, -16.14), seconds: 5, line: 'h2', fov: 38 },
        { from: C(-6.42, 1.65, -12.3), to: C(-6.4, 1.65, -12.45), look: C(-6.4, 1.59, -15), seconds: 2.6, fov: 44 },
        { from: C(-10.75, 1.66, -15.4), to: C(-10.6, 1.66, -15.35), look: C(-7.65, 1.5, -15.2), seconds: 3.2, line: 'h3', fov: 58 },
        { from: C(-8.61, 1.7, -14.28), to: C(-8.58, 1.7, -14.37), look: C(-7.79, 1.68, -16.16), seconds: 2.6, line: 'h4', fov: 36 },
        { from: C(-6.86, 1.7, -16.28), to: C(-6.89, 1.7, -16.19), look: C(-7.28, 1.71, -14.17), seconds: 1.8, line: 'h5', fov: 38 },
        { from: C(-8.58, 1.7, -14.37), to: C(-8.56, 1.7, -14.42), look: C(-7.79, 1.68, -16.16), seconds: 2.6, line: 'h6', fov: 34 },
        { from: C(-6.89, 1.7, -16.19), to: C(-6.92, 1.7, -16.1), look: C(-7.28, 1.71, -14.17), seconds: 2.6, line: 'h7', fov: 38 },
        { from: C(-9.15, 1.68, -17.78), to: C(-9.1, 1.68, -17.72), look: C(-8.03, 1.66, -16.11), seconds: 5, line: 'h8', fov: 44 },
        { from: C(-8.98, 1.68, -17.7), to: C(-8.92, 1.68, -17.62), look: C(-7.99, 1.69, -16.14), seconds: 2.6, line: 'h9', fov: 40 },
        { from: C(-14.6, 1, -25.4), to: C(-14.5, 0.96, -25.5), look: C(-13.3, 0.45, -27.4), seconds: 1.8, line: 'h10', fov: 48 },
        { from: C(-8.92, 1.68, -17.62), to: C(-8.88, 1.68, -17.58), look: C(-7.99, 1.69, -16.14), seconds: 2.2, line: 'h11', fov: 37 },
        { from: C(-9.15, 1.68, -17.78), to: C(-9.1, 1.68, -17.72), look: C(-8.03, 1.66, -16.11), seconds: 3.6, fov: 44 },
        { from: C(1, 1.82, -31.3), to: C(0.95, 1.82, -31.1), look: C(-0.2, 1.25, -25.24), seconds: 5.4, line: 'h12', fov: 52 },
        { from: C(1.2, 1.72, -26.31), to: C(1.08, 1.72, -26.53), look: C(-0.12, 1.64, -28.43), seconds: 6.4, line: 'h13', fov: 40, fovTo: 36 },
        { from: C(0.95, 1.82, -31.1), to: C(0.95, 1.82, -31), look: C(-0.2, 1.3, -25.24), seconds: 3, fov: 52 },
        { from: C(1.08, 1.72, -26.53), to: C(1.04, 1.72, -26.6), look: C(-0.12, 1.64, -28.43), seconds: 2.8, line: 'a16', fov: 34 }
      ] },
    intro: { id: 'intro', fadeIn: 1.4,
      cast: [{ id: 'you', look: 'ada', at: P(0, -28.5), yaw: 0 }, { id: 'st-1', look: 'static', at: P(-18.6, -4.4), yaw: -Math.PI / 2 }, { id: 'st-2', look: 'static', at: P(-19.4, -2.6), yaw: -Math.PI / 2, weapon: 'sidearm' }],
      cues: [
        { shot: 1, at: 0.2, actor: 'st-1', path: [P(-23, -3.6), P(-31, -1)], speed: 3.2 }, { shot: 1, at: 0.6, actor: 'st-2', path: [P(-24, -2), P(-32, 0.5)], speed: 3.4 },
        { shot: 2, at: 0.4, actor: 'you', gesture: 'radio' }, { shot: 2, at: 3.8, actor: 'you', gesture: '' }
      ],
      shots: [
        { from: C(27, 17, -29), to: C(19, 14.5, -30.5), look: C(0, 3, -4), lookTo: C(-6, 2, -2), seconds: 5.5, line: 'i1', fov: 60 },
        { from: C(5, 1.4, -5.6), to: C(1.2, 1.5, -4.4), look: C(-14, 1.5, -2.6), seconds: 6, line: 'i2', fov: 50, shake: 0.015 },
        { from: C(1.51, 1.72, -26.38), to: C(1.28, 1.72, -26.71), look: C(-0.16, 1.58, -28.37), seconds: 4.5, line: 'c1', fov: 46 }
      ] },
    // The relay comes back; a cut shows the crew already running in for the box.
    relay: { id: 'relay',
      cast: [{ id: 'st-a', look: 'static', at: P(-28.4, 31), yaw: Math.PI }, { id: 'st-b', look: 'static', at: P(-34, 31.2), yaw: Math.PI, weapon: 'sidearm' }],
      cues: [{ shot: 1, actor: 'st-a', path: [P(-29.2, 26), P(-29.6, 23)], speed: 4.6 }, { shot: 1, at: 0.3, actor: 'st-b', path: [P(-33.6, 26), P(-33.2, 24)], speed: 4.4 }, { shot: 1, sting: 'dread' }],
      shots: [
        { from: C(-30, 2.2, 15), to: C(-31, 3.2, 17.5), look: C(-34, 12, 23), lookTo: C(-34, 19, 23), seconds: 5, line: 'c3', fov: 55 },
        { from: C(-30, 1.15, 19.5), to: C(-30.1, 1.2, 19.9), look: C(-31.2, 1.5, 27), seconds: 2.6, fov: 48, ease: 'out', shake: 0.03 }
      ] },
    // Femi is staged where he hides; he gets up as Ada reaches for him, and stays standing afterwards.
    femi: { id: 'femi',
      cast: [{ id: 'femi', look: 'femi', at: P(19.4, 17.2), yaw: -Math.PI / 2, pose: 'seated', keep: true }, { id: 'you', look: 'ada', at: P(18.1, 15.7), yaw: 0.7, hidden: true }],
      cues: [{ shot: 1, actor: 'you', show: true }, { shot: 1, at: 0.4, actor: 'you', gesture: 'reach' }, { shot: 1, at: 1.0, actor: 'femi', pose: 'stand', face: P(18.1, 15.7) }, { shot: 1, at: 2.4, actor: 'you', gesture: '' }],
      shots: [
        { from: C(17.2, 1.4, 15.6), to: C(17.7, 1.3, 16.1), look: C(19.4, 1.05, 17.2), seconds: 5.5, line: 'f1', fov: 50 },
        { from: C(20.3, 1.64, 12.55), to: C(20.2, 1.64, 12.9), look: C(18.75, 1.42, 16.44), seconds: 3.8, line: 'a7', fov: 50 }
      ] },
    // At the bus: Femi's question, the door, the bus pulling away, and Control's too-quick answer.
    outro: { id: 'outro',
      cast: [{ id: 'you', look: 'ada', at: P(15, 25.4), yaw: 0.35 }, { id: 'femi', look: 'femi', at: P(16.1, 26.75), yaw: Math.PI + 0.3 }],
      cues: [
        { shot: 0, prop: 'last-bus', door: 1 },
        { shot: 3, at: 0.3, actor: 'femi', path: [P(16.1, 27.35), P(16.1, 28.2)], speed: 1.3 }, { shot: 3, at: 0.9, actor: 'you', gesture: 'reach' }, { shot: 3, at: 1.4, actor: 'femi', hide: true },
        { shot: 3, at: 1.6, prop: 'last-bus', door: 0 }, { shot: 3, at: 1.6, sound: 'door', from: P(16.1, 27.4, 1.2) }, { shot: 3, at: 2.3, sound: 'engine', from: P(16, 28.5, 1) },
        { shot: 3, at: 2.4, prop: 'last-bus', path: [P(18.5, 27.6), P(21.5, 26.8), P(25, 26.6), P(27, 26.6)], speed: 5 }, { shot: 3, at: 2.8, actor: 'you', gesture: '', to: P(15.5, 25.8), face: Math.PI / 2 },
        { shot: 4, prop: 'last-bus', hide: true }, { shot: 4, fx: 'night', seconds: 14 }, { shot: 4, grade: 'cold', seconds: 6 },
        { shot: 5, at: 0.2, actor: 'you', gesture: 'radio' }, { shot: 6, at: 0.8, sting: 'unease' }, { shot: 7, at: 0.3, actor: 'you', gesture: '' }, { shot: 7, at: 0.9, actor: 'you', face: Math.PI },
        { shot: 7, at: 1.4, fx: 'city' }, { shot: 7, at: 1.4, ambience: 'restored', seconds: 4 }, { shot: 7, at: 1.4, sound: 'horns' }, { shot: 7, at: 1.2, grade: 'restored', seconds: 3 }
      ],
      shots: [
        { from: C(14.72, 1.74, 24.08), to: C(14.81, 1.74, 24.2), look: C(15.82, 1.55, 26.87), seconds: 5, line: 'f4', fov: 40 },
        { from: C(17.04, 1.7, 26.08), to: C(16.95, 1.7, 26.05), look: C(14.95, 1.64, 25.58), seconds: 2.2, line: 'a12', fov: 40 },
        { from: C(16.43, 1.7, 24.57), to: C(16.41, 1.7, 24.67), look: C(16.03, 1.69, 26.74), seconds: 3.2, line: 'f5', fov: 34, fovTo: 29 },
        { from: C(11.2, 1.2, 24.3), to: C(11.6, 1.3, 24.7), look: C(16.3, 1.4, 27.6), lookTo: C(22, 1.4, 26.8), seconds: 5.2, fov: 52 },
        { from: C(17.87, 1.72, 24.51), to: C(17.78, 1.72, 24.55), look: C(15.65, 1.61, 26.04), seconds: 4.5, line: 'c8', fov: 40 },
        { from: C(17.33, 1.7, 26.92), to: C(17.21, 1.7, 26.85), look: C(15.61, 1.65, 25.64), seconds: 6, line: 'o1', fov: 38, blend: 0.8 },
        { from: C(17.75, 1.7, 24.98), to: C(17.47, 1.7, 25.08), look: C(15.53, 1.7, 25.88), seconds: 5.5, line: 'c10', fov: 36, fovTo: 29 },
        { from: C(18.4, 1.8, 28.2), to: C(18.7, 2.7, 28.6), look: C(14.6, 1.45, 25.5), lookTo: C(6, 2.6, 19.5), seconds: 3.4, fov: 58 }
      ] },
    // Act II: the sky over Ojuelegba.
    sky: { id: 'sky',
      // Staged on the open east side of the checkpoint plaza, clear of the flyover, so the sky reads.
      cast: [{ id: 'you', look: 'ada', at: P(8.6, -26.2), yaw: -0.2 }],
      cues: [
        { shot: 0, at: 0.2, actor: 'you', gesture: 'radio' }, { shot: 2, at: 0.1, sound: 'static' }, { shot: 2, at: 2, actor: 'you', gesture: '' },
        { shot: 3, sound: 'rumble' }, { shot: 3, sting: 'dread' }, { shot: 3, at: 0.6, actor: 'you', gesture: 'look-up' }, { shot: 3, at: 0.3, fx: 'skylight', from: C(0, 60, 70), to: C(45, 66, 90), seconds: 7 }, { shot: 3, at: 2.2, fx: 'skylight', from: C(75, 70, 80), to: C(25, 62, 95), seconds: 6 },
        { shot: 4, fx: 'streak', from: C(-58, 112, 118), to: C(8, 22, 96), seconds: 13.5 }, { shot: 4, sound: 'whoosh' },
        { shot: 5, say: 'r1' }, { shot: 5, at: 1.1, say: 'r2' }, { shot: 5, at: 0.1, sound: 'radio' },
        { shot: 6, at: 0.2, actor: 'you', gesture: '', face: -0.15 },
        // One impossible second of silence: everything drops out on Ada's face.
        { shot: 6, at: 1.2, sound: 'whoosh', volume: 0.7 }, { shot: 7, duck: 0.03, seconds: 0.15 },
        // Seen from over the rooftops. The light gets here long before the sound does: the flash, the fireball, the cap climbing, and the front coming across the city.
        { shot: 8, fx: 'explosion', from: C(8, 22, 96) }, { shot: 8, duck: 0.4, seconds: 3 }, { shot: 8, sound: 'pressure', volume: 0.9 }, { shot: 8, sting: 'impact' }, { shot: 8, fade: 0.55, seconds: 0.04, color: 'white' }, { shot: 8, at: 0.1, fade: 0, seconds: 1.1, color: 'white' }, { shot: 8, at: 0.3, grade: 'aftermath', seconds: 1.8 },
        { shot: 8, at: 1.5, fx: 'wave', from: C(8, 0, 76), to: C(8, 0, -30), seconds: 6.5 }, { shot: 8, at: 2.8, fx: 'blackout' },
        { shot: 8, at: 2.9, fx: 'sparks', from: C(4, 7, 8) }, { shot: 8, at: 3.2, fx: 'sparks', from: C(-12, 7, -2) }, { shot: 8, at: 3.4, fx: 'sparks', from: C(16, 7, -6) },
        // Ada, with the light of it on her, and one voice on the radio.
        { shot: 9, say: 'r3' }, { shot: 9, at: 0.25, actor: 'you', gesture: 'brace' }, { shot: 9, at: 0.5, sound: 'static', volume: 0.6 },
        // It arrives. Windows go in a line down the street, the wall of dust comes through the pillars, and the sound finally lands.
        { shot: 10, at: 0.1, fx: 'shatter', from: C(9.5, 0, -6) }, { shot: 10, at: 0.45, fx: 'shatter', from: C(14, 0, -12) }, { shot: 10, at: 0.8, fx: 'shatter', from: C(9.5, 0, -22.5) }, { shot: 10, at: 0.5, sound: 'glass' }, { shot: 10, at: 0.3, fx: 'sparks', from: C(6, 6, -14) }, { shot: 10, at: 0.7, fx: 'sparks', from: C(12, 6, -20) },
        { shot: 10, at: 0.95, duck: 1, seconds: 0.02 }, { shot: 10, at: 0.95, sound: 'boom' }, { shot: 10, at: 0.95, fade: 0.7, seconds: 0.05, color: 'white' }, { shot: 10, at: 1.05, fade: 0, seconds: 0.5, color: 'white' }, { shot: 10, at: 0.95, shake: 1, seconds: 3.5 }, { shot: 10, at: 0.95, fx: 'dust', from: C(8, 0, -8), to: C(10.3, 1.6, -29.3) },
        { shot: 10, at: 1.05, sound: 'crash', from: C(5, 1, -12) }, { shot: 10, at: 1.2, sound: 'deafen' }, { shot: 10, at: 1.25, sound: 'alarms', from: C(10, 1, -18) }, { shot: 10, at: 1.05, actor: 'you', pose: 'crouch' }, { shot: 10, at: 1.15, tumble: 1.5 },
        // On the ground, in the dust, with her ears gone.
        { shot: 11, actor: 'you', pose: 'down', gesture: '' }, { shot: 11, fx: 'embers' }, { shot: 11, sound: 'ringing' }, { shot: 11, duck: 0.12, seconds: 0.1 }, { shot: 11, at: 2.6, fade: 1, seconds: 1.5 },
        { shot: 12, fade: 1 }, { shot: 12, duck: 0.04, seconds: 0.05 }, { shot: 12, at: 5.2, sound: 'static' }, { shot: 13, fade: 1 }
      ],
      shots: [
        { from: C(10.1, 1.78, -28.6), to: C(10, 1.78, -28.4), look: C(8.2, 1.6, -20), seconds: 5.5, line: 'c12', fov: 50 },
        { from: C(9.16, 1.7, -24.02), to: C(9.14, 1.7, -24.07), look: C(8.46, 1.63, -26.16), seconds: 2.4, line: 'a15', fov: 38 },
        { from: C(8.8, 1.7, -24.21), to: C(8.78, 1.7, -24.36), look: C(8.53, 1.69, -26.19), seconds: 3.4, line: 'a16', fov: 34 },
        { from: C(8, 27, -38), to: C(8, 27.4, -37.4), look: C(20, 52, 80), lookTo: C(24, 58, 84), seconds: 7, fov: 62 },
        { from: C(8, 27.4, -37.4), to: C(8, 27.2, -36.8), look: C(-38, 88, 112), lookTo: C(-30, 76, 110), seconds: 3.6, line: 'a17', fov: 66, ease: 'in' },
        { from: C(7.09, 1.66, -24.21), to: C(7.15, 1.66, -24.29), look: C(8.78, 1.58, -26.05), seconds: 4.6, fov: 44, shake: 0.035 },
        { from: C(7.57, 1.66, -24.31), to: C(7.62, 1.66, -24.4), look: C(8.73, 1.64, -26.12), seconds: 4, line: 'a18', fov: 40 },
        { from: C(7.57, 1.66, -24.4), to: C(7.57, 1.66, -24.4), look: C(8.73, 1.64, -26.12), seconds: 1.3, fov: 36, ease: 'hold' },
        { from: C(8, 27, -38), to: C(8, 27, -36), look: C(8, 50, 96), lookTo: C(8, 46, 90), seconds: 5.2, fov: 74, shake: 0.03 },
        { from: C(7.62, 1.66, -24.4), to: C(7.7, 1.66, -24.5), look: C(8.73, 1.64, -26.12), seconds: 1.7, fov: 34, shake: 0.02, light: { key: 2.6, rim: 2.6 } },
        { from: C(9.6, 1.5, -30), to: C(9.4, 1.5, -29.6), look: C(8.4, 3, -8), seconds: 3.4, fov: 66, shake: 0.03 },
        { from: C(6.1, 0.42, -24.5), to: C(6.2, 0.4, -24.6), look: C(8.6, 0.34, -26.2), seconds: 4.2, fov: 42, roll: 0.16, exposure: 1.1 },
        { from: C(8, 1, -26), to: C(8, 1, -26), look: C(8, 1, -20), seconds: 6.5, line: 'u1', ease: 'hold' },
        { from: C(8, 1, -26), to: C(8, 1, -26), look: C(8, 1, -20), seconds: 2.6, line: 'u2', ease: 'hold' }
      ] }
  },
  lines: {
    // Ada's opening, 18:31. The Corporal is the officer heard later as Unit Seven.
    h1: { speaker: 'CORPORAL', voice: 'UNIT_SEVEN', text: 'Madam, this one no get particulars.', seconds: 2.8, direction: 'A checkpoint corporal in restrained Pidgin, bored, fishing for something.' },
    h2: { speaker: 'ADA', text: "He has them under the mat, with the five hundred naira he's been folding since the flyover.", seconds: 4.8, direction: 'Dry, unhurried. She has only just walked up and has already seen it.' },
    h3: { speaker: 'CORPORAL', voice: 'UNIT_SEVEN', text: 'Abeg, Madam, why them put Inspector for checkpoint?', seconds: 3, direction: 'Curious, a little amused, half under his breath.' },
    h4: { speaker: 'ADA', text: 'I asked a question in a meeting.', seconds: 2.4, direction: 'Flat. A closed door with a small smile behind it.' },
    h5: { speaker: 'CORPORAL', voice: 'UNIT_SEVEN', text: 'Which question?', seconds: 1.6, direction: 'He should not have asked, and he knows it.' },
    h6: { speaker: 'ADA', text: 'Who signs off the outages.', seconds: 2.4, direction: 'Quiet, watching his reaction.' },
    h7: { speaker: 'CORPORAL', voice: 'UNIT_SEVEN', text: 'Madam, I no hear that one.', seconds: 2.4, direction: 'Looking away. Not joking now.' },
    h8: { speaker: 'CONTROL', text: "South checkpoint, all units to the traffic stop at Stadium. That's from Command. All units, Inspector.", seconds: 4.8, direction: 'Routine, with a slight weight on the last two words.' },
    h9: { speaker: 'ADA', text: 'Send the Corporal. I have a flat.', seconds: 2.4, direction: 'Without missing a beat.' },
    h10: { speaker: 'CONTROL', text: '…Is it flat?', seconds: 1.6, direction: 'A pause first. He knows her.' },
    h11: { speaker: 'ADA', text: "It's thinking about it.", seconds: 2, direction: 'Bone dry.' },
    h12: { speaker: 'CONTROL', text: "Ada. Command says eleven coincidences, and that file isn't yours any more. Leave it.", seconds: 5, direction: 'Off the script, lower, a friend warning her.' },
    h13: { speaker: 'ADA', text: "Command should buy a calendar. I wrote his name in that file. I'll stay until he's past me.", seconds: 6, direction: 'Dry on the first sentence, then quiet and certain. No heroics.' },
    i1: { speaker: 'CONTROL', text: 'Eighteen-forty. Every mast around Ojuelegba just went dark at the same moment. Radio, phones, data — all of it.', seconds: 5.5, direction: 'Police dispatcher, calm but strained, heard over a weak radio band.' },
    i2: { speaker: 'CONTROL', text: 'Danfo 247 was carrying our witness through that junction. It went in. It never came out the other side.', seconds: 6, direction: 'Slower, heavier. The worst news of the night.' },
    o1: { speaker: 'ADA', text: "Tell them I'm walking back. Somebody paid for that jammer, Control — and I want a name.", seconds: 6, direction: 'Tired, quiet resolve after the fight. Not shouting.' },
    c1: { speaker: 'CONTROL', text: "Ada, this is Control on the backup band. You're the only unit inside the dead zone.", seconds: 4.5, direction: 'Dispatcher on a failing backup band; urgent, professional.' },
    c2: { speaker: 'CONTROL', text: "Danfo 247 never cleared the junction. Get under the flyover and find it. We'll lose you soon.", seconds: 5, direction: 'Clipped, the signal is going. Last words before the line drops.' },
    a1: { speaker: 'ADA', text: "Control? …Nothing. Backup band's gone too. I'm on my own.", seconds: 4, direction: 'Ada to herself, low. A beat of fear, then she steadies.' },
    a2: { speaker: 'ADA', text: 'Side door forced. No driver, no Femi. Blood on the step — not much. He walked away from this.', seconds: 5, direction: 'Quiet, observant, crouched at the bus door.' },
    a3: { speaker: 'ADA', text: "His phone's under the seat. Last message: 'Relay 07 is jammed from inside the Signal 9 yard.'", seconds: 5.5, direction: 'Reading a phone screen, half to herself.' },
    a4: { speaker: 'ADA', text: "'I got away. Hiding where the presses are.' Kola Printing. First, the network.", seconds: 4.5, direction: 'Decision made; brisk.' },
    a5: { speaker: 'ADA', text: 'Signal 9 yard is north-west, past Bukka 24/7. The gate, the alley, or the park behind it.', seconds: 5, direction: 'Planning out loud, low and focused.' },
    a6: { speaker: 'ADA', text: 'Yard is clear. The relay cabinet is against the south wall.', seconds: 3.5, direction: 'Breathing hard after the fight.' },
    c3: { speaker: 'CONTROL', text: '…da? Ada, you are breaking up — the relay is rebooting. Do not let them reach that cabinet.', seconds: 5, direction: 'Radio breaking up and returning; relief cut with urgency.' },
    c4: { speaker: 'CONTROL', text: 'Forty-five seconds. Hold the yard.', seconds: 3, direction: 'Firm order.' },
    s1: { speaker: 'STATIC', text: 'Somebody don touch the box! Go, go — the yard!', seconds: 3.5, direction: 'STATIC crew member shouting across the yard in Nigerian Pidgin; alarmed, aggressive.' },
    c5: { speaker: 'CONTROL', text: 'Network is up. We have you, Inspector. And we have a ping on Femi’s second phone — Kola Printing Press, east side.', seconds: 6, direction: 'Clear signal at last, relieved and quick.' },
    c6: { speaker: 'CONTROL', text: 'Units are twenty minutes out. Bring him to Danfo Park; we have a bus there that never left.', seconds: 5, direction: 'Practical, reassuring.' },
    f1: { speaker: 'FEMI', text: "Officer — thank God. They took my laptop, but the drive is in my pocket. They can't open it without me.", seconds: 5.5, direction: 'Femi, injured and frightened, relieved to see a police officer; speaks fast.' },
    a7: { speaker: 'ADA', text: 'Then you stay behind me. Head down, and keep moving.', seconds: 3.5, direction: 'Ada, gentle but firm, taking charge.' },
    f2: { speaker: 'FEMI', text: 'The last bus out of here — that is the one I was supposed to take.', seconds: 4, direction: 'Femi, a shaky laugh at the irony.' },
    c7: { speaker: 'CONTROL', text: "STATIC are pulling back to Danfo Park. They'll try to stop the bus. Clear a way.", seconds: 4.5, direction: 'Warning, rising tension.' },
    a8: { speaker: 'ADA', text: 'Park is clear. Femi — the yellow bus. Go.', seconds: 3, direction: 'Short and urgent, under fire.' },
    c8: { speaker: 'CONTROL', text: 'Witness is on board. Ojuelegba is back on air. Good work, Inspector.', seconds: 4.5, direction: 'Warm, proud; the long night is over.' },
    // Act I additions: small things that do not add up.
    a9: { speaker: 'ADA', text: 'Control, that was twenty minutes ago. Where are my units?', seconds: 3.8, direction: 'Ada between fights, impatient, a little uneasy.' },
    c9: { speaker: 'CONTROL', text: '…Units are being rerouted, Inspector. Hold for an update.', seconds: 4, direction: 'A beat too long before answering. Evasive, carefully neutral.' },
    c11: { speaker: 'CONTROL', text: "Inspector, the report we're receiving is… incomplete. It's been logged as a traffic stop. No mention of a witness.", seconds: 6, direction: 'Reading off a screen, puzzled, trying to sound routine.' },
    a10: { speaker: 'ADA', text: 'A traffic stop. With a jammer on Relay 07.', seconds: 3.2, direction: 'Dry, flat disbelief, under her breath.' },
    a11: { speaker: 'ADA', text: 'Femi. The laptop they took. What was on it?', seconds: 3.4, direction: 'Quiet, direct, walking beside him.' },
    f3: { speaker: 'FEMI', text: 'Work. Just… work. Please, Inspector — can we keep moving?', seconds: 3.8, direction: 'Too quick, nervous, avoiding the question.' },
    f4: { speaker: 'FEMI', text: 'Inspector… did Control tell you who authorised my transfer tonight?', seconds: 4.5, direction: 'At the bus door, turning back. Hesitant, then deliberate.' },
    a12: { speaker: 'ADA', text: 'No.', seconds: 1.6, direction: 'A beat. Honest, wary.' },
    f5: { speaker: 'FEMI', text: "Then somebody's lying.", seconds: 2.8, direction: 'Quiet and certain, looking straight at her.' },
    c10: { speaker: 'CONTROL', text: 'Understood, Inspector. Return to the south checkpoint. Your unit will meet you there.', seconds: 5, direction: 'Instant, smooth, too rehearsed. No hesitation at all.' },
    // Act II.
    a13: { speaker: 'ADA', text: 'Lights coming back. Horns. For the first time tonight, Lagos sounds like Lagos.', seconds: 5, direction: 'Tired, almost a smile, walking alone.' },
    a14: { speaker: 'ADA', text: "'Your unit will meet you there.' No questions. Not one.", seconds: 4, direction: 'Turning it over in her head; it bothers her.' },
    c12: { speaker: 'CONTROL', text: 'Inspector, remain at your current location. We have an update on the witness.', seconds: 5, direction: 'Formal, careful, as if reading.' },
    a15: { speaker: 'ADA', text: 'What update?', seconds: 2.2, direction: 'Immediately alert.' },
    a16: { speaker: 'ADA', text: '…Control?', seconds: 2.6, direction: 'After silence. Quieter, a flicker of fear.' },
    a17: { speaker: 'ADA', text: 'What the hell is that?', clean: 'What is that?', seconds: 2.8, direction: 'Looking up at the sky, stunned.' },
    r1: { speaker: 'RADIO', voice: 'RADIO_A', text: '—unidentified object over the mainland, descending, I say again, descending—', seconds: 4.2, direction: 'Panicked officer on an open channel, talking fast over other voices.' },
    r2: { speaker: 'RADIO', voice: 'RADIO_B', text: 'Everybody away from the junction! Get away from the junction, now!', seconds: 3.6, direction: 'A second voice shouting over the first, desperate.' },
    a18: { speaker: 'ADA', text: 'Oh, no. No, no, no…', seconds: 3.4, direction: 'Looking toward the flyover, realising. Breaking.' },
    r3: { speaker: 'RADIO', voice: 'UNIT_SEVEN', text: 'Ada! GET DOWN!', seconds: 1.8, direction: 'Screamed over the radio. Same officer as Unit Seven.' },
    u1: { speaker: 'UNIT SEVEN', text: 'Control, this is Unit Seven… the target wasn’t supposed to be—', seconds: 5.5, direction: 'Weak, hurt, through heavy static. Cut off mid-word.' },
    u2: { speaker: 'RADIO', text: '[ Transmission lost ]', seconds: 2.4, unvoiced: true, direction: 'Not voiced: static, then silence.' }
  },
  ending: { next: 'third-mainland', cards: [
    { text: 'Chapter 01: Signal Lost — Complete', kind: 'complete', hold: 4.5 },
    { text: '02:17 AM.', sub: 'Three hours and twenty-five minutes later.', kind: 'time', hold: 5 },
    { text: 'Chapter 02', sub: 'Third Mainland', kind: 'chapter', hold: 5.5 }
  ] },
  outro: 'Femi Adeyemi is safe and the relay is back online. STATIC lost the junction tonight — but whoever paid for that jammer still has the witness list.'
};
export const MISSIONS: Record<string, Mission> = { [signalLost.id]: signalLost, [aftermath.id]: aftermath, [passenger.id]: passenger };
/** True once every mission a chapter needs is finished. A prologue never counts, so older saves and players who skip it are not locked out. */
export const chapterDone = (chapter: Chapter, done: Record<string, unknown>) => chapter.missions.length > 0 && chapter.missions.every(id => MISSIONS[id]?.prologue || done[id]);
/** The mission a chapter opens on: wherever the saved checkpoint is, else the very first for a newcomer, else the next one not yet finished. */
export function openingMission(chapter: Chapter, done: Record<string, unknown>, checkpoint?: string) {
  if (checkpoint && chapter.missions.includes(checkpoint)) return checkpoint;
  if (!chapter.missions.some(id => done[id])) return chapter.missions[0];
  const main = chapter.missions.filter(id => !MISSIONS[id]?.prologue); return main.find(id => !done[id]) ?? main[0] ?? chapter.missions[0];
}
export const CAMPAIGN: { title: string; premise: string; chapters: Chapter[] } = {
  title: 'Dead Air',
  premise: 'When the networks over Lagos fall silent, a crew called STATIC moves inside the quiet. Inspector Ada Nwosu has one night, one junction and no radio.',
  chapters: [
    { id: 'dead-air', number: '01', title: 'Signal Lost', logline: 'The masts over Ojuelegba go dark with a witness still on the road.', missions: [passenger.id, 'signal-lost'], status: 'playable' },
    { id: 'third-mainland', number: '02', title: 'Third Mainland', logline: 'The witness list surfaces on the longest bridge in the city.', missions: ['aftermath'], status: 'playable' },
    { id: 'eko-after-dark', number: '03', title: 'Eko After Dark', logline: 'Whoever paid for the jammer is closer than Control thinks.', missions: [], status: 'in-development' }
  ]
};
