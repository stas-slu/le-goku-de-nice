// Headless browser driver for verification:
//   node scripts/drive.mjs <url> <outDir> '<json actions>'
// actions: {"wait":ms} {"key":"Enter"} {"down":"KeyJ"} {"up":"KeyJ"} {"shot":"name"} {"eval":"js expr"}
import puppeteer from 'puppeteer-core';
import { mkdirSync, rmSync } from 'node:fs';

const [url, outDir, json] = process.argv.slice(2);
const actions = JSON.parse(json ?? '[]');
mkdirSync(outDir, { recursive: true });
const profile = `${outDir}/.profile`;
rmSync(profile, { recursive: true, force: true });
const browser = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: 'new',
  userDataDir: profile,
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required', '--window-size=1152,648'],
  defaultViewport: { width: 1152, height: 648 },
});
const page = await browser.newPage();
const logs = [];
page.on('console', (m) => logs.push(`[${m.type()}] ${m.text()}`));
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}\n${e.stack ?? ''}`));
await page.goto(url, { waitUntil: 'load' });
for (const a of actions) {
  if (a.wait) await new Promise((r) => setTimeout(r, a.wait));
  if (a.key) await page.keyboard.press(a.key);
  if (a.down) await page.keyboard.down(a.down);
  if (a.up) await page.keyboard.up(a.up);
  if (a.shot) await page.screenshot({ path: `${outDir}/${a.shot}.png` });
  if (a.eval) console.log('eval:', JSON.stringify(await page.evaluate(a.eval)));
}
console.log(logs.filter((l) => !l.includes('Download the React')).join('\n') || '(no console output)');
await browser.close();
