import type { Vec3 } from '../world.js';
import type { AgentDef } from './ai.js';
import type { CineActor, Mission, Shot } from './campaign.js';
const P = (x: number, z: number, y = 0): Vec3 => ({ x, y, z });
const C = (x: number, y: number, z: number): Vec3 => ({ x, y, z });
/** STATIC want Femi alive: every one of them here carries a cutlass, runs flat out and goes for a grab. */
const hunter = (id: string, at: Vec3, yaw: number, extra: Partial<AgentDef> = {}): AgentDef => ({ id, at, yaw, role: 'guard', weapon: 'sidearm', melee: true, chase: true, ...extra });
/** Danfo 247 waiting at the park, facing the way it will leave. Its door is on the south side. */
const PARKED = { x: -2, z: 27.4, yaw: Math.PI / 2 };
/** Inside Danfo 247. The set stands offstage at z = 300 with its nose towards +x and the side door on the -z side, so `IN` and `AT` are bus coordinates: along the bus, then across it. */
const IN = (x: number, z: number, y = 0): Vec3 => P(x, 300 + z, y);
const AT = (x: number, y: number, z: number): Vec3 => C(x, y, 300 + z);
const AHEAD = Math.PI / 2;
const seat = (id: string, x: number, z: number, extra: Partial<CineActor> = {}): CineActor => ({ id, look: 'civilian', at: IN(x, z), yaw: AHEAD, pose: 'seated', weapon: 'none', ...extra });
/** Who is on the bus. Femi has the window; the Sergeant sits right behind him, which is who stands in the glass in Chapter 2's photo, or isn't. */
const PASSENGERS: CineActor[] = [
  seat('trader', -0.3, 0.2, { variant: 'trader', speaker: 'trader', yaw: AHEAD + 0.5 }), seat('passenger', 0.9, -0.72, { speaker: 'passenger' }), seat('passenger-b', -1.5, 0.12),
  seat('driver', 1.95, 0.6), { id: 'conductor', look: 'civilian', speaker: 'conductor', at: IN(-0.42, -0.86), yaw: AHEAD, pose: 'stand', weapon: 'none' }
];
const riding = (bag: boolean): CineActor[] => [seat('you', -0.3, 0.78, { look: 'femi', clean: true, bag, yaw: AHEAD + 0.45 }), ...PASSENGERS];
const SERGEANT = seat('sergeant', -1.5, 0.72, { variant: 'sergeant', speaker: 'sergeant' });
/** The ordinary evening: who is standing about at the park while Femi walks through it. */
const BYSTANDERS: CineActor[] = [
  { id: 'conductor', look: 'civilian', speaker: 'conductor', at: P(2.1, 25.6), yaw: Math.PI * 0.75, pose: 'stand' },
  { id: 'trader', look: 'civilian', variant: 'trader', at: P(-3.4, 25.4), yaw: 0.2, pose: 'stand' },
  { id: 'pos-agent', look: 'civilian', at: P(3.35, 24.3), yaw: Math.PI / 2, pose: 'stand' },
  { id: 'pos-customer', look: 'civilian', at: P(4.6, 25), yaw: Math.PI, pose: 'stand' },
  // Nobody looks at him, and nobody sits near him.
  { id: 'scarf-boy', look: 'static', at: P(10.8, 26.6), yaw: -Math.PI / 2, pose: 'seated', weapon: 'none' }
];
/** Street pictures that carry the ride until the bus interior exists, each a camera move: from, to, look, field of view. */
const street: [Vec3, Vec3, Vec3, number][] = [
  [C(7.4, 1.6, 26.8), C(7, 1.6, 26.7), C(4.4, 1.05, 24.3), 44], [C(-1, 1.6, -13.8), C(-0.9, 1.6, -13), C(4, 2.2, -1.6), 56], [C(-23, 1.7, -25.8), C(-23, 1.68, -25.6), C(-23, 15, -34), 62],
  [C(9.2, 1.25, 28.4), C(9.3, 1.25, 28.2), C(10.8, 1.05, 26.6), 42], [C(-9, 2.4, 3.4), C(-7, 2.3, 3.2), C(10, 2, 9), 58], [C(14, 1.7, -4.4), C(12, 1.7, -4.2), C(-4, 2.4, 0), 54]
];
const said = (line: string, seconds: number, i: number): Shot => { const [from, to, look, fov] = street[i % street.length]; return { from, to, look, seconds, line, fov }; };
/**
 * Prologue · The Passenger. Femi walks through Danfo Park on an ordinary evening, is put on the wrong bus, and is on it when the
 * network dies at 18:40. Then he runs: the route to Kola Printing Press is a chain of gates, because the direct line is only about
 * 36 m, each covered by a patrol walking a set route with a pause at each end. The ride itself still plays over street pictures
 * until the bus interior is built.
 */
