// Development: checks the sound states a player can land in, in the real game: leaving mid-song, skipping every scene, retrying from a
// checkpoint, Ada's opening, Danfo 247's hiss by distance, the Licensed music setting and the cost of making the placeholder.
// Requires `npm run dev`. Prints PASS or FAIL for each; uses the dev-only lastBusDev hooks.
import { chromium } from 'playwright';
const url = process.env.GAME_URL ?? 'http://localhost:5173';
const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE, args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'], headless: true });
const context = await browser.newContext({ viewport: { width: 1280, height: 720 } }), errors = []; let failed = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  ${detail}` : ''}`); if (!ok) failed++; };
async function fresh() {
  const page = await context.newPage(); page.on('pageerror', e => errors.push(String(e))); page.on('console', m => { if (m.type() === 'error' && !m.text().includes('ERR_CONNECTION')) errors.push(m.text()); });
  await page.goto(url); await page.waitForTimeout(3000); await page.mouse.click(5, 5); await page.waitForTimeout(300); return page;
}
const dev = (page, fn, ...args) => page.evaluate(([fn, args]) => window.lastBusDev[fn](...args), [fn, args]);
const scene = (page, id, timeout = 15000) => page.waitForFunction(id => window.lastBusDev.cinema()?.id === id, id, { timeout });
const free = page => page.waitForFunction(() => !window.lastBusDev.cinema(), null, { timeout: 15000 });
async function prologue(page) { await page.click('#nav-story'); await page.waitForTimeout(300); await page.click('#story-start'); await scene(page, 'opening'); await page.waitForTimeout(900); await page.keyboard.press('Enter'); await page.waitForTimeout(800); await dev(page, 'inspect'); await dev(page, 'god'); }
const skip = async (page, id) => { await scene(page, id); await page.waitForTimeout(500); await page.keyboard.press('Enter'); };
const board = page => dev(page, 'teleport', -0.7, 25, 0);
// Leaving in the middle of the song.
{
  const page = await fresh(); await prologue(page); await board(page); await skip(page, 'boarding'); await skip(page, 'ride');
  await scene(page, 'jam'); await page.waitForFunction(() => window.lastBusDev.sound().tape, null, { timeout: 5000 }); const during = await dev(page, 'sound');
  check('the song is playing in the jam after skipping the ride', during.station === 'radio-song' && !!during.tape, JSON.stringify(during.tape));
  await page.evaluate(() => document.getElementById('leave-game').click()); await page.waitForTimeout(200); await page.evaluate(() => document.getElementById('confirm-yes')?.click()); await page.waitForTimeout(1500);
  const after = await dev(page, 'sound'); check('leaving the mission stops the radio and the song', !after.radio && !after.tape && !after.station, JSON.stringify({ radio: after.radio, tape: after.tape, station: after.station, mood: after.mood })); await page.close();
}
// Skipping every scene, then being caught and retrying.
{
  const page = await fresh(); await prologue(page); await board(page); let heard = false; const watch = setInterval(async () => { try { heard ||= !!(await dev(page, 'sound')).tape; } catch { /* Page busy. */ } }, 200);
  for (const id of ['boarding', 'ride', 'jam', 'stop']) await skip(page, id); await free(page); await page.waitForTimeout(600); clearInterval(watch); const after = await dev(page, 'sound');
  check('skipping every scene leaves the radio off and the junction in dusk', !after.radio && !after.tape && after.mood === 'dusk' && after.city === 'dead' && !after.crowd, JSON.stringify({ mood: after.mood, city: after.city, crowd: after.crowd, tape: heard }));
  await dev(page, 'kill'); await page.waitForFunction(() => !document.getElementById('mission-end').hidden, null, { timeout: 8000 }); await page.click('#end-primary'); await page.waitForTimeout(1500);
  const retry = await dev(page, 'sound'), cinema = await dev(page, 'cinema'); check('retrying does not bring the song or a scene back', !retry.radio && !retry.tape && retry.mood === 'dusk' && !cinema, JSON.stringify({ mood: retry.mood, tape: retry.tape })); await page.close();
}
// Ada's opening, played through a shot at a time.
{
  const page = await fresh(); await page.click('#nav-story'); await page.waitForTimeout(300); await page.click('[data-m="signal-lost"]'); await page.waitForTimeout(150); await page.click('#story-start'); await page.waitForTimeout(300); await page.click('#brief-start');
  await scene(page, 'checkpoint', 30000); await page.waitForTimeout(1200); const open = await dev(page, 'sound'); check('18:31 is alive', open.mood === 'live' && open.city === 'restored' && open.crowd, JSON.stringify({ mood: open.mood, city: open.city, crowd: open.crowd }));
  for (let i = 0; i < 16; i++) { await page.mouse.click(640, 360); await page.waitForTimeout(120); } await page.waitForTimeout(1400); const jam = await dev(page, 'sound'); check('18:40 takes it back to the dead junction', jam.mood === 'dusk' && jam.city === 'dead', JSON.stringify({ shot: (await dev(page, 'cinema'))?.shot, mood: jam.mood, city: jam.city }));
  await skip(page, 'intro'); await free(page); await page.waitForTimeout(500); const play = await dev(page, 'sound'); check('Signal Lost starts on an empty street in dusk', play.mood === 'dusk' && play.city === 'dead' && !play.crowd, JSON.stringify({ mood: play.mood, city: play.city, crowd: play.crowd }));
  // Danfo 247: everything but the ambience off, then near the bus and far from it.
  await dev(page, 'inspect'); await dev(page, 'god'); await dev(page, 'clearEnemies'); await dev(page, 'skip'); await page.waitForTimeout(400); const hissing = await dev(page, 'sound'); check('Danfo 247 hisses once it needs searching', hissing.deadRadio);
  for (const bus of ['music', 'effects', 'ui', 'dialogue']) await dev(page, 'mix', bus, 0); await dev(page, 'score', 'none');
  const high = async (x, z) => { await dev(page, 'teleport', x, z, Math.PI / 2); await page.waitForTimeout(1500); return page.evaluate(() => new Promise(done => { let sum = 0, n = 0; const id = setInterval(() => { sum += window.lastBusDev.probe().high; n++; if (n === 30) { clearInterval(id); done(Math.round(sum / n)); } }, 60); })); };
  const near = await high(-14, -5), far = await high(-14, -26); check('the hiss is heard beside the bus and not down the road', near > far + 6, `${near} dB beside it, ${far} dB 20 m away`); await page.close();
}
// The setting, through the real dialog, and that it survives a reload.
{
  const page = await fresh(); const toggled = await page.evaluate(() => { document.querySelector('[data-screen="settings"]').click(); document.querySelector('[data-tab="Audio"]').click(); const el = document.querySelector('.switch[data-key="licensedMusic"]'); const label = el.closest('.setting').textContent; el.click(); return { label, on: el.getAttribute('aria-checked') }; });
  await page.waitForTimeout(200); await page.screenshot({ path: 'artifacts/settings-audio.png' }); await page.reload(); await page.waitForTimeout(2500); const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('lastbus-preferences-v2')).licensedMusic);
  check('Licensed music is in Audio settings, switches off and is remembered', toggled.on === 'false' && saved === false, toggled.label); await page.evaluate(() => { const p = JSON.parse(localStorage.getItem('lastbus-preferences-v2')); p.licensedMusic = true; localStorage.setItem('lastbus-preferences-v2', JSON.stringify(p)); }); await page.close();
}
// What the placeholder costs on a slowed-down main thread, a bar at a time as the game makes it. A bar longer than a frame or two would be a visible stall.
{
  const page = await fresh(), cdp = await context.newCDPSession(page); await cdp.send('Emulation.setCPUThrottlingRate', { rate: 6 });
  const cost = await page.evaluate(async () => { const m = await import('/src/soundtrack.ts'), t = performance.now(); m.renderPlaceholder(); return Math.round(performance.now() - t); }); await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
  check('the placeholder renders quickly at 6x CPU slowdown', cost < 2500, `${cost} ms in all, about ${Math.round(cost / 20)} ms a bar`); await page.close();
}
console.log(errors.length ? `ERRORS:\n${[...new Set(errors)].slice(0, 10).join('\n')}` : 'no page errors');
console.log(failed ? `${failed} FAILED` : 'all passed');
await browser.close();
