import { spawn } from 'node:child_process';
// The dev client always talks to :2567, so an inherited PORT (set by some launchers for the client) must not move the game server.
const jobs = [
  spawn(process.execPath, ['--env-file-if-exists=.env', '--import', 'tsx', 'apps/server/src/index.ts'], { stdio: 'inherit', env: { ...process.env, PORT: process.env.GAME_SERVER_PORT ?? '2567' }, windowsHide: true }),
  spawn(process.execPath, ['--env-file-if-exists=.env', 'node_modules/vite/bin/vite.js', '--config', 'apps/client/vite.config.ts'], { stdio: 'inherit', env: process.env, windowsHide: true })
];
let ending = false;
function stop(code = 0) { if (ending) return; ending = true; for (const job of jobs) job.kill(); setTimeout(() => process.exit(code), 200); }
jobs.forEach(job => job.on('exit', code => stop(code ?? 0)));
process.on('SIGINT', () => stop()); process.on('SIGTERM', () => stop());