export const passenger: Mission = {
  id: 'the-passenger', chapter: 'dead-air', title: 'The Passenger', location: 'Ojuelegba Junction, Lagos', time: '18:24 — dusk', unarmed: true, prologue: true,
  summary: 'Ojuelegba, 18:24. A Signal 9 engineer is being moved tonight, and an ordinary evening is about to stop.',
  briefing: [],
  intel: ['STATIC want you alive. They will not shoot, but a cutlass carrier who reaches you has you.', 'A marker over a hunter fills as they notice you. When it turns red they shout, then run. They are no faster than you.', 'Crouching makes you harder to notice. Break line of sight and they give up quickly. The compass shows hunters close to you.'],
  start: { at: P(35.5, 25), yaw: -Math.PI / 2 },
  npc: { id: 'sergeant', name: '', at: P(37, 25), yaw: -Math.PI / 2, standing: true },
  parked: { id: 'danfo-247', ...PARKED },
  bystanders: BYSTANDERS,
  // Hunters are never faster than Femi, so a chase is lost by stopping, cornering yourself or running into another one, not by
  // the numbers. Seeing him stops them for a moment to shout, and they give up soon after losing sight of him.
  pursuit: { sight: 0.5, awareness: 0.5, shout: 11, grace: 3, windup: 0.9, lose: 2.5, search: 4, pace: 0.72, hunters: { easy: 0.62, normal: 0.67, hard: 0.72 }, spotted: 'p24' },
  failure: { title: 'They have him', text: 'Femi never reached the press. Try again from the last stretch of road.' },
  objectives: [
    { id: 'walk', kind: 'reach', text: 'Get to the bus', at: P(-0.7, 25.2), radius: 2.2,
      onStart: [{ flag: 'live' }, { flag: 'parked' }, { relay: true }, { pace: 0.58 }, { follow: true }, { cutscene: 'opening' }],
      onComplete: [{ cutscene: 'boarding' }, { cutscene: 'ride' }, { cutscene: 'jam' }, { cutscene: 'stop' }, { flag: 'parked', off: true }, { flag: 'live', off: true }, { flag: 'danfo-forced' }, { flag: 'sergeant-gone' }, { relay: false }, { follow: false }] },
    { id: 'off-road', kind: 'reach', text: 'Get off the road', at: P(-15.8, -12.2), radius: 2.4, clock: '18:41 — dusk', checkpoint: { at: P(-14, -5.2), yaw: Math.PI },
      onStart: [{ place: P(-14, -5.2), yaw: Math.PI }, { pace: 0.72 }, { spawn: 'sweep', delay: 9 }, { spawn: 'street' }, { spawn: 'junction' }, { spawn: 'north' }, { say: ['p22'], delay: 0.6 }, { notice: 'They have not seen you yet. Stay out of their sight.' }] },
    { id: 'alley', kind: 'reach', text: 'Get out through the side door', at: P(-9.6, -15), radius: 2.6, checkpoint: { at: P(-15.8, -12.2), yaw: Math.PI / 2 }, onStart: [{ spawn: 'street' }, { spawn: 'junction' }, { spawn: 'north' }] },
    { id: 'flyover', kind: 'reach', text: 'Get under the flyover', at: P(-1, -18), radius: 3, checkpoint: { at: P(-9.6, -15), yaw: Math.PI / 2 }, onStart: [{ spawn: 'street' }, { spawn: 'junction' }, { spawn: 'north' }] },
    { id: 'kerb', kind: 'reach', text: 'Cross to the far side of the junction', at: P(6.8, -3), radius: 3.2, checkpoint: { at: P(-1, -18), yaw: 0.6 }, onStart: [{ spawn: 'junction' }, { spawn: 'north' }] },
    { id: 'press', kind: 'reach', text: 'Get inside Kola Printing Press', at: P(19, 16.6), radius: 2, checkpoint: { at: P(6.8, -3), yaw: 0.5 }, onStart: [{ spawn: 'north' }] },
    { id: 'text', kind: 'interact', text: 'Send a message while there is signal', interact: 'text', marker: P(19.2, 17), checkpoint: { at: P(19, 16.6), yaw: 0 }, onStart: [{ say: ['p23'] }], onComplete: [{ cutscene: 'hide' }] }
  ],
  optional: [],
  interactables: [{ id: 'text', at: P(19.2, 17), radius: 2.4, prompt: 'Send a message on the second phone', hold: 2.2, kind: 'examine' }],
  groups: {
    // The crew at the bus are busy with it; one of them starts walking Femi's way a little later, which keeps the player moving without a charge.
    sweep: [hunter('sweep-a', P(-8.8, -4.6), -Math.PI / 2, { role: 'patrol', patrol: [P(-13.5, -6.2), P(-15.8, -9), P(-15.8, -12.4), P(-12.6, -15), P(-9.6, -15), P(-8.8, -4.6)] })],
    street: [hunter('street-a', P(-7.6, -14), Math.PI, { role: 'patrol', patrol: [P(-7.6, -28), P(-7.6, -9.5)] })],
    junction: [hunter('flyover-a', P(8, -21.5), -Math.PI / 2, { role: 'patrol', patrol: [P(-1, -22), P(8, -21.5)] }), hunter('cross-a', P(-2, 4.4), 0)],
    north: [hunter('door-a', P(15.9, 8.8), Math.PI), hunter('north-a', P(7, 7), 0, { role: 'patrol', patrol: [P(7, 21), P(20, 22), P(7, 21), P(7, 7)] })]
  },
  lines: {
    p1: { speaker: 'CONDUCTOR', text: 'Ojuelegba, Yaba! Enter with your change o! I no get change!', seconds: 3.6, direction: 'Danfo conductor calling his route, loud and sing-song, a thousand evenings of this.' },
    p2: { speaker: 'FEMI', text: "This isn't the bus. They told me the seven o'clock.", seconds: 3, direction: 'Stopping short. Polite, but he has noticed.' },
    p3: { speaker: 'SERGEANT', text: 'Plan changed.', seconds: 1.6, direction: 'Flat. Not interested in discussing it.' },
    p4: { speaker: 'FEMI', text: 'Who changed it?', seconds: 1.6, direction: 'Quiet. He wants an answer.' },
    p5: { speaker: 'SERGEANT', text: 'Command.', seconds: 1.4, direction: 'As if that settles it.' },
    p6: { speaker: 'FEMI', text: 'Which command?', seconds: 1.6, direction: 'He has spent his life asking systems for their logs.' },
    p7: { speaker: 'SERGEANT', text: 'Oga. Enter.', seconds: 1.6, direction: 'Not unkind, not asking either.' },
    p8: { speaker: 'RADIO', voice: 'RADIO_PRESENTER', station: true, text: "…the eleventh outage on the mainland since June. Police say there is no link to Tuesday's robbery at Ikeja, where witnesses—", seconds: 6, direction: 'Evening news on FM, brisk and practised. Cut off by the driver changing the station.' },
    p9: { speaker: 'PASSENGER', voice: 'CONDUCTOR', text: 'Na STATIC be that.', seconds: 1.8, direction: 'A passenger, half to himself.' },
    p10: { speaker: 'TRADER', text: 'Shh! Abeg. No call that name for motor.', seconds: 2.6, direction: 'A market woman in her fifties, sharp and low. She is not joking.' },
    p11: { speaker: 'RADIO', voice: 'RADIO_PRESENTER', station: true, text: 'Your mama in Aba. Your money in the bank. Your market in your hand. Signal 9: the network that never sleeps.', seconds: 6, direction: 'A bright radio advert, warm and over-produced.' },
    p12: { speaker: 'FEMI', text: "Your phone is fine. It's the mast. Try now.", seconds: 2.6, direction: 'Gentle, handing it back. The first time he has relaxed.' },
    p13: { speaker: 'TRADER', text: 'Ah! God bless you. You work for them?', seconds: 2.4, direction: "Delighted, her daughter's message arriving." },
    p14: { speaker: 'FEMI', text: 'Not for long.', seconds: 1.8, direction: 'A small private smile that fades.' },
    p15: { speaker: 'SERGEANT', text: 'You talk tomorrow, you sleep tomorrow night.', seconds: 2.8, direction: 'Low, without looking at him.' },
    p16: { speaker: 'SERGEANT', text: 'Who are you sending that to?', seconds: 2, direction: 'Sharper than he meant it.' },
    p17: { speaker: 'FEMI', text: "Nobody. It's just so somebody knows which bus.", seconds: 3, direction: 'Trying to make it sound like nothing.' },
    p18: { speaker: 'SERGEANT', text: "Stay here. If I'm not back, use this. Only this.", seconds: 3.2, direction: 'Pressing something into his hand, already standing.' },
    p19: { speaker: 'PASSENGER', voice: 'CONDUCTOR', text: 'Na network o.', seconds: 1.6, direction: 'Amused. It happens every week.' },
    p20: { speaker: 'FEMI', text: "All the bands. Together. That's not a fault.", seconds: 3.2, direction: 'To himself, very quiet. The only person on the bus who understands.' },
    p21: { speaker: 'LEADER', voice: 'STATIC_A', text: 'Engineer. Come down. No make me enter.', seconds: 3, direction: 'Calm, almost bored, through the door. He knows the job title.' },
    p22: { speaker: 'LEADER', voice: 'STATIC_A', text: 'No shoot am! We need that head.', seconds: 2.4, direction: 'Shouted from inside the bus, furious.' },
    p23: { speaker: 'FEMI', text: 'Come on. One bar. One bar.', seconds: 2.4, direction: 'Whispered, out of breath, watching the phone.' },
    p24: { speaker: 'STATIC', text: 'Na him be that! Catch am!', seconds: 1.8, direction: 'A crew member spotting him, shouting across the street.' }
  },
  cutscenes: {
    // Sound first, then the park: this is the ordinary evening the rest of the prologue takes away.
    opening: { id: 'opening', fadeIn: 3,
      cast: [{ id: 'you', look: 'femi', at: P(35.5, 25), yaw: -Math.PI / 2, pose: 'stand', clean: true, bag: true }, { id: 'sergeant', look: 'civilian', variant: 'sergeant', at: P(37, 25), yaw: -Math.PI / 2, pose: 'stand', weapon: 'none' }, ...BYSTANDERS],
      cues: [
        { shot: 0, at: 0.2, sound: 'horns', from: P(0, 10, 2), volume: 0.5 }, { shot: 0, at: 1, caption: 'Prologue', sub: 'The Passenger', seconds: 3.2 },
        { shot: 1, at: 0.4, caption: 'Danfo Park', sub: '18:24', seconds: 3 }
      ],
      props: { 'danfo-247': PARKED },
      shots: [
        { from: C(5.4, 1.6, 30.6), to: C(4.8, 1.6, 30.3), look: C(-1, 1.5, 26), seconds: 5.2, line: 'p1', fov: 52 },
        { from: C(26, 2.5, 24.9), to: C(24, 2.35, 25), look: C(2, 1.6, 27), seconds: 4.6, fov: 58 },
        { from: C(32.8, 1.7, 24.5), to: C(33.1, 1.7, 24.6), look: C(35.8, 1.55, 25.1), seconds: 3.4, fov: 46 }
      ] },
    // The wrong bus. The Sergeant answers exactly as Control will answer Ada in Chapter 2.
    boarding: { id: 'boarding',
      cast: [
        { id: 'you', look: 'femi', at: P(-0.7, 24.6), yaw: 1.82, pose: 'stand', clean: true, bag: true }, { id: 'sergeant', look: 'civilian', variant: 'sergeant', speaker: 'sergeant', at: P(0.9, 24.2), yaw: -1.33, pose: 'stand', weapon: 'none' },
        { id: 'conductor', look: 'civilian', speaker: 'conductor', at: P(-3.4, 25.6), yaw: Math.PI / 2, pose: 'stand' }
      ],
      props: { 'danfo-247': PARKED },
      cues: [
        { shot: 0, prop: 'danfo-247', door: 1 }, { shot: 5, at: 0.5, actor: 'sergeant', gesture: 'point' },
        { shot: 6, at: 0.2, actor: 'you', path: [P(-0.7, 25.7)], speed: 1.3 }, { shot: 6, at: 1.2, actor: 'you', hide: true }, { shot: 6, at: 1.3, actor: 'sergeant', gesture: '', path: [P(-0.7, 25.7)], speed: 1.3 }, { shot: 6, at: 2.5, actor: 'sergeant', hide: true }, { shot: 6, at: 2.7, prop: 'danfo-247', door: 0 }, { shot: 6, at: 2.7, sound: 'door', from: P(-0.7, 26, 1.2) }
      ],
      shots: [
        { from: C(0.98, 1.7, 23.03), to: C(0.91, 1.7, 23.1), look: C(-0.61, 1.64, 24.69), seconds: 3, line: 'p2', fov: 38 },
        { from: C(-1.35, 1.7, 23.72), to: C(-1.25, 1.7, 23.74), look: C(0.87, 1.64, 24.33), seconds: 1.8, line: 'p3', fov: 38 },
        { from: C(0.91, 1.7, 23.1), to: C(0.88, 1.7, 23.14), look: C(-0.61, 1.64, 24.69), seconds: 1.8, line: 'p4', fov: 36 },
        { from: C(-1.25, 1.7, 23.74), to: C(-1.2, 1.7, 23.76), look: C(0.87, 1.64, 24.33), seconds: 1.6, line: 'p5', fov: 36 },
        { from: C(0.88, 1.7, 23.14), to: C(0.85, 1.7, 23.18), look: C(-0.61, 1.64, 24.69), seconds: 1.8, line: 'p6', fov: 34 },
        { from: C(-1.2, 1.7, 23.76), to: C(-1.15, 1.7, 23.78), look: C(0.87, 1.64, 24.33), seconds: 1.8, line: 'p7', fov: 34 },
        { from: C(3.3, 1.75, 24.6), to: C(3.1, 1.75, 24.7), look: C(-0.8, 1.35, 26), seconds: 3.6, fov: 50 }
      ] },
    // The ride: the bus pulls out, then we are inside it. The news, the name nobody says aloud, the song coming up, the mast, the photo, and the Sergeant getting off.
    ride: { id: 'ride', light: { key: 1.7, rim: 1.2 },
      cast: [...BYSTANDERS.filter(a => a.id !== 'conductor' && a.id !== 'trader'), ...riding(true), SERGEANT].map(a => a.id === 'conductor' ? { ...a, id: 'conductor-in' } : a),
      props: { 'danfo-247': PARKED },
      cues: [
        { shot: 0, cabin: 'rolling', seconds: 0 }, { shot: 0, at: 0.3, sound: 'engine', from: P(-2, 27, 1), volume: 0.7 }, { shot: 0, at: 0.4, radio: 'play', station: 'news', muffled: true, signal: 1 }, { shot: 0, at: 1.2, prop: 'danfo-247', path: [P(1.6, 26.8), P(0.6, 22), P(1.4, 18), P(1.4, 4)], speed: 5 }, { shot: 0, at: 2.5, ambience: 'ride', seconds: 3 },
        { shot: 1, radio: 'play', muffled: false, seconds: 0.4 }, { shot: 2, radio: 'play', station: 'adverts' }, { shot: 2, prop: 'danfo-247', hide: true }, { shot: 3, at: 0.2, actor: 'trader', gesture: 'shrug' }, { shot: 3, at: 2, actor: 'trader', gesture: '' }, { shot: 5, radio: 'play', station: 'radio-song' },
        { shot: 8, actor: 'you', gesture: 'phone', face: AHEAD + 0.9 }, { shot: 8, at: 1.6, actor: 'you', gesture: '' }, { shot: 9, actor: 'trader', gesture: 'phone' }, { shot: 10, at: 0.6, actor: 'trader', gesture: '' },
        { shot: 12, actor: 'you', gesture: 'phone', face: 0.1 }, { shot: 12, at: 1.2, phone: 'photo' }, { shot: 12, at: 1.2, sound: 'shutter' }, { shot: 12, at: 1.9, phone: 'sending' }, { shot: 14, at: 2.6, actor: 'you', gesture: '', face: AHEAD + 0.45 },
        { shot: 15, phone: 'off' }, { shot: 15, at: 0.2, actor: 'sergeant', pose: 'stand', face: 0.6 }, { shot: 15, at: 0.9, actor: 'sergeant', gesture: 'reach' }, { shot: 15, at: 1.2, actor: 'you', gesture: 'hold' }, { shot: 15, at: 2.7, actor: 'sergeant', gesture: '' }, { shot: 15, at: 2.9, actor: 'you', gesture: '' },
        { shot: 16, at: 0.1, cabin: 'slowing', seconds: 0.8 }, { shot: 16, at: 0.1, actor: 'sergeant', path: [IN(-1.1, -0.5), IN(-0.42, -1.2)], speed: 1.1 }, { shot: 16, at: 0.3, actor: 'conductor-in', to: IN(0.05, -0.6), speed: 1 }, { shot: 16, at: 1, cabin: 'open', seconds: 0.5 }, { shot: 16, at: 1, sound: 'door', volume: 0.6 }, { shot: 16, at: 2.6, actor: 'sergeant', hide: true }, { shot: 16, at: 2.9, cabin: 'rolling', seconds: 1 }, { shot: 16, at: 3.1, sound: 'door', volume: 0.6 }
      ],
      shots: [
        { from: C(-1.6, 2, 21.4), to: C(-1.5, 2, 21), look: C(0, 1.3, 25.5), lookTo: C(1.2, 1.3, 17), seconds: 5.4, fov: 56 },
        { from: AT(2.3, 1.62, -0.3), to: AT(2.1, 1.62, -0.3), look: AT(-1.6, 1, 0.3), seconds: 6, line: 'p8', fov: 52, shake: 0.006 },
        { from: AT(2.4, 1.36, -0.78), to: AT(2.36, 1.36, -0.78), look: AT(0.9, 1.28, -0.72), seconds: 1.9, line: 'p9', fov: 30, shake: 0.005 },
        { from: AT(1.8, 1.36, 0.14), to: AT(1.74, 1.36, 0.14), look: AT(-0.3, 1.28, 0.22), seconds: 2.7, line: 'p10', fov: 28, shake: 0.004 },
        said('p11', 6, 2),
        // Lagos going by with the song up, and nobody talking. Between them these give the song its 45 to 60 seconds before it dies.
        { from: C(-11, 1.6, -0.6), to: C(-7, 1.6, -0.6), look: C(14, 2.2, -1.8), seconds: 6.6, fov: 54 },
        { from: AT(1.75, 1.5, -0.2), to: AT(1.65, 1.5, -0.24), look: AT(-0.42, 1.52, -0.88), seconds: 6.4, fov: 34, shake: 0.006 },
        { from: AT(1.7, 1.34, 0.84), to: AT(1.55, 1.34, 0.84), look: AT(-0.3, 1.28, 0.8), seconds: 6.6, fov: 31, fovTo: 27, shake: 0.004 },
        { from: AT(1.8, 1.38, 0.5), to: AT(1.72, 1.38, 0.5), look: AT(-0.3, 1.22, 0.5), seconds: 2.7, line: 'p12', fov: 30, shake: 0.004 },
        { from: AT(1.74, 1.36, 0.14), to: AT(1.7, 1.36, 0.14), look: AT(-0.3, 1.28, 0.22), seconds: 2.5, line: 'p13', fov: 26, shake: 0.004 },
        { from: AT(1.55, 1.34, 0.84), to: AT(1.5, 1.34, 0.84), look: AT(-0.3, 1.28, 0.8), seconds: 1.9, line: 'p14', fov: 26, shake: 0.004 },
        { from: AT(1.6, 1.4, 0.34), to: AT(1.54, 1.4, 0.35), look: AT(-1.5, 1.28, 0.72), seconds: 2.9, line: 'p15', fov: 22, shake: 0.003 },
        // The photo, taken at the window with the man behind him in the glass. What it shows stays for Chapter 2.
        { from: AT(-2.5, 1.56, 0.12), to: AT(-2.44, 1.56, 0.14), look: AT(-0.3, 1.22, 1), seconds: 2.8, fov: 34, shake: 0.004 },
        { from: AT(1.54, 1.4, 0.35), to: AT(1.5, 1.4, 0.36), look: AT(-1.5, 1.28, 0.72), seconds: 2.1, line: 'p16', fov: 19, shake: 0.003 },
        { from: AT(1.5, 1.34, 0.84), to: AT(1.46, 1.34, 0.84), look: AT(-0.3, 1.28, 0.8), seconds: 3.1, line: 'p17', fov: 25, shake: 0.004 },
        { from: AT(1.8, 1.5, 0.02), to: AT(1.74, 1.5, 0.04), look: AT(-1.2, 1.5, 0.62), seconds: 3.3, line: 'p18', fov: 34, shake: 0.004 },
        { from: AT(-2.5, 1.62, 0.3), to: AT(-2.44, 1.62, 0.26), look: AT(-0.5, 1.56, -1), seconds: 3.6, fov: 46, shake: 0.004 }
      ] },
    // 18:40 is one second before the end of shot 1, on the billboard. It looks like an ordinary network fault to everyone in Lagos but
    // one. Six seconds out a phone starts to buzz through the radio; the song breaks up and dies; then, over about twelve seconds, so does the street.
    jam: { id: 'jam', light: { key: 1.5, rim: 1.2 },
      cast: [...riding(true).map(a => a.id === 'conductor' ? { ...a, id: 'conductor-in', at: IN(0.05, -0.6) } : a), { id: 'pos-agent', look: 'civilian', at: P(-7.8, -19), yaw: Math.PI / 2, pose: 'stand' }, { id: 'pos-customer', look: 'civilian', at: P(-6.6, -19.3), yaw: -Math.PI / 2, pose: 'stand' }],
      props: { 'danfo-247': { x: -38, z: -2.6, yaw: Math.PI / 2 } },
      cues: [
        { shot: 0, cabin: 'rolling', seconds: 0 }, { shot: 0, actor: 'you', gesture: 'phone', face: 0.9 }, { shot: 0, at: 0.1, phone: 'sending' }, { shot: 0, at: 0.1, prop: 'danfo-247', path: [P(-24, -2.6)], speed: 3 }, { shot: 0, at: 0.2, radio: 'play', signal: 0.8, seconds: 1 }, { shot: 0, at: 2.2, phone: 'failing' },
        { shot: 1, phone: 'off' }, { shot: 1, at: 0.1, fx: 'flicker', seconds: 2.8 }, { shot: 1, at: 0.2, radio: 'play', signal: 0.55, seconds: 2.4 }, { shot: 1, at: 2.1, caption: '18:40', seconds: 2.4 }, { shot: 1, at: 2.9, fx: 'jam' }, { shot: 1, at: 2.9, radio: 'play', signal: 0.2, seconds: 1 }, { shot: 1, at: 2.9, sound: 'static' }, { shot: 1, at: 2.9, sting: 'unease' },
        { shot: 2, at: 0.2, radio: 'play', signal: 0, seconds: 0.15 }, { shot: 2, at: 0.5, actor: 'driver', gesture: 'reach' }, { shot: 2, at: 0.7, sound: 'slap' }, { shot: 2, at: 1, radio: 'stop' }, { shot: 2, at: 1.5, actor: 'driver', gesture: 'shrug' },
        { shot: 3, at: 0.1, actor: 'pos-agent', gesture: 'shrug' }, { shot: 3, at: 0.3, actor: 'pos-customer', gesture: 'phone' },
        { shot: 4, actor: 'trader', gesture: 'phone' }, { shot: 4, actor: 'passenger', gesture: 'phone' }, { shot: 4, at: 0.3, actor: 'passenger-b', gesture: 'phone' }, { shot: 4, at: 0.5, actor: 'conductor-in', gesture: 'phone' }, { shot: 4, at: 0.2, ambience: 'hush', seconds: 6 },
        { shot: 5, phone: 'dead' }
      ],
      shots: [
        { from: AT(1.5, 1.34, 0.84), to: AT(1.42, 1.34, 0.84), look: AT(-0.3, 1.26, 0.8), seconds: 3.4, fov: 28, shake: 0.004 },
        { from: C(-23, 1.7, -25.8), to: C(-23, 1.68, -25.6), look: C(-23, 15, -34), seconds: 4, fov: 62 },
        { from: AT(1.28, 1.42, -0.5), to: AT(1.36, 1.42, -0.48), look: AT(2.36, 1.12, 0.05), seconds: 2.2, fov: 46, shake: 0.005 },
        { from: C(-7.1, 1.6, -16.4), to: C(-7.1, 1.6, -16.6), look: C(-7.2, 1.35, -19.2), seconds: 2.6, line: 'p19', fov: 44 },
        { from: AT(2.3, 1.62, -0.3), to: AT(2.16, 1.62, -0.3), look: AT(-1.6, 1, 0.3), seconds: 2.4, fov: 50, shake: 0.005 },
        { from: AT(1.42, 1.34, 0.84), to: AT(1.36, 1.34, 0.84), look: AT(-0.3, 1.28, 0.8), seconds: 3.4, line: 'p20', fov: 25, fovTo: 20, shake: 0.003 }
      ] },
    // They know his job, not his face. He gets past them because the bus is full of people and they are looking for a laptop bag. It costs him the bag and his phone.
    stop: { id: 'stop', fadeOut: 0.5,
      cast: [
        { id: 'leader', look: 'static', speaker: 'leader', at: P(-8.6, -2.6), yaw: -Math.PI / 2, pose: 'relaxed', hidden: true }, { id: 'st-a', look: 'static', at: P(-9.2, -4.8), yaw: -Math.PI / 2, pose: 'relaxed', weapon: 'sidearm', hidden: true },
        { id: 'st-b', look: 'static', at: P(-9.6, -0.8), yaw: -Math.PI / 2, pose: 'relaxed', weapon: 'sidearm', hidden: true }, { id: 'you', look: 'femi', at: P(-12.7, -4.3), yaw: Math.PI, pose: 'crouch', hidden: true },
        seat('femi-in', -0.3, 0.78, { look: 'femi', clean: true, bag: true, yaw: AHEAD + 0.45 }), seat('trader-in', -0.3, 0.2, { variant: 'trader', yaw: AHEAD + 0.5 }), seat('passenger-in', 0.9, -0.72), { id: 'leader-in', look: 'static', at: IN(-0.42, -1.7), yaw: 0, pose: 'relaxed', weapon: 'sidearm', hidden: true }, { id: 'st-in', look: 'static', at: IN(-0.42, -1.7), yaw: 0, pose: 'relaxed', weapon: 'sidearm', hidden: true }
      ],
      props: { 'danfo-247': { x: -24, z: -2.6, yaw: Math.PI / 2 } },
      cues: [
        { shot: 0, phone: 'off' }, { shot: 0, prop: 'danfo-247', path: [P(-14, -2.6)], speed: 3.2 }, { shot: 0, at: 0.5, cabin: 'slowing', seconds: 3 }, { shot: 0, at: 1.2, actor: 'leader', show: true }, { shot: 0, at: 1.4, actor: 'st-a', show: true }, { shot: 0, at: 1.5, actor: 'st-b', show: true },
        { shot: 0, at: 3.9, sound: 'stall', from: P(-14, -2.6, 1), volume: 0.8 }, { shot: 0, at: 4, ambience: 'still', seconds: 1.5 }, { shot: 1, cabin: 'stopped', seconds: 0.5 }, { shot: 1, at: 0.2, sound: 'steps', from: P(-11, -5), volume: 0.7 },
        { shot: 1, actor: 'leader', path: [P(-11, -5), P(-12.7, -4.7)], speed: 1.6, face: 0 }, { shot: 1, actor: 'st-a', path: [P(-11.4, -5.6)], speed: 1.6 },
        { shot: 2, prop: 'danfo-247', door: 1 }, { shot: 2, sound: 'crash', from: P(-12.7, -4, 1.2), volume: 0.7 }, { shot: 2, shake: 0.35, seconds: 1 }, { shot: 2, at: 0.5, actor: 'leader', path: [P(-12.7, -3.6)], speed: 2 }, { shot: 2, at: 0.8, actor: 'st-a', path: [P(-12.7, -3.6)], speed: 2.4 }, { shot: 2, at: 1.3, actor: 'leader', hide: true }, { shot: 2, at: 1.9, actor: 'st-a', hide: true },
        { shot: 3, cabin: 'open', seconds: 0 }, { shot: 3, actor: 'leader-in', show: true }, { shot: 3, actor: 'leader-in', path: [IN(-0.42, -0.8), IN(-0.2, -0.45)], speed: 2.2, face: 0.4 }, { shot: 3, at: 0.5, actor: 'st-in', show: true }, { shot: 3, at: 0.5, actor: 'st-in', path: [IN(-0.42, -0.9)], speed: 2.2 }, { shot: 3, at: 0.2, actor: 'trader-in', gesture: 'brace' }, { shot: 3, at: 0.5, actor: 'femi-in', gesture: 'hold' },
        { shot: 4, actor: 'leader-in', gesture: 'reach' }, { shot: 4, at: 0.6, actor: 'femi-in', gesture: 'brace' }, { shot: 4, at: 0.9, actor: 'femi-in', bag: false }, { shot: 4, at: 0.9, sound: 'door', volume: 0.4 }, { shot: 4, at: 1, shake: 0.2, seconds: 0.5 },
        { shot: 5, cabin: 'attacked', seconds: 0 },
        { shot: 6, at: 0.3, sound: 'glass', from: P(-13, -3, 1.2), volume: 0.4 }, { shot: 6, at: 0.6, actor: 'you', show: true }, { shot: 6, at: 0.7, actor: 'you', pose: 'stand', path: [P(-13.6, -5)], speed: 1.8 }
      ],
      shots: [
        { from: C(-6.4, 1.3, -1.8), to: C(-6.5, 1.3, -1.9), look: C(-10.8, 1.3, -2.6), seconds: 5, fov: 50 },
        { from: C(-15.6, 1.6, -5.7), to: C(-15.4, 1.6, -5.7), look: C(-12.4, 1.55, -4.5), seconds: 3.8, line: 'p21', fov: 42 },
        { from: C(-15.4, 1.6, -5.7), to: C(-15.3, 1.6, -5.7), look: C(-12.4, 1.45, -4.2), seconds: 2.4, fov: 46 },
        { from: AT(1.8, 1.5, 0.3), to: AT(1.7, 1.5, 0.26), look: AT(-0.5, 1.5, -0.8), seconds: 2.2, fov: 42, shake: 0.03 },
        { from: AT(1.8, 1.46, 0.3), to: AT(1.7, 1.46, 0.28), look: AT(-0.26, 1.34, 0.3), seconds: 2, fov: 40, shake: 0.035 },
        { from: AT(-0.5, 0.2, 0.02), to: AT(-0.46, 0.18, 0.06), look: AT(-0.16, 0.03, 0.3), seconds: 1.7, fov: 40, shake: 0.01 },
        { from: C(-16.2, 1.1, -7), to: C(-16, 1.1, -6.9), look: C(-13.2, 1.1, -4.6), seconds: 2.6, fov: 48, shake: 0.03 }
      ] },
    // He hides exactly where Ada will find him.
    hide: { id: 'hide', fadeOut: 2.2,
      cast: [{ id: 'you', look: 'femi', at: P(19.4, 17.2), yaw: -Math.PI / 2, pose: 'seated' }],
      // He texts the one phone the police are sure to find, and on the floor of the empty bus it lights up.
      cues: [{ shot: 0, sound: 'breath' }, { shot: 0, at: 1, phone: 'message' }, { shot: 1, phone: 'off' }, { shot: 1, cabin: 'text', seconds: 0 }, { shot: 1, at: 0.3, sound: 'radio', volume: 0.3 }, { shot: 2, sting: 'unease' }],
      shots: [
        { from: C(16.9, 1.3, 15.9), to: C(17.2, 1.3, 16.1), look: C(19.4, 1.05, 17.2), seconds: 4.6, fov: 44 },
        { from: AT(-0.5, 0.2, 0.02), to: AT(-0.47, 0.19, 0.05), look: AT(-0.16, 0.03, 0.3), seconds: 2.8, fov: 38 },
        { from: C(17.6, 1.2, 16.5), to: C(17.8, 1.2, 16.6), look: C(19.4, 1.2, 17.2), seconds: 4.8, fov: 38 }
      ] }
  },
  outro: 'Femi reached the press.',
  ending: { cards: [{ text: 'Chapter 01', sub: 'Signal Lost', kind: 'chapter', hold: 5 }], continue: 'signal-lost' }
};
