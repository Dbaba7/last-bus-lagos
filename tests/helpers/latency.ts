import { createServer, connect, type Socket } from 'node:net';
/** Delays the actual ordered TCP byte stream, including WebSocket frames and pings. */
export async function latencyProxy(port: number, destination: number, rtt: number, jitter = 0) {
  const sockets = new Set<Socket>(); let forwardedBytes = 0;
  const server = createServer(client => {
    const upstream = connect(destination, '127.0.0.1'); sockets.add(client); sockets.add(upstream);
    function forward(source: Socket, target: Socket) {
      let due = 0; const timers = new Set<ReturnType<typeof setTimeout>>();
      source.on('data', data => {
        forwardedBytes += data.length;
        due = Math.max(due + 0.1, performance.now() + rtt / 2 + (Math.random() - 0.5) * jitter);
        const timer = setTimeout(() => { timers.delete(timer); if (!target.destroyed) target.write(data); }, Math.max(0, due - performance.now())); timers.add(timer);
      });
      source.on('error', () => target.destroy());
      source.on('close', () => { timers.forEach(clearTimeout); sockets.delete(source); target.destroy(); });
    }
    forward(client, upstream); forward(upstream, client);
  });
  await new Promise<void>((resolve, reject) => { server.once('error', reject); server.listen(port, '127.0.0.1', resolve); });
  return { endpoint: `http://127.0.0.1:${port}`, bytes: () => forwardedBytes, interrupt: () => { for (const socket of sockets) socket.destroy(); }, close: async () => { for (const socket of sockets) socket.destroy(); await new Promise<void>(resolve => server.close(() => resolve())); } };
}
