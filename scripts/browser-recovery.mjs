import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';

const url = process.env.GAME_URL || 'http://localhost:5173';
const launch = { headless: true, executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || undefined };
const browser = await chromium.launch({ ...launch, args: ['--enable-unsafe-swiftshader'] });
const assertions = [], pageErrors = [];
await mkdir('artifacts', { recursive: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();
page.on('pageerror', error => pageErrors.push(error.message));
async function ready() {
  await page.waitForFunction(() => window.lastBusDiagnostics?.().ready);
  await page.locator('#loading').waitFor({ state: 'hidden' });
}
try {
  await page.goto(url); await ready();
  await page.locator('#settings-top').click();
  for (const [id, value] of [['sensitivity', '1.7'], ['volume', '0.2']]) {
    await page.locator(`#${id}`).evaluate((slider, value) => { slider.value = value; slider.dispatchEvent(new Event('input', { bubbles: true })); }, value);
  }
  await page.locator('#quality').selectOption('high');
  await page.reload(); await ready(); await page.locator('#settings-top').click();
  assert.equal(await page.locator('#sensitivity').inputValue(), '1.7');
  assert.equal(await page.locator('#volume').inputValue(), '0.2');
  assert.equal(await page.locator('#quality').inputValue(), 'high');
  await page.setViewportSize({ width: 1024, height: 768 });
  await page.waitForFunction(() => { const canvas = document.querySelector('#game'); return canvas.width === 1024 && canvas.height === 768; });
  await page.locator('#quality').selectOption('low');
  await page.waitForFunction(() => document.querySelector('#game').width === 640);
  await page.waitForFunction(() => window.lastBusDiagnostics().ready);
  assertions.push('sensitivity, volume and graphics persist; high/low presets and canvas resize render correctly');
  for (const invalid of ['{broken', 'null', '{"sensitivity":-99,"volume":8,"quality":"ultra"}']) {
    await page.evaluate(value => localStorage.setItem('lastbus-preferences', value), invalid);
    await page.reload(); await ready();
    assert.equal(await page.locator('#quality').inputValue(), 'medium');
    assert.equal(await page.locator('#sensitivity').inputValue(), invalid.startsWith('{"') ? '0.2' : '1');
    assert.equal(await page.locator('#volume').inputValue(), invalid.startsWith('{"') ? '1' : '0.45');
  }
  assertions.push('corrupt/null preferences recover and out-of-range values are clamped');

  await page.route('**/matchmake/**', route => route.abort('connectionrefused'));
  await page.locator('#play').click();
  await page.locator('#status.error.visible').waitFor(); await page.locator('#loading').waitFor({ state: 'hidden' });
  assert.equal(await page.locator('#menu').isVisible(), true);
  await page.unroute('**/matchmake/**');
  await page.locator('#play').click();
  await page.waitForFunction(() => window.lastBusDiagnostics().connected && window.lastBusDiagnostics().phase === 'WAITING');
  await page.locator('#leave-lobby').click(); await page.locator('#menu').waitFor({ state: 'visible' });
  assertions.push('unavailable matchmaking returns to usable menu; retry joins and leaves a real room');
  await page.locator('#join-open').click(); await page.locator('#room-code').fill('invalid-invitation');
  await page.locator('#join-form button[type=submit]').click();
  await page.waitForFunction(() => document.querySelector('#status').textContent.includes('invalid, expired'));
  await page.locator('#loading').waitFor({ state: 'hidden' });
  assert.equal(await page.locator('#menu').isVisible(), true);
  assertions.push('invalid invitation gives an error and leaves the menu usable');

  // Simulate the browser denying its first capture request, using the actual DOM API boundary.
  await page.evaluate(() => {
    const original = HTMLCanvasElement.prototype.requestPointerLock;
    HTMLCanvasElement.prototype.requestPointerLock = function (...args) {
      HTMLCanvasElement.prototype.requestPointerLock = original;
      return Promise.reject(new DOMException('Denied by browser', 'NotAllowedError'));
    };
  });
  await page.locator('#practice').click();
  await page.waitForFunction(() => document.querySelector('#status').textContent.includes('Mouse capture was denied'));
  await page.locator('#resume').click(); await page.waitForFunction(() => document.pointerLockElement !== null);
  await page.keyboard.down('w'); await page.mouse.down(); await page.waitForTimeout(300);
  await page.evaluate(() => document.exitPointerLock());
  await page.keyboard.up('w'); await page.mouse.up(); await page.locator('#pause').waitFor({ state: 'visible' });
  await page.waitForTimeout(500);
  const stopped = await page.evaluate(() => ({ self: window.lastBusDiagnostics().self, ammo: document.querySelector('#ammo').textContent }));
  await page.waitForTimeout(500);
  const later = await page.evaluate(() => ({ self: window.lastBusDiagnostics().self, ammo: document.querySelector('#ammo').textContent }));
  assert.ok(Math.hypot(stopped.self.x - later.self.x, stopped.self.z - later.self.z) < 0.01);
  assert.equal(stopped.ammo, later.ammo);
  await page.locator('#resume').click(); await page.waitForFunction(() => document.pointerLockElement !== null);
  await page.keyboard.down('w'); await page.mouse.down(); await page.waitForTimeout(200);
  await page.evaluate(() => window.dispatchEvent(new Event('blur')));
  await page.keyboard.up('w'); await page.mouse.up(); await page.waitForTimeout(500);
  const blurred = await page.evaluate(() => ({ self: window.lastBusDiagnostics().self, ammo: document.querySelector('#ammo').textContent }));
  await page.waitForTimeout(400);
  const afterBlur = await page.evaluate(() => ({ self: window.lastBusDiagnostics().self, ammo: document.querySelector('#ammo').textContent }));
  assert.ok(Math.hypot(blurred.self.x - afterBlur.self.x, blurred.self.z - afterBlur.self.z) < 0.01);
  assert.equal(blurred.ammo, afterBlur.ammo);
  await page.evaluate(() => document.exitPointerLock());
  await page.locator('#leave-game').click(); await page.locator('#menu').waitFor({ state: 'visible' });
  assertions.push('pointer-lock denial retries successfully; lost lock and focus clear held movement/fire');
  assert.deepEqual(pageErrors, []);
  await page.screenshot({ path: 'artifacts/recovery-menu.png' });
} catch (error) {
  await page.screenshot({ path: 'artifacts/recovery-failure.png' }); throw error;
} finally { await browser.close(); }

const unsupported = await chromium.launch({ ...launch, args: ['--disable-webgl'] });
const unsupportedErrors = [];
try {
  const page = await unsupported.newPage(); page.on('pageerror', error => unsupportedErrors.push(error.message));
  await page.goto(url); await page.locator('#status.error.visible').waitFor();
  assert.match(await page.locator('#status').innerText(), /Enable hardware acceleration/);
  assert.equal(await page.locator('#menu').isVisible(), false);
  await page.screenshot({ path: 'artifacts/unsupported-webgl.png' });
  assertions.push('Chromium with WebGL disabled displays actionable renderer guidance');
} finally { await unsupported.close(); }
const report = { verifiedAt: new Date().toISOString(), assertions, pageErrors, expectedUnsupportedRendererErrors: unsupportedErrors, note: 'Browser API failure injection and headless Chromium; not a physical-device or human listening test.' };
await writeFile('artifacts/browser-recovery-report.json', JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
