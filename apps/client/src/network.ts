import { Client, type Room } from '@colyseus/sdk';
import { VERSION, type GameEvent, type InputFrame, type Snapshot } from '@lastbus/shared';
import { closeRoom } from './closeRoom.js';
type WireState = Omit<Snapshot, 'players' | 'results'> & { players: Record<string, Snapshot['players'][number]>; resultsJson: string };
type WireRoom = Room<unknown, { toJSON(): WireState }>;
export class GameConnection {
  room?: WireRoom; id = ''; invite = ''; connected = false;
  onSnapshot?: (snapshot: Snapshot) => void; onEvent?: (event: GameEvent) => void; onStatus?: (message: string, failed?: boolean) => void; onInvite?: (token: string) => void;
  readonly endpoint: string;
  constructor() {
    this.endpoint = import.meta.env.VITE_SERVER_URL || (import.meta.env.DEV ? `${location.protocol}//${location.hostname}:2567` : location.origin);
  }
  async join(kind: 'public' | 'private' | 'invite', name: string, token = '') {
    if (!this.endpoint) throw new Error('This build needs a game server URL. Contact the host.');
    await this.leave(); const client = new Client(this.endpoint); let pending: Promise<WireRoom>;
    if (kind === 'invite') {
      const response = await fetch(`${this.endpoint}/api/invite`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token }), signal: AbortSignal.timeout(8000) });
      if (!response.ok) throw new Error('That invitation is invalid, expired, or unavailable.'); const result = await response.json() as { roomId: string };
      pending = client.joinById(result.roomId, { version: VERSION, name, invite: token }) as Promise<WireRoom>;
    } else pending = (kind === 'private' ? client.create('street_wars', { version: VERSION, name, private: true }) : client.joinOrCreate('street_wars', { version: VERSION, name })) as Promise<WireRoom>;
    let timedOut = false, timer: ReturnType<typeof setTimeout> | undefined;
    pending.then(room => { if (timedOut) void closeRoom(room); }).catch(() => {});
    try { this.room = await Promise.race([pending, new Promise<never>((_, reject) => { timer = setTimeout(() => { timedOut = true; reject(new Error('The server did not respond. Try again shortly.')); }, 12000); })]); } finally { clearTimeout(timer); }
    const room = this.room; this.id = room.sessionId; this.connected = true;
    room.reconnection.enabled = true; room.reconnection.maxRetries = 8; room.reconnection.minUptime = 0;
    room.onStateChange(state => { if (this.room !== room) return; const raw = state.toJSON(); if (!raw.players || !raw.phase) return; this.onSnapshot?.({ ...raw, players: Object.values(raw.players), results: JSON.parse(raw.resultsJson || '[]') } as Snapshot); });
    room.onMessage('event', (event: GameEvent) => { if (this.room === room) this.onEvent?.(event); });
    room.onMessage('invite', (invite: string) => { if (this.room !== room) return; this.invite = invite; this.onInvite?.(invite); });
    room.onMessage('notice', (text: string) => { if (this.room === room) this.onStatus?.(text); });
    room.onMessage('ping', (nonce: number) => room.send('pong', nonce));
    room.onDrop(() => { if (this.room !== room) return; this.connected = false; this.onStatus?.('Connection interrupted. Reconnecting…'); });
    room.onReconnect(() => { if (this.room !== room) return; this.connected = true; this.onStatus?.('Back on board.'); });
    room.onError((_code, message) => { if (this.room === room) this.onStatus?.(message ?? 'Connection error. Please retry.', true); });
    room.onLeave((_code, reason) => { if (this.room !== room) return; this.connected = false; this.room = undefined; this.onStatus?.(`${reason || 'You left the room or the connection expired.'} Return to the menu to rejoin.`, true); });
    room.send('ready');
  }
  send(input: InputFrame) { if (this.room && this.connected) this.room.send('input', input); }
  start() { this.room?.send('start'); }
  configure(duration: number, killLimit: number) { this.room?.send('configure', { duration, killLimit }); }
  switchTeam() { this.room?.send('team'); }
  /** Real reachability check; never invents player counts. */
  async health(): Promise<{ ok: boolean; rooms?: number; version?: string }> {
    try { const r = await fetch(`${this.endpoint}/health`, { signal: AbortSignal.timeout(3500) }); if (!r.ok) return { ok: false }; return { ok: true, ...(await r.json() as { rooms: number; version: string }) }; } catch { return { ok: false }; }
  }
  async leave() { const room = this.room; this.room = undefined; this.connected = false; this.invite = ''; if (room) await closeRoom(room); }
}
