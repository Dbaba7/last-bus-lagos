import { schema, t, MapSchema } from '@colyseus/schema';
import type { Player, Simulation } from '@lastbus/shared';
const Gun = schema({ ammo: t.number().default(0), reserve: t.number().default(0), nextShot: t.number().default(0) });
const Guns = schema({ rifle: Gun, sidearm: Gun });
export const NetworkPlayer = schema({
  id: t.string().default(''), name: t.string().default(''), team: t.uint8().default(0), connected: t.boolean().default(false), ready: t.boolean().default(false), life: t.uint32().default(0), health: t.uint8().default(0),
  x: t.float32().default(0), y: t.float32().default(0), z: t.float32().default(0), vx: t.float32().default(0), vy: t.float32().default(0), vz: t.float32().default(0), yaw: t.float32().default(0), pitch: t.float32().default(0), grounded: t.boolean().default(false), crouched: t.boolean().default(false), aiming: t.boolean().default(false),
  traverse: t.uint8().default(0), traverseT: t.float32().default(0), fromX: t.float32().default(0), fromY: t.float32().default(0), fromZ: t.float32().default(0), toX: t.float32().default(0), toY: t.float32().default(0), toZ: t.float32().default(0), ledgeY: t.float32().default(0),
  kills: t.uint16().default(0), deaths: t.uint16().default(0), weapon: t.string().default(''), guns: Guns,
  reloadUntil: t.number().default(0), equipUntil: t.number().default(0), respawnAt: t.number().default(0), protectedUntil: t.number().default(0), recoil: t.float32().default(0), recoilYaw: t.float32().default(0), burst: t.uint8().default(0), shots: t.uint16().default(0), ack: t.uint32().default(0), ping: t.uint16().default(0), joined: t.number().default(0)
});
export const NetworkState = schema({
  tick: t.uint32().default(0), now: t.number().default(0), round: t.uint16().default(0), phase: t.string().default(''), deadline: t.number().default(0), score0: t.uint16().default(0), score1: t.uint16().default(0),
  host: t.string().default(''), private: t.boolean().default(false), winner: t.string().default(''), resultsJson: t.string().default(''), duration: t.number().default(0), killLimit: t.number().default(0), players: t.map(NetworkPlayer)
});
export function createState() { return new NetworkState({ players: new MapSchema(), phase: 'WAITING', resultsJson: '[]', host: '', winner: '' }); }
export function syncState(state: InstanceType<typeof NetworkState>, game: Simulation) {
  const snapshot = game.snapshot(); const { players: _players, results, ...values } = snapshot;
  Object.assign(state, values); state.resultsJson = JSON.stringify(results);
  for (const id of state.players.keys()) if (!game.players.has(id)) state.players.delete(id);
  for (const player of game.players.values()) {
    let entry = state.players.get(player.id);
    if (!entry) { entry = new NetworkPlayer({ guns: new Guns({ rifle: new Gun(), sidearm: new Gun() }) }); state.players.set(player.id, entry); }
    const { guns, ...plain }: Player = player; Object.assign(entry, plain);
    Object.assign(entry.guns.rifle, guns.rifle); Object.assign(entry.guns.sidearm, guns.sidearm);
  }
}
