// Development: plays the prologue's ride, 18:40 and the stop in real time and logs what the sound engine is doing every half second,
// so the collapse can be checked without ears. Requires `npm run dev`. Uses the dev-only lastBusDev.play / sound / probe hooks.
// Prints: when each stage happens relative to 18:40, how long the song was heard, levels through the collapse and page errors.
// THROTTLE=4 slows the CPU like a phone and reports the frame rate and how long the placeholder took to make.
import { chromium } from 'playwright';
const url = process.env.GAME_URL ?? 'http://localhost:5173', throttle = Number(process.env.THROTTLE ?? 1);
const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE, args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'], headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } }); const errors = []; page.on('pageerror', e => errors.push(String(e))); page.on('console', m => { if (m.type() === 'error' && !m.text().includes('ERR_CONNECTION')) errors.push(m.text()); });
if (throttle > 1) { const cdp = await page.context().newCDPSession(page); await cdp.send('Emulation.setCPUThrottlingRate', { rate: throttle }); }
const dev = (fn, ...args) => page.evaluate(([fn, args]) => window.lastBusDev[fn](...args), [fn, args]);
await page.goto(url); await page.waitForTimeout(3500); await page.mouse.click(5, 5); await page.waitForTimeout(300);
await page.click('#nav-story'); await page.waitForTimeout(300); const launched = Date.now(); await page.click('#story-start');
await page.waitForFunction(() => !document.getElementById('cinema').hidden, null, { timeout: 30000 }); console.log(`launch to first scene: ${Date.now() - launched} ms`); await page.waitForTimeout(800);
await page.keyboard.press('Enter'); await page.waitForTimeout(1200); await dev('inspect'); await dev('god');
console.log('walk', JSON.stringify(await dev('sound'))); console.log('walk levels', JSON.stringify(await dev('probe')));
await dev('teleport', -0.7, 25, 0); await page.waitForFunction(() => window.lastBusDev.cinema()?.id === 'boarding', null, { timeout: 8000 }); await page.waitForTimeout(300); await page.keyboard.press('Enter');
await page.waitForFunction(() => window.lastBusDev.cinema()?.id === 'ride', null, { timeout: 8000 });
const t0 = Date.now(), log = []; let last = '', frames = 0;
await page.evaluate(() => { window.__frames = 0; const tick = () => { window.__frames++; requestAnimationFrame(tick); }; tick(); });
const stage = async () => page.evaluate(() => ({ cinema: window.lastBusDev.cinema(), sound: window.lastBusDev.sound(), levels: window.lastBusDev.probe(), caption: document.querySelector('#cinema-caption.in')?.textContent, draws: window.lastBusDiagnostics().drawCalls }));
let on18 = 0, songFrom = 0, songTo = 0, maxDraws = 0;
while (Date.now() - t0 < 150000) {
  const s = await stage(), t = (Date.now() - t0) / 1000; maxDraws = Math.max(maxDraws, s.draws ?? 0);
  if (!s.cinema) { log.push({ t, s }); break; }
  if (s.sound.tape && !songFrom) songFrom = t; if (s.sound.tape) songTo = t; if (!on18 && s.caption?.includes('18:40')) on18 = t + 0.7;
  log.push({ t, s }); await page.waitForTimeout(400);
}
frames = await page.evaluate(() => window.__frames); const seconds = (Date.now() - t0) / 1000;
for (const { t, s } of log) {
  const street = `${s.sound.city}${s.sound.crowd ? '+crowd' : ''}`, beds = Object.entries(s.sound.beds).filter(([, v]) => v > 0).map(([k]) => k).join(' '), key = `${s.cinema?.id}.${s.cinema?.shot}`;
  console.log(`${(on18 ? t - on18 : t).toFixed(1).padStart(6)}s ${key.padEnd(9)} ${s.sound.mood.padEnd(6)} ${street.padEnd(14)} station=${(s.sound.station || '-').padEnd(10)} signal=${s.sound.radio ? s.sound.radio.signal.toFixed(2) : '  - '} rate=${s.sound.tape ? s.sound.tape.rate.toFixed(3) : '  -  '} rms=${String(s.levels?.rms).padEnd(6)} low=${String(s.levels?.low).padStart(4)} mid=${String(s.levels?.mid).padStart(4)} high=${String(s.levels?.high).padStart(4)} ${last === beds ? '' : beds}`); last = beds;
}
console.log(`song heard for ${(songTo - songFrom).toFixed(1)} s, ending ${(songTo - on18).toFixed(1)} s after 18:40`);
console.log(`frames: ${(frames / seconds).toFixed(0)} fps average, most draw calls ${maxDraws}`);
await page.waitForTimeout(6500); console.log('escape', JSON.stringify(await dev('sound')));
console.log(errors.length ? `ERRORS:\n${errors.slice(0, 10).join('\n')}` : 'no page errors');
await browser.close();
