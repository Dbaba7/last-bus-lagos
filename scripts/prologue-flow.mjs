// Development: node scripts/prologue-flow.mjs <screenshot prefix>. Requires `npm run dev`. Plays the prologue in order on a new profile: opening, the park walk under scripted input, the four scenes, the escape, the hiding place, the hand-off.
import { chromium } from 'playwright';
const out = process.argv[2]; const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
const page = await b.newPage({ viewport: { width: 1600, height: 900 } }); const errors = []; page.on('pageerror', e => errors.push(String(e))); page.on('console', m => { if (m.type() === 'error' && !m.text().includes('ERR_CONNECTION')) errors.push(m.text()); });
const dev = (fn, ...args) => page.evaluate(([fn, args]) => window.lastBusDev[fn](...args), [fn, args]);
const state = () => page.evaluate(() => { const d = window.lastBusDiagnostics(); return { scene: window.lastBusDev.cinema()?.id, shot: window.lastBusDev.cinema()?.shot, objective: d.objective, x: d.self?.x?.toFixed(1), z: d.self?.z?.toFixed(1), actors: d.actors, draws: d.drawCalls, agents: d.agents?.length, location: document.getElementById('location')?.textContent }; });
const inCinema = () => page.evaluate(() => !document.getElementById('cinema').hidden);
await page.goto('http://localhost:5173/'); await page.waitForTimeout(3500); await page.click('#nav-story'); await page.waitForTimeout(300); await page.click('#story-start');
await page.waitForFunction(() => !document.getElementById('cinema').hidden, null, { timeout: 20000 }); await page.waitForTimeout(800); console.log('opening', JSON.stringify(await state()));
await page.keyboard.press('Enter'); await page.waitForTimeout(1000); await dev('inspect'); await dev('god');
console.log('walk start', JSON.stringify(await state())); await page.screenshot({ path: `${out}-walk0.png` });
await dev('drive', 240, { z: 1 }); await page.waitForTimeout(3500); console.log('walking', JSON.stringify(await state())); await page.screenshot({ path: `${out}-walk1.png` });
await dev('teleport', 12, 25.6, -Math.PI / 2); await dev('look', -Math.PI / 2, 0.02); await page.waitForTimeout(700); console.log('past last bus', JSON.stringify(await state())); await page.screenshot({ path: `${out}-walk2.png` });
await dev('teleport', -0.7, 25, 0); await page.waitForTimeout(900); console.log('at the door', JSON.stringify(await state()));
for (const name of ['boarding', 'ride', 'jam']) { await page.waitForTimeout(500); console.log(name, JSON.stringify(await state())); await page.keyboard.press('Enter'); await page.waitForTimeout(500); }
console.log('stop', JSON.stringify(await state())); await page.waitForTimeout(800); await page.screenshot({ path: `${out}-stop.png` }); await page.keyboard.press('Enter'); await page.waitForTimeout(1200);
console.log('on the road', JSON.stringify(await state()), await page.evaluate(() => document.getElementById('notice').textContent)); await page.screenshot({ path: `${out}-road.png` });
for (let i = 0; i < 8 && await page.evaluate(() => window.lastBusDiagnostics().objective) !== 'text'; i++) { await dev('skip'); await page.waitForTimeout(220); }
await dev('skip'); await page.waitForTimeout(1200); console.log('hiding', JSON.stringify(await state()), 'cinema', await inCinema()); await page.keyboard.press('Enter');
await page.waitForFunction(() => !document.getElementById('chapter-card').hidden, null, { timeout: 15000 }); await page.waitForTimeout(1300); console.log('card', await page.evaluate(() => document.querySelector('.card-sub')?.textContent)); await page.mouse.click(800, 450);
await page.waitForFunction(() => window.lastBusDev.cinema()?.id === 'checkpoint', null, { timeout: 20000 }); console.log('ada', JSON.stringify(await state()));
console.log(errors.length ? errors.slice(0, 6) : 'no page errors'); await b.close();
