export const BRAND = { title: 'LAST BUS', city: 'LAGOS', mode: 'STREET WARS', map: 'Ojuelegba Junction', build: '0.2.0' };
// Bump whenever the input contract, snapshot fields or map geometry change incompatibly.
export const VERSION = 'lagos-3';
export const RULES = {
  tickRate: 30, dt: 1 / 30, maxPlayers: 8, teamSize: 4, publicMinimum: 4,
  duration: 240, killLimit: 30, countdown: 5, results: 10, respawn: 3,
  protection: 1, reconnect: 15, staleInput: 0.15, abandon: 15,
  walk: 5, sprint: 7.5, crouchSpeed: 2.6, aimSpeed: 3.4, jump: 6, gravity: 18,
  acceleration: 38, deceleration: 46, airControl: 0.35, stepHeight: 0.45,
  radius: 0.35, height: 1.8, crouchHeight: 1.2, eye: 1.6, crouchEye: 1.05, head: 0.32,
  /** Traversal: tallest obstacle vaulted (above the feet), deepest one crossed, highest ledge mantled (above the floor stood on), climb speed and slide tuning. */
  vaultHeight: 1.3, vaultDepth: 1.25, vaultTime: 0.42, mantleHeight: 2.05, climbSpeed: 2.6, slideSpeed: 9.2, slideTime: 0.85, slideDrag: 1.2
} as const;
/** Team identity is presentation and result data. Index 0 is always Police, 1 is always Bandits. */
export const TEAMS = [
  { id: 'POLICE', name: 'Police', short: 'POL', color: '#3d7bd9' },
  { id: 'BANDITS', name: 'Bandits', short: 'BND', color: '#d9473d' }
] as const;
export interface WeaponDef {
  name: string; label: string; role: string; automatic: boolean; damage: number; minDamage: number; falloffStart: number; range: number;
  headshot: number; interval: number; magazine: number; reserve: number; reload: number; emptyReload: number; equip: number;
  /** Radians of spread when hip firing still, extra per m/s of movement, airborne extra, and the multiplier while aiming. */
  spread: number; moveSpread: number; airSpread: number; aimSpread: number;
  /** Designed recoil: vertical kick per shot (scaled by the pattern), horizontal pattern, recovery per second, cap. */
  kick: number; pattern: readonly number[]; recovery: number; maxRecoil: number; aimRecoil: number;
  zoom: number;
}
export const WEAPONS = {
  rifle: {
    name: 'AK-26', label: 'ASSAULT RIFLE', role: 'Automatic mid-range rifle', automatic: true, damage: 25, minDamage: 18, falloffStart: 30, range: 90,
    headshot: 1.6, interval: 0.1, magazine: 30, reserve: 90, reload: 1.9, emptyReload: 2.4, equip: 0.4,
    spread: 0.022, moveSpread: 0.006, airSpread: 0.06, aimSpread: 0.12,
    kick: 0.012, pattern: [0, 0.2, 0.35, 0.1, -0.25, -0.45, -0.2, 0.25, 0.5, 0.3, -0.1, -0.4], recovery: 0.16, maxRecoil: 0.13, aimRecoil: 0.7,
    zoom: 1.35
  },
  sidearm: {
    name: 'K9', label: 'SIDEARM', role: 'Precise semi-automatic pistol', automatic: false, damage: 34, minDamage: 22, falloffStart: 18, range: 60,
    headshot: 1.75, interval: 0.18, magazine: 12, reserve: 48, reload: 1.3, emptyReload: 1.6, equip: 0.22,
    spread: 0.014, moveSpread: 0.004, airSpread: 0.05, aimSpread: 0.25,
    kick: 0.02, pattern: [0, 0.3, -0.3, 0.2, -0.2], recovery: 0.3, maxRecoil: 0.09, aimRecoil: 0.75,
    zoom: 1.15
  }
} as const satisfies Record<string, WeaponDef>;
export type WeaponId = keyof typeof WEAPONS;
export type Team = 0 | 1;
export type Phase = 'WAITING' | 'COUNTDOWN' | 'ACTIVE' | 'RESULTS';
/** Host-configurable private match settings. The server only accepts these exact values. */
export const MATCH_OPTIONS = { duration: [180, 240, 300, 600], killLimit: [20, 30, 50] } as const;
