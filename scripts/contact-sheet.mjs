// Development: node scripts/contact-sheet.mjs out.png cols width img1 img2 ... builds a labelled contact sheet of screenshots.
import { pathToFileURL } from 'node:url'; import { resolve, basename } from 'node:path';
import { chromium } from 'playwright';
const [out, cols, width, ...imgs] = process.argv.slice(2); const w = Number(width), c = Number(cols);
const html = `<body style="margin:0;background:#111;display:grid;grid-template-columns:repeat(${c},${w}px);gap:4px;font:12px sans-serif;color:#fff">${imgs.map(i => `<div><img src="${pathToFileURL(resolve(i))}" style="width:${w}px;display:block"><div>${basename(i)}</div></div>`).join('')}</body>`;
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' }); const p = await b.newPage({ viewport: { width: c * (w + 4), height: 400 } });
const { writeFileSync } = await import('node:fs'); writeFileSync(out + '.html', html); await p.goto(pathToFileURL(resolve(out + '.html')).href); await p.waitForTimeout(300); await p.screenshot({ path: out, fullPage: true }); await b.close();
