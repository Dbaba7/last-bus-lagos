import type { Vec3 } from '../world.js';
import type { Mission } from './campaign.js';
const P = (x: number, z: number, y = 0): Vec3 => ({ x, y, z });
const C = (x: number, y: number, z: number): Vec3 => ({ x, y, z });
/**
 * Chapter 02 · Third Mainland, opening mission. Ada wakes in an emergency shelter three hours
 * after the blast, finds her gear and a message from an unknown number, and is sent to Third
 * Mainland Bridge by an authorisation nobody will put a name to. The bridge itself is a later
 * map; its lines (Acts III–IV) are written here already so they can be recorded with the rest.
 */
export const aftermath: Mission = {
  id: 'aftermath', chapter: 'third-mainland', title: 'Aftermath', location: 'Emergency shelter, Yaba', time: '02:17 — night', map: 'shelter', unarmed: true,
  summary: 'Three hours after the blast, Ada wakes in a shelter two kilometres from Ojuelegba. The bus never arrived. Someone has already sent her a message.',
  briefing: [
    'Something fell on Ojuelegba at 22:52. The flash was seen from the mainland; the junction is still burning.',
    'Search and rescue pulled Inspector Ada Nwosu out of the dust and left her in a Yaba community hall being used as an emergency shelter. Her radio barely works.',
    'Femi Adeyemi was on the last bus out of the junction. Nobody has said where that bus is now.'
  ],
  intel: ['You start without a weapon. Your service pistol was brought in with you.', 'Control is on a damaged handset: they can hear you, but they are not telling you everything.', 'Mature language can be turned off in Settings → Audio.'],
  start: { at: P(-4.4, -1.2), yaw: Math.PI / 2 },
  interactables: [
    { id: 'pistol', at: P(-4.7, -3.95, 0.42), radius: 1.7, prompt: 'Recover your service pistol', hold: 1, kind: 'examine', onUse: [{ arm: true }, { say: ['k20'] }] },
    { id: 'radio', at: P(3.2, -1, 0.95), radius: 1.7, prompt: 'Check your radio', hold: 1.4, kind: 'examine', onUse: [{ say: ['k21'] }] },
    { id: 'phone', at: P(-1, -4, 0.42), radius: 1.7, prompt: 'Read the message on your phone', hold: 1, kind: 'phone', onUse: [{ say: ['k22'], delay: 0.5 }] }
  ],
  objectives: [
    { id: 'window', kind: 'reach', text: 'Get to the broken window', at: P(0, 3.9), radius: 1.5, onStart: [{ cutscene: 'wake' }, { say: ['k5', 'k6', 'k7', 'k8', 'k9'], delay: 1.5 }], onComplete: [{ cutscene: 'window' }] },
    { id: 'search', kind: 'collect', text: 'Search the shelter for your equipment', items: ['pistol', 'radio', 'phone'], marker: P(0, -2.5), checkpoint: { at: P(0, 2.8), yaw: Math.PI },
      onComplete: [{ say: ['k23', 'k24', 'k25', 'k26', 'k27', 'k28'] }] },
    { id: 'exit', kind: 'reach', text: 'Leave the shelter', at: P(6.6, 0), radius: 1.3, onComplete: [{ cutscene: 'doorway' }] }
  ],
  optional: [],
  groups: {},
  phone: {
    phone: { from: 'Unknown number', time: '02:09', photo: 'danfo-reflection', body: ['6.4974° N, 3.4016° E', 'Third Mainland Bridge', 'THE WITNESS LIST IS NOT COMPLETE.'] }
  },
  cutscenes: {
    // Black, breathing, a ringing in the ears; the room swims into focus and Ada gets up off the floor.
    wake: { id: 'wake', fadeIn: 3.2, grade: 'shelter',
      cast: [{ id: 'you', look: 'ada', at: P(-4.6, -1.2), yaw: Math.PI / 2, pose: 'down', weapon: 'none' }],
      cues: [
        { shot: 0, sound: 'ringing' }, { shot: 0, sound: 'breath' }, { shot: 0, letterbox: 1, seconds: 2.5 },
        { shot: 2, at: 0.6, actor: 'you', pose: 'relaxed' }, { shot: 2, at: 1.4, actor: 'you', gesture: 'hold' },
        { shot: 3, at: 0.3, actor: 'you', gesture: '', face: 0 }, { shot: 3, at: 0.8, sting: 'unease' }
      ],
      shots: [
        { from: C(-4.25, 0.32, -1.1), to: C(-4.2, 0.36, -1.05), look: C(-3, 2.8, 0.2), seconds: 3.4, line: 'k1', fov: 70, shake: 0.02, roll: 0.2 },
        { from: C(-2.6, 1.1, -2.6), to: C(-2.7, 1.2, -2.4), look: C(-4.4, 0.4, -1.2), seconds: 4, line: 'k2', fov: 50, shake: 0.01 },
        { from: C(-2.4, 1.5, -2.9), to: C(-2.6, 1.6, -2.7), look: C(-4.4, 1.3, -1.2), seconds: 3.4, line: 'k3', fov: 46 },
        { from: C(-2.5, 1.65, 0.6), to: C(-2.65, 1.66, 0.4), look: C(-4.4, 1.6, -1.2), seconds: 4.2, line: 'k4', fov: 40, fovTo: 34 }
      ] },
    // Through the shattered window: the city burning, and Control finally answering the question.
    window: { id: 'window', grade: 'shelter',
      cast: [{ id: 'you', look: 'ada', at: P(0, 4.1), yaw: 0, weapon: 'none' }],
      cues: [
        { shot: 0, fx: 'smoke', from: C(-18, 8, 70), seconds: 34 }, { shot: 0, fx: 'smoke', from: C(14, 6, 82), seconds: 26 }, { shot: 0, fx: 'smoke', from: C(-2, 10, 95), seconds: 40 },
        { shot: 0, sound: 'siren', from: C(-40, 4, 80) }, { shot: 3, sound: 'siren', from: C(30, 4, 60) }, { shot: 2, actor: 'you', gesture: 'radio' },
        { shot: 5, at: 0.4, actor: 'you', gesture: '' }, { shot: 6, sting: 'dread' }, { shot: 8, actor: 'you', face: Math.PI, gesture: 'reach' }, { shot: 9, at: 0.4, actor: 'you', gesture: '' }
      ],
      shots: [
        { from: C(1.35, 1.72, 3.0), to: C(1.25, 1.74, 3.25), look: C(-3, 7, 60), seconds: 5, fov: 58, line: 'k10' },
        { from: C(1.2, 1.7, 6.5), to: C(1.1, 1.7, 6.3), look: C(0, 1.62, 4.1), seconds: 3, line: 'k11', fov: 40 },
        { from: C(-1.25, 1.72, 3.0), to: C(-1.2, 1.74, 3.2), look: C(-6, 9, 80), lookTo: C(6, 9, 80), seconds: 4, line: 'k12', fov: 58 },
        { from: C(-1.2, 1.64, 5.9), to: C(-1.1, 1.64, 5.7), look: C(0, 1.6, 4.1), seconds: 3.4, line: 'k13', fov: 38 },
        { from: C(1.6, 1.66, 2.6), to: C(1.5, 1.66, 2.8), look: C(0, 1.6, 4.1), seconds: 3.6, line: 'k14', fov: 42 },
        { from: C(1.1, 1.66, 6.3), to: C(0.9, 1.66, 6.0), look: C(0, 1.62, 4.1), seconds: 3, line: 'k15', fov: 36, fovTo: 31 },
        { from: C(-0.4, 1.62, 3.0), to: C(-0.35, 1.62, 3.1), look: C(0.2, 2.4, 60), seconds: 4.6, line: 'k16', fov: 50 },
        { from: C(-0.4, 1.62, 3.0), to: C(-0.3, 1.62, 3.2), look: C(0.2, 2.4, 60), seconds: 5, line: 'k17', fov: 46, ease: 'linear' },
        { from: C(0.9, 1.62, 2.4), to: C(0.8, 1.62, 2.6), look: C(0, 1.58, 4.1), seconds: 4.8, line: 'k18', fov: 40, shake: 0.012 },
        { from: C(0.2, 1.64, 2.2), to: C(0.15, 1.64, 2.5), look: C(0, 1.6, 4.1), seconds: 3.6, line: 'k19', fov: 34, fovTo: 28 }
      ] },
    // At the door. She checks the radio, and decides how far she will follow it.
    doorway: { id: 'doorway', fadeOut: 1.6, grade: 'shelter',
      cast: [{ id: 'you', look: 'ada', at: P(6.4, 0), yaw: Math.PI / 2, weapon: 'sidearm' }],
      cues: [{ shot: 1, at: 0.6, actor: 'you', gesture: 'radio' }, { shot: 2, at: 0.6, actor: 'you', gesture: '' }, { shot: 2, at: 1.2, actor: 'you', path: [P(7.6, 0)], speed: 1.2 }, { shot: 2, sting: 'reveal' }],
      shots: [
        { from: C(4.4, 1.66, 1.4), to: C(4.6, 1.66, 1.2), look: C(6.4, 1.6, 0), seconds: 3.4, line: 'k29', fov: 42 },
        { from: C(5.2, 1.62, -1.3), to: C(5.3, 1.62, -1.2), look: C(6.4, 1.58, 0), seconds: 3.6, line: 'k30', fov: 36 },
        { from: C(3.6, 1.7, 0.2), to: C(3.9, 1.7, 0.1), look: C(7.4, 1.5, 0), seconds: 4.4, line: 'k31', fov: 46 }
      ] }
  },
  lines: {
    // Act I — the aftermath.
    k1: { speaker: 'ADA', text: 'Ah… fuck.', clean: 'Ah… damn.', seconds: 2.6, direction: 'Waking up on a hard floor, winded, in pain. Barely voiced.' },
    k2: { speaker: 'ADA', text: 'The bus. Femi. The checkpoint…', seconds: 3.6, direction: 'Piecing it together, slow and groggy. Trailing off.' },
    k3: { speaker: 'ADA', text: 'The sky.', seconds: 2.4, direction: 'Stops. Remembering.' },
    k4: { speaker: 'ADA', text: 'Was that… a dream?', seconds: 3, direction: 'Quiet, unsure, half hoping.' },
    k5: { speaker: 'CONTROL', text: '—Inspector Nwosu. Respond.', seconds: 2.6, direction: 'Through heavy static on a damaged handset. Flat.' },
    k6: { speaker: 'ADA', text: 'Control?', seconds: 1.8, direction: 'Surprised to hear anyone.' },
    k7: { speaker: 'CONTROL', text: 'Inspector, confirm your status.', seconds: 2.6, direction: 'Procedural. No warmth.' },
    k8: { speaker: 'ADA', text: "I'm alive. Where the hell am I?", clean: "I'm alive. Where am I?", seconds: 3, direction: 'Sitting up, irritated, disoriented.' },
    k9: { speaker: 'CONTROL', text: 'An emergency shelter, approximately two kilometres from the junction. Search and rescue found you unconscious.', seconds: 6, direction: 'Reading it out. Too neat.' },
    k10: { speaker: 'ADA', text: 'How long was I out?', seconds: 2.4, direction: 'At the window, looking at the smoke.' },
    k11: { speaker: 'CONTROL', text: 'Three hours, twenty-five minutes.', seconds: 2.8, direction: 'Precise to the minute. Somebody has been counting.' },
    k12: { speaker: 'ADA', text: 'Oh, my fucking days…', clean: 'Oh, my days…', seconds: 3, direction: 'Lagos exasperation, breathed out. Shock under it.' },
    k13: { speaker: 'ADA', text: "The witness. Where's Femi?", seconds: 2.6, direction: 'Snapping back to the job. Urgent.' },
    k14: { speaker: 'CONTROL', text: 'Inspector, we need you to listen carefully.', seconds: 3.2, direction: 'A delay before answering. Careful, managing her.' },
    k15: { speaker: 'ADA', text: 'Where. Is. Femi?', seconds: 2.8, direction: 'Each word on its own. Controlled anger.' },
    k16: { speaker: 'CONTROL', text: 'The bus never arrived at the designated extraction point.', seconds: 4, direction: 'Flat. A pause after it.' },
    k17: { speaker: 'CONTROL', text: 'We lost contact with the escort team shortly after the explosion.', seconds: 4.4, direction: 'Even flatter. Giving nothing away.' },
    k18: { speaker: 'ADA', text: 'No. No, you told me he was safe. You said he was on the bus.', seconds: 4.4, direction: 'Rising. Accusing.' },
    k19: { speaker: 'CONTROL', text: 'He was supposed to be.', seconds: 2.8, direction: 'Quiet. The only honest-sounding thing they say.' },
    // Act II — the second message.
    k20: { speaker: 'ADA', text: 'Still here. Still loaded.', seconds: 2.6, direction: 'Checking the pistol, a breath of relief.' },
    k21: { speaker: 'ADA', text: 'Casing cracked. It still gets Control — just about.', seconds: 3.4, direction: 'Turning the radio over, unimpressed.' },
    k22: { speaker: 'ADA', text: "Unknown number. That's the inside of Danfo 247… who took this?", seconds: 4.4, direction: 'Reading her phone, cold realisation.' },
    k23: { speaker: 'CONTROL', text: 'Inspector, your next assignment has been authorised. Proceed to Third Mainland Bridge. A recovery team has located a vehicle connected to the incident.', seconds: 7.5, direction: 'Brisk, rehearsed, moving her along.' },
    k24: { speaker: 'ADA', text: 'Who authorised it?', seconds: 2, direction: 'Immediate. Testing them.' },
    k25: { speaker: 'CONTROL', text: 'Command.', seconds: 1.6, direction: 'One word. Closed.' },
    k26: { speaker: 'ADA', text: 'Which command?', seconds: 1.8, direction: 'Pressing.' },
    k27: { speaker: 'CONTROL', text: 'Inspector, you need to move. We have reports of armed men converging on the bridge.', seconds: 5, direction: 'Changing the subject with urgency. Not answering.' },
    k28: { speaker: 'ADA', text: 'They knew I would make it. They knew exactly where I would be.', seconds: 4, direction: 'To herself, very low, after the radio clicks off.' },
    k29: { speaker: 'ADA', text: 'Fine. Third Mainland it is.', seconds: 2.8, direction: 'At the doorway. Decided, tired.' },
    k30: { speaker: 'ADA', text: 'But if this is another setup…', seconds: 3, direction: 'Looking at the radio in her hand.' },
    k31: { speaker: 'ADA', text: "…I'm done taking orders.", seconds: 3, direction: 'Quiet, final. She walks out.' },
    // Act III — the bridge (map in development). Recorded now with the rest of the chapter.
    b1: { speaker: 'STATIC', voice: 'STATIC_A', text: 'Boss said the drive must reach the other side before sunrise.', seconds: 4, direction: 'STATIC crew member, low, searching between cars. Nigerian Pidgin rhythm.' },
    b2: { speaker: 'STATIC', voice: 'STATIC_B', text: 'Which drive?', seconds: 1.6, direction: 'Second STATIC member, younger, confused.' },
    b3: { speaker: 'STATIC', voice: 'STATIC_A', text: 'The one the engineer kept.', seconds: 2.4, direction: 'Impatient, keeping his voice down.' },
    b4: { speaker: 'ADA', text: "You're kidding me.", seconds: 2, direction: 'Watching the body-camera footage a second time. Disbelief turning cold.' },
    b5: { speaker: 'CONTROL', text: 'Inspector, report your findings.', seconds: 2.6, direction: 'Waiting for an answer that does not come.' },
    b6: { speaker: 'CONTROL', text: 'Inspector Nwosu, respond.', seconds: 2.4, direction: 'A little sharper. Then she switches the radio off.' },
    // Act IV — the call.
    b7: { speaker: 'UNKNOWN', voice: 'CALLER', text: "Inspector Nwosu. You've had a difficult night.", seconds: 3.4, direction: 'Calm, educated, unhurried. Enjoying this slightly.' },
    b8: { speaker: 'ADA', text: 'Who is this?', seconds: 1.8, direction: 'Answering a ringing phone in an abandoned car.' },
    b9: { speaker: 'UNKNOWN', voice: 'CALLER', text: 'Someone who knows what happened at Ojuelegba.', seconds: 3, direction: 'Measured.' },
    b10: { speaker: 'ADA', text: 'Then tell me who paid for the jammer.', seconds: 2.8, direction: 'Hard, direct.' },
    b11: { speaker: 'UNKNOWN', voice: 'CALLER', text: 'You still think the jammer was the operation?', seconds: 3, direction: 'Almost amused.' },
    b12: { speaker: 'UNKNOWN', voice: 'CALLER', text: 'The jammer was the distraction. The explosion was the cleanup. And the witness list…', seconds: 6, direction: 'Slower, each sentence landing.' },
    b13: { speaker: 'UNKNOWN', voice: 'CALLER', text: '…was never supposed to leave that bus.', seconds: 3, direction: 'Lower, almost a whisper. Then he hangs up.' }
  },
  outro: 'Ada leaves the shelter for Third Mainland Bridge, on an assignment nobody will put a name to.',
  ending: { cards: [
    { text: 'Objective: Reach Third Mainland Bridge', kind: 'objective', hold: 4 },
    { text: 'Chapter 02 · Third Mainland', sub: 'The bridge is still being built. Your progress is saved.', kind: 'chapter', hold: 6 }
  ] }
};
