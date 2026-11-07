// Development: plays every synthesized effect and cutscene sound in a real browser and reports the output peak of
// each with the music, ambience and dialogue buses muted (silence or clipping shows up here), and lists page errors.
// Requires `npm run dev`. Uses the dev-only lastBusDev.sfx / peak hooks.
import { chromium } from 'playwright';
const url = process.env.GAME_URL ?? 'http://localhost:5173';
const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE, args: ['--autoplay-policy=no-user-gesture-required'], headless: true });
const page = await browser.newPage(); const errors = []; page.on('pageerror', e => errors.push(String(e))); page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
await page.goto(url); await page.waitForTimeout(3500); await page.mouse.click(5, 5); await page.waitForTimeout(500);
const dev = (fn, ...args) => page.evaluate(([fn, args]) => window.lastBusDev[fn](...args), [fn, args]);
/** Peak output over `ms` after starting a sound, sampled every 20 ms. */
async function measure(start, ms) { await start(); return page.evaluate(ms => new Promise(res => { let p = 0; const t0 = performance.now(); const id = setInterval(() => { p = Math.max(p, window.lastBusDev.peak()); if (performance.now() - t0 > ms) { clearInterval(id); res(p); } }, 20); }), ms); }
await page.evaluate(() => document.getElementById('nav-story').click()); await page.waitForTimeout(300); await page.evaluate(() => document.querySelector('[data-m="signal-lost"]').click()); await page.waitForTimeout(150); await page.evaluate(() => document.getElementById('story-start').click()); await page.waitForTimeout(300); await page.evaluate(() => document.getElementById('brief-start').click());
await page.waitForFunction(() => !document.getElementById('cinema').hidden, null, { timeout: 30000 }); await page.keyboard.press('Enter'); await page.waitForTimeout(1500);
const bed = await measure(() => {}, 1500);
const rows = [`ambience, music and voice: ${bed.toFixed(3)}`];
for (const bus of ['music', 'ambience', 'dialogue']) await dev('mix', bus, 0); await page.waitForTimeout(1500);
const quiet = await measure(() => {}, 600); rows.push(`with music, ambience and dialogue muted: ${quiet.toFixed(3)}`);
const effects = ['rifle', 'sidearm', 'empty', 'magout', 'magin', 'bolt', 'slide', 'switch', 'impact', 'step', 'step-dirt', 'step-wood', 'step-tile', 'step-metal', 'land', 'hurt', 'vault', 'mantle', 'rung', 'pipe', 'slide'];
const cine = ['rumble', 'whoosh', 'boom', 'glass', 'horns', 'crash', 'static', 'ringing', 'breath', 'engine', 'door', 'siren', 'slap', 'stall', 'steps', 'pressure', 'alarms'];
let silent = 0, clipped = 0;
for (const k of effects) { const p = await measure(() => dev('sfx', k), 500); rows.push(`${k.padEnd(10)} ${p.toFixed(3)}`); if (p <= quiet + 0.02) silent++; if (p >= 0.999) clipped++; await page.waitForTimeout(300); }
for (const k of cine) { const p = await measure(() => dev('sfx', k, true), 1600); rows.push(`cine ${k.padEnd(8)} ${p.toFixed(3)}`); if (p <= quiet + 0.02) silent++; if (p >= 0.999) clipped++; await page.waitForTimeout(2500); }
console.log(rows.join('\n'));
console.log(`${silent} silent, ${clipped} clipped`);
// The ambience moods and the radio, measured on their own: average level and how much sits in each band.
const levels = ms => page.evaluate(ms => new Promise(res => { const seen = [], id = setInterval(() => seen.push(window.lastBusDev.probe()), 60); setTimeout(() => { clearInterval(id); const mean = k => seen.reduce((s, p) => s + p[k], 0) / seen.length; res({ rms: +mean('rms').toFixed(3), most: Math.max(...seen.map(p => p.rms)), low: Math.round(mean('low')), mid: Math.round(mean('mid')), high: Math.round(mean('high')) }); }, ms); }), ms);
const show = (name, l) => console.log(`${name.padEnd(30)} rms ${l.rms.toFixed(3)}  loudest ${l.most.toFixed(3)}  low ${l.low}  mid ${l.mid}  high ${l.high} dB`);
for (const bus of ['effects', 'ui']) await dev('mix', bus, 0); await dev('mix', 'ambience', 0.6);
console.log('\nmoods, ambience bus only (2.5 s to settle, 4 s measured, random events included)');
for (const mood of ['live', 'ride', 'hush', 'still', 'dusk', 'restored']) { await dev('ambience', mood, 0.5); await page.waitForTimeout(2500); show(mood, await levels(4000)); }
console.log('\ncrossfade live to hush over 6 s: output every 0.5 s, which should fall without a gap or a bump');
await dev('ambience', 'live', 0.5); await page.waitForTimeout(3000); await dev('ambience', 'hush', 6); const fall = []; for (let i = 0; i < 16; i++) { fall.push((await page.evaluate(() => window.lastBusDev.probe().rms)).toFixed(3)); await page.waitForTimeout(500); } console.log(fall.join(' '));
console.log('\nradio with the ambience and the score off'); await dev('score', 'none'); await dev('mix', 'ambience', 0); await dev('mix', 'music', 0.45); await dev('mix', 'dialogue', 0.9);
await dev('radio', { radio: 'play', station: 'news', signal: 1 }); await page.waitForTimeout(800); show('carrier alone', await levels(2000));
await dev('radio', { radio: 'play', station: 'radio-song', signal: 1 }); await page.waitForTimeout(1500); show('song, clean', await levels(4000));
await dev('radio', { radio: 'play', muffled: true, seconds: 0.2 }); await page.waitForTimeout(800); show('song, muffled', await levels(4000));
await dev('radio', { radio: 'play', muffled: false, seconds: 0.2 }); await dev('mix', 'music', 0); await page.waitForTimeout(800); show('Music at 0', await levels(2000)); await dev('mix', 'music', 0.45);
for (const signal of [0.8, 0.55, 0.2, 0]) { await dev('radio', { radio: 'play', signal, seconds: 0.3 }); await page.waitForTimeout(900); show(`signal ${signal}`, await levels(3000)); }
console.log('sound', JSON.stringify(await dev('sound'))); await dev('radio', { radio: 'stop' }); await page.waitForTimeout(600); show('after the click', await levels(1500)); console.log('sound', JSON.stringify(await dev('sound')));
console.log(errors.length ? `ERRORS:\n${errors.slice(0, 10).join('\n')}` : 'no page errors');
await browser.close();
