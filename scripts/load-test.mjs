import { chromium } from 'playwright';
import { writeFile, mkdir, readdir, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import os from 'node:os';
const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || undefined, headless: true, args: ['--enable-unsafe-swiftshader'] });
const reports = [], errors = []; const url = process.env.GAME_URL || 'http://localhost:2580';
try {
  for (const mbps of [20, 5]) {
    const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } }), page = await context.newPage();
    page.on('pageerror', error => errors.push(error.message));
    const cdp = await context.newCDPSession(page); await cdp.send('Network.enable'); await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
    await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 80, downloadThroughput: mbps * 1_000_000 / 8, uploadThroughput: 1_000_000 / 8 });
    const start = performance.now(); await page.goto(url); await page.locator('#loading').waitFor({ state: 'hidden', timeout: 45000 });
    const playableSeconds = (performance.now() - start) / 1000;
    const state = await page.evaluate(() => {
      const gl = document.querySelector('#game').getContext('webgl2'), extension = gl?.getExtension('WEBGL_debug_renderer_info');
      return { renderer: extension ? gl.getParameter(extension.UNMASKED_RENDERER_WEBGL) : 'unavailable', transferBytes: performance.getEntriesByType('resource').reduce((sum, entry) => sum + entry.transferSize, 0) + performance.getEntriesByType('navigation')[0].transferSize, diagnostics: window.lastBusDiagnostics() };
    });
    reports.push({ downloadMbps: mbps, httpLatencyMs: 80, playableSeconds, ...state }); await context.close();
  }
  const hash = createHash('sha256'); let rawBytes = 0, gzipBytes = 0;
  for (const file of (await readdir('dist/client/assets')).sort()) { const data = await readFile(`dist/client/assets/${file}`); hash.update(file); hash.update(data); rawBytes += data.length; gzipBytes += gzipSync(data).length; }
  await mkdir('artifacts', { recursive: true });
  const report = { browser: browser.version(), cpu: os.cpus()[0].model, logicalCores: os.cpus().length, ramGiB: os.totalmem() / 2 ** 30, os: `${os.type()} ${os.release()}`, buildAssetHash: hash.digest('hex'), allAssetRawBytes: rawBytes, allAssetGzipBytes: gzipBytes, reports, errors, note: 'HTTP cold-load shaping only. WebSocket impairment is tested separately. Local Express serves uncompressed files; public compression is a deployment setting. No physical-display gaming benchmark.' };
  await writeFile('artifacts/load-report.json', JSON.stringify(report, null, 2)); console.log(JSON.stringify(report, null, 2));
  if (errors.length) process.exitCode = 1;
} finally { await browser.close(); }
