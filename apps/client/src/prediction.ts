import { advanceWeapon, applyRecoil, movePlayer, RULES, type InputFrame, type Player } from '@lastbus/shared';
/** Pure replay step. The caller emits presentation effects only for fresh input. */
export function predictPlayer(player: Player, input: InputFrame, now: number) {
  if (player.health <= 0) return null;
  movePlayer(player, input);
  const action = advanceWeapon(player, input, now, RULES.dt);
  if (action === 'shot') applyRecoil(player);
  return action;
}
