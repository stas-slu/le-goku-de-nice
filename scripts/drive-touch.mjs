// Mobile emulation check: phone viewport, touch, tap to start, hold the stick, tap A.
import puppeteer from 'puppeteer-core';
import { mkdirSync, rmSync } from 'node:fs';
const [url, outDir] = process.argv.slice(2);
mkdirSync(outDir, { recursive: true });
rmSync(`${outDir}/.profile`, { recursive: true, force: true });
const browser = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: 'new', userDataDir: `${outDir}/.profile`, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage();
await page.emulate({ viewport: { width: 844, height: 390, deviceScaleFactor: 2, isMobile: true, hasTouch: true, isLandscape: true }, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1' });
const logs = [];
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));
page.on('console', (m) => m.type() === 'error' && logs.push(m.text()));
await page.goto(url, { waitUntil: 'load' });
await new Promise((r) => setTimeout(r, 3000));
await page.screenshot({ path: `${outDir}/touch0.png` });
const box = await page.evaluate(() => { const r = document.querySelector('canvas').getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; });
const g = (gx, gy) => ({ x: box.x + (gx / 384) * box.w, y: box.y + (gy / 216) * box.h });
// hold the virtual stick to the left for a while, and tap attack
const cdp = await page.createCDPSession();
const touch = async (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map((p, i) => ({ x: p.x, y: p.y, id: i })) });
const s0 = g(80, 150), s1 = g(50, 150), a = g(384 - 30, 216 - 28);
await touch('touchStart', [s0]);
await new Promise((r) => setTimeout(r, 100));
await touch('touchMove', [s1]);
await new Promise((r) => setTimeout(r, 700));
const x1 = await page.evaluate(() => window.__game.scene.getScene('stage').world.hero.x);
await touch('touchMove', [s1, a]);
await new Promise((r) => setTimeout(r, 120));
await page.screenshot({ path: `${outDir}/touch1.png` });
const st = await page.evaluate(() => window.__game.scene.getScene('stage').world.hero.state + ':' + window.__game.scene.getScene('stage').world.hero.moveId);
await touch('touchEnd', []);
console.log('hero x after stick-left:', x1, 'state after A:', st);
console.log(logs.join('\n') || '(no errors)');
await browser.close();
