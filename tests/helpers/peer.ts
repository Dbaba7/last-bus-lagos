import { Client, type Room } from '@colyseus/sdk';
import { VERSION, neutral, RULES, TEST_LANE, type InputFrame, type Player, type Snapshot, type GameEvent } from '@lastbus/shared';
import { until } from './server.js';
export class Peer {
  room: Room; invite = ''; seq = 0; events: GameEvent[] = []; receivedBytes = 0; sentBytes = 0;
  private timer?: ReturnType<typeof setInterval>; private controller?: (player: Player, snapshot: Snapshot) => Partial<InputFrame>;
  constructor(room: Room) {
    this.room = room;
    room.onMessage('invite', (value: string) => { this.invite = value; }); room.onMessage('event', (event: GameEvent) => { this.events.push(event); if (this.events.length > 4000) this.events.shift(); }); room.onMessage('notice', () => {}); room.onMessage('ping', (nonce: number) => room.send('pong', nonce));
    room.onError(() => {});
    const transport = room.connection.transport as unknown as { ws: { addEventListener(type: string, cb: (event: { data: ArrayBuffer }) => void): void } };
    transport.ws.addEventListener('message', event => { this.receivedBytes += event.data.byteLength ?? 0; });
    const original = room.connection.send.bind(room.connection); room.connection.send = data => { this.sentBytes += data.byteLength; original(data); };
  }
  static async create(endpoint: string, name = 'Test host') { return new Peer(await new Client(endpoint).create('street_wars', { version: VERSION, name, private: true })); }
  static async join(endpoint: string, host: Peer, name = 'Test guest') { await until(() => !!host.invite); return new Peer(await new Client(endpoint).joinById(host.room.roomId, { version: VERSION, invite: host.invite, name })); }
  get id() { return this.room.sessionId; }
  get state(): Snapshot { const data = this.room.state.toJSON(); return { ...data, players: Object.values(data.players ?? {}), results: JSON.parse(data.resultsJson || '[]') }; }
  get player(): Player | undefined { return this.state.players.find(p => p.id === this.id); }
  ready() { this.room.send('ready'); }
  control(controller: (player: Player, snapshot: Snapshot) => Partial<InputFrame>) {
    this.controller = controller;
    if (this.timer) return;
    this.timer = setInterval(() => { const p = this.player; if (!p || !this.room.connection.isOpen) return; const frame = { ...neutral(++this.seq, p.life, this.state.round), yaw: p.yaw, pitch: p.pitch, ...this.controller?.(p, this.state) }; this.room.send('input', frame); }, 1000 / RULES.tickRate);
  }
  async close() { clearInterval(this.timer); this.room.reconnection.enabled = false; if (this.room.connection.isOpen) await this.room.leave(); }
}
/** Drives test clients through real inputs along an unobstructed lane. No server mutation. */
export function laneController(targetZ: number) {
  let life = -1, stage = 0;
  return (p: Player): Partial<InputFrame> => {
    if (p.life !== life) { life = p.life; stage = 0; }
    if (p.health <= 0) return {};
    const goal = stage === 0 ? { x: TEST_LANE.x, z: p.team === 0 ? -TEST_LANE.spawnZ : TEST_LANE.spawnZ } : { x: TEST_LANE.x, z: targetZ };
    const dx = goal.x - p.x, dz = goal.z - p.z, distance = Math.hypot(dx, dz);
    if (distance < 0.3) { if (stage === 0) stage = 1; return {}; }
    // Slow down close to the target so delayed snapshots do not create oscillation.
    return { yaw: Math.atan2(dx, dz), z: Math.min(1, distance * 0.5) };
  };
}
