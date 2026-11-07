// Development visual tour: drives the dev build through its menus, cutscenes, story beats
// and combat, saving screenshots into artifacts/tour. Requires `npm run dev`.
// Uses dev-only hooks (window.lastBusDev) that do not exist in production builds.
// TOUR=traversal,chapter1,ending,chapter2 picks sections (default: all); TOUR_OUT=dir changes the output folder.
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const url = process.env.GAME_URL ?? 'http://localhost:5173';
const parts = (process.env.TOUR ?? 'traversal,chapter1,ending,chapter2').split(',');
const out = process.env.TOUR_OUT ?? 'artifacts/tour'; mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE, args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'], headless: true });
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
const errors = []; page.on('pageerror', e => errors.push(String(e))); page.on('console', m => { if (m.type() === 'error' && !m.text().includes('ERR_CONNECTION_REFUSED')) errors.push(m.text()); });
const wait = ms => page.waitForTimeout(ms);
const shot = async name => { await wait(250); await page.screenshot({ path: `${out}/${name}.png` }); console.log('saved', name); };
const diag = () => page.evaluate(() => window.lastBusDiagnostics());
const dev = (fn, ...args) => page.evaluate(([fn, args]) => window.lastBusDev[fn](...args), [fn, args]);
const view = async (x, z, yaw, pitch = 0) => { await dev('teleport', x, z, yaw); await dev('look', yaw, pitch); };
const cinema = () => page.evaluate(() => !document.getElementById('cinema').hidden);
const untilCinema = async (open = true, timeout = 20000) => { try { await page.waitForFunction(o => document.getElementById('cinema').hidden !== o, open, { timeout }); } catch (e) { console.log('STUCK', JSON.stringify(await page.evaluate(() => ({ cine: window.lastBusDev.cinema(), d: window.lastBusDiagnostics() })).catch(() => null)).slice(0, 600), errors.slice(0, 5)); throw e; } };
const untilTraverse = kind => page.waitForFunction(k => window.lastBusDiagnostics().self?.traverse === k, kind, { polling: 10, timeout: 5000 });
const objective = async () => (await diag()).objective;
/** Skips objectives (dev F9) until the named one is current; a cutscene queued on the way waits to be played. */
async function skipTo(id) { for (let i = 0; i < 12 && (await objective()) !== id; i++) { await dev('clearEnemies'); await dev('skip'); await wait(150); } }
/** Clicks through the current cutscene shot by shot, screenshotting `at` seconds into the shots listed. */
async function scene(prefix, shots) { for (const [i, delay] of shots) { while ((await page.evaluate(() => window.lastBusDev.cinema()?.shot ?? -1)) < i && await cinema()) await page.mouse.click(800, 450); await wait(delay); await shot(`${prefix}-shot${i + 1}`); } }
async function startStory(chapter) {
  await page.goto(url); await wait(4000);
  if (chapter) await page.evaluate(id => window.lastBusDev.unlockAll(id), chapter);
  await page.click('#nav-story'); await wait(300);
  if (chapter) { await page.click(`[data-chapter="${chapter}"]`); await wait(200); }
  if (!chapter) { await page.click('[data-m="signal-lost"]'); await wait(150); } // A new profile opens on the prologue.
  await page.click('#story-start'); await wait(300); return shot(`${chapter ?? 'ch1'}-briefing`);
}
if (parts.includes('traversal')) {
  await page.goto(url); await wait(4000); await shot('01-menu');
  await page.click('#nav-training'); await wait(300); await page.click('#practice'); await wait(2500); await dev('inspect'); await dev('god');
  await view(-4.5, -24.9, 0, -0.05); await wait(500);
  await dev('drive', 40, { z: 1, jump: true }); await untilTraverse(1); await wait(110); await shot('trav-vault');
  await view(35.2, -20.5, Math.PI / 2, 0.15); await wait(400); await dev('drive', 60, { z: 1 }); await untilTraverse(3); await wait(300); await shot('trav-ladder');
  await view(7, -26, 0, 0); await wait(300); await dev('drive', 50, { z: 1, sprint: true }); await wait(800); await dev('drive', 30, { z: 1, sprint: true, crouch: true }); await untilTraverse(4); await wait(150); await shot('trav-slide');
  await view(30.4, -17, Math.PI / 2, -0.1); await wait(600); await shot('trav-hint');
}
if (parts.includes('chapter1')) {
  await startStory();
  await dev('inspect'); await dev('god'); await page.click('#brief-start'); await untilCinema(true, 15000);
  await wait(1500); await shot('ch1-checkpoint'); await page.keyboard.press('Enter'); // Ada's opening comes first; scene-preview covers its shots.
  await wait(2600); await shot('ch1-intro-shot1'); await page.mouse.click(800, 450); await wait(2200); await shot('ch1-intro-shot2'); await page.mouse.click(800, 450); await wait(1500); await shot('ch1-intro-shot3');
  await untilCinema(false); await dev('inspect');
  await view(0, -3, 0); await wait(400); await skipTo('yard');
  await view(-31.7, 5.5, 0, 0.02); await wait(1500); await shot('ch1-yard');
  await skipTo('defend');
  await untilCinema(); await wait(800); await shot('ch1-relay-shot1'); await page.mouse.click(800, 450); await wait(1200); await shot('ch1-relay-shot2');
  await untilCinema(false); await dev('inspect'); await skipTo('park');
  await untilCinema(); await wait(1500); await shot('ch1-femi-shot1'); await page.mouse.click(800, 450); await wait(2400); await shot('ch1-femi-shot2');
  await untilCinema(false); await dev('inspect'); await skipTo('walkback');
  await untilCinema(); console.log('outro playing', await cinema());
  for (const [i, ms] of [[0, 1600], [1, 900], [2, 1800], [3, 3300], [4, 1500], [5, 2200], [6, 3200], [7, 1500]]) { if (i) await page.mouse.click(800, 450); await wait(ms); await shot(`ch1-outro-shot${i + 1}`); console.log('cam', JSON.stringify(await page.evaluate(() => window.lastBusDev.cinema()))); }
  await untilCinema(false); await dev('inspect'); console.log('after outro', await objective());
  await view(4, 10, Math.PI, 0.02); await wait(2500); await shot('ch1-walkback-night');
  await view(-6, -14, Math.PI * 0.8, 0.05); await wait(1200); await shot('ch1-walkback-city');
}
if (parts.includes('ending')) {
  if (!parts.includes('chapter1')) { await startStory(); await dev('inspect'); await dev('god'); await page.click('#brief-start'); await untilCinema(true, 15000); while (await cinema()) { await page.keyboard.press('Enter'); await wait(400); } await dev('inspect'); await skipTo('walkback'); while (await cinema()) { await page.keyboard.press('Enter'); await wait(400); } await dev('inspect'); }
  await view(8.4, -26, 0); await wait(300); console.log('objective before sky', await objective());
  await untilCinema(); const at = [[0, 1500], [1, 900], [2, 1300], [3, 3200], [4, 2400], [5, 1600], [6, 1600], [7, 700], [8, 120], [8, 700], [8, 1500], [9, 2000]];
  let current = 0;
  for (const [i, ms] of at) { while (current < i) { await page.mouse.click(800, 450); current++; } await wait(ms); await shot(`ending-sky-shot${i + 1}-${ms}`); }
  await page.waitForFunction(() => !document.getElementById('chapter-card').hidden, null, { timeout: 30000 }); await wait(1600); await shot('ending-card1');
  await page.mouse.click(800, 450); await wait(2400); await shot('ending-card2'); await page.mouse.click(800, 450); await wait(2600); await shot('ending-card3');
  await page.waitForFunction(() => !document.getElementById('screen-story').hidden, null, { timeout: 30000 }); await wait(600); await shot('ending-campaign');
}
if (parts.includes('chapter2')) {
  await startStory('third-mainland'); await dev('inspect'); await dev('god'); await page.click('#brief-start');
  await untilCinema(true, 15000); for (const [i, ms] of [[0, 2600], [1, 2000], [2, 2500], [3, 2200]]) { if (i) await page.mouse.click(800, 450); await wait(ms); await shot(`ch2-wake-shot${i + 1}`); }
  await page.keyboard.press('Enter'); await untilCinema(false); await dev('inspect'); await wait(1200); await shot('ch2-shelter');
  console.log('ch2 objective', await objective());
  for (let i = 0; i < 6 && (await objective()) !== 'exit'; i++) { await dev('skip'); await wait(600); if (await cinema()) { await wait(1500); await shot(`ch2-scene-${i}`); await page.keyboard.press('Enter'); await wait(300); } if (await page.evaluate(() => !document.getElementById('phone').hidden)) { await wait(800); await shot('ch2-phone'); await page.keyboard.press('Enter'); await wait(300); } }
  await dev('inspect'); await wait(800); await shot('ch2-exit-objective');
  await dev('phone'); await wait(700); await shot('ch2-phone'); await page.keyboard.press('Enter'); await wait(300);
}
await browser.close();
console.log(errors.length ? `ERRORS:\n${errors.slice(0, 10).join('\n')}` : 'no page errors');
