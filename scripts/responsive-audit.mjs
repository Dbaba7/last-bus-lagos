// Responsive audit: renders every screen at common device sizes, saves screenshots to
// artifacts/responsive and reports elements that leave the viewport, overlap each other
// or make the page scroll sideways. Requires `npm run dev` (uses dev-only hooks for in-game states).
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
const url = process.env.GAME_URL ?? 'http://localhost:5173';
const only = process.env.ONLY?.split(',');
const out = 'artifacts/responsive'; mkdirSync(out, { recursive: true });
const DEVICES = [
  { name: 'phone-portrait', width: 390, height: 844, touch: true },
  { name: 'phone-landscape', width: 844, height: 390, touch: true },
  { name: 'small-phone-landscape', width: 667, height: 375, touch: true },
  { name: 'tablet-portrait', width: 820, height: 1180, touch: true },
  { name: 'tablet-landscape', width: 1180, height: 820, touch: true },
  { name: 'laptop-1280x720', width: 1280, height: 720 },
  { name: 'laptop-1366x768', width: 1366, height: 768 },
  { name: 'desktop-1920x1080', width: 1920, height: 1080 },
  { name: 'ultrawide-3440x1440', width: 3440, height: 1440 },
  { name: '4k-3840x2160', width: 3840, height: 2160 }
].filter(d => !only || only.includes(d.name));
// Checks run in the page: off-screen or clipped visible elements, sideways scroll and HUD overlaps.
const inspect = () => {
  const vw = innerWidth, vh = innerHeight, issues = [];
  if (document.documentElement.scrollWidth > vw + 1) issues.push(`page scrolls sideways (${document.documentElement.scrollWidth}px)`);
  const visible = el => { const s = getComputedStyle(el); if (s.display === 'none' || s.visibility === 'hidden' || +s.opacity === 0) return false; const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && !el.closest('[hidden]'); };
  const label = el => `${el.tagName.toLowerCase()}${el.id ? '#' + el.id : ''}${el.className && typeof el.className === 'string' ? '.' + el.className.split(' ')[0] : ''}`;
  for (const el of document.querySelectorAll('#app button, #app h1, #app h2, #app .nav-item, #app .card, #app .dialog, #app .settings, #app .briefing, #hud .objective, #hud .vitals, #hud .weapon, #hud .scorebar, #hud .compass, #app .feature, #app .topbar, #app .logo, #app input, #app select, #app .phone, #app .card-text, #app .card-sub')) {
    if (!visible(el) || el.closest('.page, .tab-body, .dialog, .briefing, .modal') && el.closest('.page, .tab-body, .dialog, .briefing, .modal') !== el && getComputedStyle(el.closest('.page, .tab-body, .dialog, .briefing, .modal')).overflowY !== 'visible') {
      // Elements inside a scrolling container may legitimately extend below its fold; only check horizontal fit.
      if (!visible(el)) continue; const r = el.getBoundingClientRect(); if (r.left < -1 || r.right > vw + 1) issues.push(`${label(el)} spills sideways (${Math.round(r.left)}→${Math.round(r.right)} of ${vw})`); continue;
    }
    const r = el.getBoundingClientRect();
    if (r.left < -1 || r.right > vw + 1 || r.top < -1 || r.bottom > vh + 1) issues.push(`${label(el)} outside viewport (${Math.round(r.left)},${Math.round(r.top)} ${Math.round(r.width)}×${Math.round(r.height)})`);
    if (el.scrollWidth > el.clientWidth + 2 && getComputedStyle(el).overflowX === 'visible' && el.tagName !== 'INPUT' && el.tagName !== 'SELECT') issues.push(`${label(el)} text overflows its box`);
  }
  if (getComputedStyle(document.getElementById('rotate')).display !== 'none') return [...new Set(issues)].filter(i => !i.startsWith('overlap'));
  const hud = [...document.querySelectorAll('#hud .objective, #hud .vitals, #hud .weapon, #hud .scorebar, #hud .compass, #hud .kill-feed, #hud .subtitle, #hud .location, #hud #net-label, #touch-controls button, #touch-move')].filter(visible).map(el => [label(el), el.getBoundingClientRect()]);
  for (let i = 0; i < hud.length; i++) for (let j = i + 1; j < hud.length; j++) { const [a, ra] = hud[i], [b, rb] = hud[j]; const x = Math.min(ra.right, rb.right) - Math.max(ra.left, rb.left), y = Math.min(ra.bottom, rb.bottom) - Math.max(ra.top, rb.top); if (x > 4 && y > 4) issues.push(`overlap: ${a} × ${b}`); }
  return [...new Set(issues)];
};
const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE, headless: true, args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] });
const report = {};
for (const d of DEVICES) {
  const context = await browser.newContext({ viewport: { width: d.width, height: d.height }, hasTouch: !!d.touch, isMobile: !!d.touch, deviceScaleFactor: 1 });
  const page = await context.newPage(); const errors = []; page.on('pageerror', e => errors.push(String(e)));
  const results = report[d.name] = { errors };
  const step = async (name, action) => {
    try { await action(); await page.waitForTimeout(450); results[name] = await page.evaluate(inspect); await page.screenshot({ path: `${out}/${d.name}--${name}.png` }); }
    catch (e) { results[name] = [`could not reach: ${String(e).split('\n')[0]}`]; }
  };
  const click = sel => page.evaluate(s => document.querySelector(s).click(), sel);
  await page.goto(url); await page.waitForTimeout(3500);
  await step('menu', async () => {});
  await step('story', () => click('#nav-story'));
  await step('briefing', async () => { await click('[data-m="signal-lost"]'); await click('#story-start'); });
  await step('multiplayer', async () => { await click('#brief-cancel'); await click('#screen-story [data-back]'); await click('#nav-multiplayer'); });
  await step('lobby', async () => { await click('#create'); await page.waitForFunction(() => !document.getElementById('lobby').hidden, null, { timeout: 8000 }); });
  await step('training', async () => { await click('#leave-lobby'); await page.waitForTimeout(500); await click('#screen-multiplayer [data-back]'); await click('#nav-training'); });
  await step('settings', async () => { await click('#screen-training [data-back]'); await click('#nav-settings'); });
  await step('settings-video', () => click('[data-tab=Video]'));
  await step('cutscene', async () => {
    await click('#settings-close'); await click('#nav-story'); await click('[data-m="signal-lost"]'); await click('#story-start');
    await page.evaluate(() => { window.lastBusDev.inspect(); window.lastBusDev.god(); }); await click('#brief-start');
    await page.waitForFunction(() => !document.getElementById('cinema').hidden, null, { timeout: 15000 }); await page.waitForTimeout(800);
  });
  await step('hud', async () => {
    // Ada's opening and then the intro: skip every scene in the queue.
    for (let i = 0; i < 4 && await page.evaluate(() => !document.getElementById('cinema').hidden); i++) { await page.keyboard.press('Enter'); await page.waitForTimeout(350); }
    await page.evaluate(() => { window.lastBusDev.inspect(); window.lastBusDev.teleport(0, -3, 0); }); await page.waitForTimeout(400);
    await page.evaluate(() => window.lastBusDev.skip()); await page.evaluate(() => { window.lastBusDev.teleport(-31.7, 5, 0); window.lastBusDev.look(0, 0.02); }); await page.waitForTimeout(1500);
  });
  await step('pause', async () => { await page.evaluate(() => window.lastBusDev.inspect(false)); await page.evaluate(() => { document.getElementById('pause').hidden = false; }); });
  await step('mission-end', async () => { await page.evaluate(() => { document.getElementById('pause').hidden = true; window.lastBusDev.god(false); window.lastBusDev.inspect(true); }); await page.evaluate(() => { for (const a of window.lastBusDiagnostics().agents ?? []) void a; }); await page.evaluate(() => window.lastBusDev.kill?.()); await page.waitForFunction(() => !document.getElementById('mission-end').hidden, null, { timeout: 20000 }); });
  // Story overlays added for the chapter endings and Chapter 2: the phone message and a title card.
  await step('phone', async () => { await page.evaluate(() => { document.getElementById('mission-end').hidden = true; document.getElementById('phone-from').textContent = 'Unknown number'; document.getElementById('phone-time').textContent = '02:09'; document.getElementById('phone-body').innerHTML = '<p>6.4974° N, 3.4016° E</p><p>Third Mainland Bridge</p><p class="alarm">THE WITNESS LIST IS NOT COMPLETE.</p>'; document.getElementById('phone').hidden = false; }); });
  await step('chapter-card', async () => { await page.evaluate(() => { document.getElementById('phone').hidden = true; const el = document.getElementById('chapter-card'); el.hidden = false; el.className = 'chapter-card time in'; el.innerHTML = '<div class="card-text">02:17 AM.</div><div class="card-sub">Three hours and twenty-five minutes later.</div><div class="card-hint">Click to continue</div>'; }); });
  await context.close();
  const count = Object.entries(results).filter(([k]) => k !== 'errors').reduce((n, [, v]) => n + v.length, 0);
  console.log(`${d.name}: ${count} issue(s)${errors.length ? `, ${errors.length} page error(s)` : ''}`);
}
await browser.close();
writeFileSync(`${out}/report.json`, JSON.stringify(report, null, 2));
for (const [device, screens] of Object.entries(report)) for (const [screen, issues] of Object.entries(screens)) if (issues.length) console.log(`  ${device} / ${screen}:\n    ${issues.slice(0, 12).join('\n    ')}`);
