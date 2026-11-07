// Cold-load check for the first voice line: a fresh browser profile with the HTTP cache disabled and a
// slowed voice download opens the menu, starts Chapter 1 and reports which recorded lines started during
// each intro shot. Requires `npm run dev`. RUNS=n repeats it; DELAY=ms sets how late each recording arrives; THROTTLE=0 disables that.
import { chromium } from 'playwright';
const url = process.env.GAME_URL ?? 'http://localhost:5173', runs = Number(process.env.RUNS ?? 3), throttle = process.env.THROTTLE !== '0', delay = Number(process.env.DELAY ?? 900);
const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE, args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'], headless: true });
let failures = 0;
for (let run = 1; run <= runs; run++) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } }), page = await context.newPage();
  const cdp = await context.newCDPSession(page); await cdp.send('Network.enable'); await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
  // Each recording arrives late, as on a slow phone connection (the page itself loads at full speed).
  if (throttle) await page.route(/\/voice\/[^?]+$/, async route => { await new Promise(r => setTimeout(r, delay + Math.random() * delay)); await route.continue(); });
  // Every buffer that starts playing is logged with the cutscene shot and subtitle showing at that moment
  // (shot 0 speaks from the director's constructor, before the dev hook can see the scene).
  await page.addInitScript(() => {
    window.__voices = []; const start = AudioBufferSourceNode.prototype.start;
    AudioBufferSourceNode.prototype.start = function (...args) { const b = this.buffer; if (b && !this.loop && b.duration > 0.6 && b.numberOfChannels && b.duration !== 2 && b.duration !== 4) window.__voices.push({ d: +b.duration.toFixed(2), shot: window.lastBusDev?.cinema()?.shot ?? 0, line: document.getElementById('cinema-line')?.textContent.slice(0, 12), at: Math.round(performance.now()) }); return start.apply(this, args); };
  });
  const t0 = Date.now(); await page.goto(url, { timeout: 120000 }); await page.waitForFunction(() => !!window.lastBusDev, null, { timeout: 60000 });
  await page.waitForTimeout(1500); await page.click('#nav-story'); await page.waitForTimeout(300); await page.click('[data-m="signal-lost"]'); await page.waitForTimeout(150); await page.click('#story-start'); await page.waitForTimeout(300);
  const clicked = Date.now(); await page.click('#brief-start'); await page.waitForTimeout(400);
  const loading = await page.evaluate(() => document.getElementById('loading').hidden ? '(hidden)' : document.getElementById('loading-text').textContent);
  await page.waitForFunction(() => !document.getElementById('cinema').hidden, null, { timeout: 60000 }); const shown = Date.now();
  await page.keyboard.press('Enter'); // Ada's opening plays first; i1 is the first line of the intro after it.
  await page.waitForTimeout(4000); const firstShot = await page.evaluate(() => window.__voices.filter(v => v.shot === 0 && v.line?.startsWith('CONTROLEigh')));
  const text = await page.evaluate(() => document.getElementById('cinema-line').textContent);
  console.log(`run ${run}: page→begin ${((clicked - t0) / 1000).toFixed(1)}s, begin→scene ${((shown - clicked) / 1000).toFixed(1)}s, shot 1 voices ${JSON.stringify(firstShot)}, subtitle "${text.slice(0, 40)}", loading screen said "${loading}"`);
  if (!firstShot.length) failures++;
  await context.close();
}
await browser.close(); console.log(failures ? `FAIL: i1 silent in ${failures}/${runs} runs` : `OK: i1 heard in all ${runs} runs`); process.exit(failures ? 1 : 0);
