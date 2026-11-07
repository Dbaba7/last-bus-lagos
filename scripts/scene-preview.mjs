// Development: screenshots every Chapter 1 cutscene shot without playing the mission, using the dev-only
// lastBusDev.play(scene, shot, flags) hook. Requires `npm run dev`. Output: artifacts/scenes/<OUT or "latest">.
// SCENES=intro,outro picks scenes; AT=ms sets how far into each shot the picture is taken (default 1400); MISSION=the-passenger previews the prologue.
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const url = process.env.GAME_URL ?? 'http://localhost:5173', at = Number(process.env.AT ?? 1400);
const out = `artifacts/scenes/${process.env.OUT ?? 'latest'}`; mkdirSync(out, { recursive: true });
const pick = process.env.SCENES?.split(',');
// [scene, shot count, world flags in force while it plays]
const prologue = process.env.MISSION === 'the-passenger';
const scenes = prologue ? [['opening', 3, ['live', 'parked']], ['boarding', 7, ['live', 'parked']], ['ride', 17, ['live']], ['jam', 6, ['live']], ['stop', 7, []], ['hide', 3, []]] : [['checkpoint', 18, []], ['intro', 3, []], ['relay', 2, []], ['femi', 2, []], ['outro', 4, []], ['outro', 8, ['night'], 4], ['sky', 13, ['night', 'city', 'bus-gone', 'femi-gone']]];
const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE, args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'], headless: true });
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
const errors = []; page.on('pageerror', e => errors.push(String(e)));
const dev = (fn, ...args) => page.evaluate(([fn, args]) => window.lastBusDev[fn](...args), [fn, args]);
await page.goto(url); await page.waitForTimeout(4000);
await page.click('#nav-story'); await page.waitForTimeout(300);
if (prologue) await page.click('#story-start');
else { await page.click('[data-m="signal-lost"]'); await page.waitForTimeout(150); await page.click('#story-start'); await page.waitForTimeout(300); await page.click('#brief-start'); }
await page.waitForFunction(() => !document.getElementById('cinema').hidden, null, { timeout: 20000 }); await page.keyboard.press('Enter'); await page.waitForTimeout(500);
await dev('inspect'); await dev('god'); await dev('clearEnemies');
const stats = [];
for (const [id, count, flags, from = 0] of scenes) {
  if (pick && !pick.includes(id)) continue;
  for (let shot = from; shot < count; shot++) {
    await dev('play', id, shot, flags); await page.waitForTimeout(at);
    await page.screenshot({ path: `${out}/${id}-shot${shot + 1}.png` });
    const d = await page.evaluate(() => window.lastBusDiagnostics()); stats.push(`${id} ${shot + 1}: ${d.drawCalls ?? d.render?.drawCalls ?? '?'} draws`); console.log('saved', `${id}-shot${shot + 1}`);
  }
}
await browser.close();
console.log(stats.join('\n')); console.log(errors.length ? `ERRORS:\n${errors.slice(0, 10).join('\n')}` : 'no page errors');
