import { spawn } from 'node:child_process';
export const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
export async function until(check: () => boolean, timeout = 12000, label = 'condition') {
  const started = Date.now(); while (!check()) { if (Date.now() - started > timeout) throw new Error(`Timed out waiting for ${label}`); await sleep(25); }
}
export async function testServer(port: number, extraEnv: Record<string, string> = {}) {
  const samples: { elapsed: number; rss: number; heap: number; rooms: number; p95TickMs: number; ticks: number; rejected: number }[] = [];
  let logs = '';
  const entry = process.env.TEST_COMPILED === '1' ? ['dist/server/index.js'] : ['--import', 'tsx', 'apps/server/src/index.ts'];
  const child = spawn(process.execPath, entry, { env: { ...process.env, NODE_ENV: 'test', PORT: String(port), ...extraEnv }, stdio: ['ignore', 'pipe', 'pipe', 'ipc'], windowsHide: true });
  child.stdout?.on('data', data => { logs = (logs + String(data)).slice(-16000); }); child.stderr?.on('data', data => { logs = (logs + String(data)).slice(-16000); });
  child.on('message', message => { if (typeof message === 'object' && message && 'sample' in message) samples.push((message as { sample: typeof samples[number] }).sample); });
  const endpoint = `http://127.0.0.1:${port}`;
  try {
    const started = Date.now();
    for (;;) { if (child.exitCode !== null) throw new Error(logs); try { if ((await fetch(`${endpoint}/health`)).ok) break; } catch { /* Waiting for the listener. */ } if (Date.now() - started > 15000) throw new Error(`Server startup timed out: ${logs}`); await sleep(100); }
  } catch (error) { child.kill(); throw error; }
  return { endpoint, samples, logs: () => logs, stop: async () => { child.kill(); await Promise.race([new Promise(resolve => child.once('exit', resolve)), sleep(2000)]); } };
}
