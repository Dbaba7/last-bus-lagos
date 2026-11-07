import { mkdtemp, cp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
const directory = await mkdtemp(join(tmpdir(), 'lastbus-clean-'));
for (const path of ['package.json', 'package-lock.json', 'tsconfig.json', 'apps', 'packages', 'tests', 'scripts']) await cp(path, join(directory, path), { recursive: true, filter: source => !source.split(/[\\/]/).includes('node_modules') });
console.log(`Clean verification workspace: ${directory}`);
const npm = process.env.npm_execpath;
if (!npm) throw new Error('Run this script with npm run verify:clean');
for (const args of [['ci'], ['run', 'build'], ['run', 'lint'], ['test']]) {
  const code = await new Promise(resolve => { const child = spawn(process.execPath, [npm, ...args], { cwd: directory, stdio: 'inherit', env: process.env, windowsHide: true }); child.on('exit', resolve); });
  if (code !== 0) { process.exitCode = 1; break; }
}
// Kept for inspection; no recursive deletion of a computed Windows path.
