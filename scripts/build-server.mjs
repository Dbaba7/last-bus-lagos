import { build } from 'esbuild';
import { readFile } from 'node:fs/promises';
const manifest = JSON.parse(await readFile('package.json', 'utf8'));
await build({ entryPoints: ['apps/server/src/index.ts'], bundle: true, platform: 'node', target: 'node24', format: 'esm', outfile: 'dist/server/index.js', sourcemap: true, external: Object.keys(manifest.dependencies), logLevel: 'info' });
