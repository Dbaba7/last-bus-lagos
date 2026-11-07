import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { Client } from '@colyseus/sdk';
import { VERSION } from '@lastbus/shared';
import { Peer, laneController } from '../helpers/peer.js';
import { testServer, until, sleep } from '../helpers/server.js';
const server = await testServer(2576, { TEST_MATCH_SECONDS: '45', TEST_RESULTS_SECONDS: '3', ALLOWED_ORIGINS: 'http://127.0.0.1:2576' });
const browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || undefined, args: ['--enable-unsafe-swiftshader'] });
const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } }), page = await context.newPage();
const peers: Peer[] = [], errors: string[] = [], assertions: string[] = [];
page.on('pageerror', error => errors.push(error.message)); page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
try {
  await page.goto(server.endpoint); await page.locator('#loading').waitFor({ state: 'hidden' }); await page.locator('#nav-multiplayer').click(); await page.locator('#create').click();
  await page.waitForFunction(() => (document.querySelector('#invite-link') as HTMLInputElement).value.length > 0);
  const invite = await page.locator('#invite-link').inputValue();
  const token = new URLSearchParams(new URL(invite).hash.slice(1)).get('room')!;
  const lookup = await fetch(`${server.endpoint}/api/invite`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token }) });
  const { roomId } = await lookup.json() as { roomId: string };
  const guest = new Peer(await new Client(server.endpoint).joinById(roomId, { version: VERSION, name: 'Test opponent', invite: token })); peers.push(guest); guest.ready();
  const friendContext = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const friend = await friendContext.newPage();
  friend.on('pageerror', error => errors.push(error.message)); friend.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await friend.goto(invite); await friend.locator('#loading').waitFor({ state: 'hidden' });
  await friend.locator('#nickname').fill('Browser teammate'); await friend.locator('#join-form button[type=submit]').click();
  await until(() => guest.state.players.length === 3 && guest.state.players.every(p => p.ready)); await page.locator('#start-match').click(); await until(() => guest.state.phase === 'ACTIVE');
  await friend.waitForFunction(() => (window as unknown as { lastBusDiagnostics(): { phase: string } }).lastBusDiagnostics().phase === 'ACTIVE');
  await page.locator('#resume').click(); await page.waitForFunction(() => !!document.pointerLockElement);
  const own = () => guest.state.players.find(p => p.id !== guest.id)!;
  const route = laneController(6); guest.control(p => route(p));
  async function move(axis: 'x' | 'z', goal: number) {
    for (let attempt = 0; attempt < 15; attempt++) {
      const delta = goal - own()[axis]; if (Math.abs(delta) < 0.2) return;
      const key = axis === 'x' ? delta > 0 ? 'd' : 'a' : delta > 0 ? 'w' : 's';
      await page.keyboard.down(key); await sleep(Math.max(40, Math.min(2000, Math.abs(delta) / 5 * 1000 - 180))); await page.keyboard.up(key); await sleep(300);
    }
    throw new Error(`Browser could not reach ${axis}=${goal}`);
  }
  await move('x', 7); await move('z', -6); await until(() => Math.abs(guest.player!.z - 6) < 0.5);
  guest.control(() => ({}));
  // Dispatches a mouse movement through the real DOM input handler; no game-state hook.
  const yaw = Math.atan2(guest.player!.x - own().x, guest.player!.z - own().z);
  await page.evaluate(movement => document.dispatchEvent(new MouseEvent('mousemove', { movementX: movement, movementY: 35, bubbles: true })), yaw / 0.002);
  await page.mouse.down(); await until(() => guest.player!.health === 0, 5000, 'browser-fired elimination'); await page.mouse.up();
  await page.waitForFunction(() => document.querySelector('#score0')!.textContent === '1'); assertions.push('production client: keyboard navigation, mouse aim and server-confirmed elimination reflected in HUD');
  const life = guest.player!.life; await until(() => guest.player!.life > life && guest.player!.health === 100, 5000, 'opponent respawn'); assertions.push('online opponent respawn');
  for (let i = 0; i < 5; i++) { const peer = await Peer.join(server.endpoint, guest, `Load player ${i}`); peers.push(peer); peer.ready(); peer.control(p => ({ yaw: p.team === 0 ? 0 : Math.PI, z: 0.5 })); }
  await until(() => guest.state.players.length === 8); await sleep(8000);
  await mkdir('artifacts', { recursive: true }); await page.screenshot({ path: 'artifacts/eight-player.png' });
  const diagnostics = await page.evaluate('window.lastBusDiagnostics()') as { players: number }; assert.equal(diagnostics.players, 8); assertions.push('two independent browser contexts and six SDK connections share a live room');
  await page.keyboard.down('Tab'); await page.locator('#scoreboard').waitFor({ state: 'visible' }); await page.waitForFunction(() => document.querySelectorAll('#score-table tbody tr').length === 8); await page.keyboard.up('Tab');
  await until(() => guest.state.phase === 'RESULTS', 45000); await page.locator('#results').waitFor({ state: 'visible' });
  await page.waitForFunction(() => document.querySelector('#result-title')!.textContent!.includes('Police take') && document.querySelectorAll('#results-table tbody tr').length === 8); await page.screenshot({ path: 'artifacts/results.png' }); assertions.push('browser scoreboard and results show eight players and the correct winner');
  await friend.locator('#results').waitFor({ state: 'visible' });
  await friend.waitForFunction(() => document.querySelector('#result-title')!.textContent!.includes('Police take') && document.querySelectorAll('#results-table tbody tr').length === 8);
  await page.locator('#start-match').waitFor({ state: 'visible' }); await page.locator('#start-match').click(); await until(() => guest.state.phase === 'ACTIVE' && guest.state.round === 2);
  await page.waitForFunction(() => document.querySelector('#score0')!.textContent === '0'); assert.equal(await page.locator('#ammo').innerText(), '30'); assertions.push('browser rematch resets HUD and ammunition');
  await friend.waitForFunction(() => (window as unknown as { lastBusDiagnostics(): { phase: string } }).lastBusDiagnostics().phase === 'ACTIVE' && document.querySelector('#score0')!.textContent === '0');
  assert.equal(await friend.locator('#ammo').innerText(), '30');
  await friend.evaluate(() => document.exitPointerLock()); await friend.locator('#leave-game').click(); await friend.locator('#confirm-yes').click(); await friend.locator('#screen-multiplayer').waitFor({ state: 'visible' });
  assertions.push('second browser independently observes results, rematch and a usable return to menu');
  await page.evaluate(() => document.exitPointerLock()); await page.locator('#leave-game').click(); await page.locator('#confirm-yes').click(); await page.locator('#screen-multiplayer').waitFor({ state: 'visible' }); assert.deepEqual(errors, []);
  const report = { assertions, diagnostics, errors, note: 'Production client build served by the actual server; shortened server-test match timing. Headless Chromium automation, not a physical-display gaming benchmark.' };
  await writeFile('artifacts/browser-combat-report.json', JSON.stringify(report, null, 2)); console.log(JSON.stringify(report, null, 2));
} catch (error) { await page.screenshot({ path: 'artifacts/browser-combat-failure.png' }); console.error(error); console.error(errors); console.error(await page.locator('#status').innerText()); console.error(server.logs()); console.error(peers[0]?.state); process.exitCode = 1; }
finally { await browser.close(); for (const peer of peers) await peer.close(); await server.stop(); }
