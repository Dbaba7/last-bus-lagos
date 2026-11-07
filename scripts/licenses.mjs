import { readFile, writeFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
const lock = JSON.parse(await readFile('package-lock.json', 'utf8'));
const sections = ['LAST BUS: LAGOS — third-party runtime notices\nGenerated from the installed, locked dependency tree. Original game assets are listed in docs/assets.md.'];
for (const [path, info] of Object.entries(lock.packages).sort(([a], [b]) => a.localeCompare(b))) {
  if (!path.startsWith('node_modules/') || info.dev || info.link) continue;
  let files; try { files = await readdir(path); } catch { continue; }
  const manifest = JSON.parse(await readFile(join(path, 'package.json'), 'utf8'));
  const notices = files.filter(file => /^(licen[sc]e|notice|copying)(\.|$)/i.test(file));
  sections.push(`\n${'='.repeat(72)}\n${manifest.name} ${manifest.version}\nLicense: ${manifest.license ?? info.license ?? 'See package'}\n${manifest.homepage ?? ''}`);
  for (const file of notices) sections.push(`${file}\n${await readFile(join(path, file), 'utf8')}`);
}
await writeFile('apps/client/public/THIRD_PARTY_NOTICES.txt', sections.join('\n\n'));
console.log('Runtime dependency notices written.');
