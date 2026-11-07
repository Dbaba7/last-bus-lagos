// Development: node scripts/shot-frames.mjs <scene> <shot> <out folder> [frames] [seconds between]. Plays one shot in real time and saves a run of
// frames from it, for judging something that changes over a shot (the blast) rather than one moment. Requires `npm run dev`.
// MISSION=the-passenger for the prologue; FLAGS=a,b sets world flags; VIEW=844x390 sets the window size.
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const [scene, shot, folder, frames = '8', gap = '0.6'] = process.argv.slice(2), out = `artifacts/scenes/${folder}`; mkdirSync(out, { recursive: true });
const prologue = process.env.MISSION === 'the-passenger', flags = process.env.FLAGS?.split(',') ?? (scene === 'sky' ? ['night', 'city', 'bus-gone', 'femi-gone'] : []);
const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE, args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'], headless: true });
const [width, height] = (process.env.VIEW ?? '1600x900').split('x').map(Number), page = await browser.newPage({ viewport: { width, height } }); const errors = []; page.on('pageerror', e => errors.push(String(e)));
const dev = (fn, ...args) => page.evaluate(([fn, args]) => window.lastBusDev[fn](...args), [fn, args]);
await page.goto(process.env.GAME_URL ?? 'http://localhost:5173'); await page.waitForTimeout(3500); await page.click('#nav-story'); await page.waitForTimeout(300);
if (prologue) await page.click('#story-start'); else { await page.click('[data-m="signal-lost"]'); await page.waitForTimeout(150); await page.click('#story-start'); await page.waitForTimeout(300); await page.click('#brief-start'); }
await page.waitForFunction(() => !document.getElementById('cinema').hidden, null, { timeout: 20000 }); await page.waitForTimeout(800); await page.keyboard.press('Enter'); await page.waitForTimeout(500);
await dev('inspect'); await dev('god'); await dev('clearEnemies'); await dev('play', scene, Number(shot), flags);
const names = [], t0 = Date.now(), most = [];
for (let i = 0; i < Number(frames); i++) { const name = `${out}/${scene}-${shot}-${String(i).padStart(2, '0')}.png`; await page.screenshot({ path: name }); names.push(name); most.push((await page.evaluate(() => window.lastBusDiagnostics())).drawCalls); const wait = (i + 1) * Number(gap) * 1000 - (Date.now() - t0); if (wait > 0) await page.waitForTimeout(wait); }
console.log(names.join(' ')); console.error(`draws ${most.join(' ')}; ${errors.length ? errors.slice(0, 4).join(' | ') : 'no page errors'}`);
await browser.close();
