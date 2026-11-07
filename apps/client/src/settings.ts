/** Player preferences. Everything here changes a real system; storage failure falls back to defaults. */
export type Action = 'forward' | 'back' | 'left' | 'right' | 'sprint' | 'jump' | 'crouch' | 'reload' | 'interact' | 'rifle' | 'sidearm' | 'scores';
export const ACTION_LABELS: Record<Action, string> = {
  forward: 'Move forward', back: 'Move back', left: 'Strafe left', right: 'Strafe right', sprint: 'Sprint', jump: 'Jump',
  crouch: 'Crouch', reload: 'Reload', interact: 'Interact', rifle: 'Primary weapon', sidearm: 'Sidearm', scores: 'Scoreboard'
};
export const DEFAULT_BINDINGS: Record<Action, string[]> = {
  forward: ['KeyW'], back: ['KeyS'], left: ['KeyA'], right: ['KeyD'], sprint: ['ShiftLeft'], jump: ['Space'], crouch: ['KeyC'],
  reload: ['KeyR'], interact: ['KeyE'], rifle: ['Digit1'], sidearm: ['Digit2'], scores: ['Tab']
};
export type Quality = 'low' | 'medium' | 'high';
export interface Preferences {
  sensitivityX: number; sensitivityY: number; aimMultiplier: number; fov: number; invertY: boolean;
  toggleAim: boolean; toggleCrouch: boolean; toggleSprint: boolean;
  master: number; music: number; effects: number; ambience: number; dialogue: number;
  quality: Quality; shadows: 'off' | 'low' | 'high'; renderScale: number; postEffects: boolean;
  cameraShake: number; headBob: number; subtitleSize: 'small' | 'medium' | 'large'; hudScale: number; diagnostics: boolean;
  /** Strong language in story dialogue; off swaps in the clean alternative lines. */
  matureLanguage: boolean;
  /** Commercial music in story scenes; off always plays the original placeholder, for streaming and video. */
  licensedMusic: boolean;
  difficulty: 'easy' | 'normal' | 'hard'; bindings: Record<Action, string[]>; callsign: string;
}
export const PRESETS: Record<Quality, Pick<Preferences, 'shadows' | 'renderScale' | 'postEffects'>> = {
  low: { shadows: 'off', renderScale: 0.67, postEffects: false }, medium: { shadows: 'low', renderScale: 0.85, postEffects: true }, high: { shadows: 'high', renderScale: 1, postEffects: true }
};
export function defaults(touch = false): Preferences {
  return {
    sensitivityX: 1, sensitivityY: 1, aimMultiplier: 0.8, fov: 90, invertY: false, toggleAim: false, toggleCrouch: false, toggleSprint: false,
    master: 0.7, music: 0.45, effects: 0.85, ambience: 0.6, dialogue: 0.9,
    quality: touch ? 'low' : 'medium', ...PRESETS[touch ? 'low' : 'medium'], cameraShake: 1, headBob: 0.6, subtitleSize: 'medium', hudScale: 1, diagnostics: false, matureLanguage: true, licensedMusic: true,
    difficulty: 'normal', bindings: structuredClone(DEFAULT_BINDINGS), callsign: 'Passenger'
  };
}
const ranges: Partial<Record<keyof Preferences, [number, number]>> = {
  sensitivityX: [0.1, 4], sensitivityY: [0.1, 4], aimMultiplier: [0.3, 1.5], fov: [70, 110], master: [0, 1], music: [0, 1], effects: [0, 1], ambience: [0, 1], dialogue: [0, 1],
  renderScale: [0.5, 1], cameraShake: [0, 1], headBob: [0, 1], hudScale: [0.8, 1.25]
};
const KEY = 'lastbus-preferences-v2';
export function load(touch: boolean): Preferences {
  const pref = defaults(touch);
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? 'null') ?? migrate();
    if (!raw || typeof raw !== 'object') return pref;
    for (const key of Object.keys(pref) as (keyof Preferences)[]) {
      const value = (raw as Record<string, unknown>)[key], range = ranges[key];
      if (range && typeof value === 'number' && Number.isFinite(value)) (pref as unknown as Record<string, unknown>)[key] = Math.max(range[0], Math.min(range[1], value));
      else if (typeof value === 'boolean' && typeof pref[key] === 'boolean') (pref as unknown as Record<string, unknown>)[key] = value;
    }
    const r = raw as Record<string, unknown>;
    if (['low', 'medium', 'high'].includes(String(r.quality))) pref.quality = r.quality as Quality;
    if (['off', 'low', 'high'].includes(String(r.shadows))) pref.shadows = r.shadows as Preferences['shadows'];
    if (['small', 'medium', 'large'].includes(String(r.subtitleSize))) pref.subtitleSize = r.subtitleSize as Preferences['subtitleSize'];
    if (['easy', 'normal', 'hard'].includes(String(r.difficulty))) pref.difficulty = r.difficulty as Preferences['difficulty'];
    if (typeof r.callsign === 'string') pref.callsign = r.callsign.slice(0, 20);
    if (r.bindings && typeof r.bindings === 'object') for (const action of Object.keys(DEFAULT_BINDINGS) as Action[]) {
      const codes = (r.bindings as Record<string, unknown>)[action];
      if (Array.isArray(codes) && codes.every(c => typeof c === 'string' && /^[A-Za-z0-9]{2,20}$/.test(c))) pref.bindings[action] = codes.slice(0, 2) as string[];
    }
  } catch { /* Corrupt or denied storage uses safe defaults. */ }
  return pref;
}
/** Carries over the sensitivity, volume and quality saved by the 0.1 prototype. */
function migrate() {
  const old = JSON.parse(localStorage.getItem('lastbus-preferences') ?? 'null') as { sensitivity?: number; volume?: number; quality?: string } | null;
  if (!old) return null;
  return { sensitivityX: old.sensitivity, sensitivityY: old.sensitivity, master: old.volume, quality: old.quality, ...(PRESETS[old.quality as Quality] ?? {}) };
}
export function save(pref: Preferences) { try { localStorage.setItem(KEY, JSON.stringify(pref)); return true; } catch { return false; } }
export function keyName(code: string) {
  if (code.startsWith('Key')) return code.slice(3); if (code.startsWith('Digit')) return code.slice(5);
  return ({ ShiftLeft: 'L-Shift', ShiftRight: 'R-Shift', ControlLeft: 'L-Ctrl', ControlRight: 'R-Ctrl', AltLeft: 'L-Alt', Space: 'Space', Tab: 'Tab', CapsLock: 'Caps', Backquote: '`', Mouse3: 'Mouse 4', Mouse4: 'Mouse 5' } as Record<string, string>)[code] ?? code;
}
