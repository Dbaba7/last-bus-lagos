import { Room, type Client } from '@colyseus/core';
import { randomBytes } from 'node:crypto';
import { RULES, VERSION, Simulation, parseInput, neutral, type InputFrame, type GameOptions } from '@lastbus/shared';
import { createState, syncState, NetworkState } from './schema.js';
export const invitations = new Map<string, string>();
export const metrics = { ticks: 0, maxTickMs: 0, rejected: 0, rooms: 0, tickSamples: [] as number[] };
interface InputQueue { frames: InputFrame[]; last?: InputFrame; lastSeen: number; lastSeq: number; tokens: number; tokenTime: number; actions: number; actionTime: number; violations: number }
export class GameRoom extends Room<{ state: InstanceType<typeof NetworkState> }> {
  game!: Simulation; invite = ''; state = createState(); private queues = new Map<string, InputQueue>();
  private creator = ''; private counted = false;
  private pulses = new Map<string, { nonce: number; at: number }>();
  async onCreate(options: { private?: boolean }) {
    if (metrics.rooms >= 64) throw new Error('This server is full. Please try again shortly.');
    metrics.rooms++; this.counted = true;
    // Test timing is a server deployment setting, never accepted from a client request.
    const test: GameOptions = process.env.NODE_ENV === 'test' ? { countdown: Number(process.env.TEST_COUNTDOWN_SECONDS ?? 0.2), duration: Number(process.env.TEST_MATCH_SECONDS ?? 3), results: Number(process.env.TEST_RESULTS_SECONDS ?? 1) } : {};
    this.game = new Simulation({ ...test, private: options.private === true }); this.maxClients = RULES.maxPlayers;
    this.setPatchRate(50); this.seatReservationTimeout = 10;
    if (this.game.options.private) { this.invite = randomBytes(16).toString('base64url'); invitations.set(this.invite, this.roomId); await this.setPrivate(true); }
    this.onMessage('input', (client, raw: unknown) => this.input(client, raw));
    this.onMessage('ready', client => { if (this.operation(client)) this.game.ready(client.sessionId); });
    this.onMessage('start', client => { if (this.operation(client) && !this.game.start(client.sessionId)) client.send('notice', 'Wait for two loaded players on opposing teams. Only the host can start.'); });
    this.onMessage('configure', (client, raw: unknown) => { const v = raw as { duration?: unknown; killLimit?: unknown } | null; if (this.operation(client) && v && typeof v === 'object' && this.game.configure(client.sessionId, v.duration, v.killLimit)) syncState(this.state, this.game); });
    this.onMessage('team', client => { if (this.operation(client) && !this.game.switchTeam(client.sessionId)) client.send('notice', 'That team is full, or the match has already started.'); else syncState(this.state, this.game); });
    this.onMessage('pong', (client, value: unknown) => { const pulse = this.pulses.get(client.sessionId), player = this.game.players.get(client.sessionId); if (pulse && value === pulse.nonce && player) { player.ping = Math.min(999, Math.round(performance.now() - pulse.at)); this.pulses.delete(client.sessionId); } });
    this.onMessage('*', client => { metrics.rejected++; const q = this.queues.get(client.sessionId); if (q && ++q.violations > 30) client.leave(4002, 'Unsupported messages'); });
    this.clock.setInterval(() => { for (const client of this.clients) { const nonce = Math.floor(Math.random() * 0x7fffffff); this.pulses.set(client.sessionId, { nonce, at: performance.now() }); client.send('ping', nonce); } }, 2000);
    this.setFixedTimestep(() => this.step(), RULES.tickRate);
    syncState(this.state, this.game);
  }
  onAuth(client: Client, options: { version?: string; invite?: string }) {
    if (options.version !== VERSION) throw new Error('Game updated. Refresh this page before joining.');
    if (this.game.options.private) {
      if (!this.creator) this.creator = client.sessionId;
      else if (client.sessionId !== this.creator && options.invite !== this.invite) throw new Error('This private room needs a valid invitation.');
    }
    return true;
  }
  onJoin(client: Client, options: { name?: string }) {
    this.game.add(client.sessionId, options.name ?? 'Passenger');
    this.queues.set(client.sessionId, { frames: [], lastSeen: this.game.now, lastSeq: 0, tokens: 90, tokenTime: performance.now(), actions: 10, actionTime: performance.now(), violations: 0 });
    syncState(this.state, this.game); if (this.invite) client.send('invite', this.invite);
  }
  async onDrop(client: Client, code: number) {
    if (process.env.NODE_ENV === 'test') console.log(JSON.stringify({ event: 'socket-drop', code, rejectedInputs: metrics.rejected }));
    const player = this.game.players.get(client.sessionId); if (player) player.connected = false;
    const q = this.queues.get(client.sessionId); if (q) { q.frames = []; q.last = undefined; }
    this.game.chooseHost(); syncState(this.state, this.game);
    try { await this.allowReconnection(client, RULES.reconnect); } catch { /* Colyseus calls onLeave after the reservation expires. */ }
  }
  onReconnect(client: Client) { const player = this.game.players.get(client.sessionId); if (player) player.connected = true; this.game.chooseHost(); if (this.invite) client.send('invite', this.invite); syncState(this.state, this.game); }
  onLeave(client: Client) { this.game.remove(client.sessionId); this.queues.delete(client.sessionId); this.pulses.delete(client.sessionId); syncState(this.state, this.game); }
  onDispose() { if (this.invite) invitations.delete(this.invite); if (this.counted) metrics.rooms--; }
  private operation(client: Client) {
    const q = this.queues.get(client.sessionId); if (!q) return false;
    const now = performance.now(); q.actions = Math.min(10, q.actions + (now - q.actionTime) / 6000); q.actionTime = now;
    if (q.actions < 1) return false; q.actions--; return true;
  }
  private input(client: Client, raw: unknown) {
    const q = this.queues.get(client.sessionId); if (!q) return;
    const now = performance.now(); q.tokens = Math.min(90, q.tokens + (now - q.tokenTime) * 0.06); q.tokenTime = now;
    const input = parseInput(raw);
    if (!input || input.seq <= q.lastSeq || input.seq > q.lastSeq + 1000) {
      metrics.rejected++; if (++q.violations > 120) client.leave(4002, 'Too many invalid inputs'); return;
    }
    // Congestion can deliver legitimate frames in a burst. Drop excess frames without
    // negative token debt or treating congestion as malformed gameplay input.
    if (q.tokens < 1) { metrics.rejected++; return; }
    q.tokens--;
    q.lastSeq = input.seq; q.lastSeen = this.game.now;
    // Backlog gets discarded and corrected, never simulated as extra time.
    if (q.frames.length >= 8) q.frames.length = 0;
    q.frames.push(input);
  }
  private step() {
    const started = performance.now(), inputs = new Map<string, InputFrame>();
    for (const client of this.clients) if ((client.ref as { bufferedAmount?: number }).bufferedAmount! > 256 * 1024) client.leave(4002, 'Connection cannot keep up. Please reconnect.');
    for (const [id, q] of this.queues) {
      const player = this.game.players.get(id); if (!player) continue;
      let frame = q.frames.shift();
      if (frame) q.last = frame;
      else if (q.last && player.connected && this.game.now - q.lastSeen < RULES.staleInput) frame = { ...q.last, jump: false, trigger: false, reload: false, weapon: '' };
      else frame = { ...neutral(player.ack, player.life, this.game.round), yaw: player.yaw, pitch: player.pitch };
      inputs.set(id, frame);
    }
    for (const event of this.game.step(inputs)) this.broadcast('event', event);
    syncState(this.state, this.game); metrics.ticks++; const elapsed = performance.now() - started; metrics.maxTickMs = Math.max(metrics.maxTickMs, elapsed); metrics.tickSamples.push(elapsed); if (metrics.tickSamples.length > 10000) metrics.tickSamples.shift();
  }
}
