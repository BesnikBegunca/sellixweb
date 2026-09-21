// Renders ad.html frame by frame and encodes an MP4.
//   node record.mjs <chrome.exe> <ffmpeg.exe> <music.wav> <out.mp4> [url]
// Needs the Vite dev server running (npm run dev in web/).
import puppeteer from 'puppeteer-core';
import { spawn } from 'node:child_process';

const [chrome, ffmpeg, music, out, url = 'http://localhost:5173/ad.html?record=1'] = process.argv.slice(2);
const FPS = 30;
const DURATION = 30;

const browser = await puppeteer.launch({ executablePath: chrome, headless: true });
const page = await browser.newPage();
await page.setViewport({ width: 1920, height: 1080, deviceScaleFactor: 1 });
await page.goto(url, { waitUntil: 'networkidle0' });
await page.waitForFunction(() => window.__ready);
await page.evaluate(() => document.fonts.ready);

const enc = spawn(ffmpeg, [
  '-y', '-loglevel', 'error',
  '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'png', '-i', '-',
  '-i', music,
  '-c:v', 'libx264', '-preset', 'slow', '-crf', '16', '-pix_fmt', 'yuv420p', '-movflags', '+faststart',
  '-c:a', 'aac', '-b:a', '192k', '-shortest',
  out,
], { stdio: ['pipe', 'inherit', 'inherit'] });

const total = FPS * DURATION;
for (let i = 0; i < total; i++) {
  await page.evaluate((v) => window.__seek(v), i / FPS);
  // Seeking once more lets layout effects (cursor targets, ring) settle.
  if (i === 0) await page.evaluate((v) => window.__seek(v), 0);
  const png = await page.screenshot({ type: 'png', optimizeForSpeed: true });
  if (!enc.stdin.write(png)) await new Promise((r) => enc.stdin.once('drain', r));
  if (i % 90 === 0) console.log(`frame ${i}/${total}`);
}
enc.stdin.end();
await new Promise((r) => enc.on('close', r));
await browser.close();
console.log('done', out);
