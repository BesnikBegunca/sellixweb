import puppeteer from 'puppeteer-core';
// node posters.mjs <outDir> [list]
const out = process.argv[2];
const list = (process.argv[3] || '1,2,3,4,5,6,7,8,9,10').split(',').map(Number);
const browser = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const page = await browser.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.setViewport({ width: 1080, height: 1920, deviceScaleFactor: 1 });
for (const n of list) {
  await page.goto(`http://localhost:5173/posters.html?p=${n}`, { waitUntil: 'networkidle0' });
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate(() => Promise.all([...document.images].map((i) => (i.complete ? 0 : new Promise((r) => { i.onload = i.onerror = r; })))));
  await new Promise((r) => setTimeout(r, 400));
  await page.screenshot({ path: `${out}/SelliX-reklama-${String(n).padStart(2, '0')}.png`, clip: { x: 0, y: 0, width: 1080, height: 1920 } });
}
console.log('errors', errors);
await browser.close();
