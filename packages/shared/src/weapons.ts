import { WEAPONS, type WeaponDef, type WeaponId } from './config.js';
import type { InputFrame, Player } from './protocol.js';
export function loadout() { return { rifle: { ammo: WEAPONS.rifle.magazine as number, reserve: WEAPONS.rifle.reserve as number, nextShot: 0 }, sidearm: { ammo: WEAPONS.sidearm.magazine as number, reserve: WEAPONS.sidearm.reserve as number, nextShot: 0 } }; }
/** Small deterministic hash so the client prediction and server agree on every spread sample. */
function hash(text: string, a: number, b: number) {
  let h = 2166136261 ^ a * 374761393 ^ b * 668265263;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  h = Math.imul(h ^ h >>> 15, 2246822507); h = Math.imul(h ^ h >>> 13, 3266489909); return (h ^ h >>> 16) >>> 0;
}
export function spreadCone(p: Player, def: WeaponDef = WEAPONS[p.weapon]) {
  const speed = Math.hypot(p.vx, p.vz);
  let cone = def.spread * (p.aiming ? def.aimSpread : 1) + def.moveSpread * speed * (p.aiming ? 0.5 : 1) + (p.grounded ? 0 : def.airSpread);
  if (p.crouched) cone *= 0.8;
  return cone;
}
/** Uniform sample inside the spread cone for the player's next shot. */
export function spreadOffset(p: Player, def: WeaponDef = WEAPONS[p.weapon]) {
  const cone = spreadCone(p, def), h = hash(p.id, p.life, p.shots);
  const r = Math.sqrt((h & 0xffff) / 0xffff) * cone, angle = (h >>> 16) / 0xffff * Math.PI * 2;
  return { yaw: Math.cos(angle) * r, pitch: Math.sin(angle) * r };
}
export function damageAt(def: WeaponDef, distance: number, head: boolean) {
  const t = Math.max(0, Math.min(1, (distance - def.falloffStart) / Math.max(1, def.range - def.falloffStart)));
  return Math.round((def.damage + (def.minDamage - def.damage) * t) * (head ? def.headshot : 1));
}
export function advanceWeapon(p: Player, input: InputFrame, now: number, dt: number): 'shot' | 'reload' | null {
  const current = WEAPONS[p.weapon], gun = p.guns[p.weapon];
  // Recoil recovers once the trigger has been off the weapon for a full interval.
  if (now >= gun.nextShot) {
    const amount = current.recovery * dt; const ratio = p.recoil > 0 ? Math.max(0, p.recoil - amount) / p.recoil : 0;
    p.recoil = Math.max(0, p.recoil - amount); p.recoilYaw *= ratio;
    if (now > gun.nextShot + current.interval * 1.5) p.burst = 0;
  }
  if (p.health <= 0) { p.reloadUntil = 0; return null; }
  if (input.weapon && input.weapon !== p.weapon) { p.weapon = input.weapon; p.reloadUntil = 0; p.equipUntil = now + WEAPONS[p.weapon].equip; p.burst = 0; }
  const def = WEAPONS[p.weapon], active = p.guns[p.weapon];
  if (p.reloadUntil > 0 && now >= p.reloadUntil) {
    const amount = Math.min(def.magazine - active.ammo, active.reserve); active.ammo += amount; active.reserve -= amount; p.reloadUntil = 0;
  }
  // Hands are busy while vaulting, mantling or on a ladder: no aiming and no shots (a slide can still shoot).
  const climbing = p.traverse > 0 && p.traverse < 4;
  if (p.reloadUntil || now < p.equipUntil || climbing) p.aiming = false;
  const wantsShot = !climbing && (def.automatic ? input.fire : input.trigger);
  // An empty magazine reloads automatically on the next trigger pull, like most modern shooters.
  const autoReload = wantsShot && active.ammo <= 0 && now + 1e-7 >= active.nextShot;
  if ((input.reload || autoReload) && !p.reloadUntil && now >= p.equipUntil && active.ammo < def.magazine && active.reserve > 0) {
    p.reloadUntil = now + (active.ammo === 0 ? def.emptyReload : def.reload); p.aiming = false; p.burst = 0; return 'reload';
  }
  if (!wantsShot || p.reloadUntil || now < p.equipUntil || now + 1e-7 < active.nextShot || active.ammo <= 0) return null;
  active.ammo--; active.nextShot = now + def.interval; p.protectedUntil = 0;
  return 'shot';
}
/** Applies the designed kick for the shot that was just fired. Spread uses the pre-shot state. */
export function applyRecoil(p: Player) {
  const def: WeaponDef = WEAPONS[p.weapon];
  const scale = (p.aiming ? def.aimRecoil : 1) * (p.crouched ? 0.85 : 1);
  const kick = def.kick * scale * (p.burst === 0 ? 0.6 : 1);
  p.recoil = Math.min(def.maxRecoil, p.recoil + kick);
  p.recoilYaw = Math.max(-0.05, Math.min(0.05, p.recoilYaw + def.pattern[p.burst % def.pattern.length] * def.kick * scale * 0.7));
  p.burst = Math.min(255, p.burst + 1); p.shots = (p.shots + 1) % 65536;
}
export function validWeapon(value: unknown): value is WeaponId { return value === 'rifle' || value === 'sidearm'; }
