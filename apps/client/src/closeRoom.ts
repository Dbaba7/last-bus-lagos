import type { Room } from '@colyseus/sdk';
/** Bound menu navigation even if the server cannot acknowledge a voluntary leave. */
export async function closeRoom(room: Room) {
  room.reconnection.enabled = false; room.reconnection.isReconnecting = false;
  // SDK 0.18.5 does not cancel an already scheduled reconnect when enabled changes.
  // This connection belongs to the discarded room and must never reconnect later.
  room.connection.reconnect = () => {};
  if (!room.connection.isOpen) { room.connection.close(1000); room.onLeave.invoke(1000); return; }
  let timer: ReturnType<typeof setTimeout> | undefined;
  try { await Promise.race([room.leave(), new Promise(resolve => { timer = setTimeout(resolve, 1500); })]); }
  finally { clearTimeout(timer); if (room.connection.isOpen) { room.connection.close(1000); room.onLeave.invoke(1000); } }
}
