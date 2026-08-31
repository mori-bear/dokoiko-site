#!/usr/bin/env node
/**
 * captureKyushuSections.mjs — 特設ページのセクション単位で読める倍率のスクショを撮る。
 * 全ページ縦長だと文字が潰れて目視確認にならないため、セクション要素をクリップする。
 */
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.join(process.cwd(), 'dist');
const OUTDIR = path.join(process.cwd(), 'logs', 'shots');
const PORT = 4400;
const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript',
  '.jpg': 'image/jpeg', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json' };

const server = http.createServer((req, res) => {
  let f = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
  if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, 'index.html');
  if (!fs.existsSync(f)) { res.writeHead(404); res.end('404'); return; }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
});
await new Promise((r) => server.listen(PORT, r));

fs.mkdirSync(OUTDIR, { recursive: true });
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 900 }, deviceScaleFactor: 2, isMobile: true, locale: 'ja-JP' });
const page = await ctx.newPage();
await page.goto(`http://localhost:${PORT}/kyushu-fukko/`, { waitUntil: 'networkidle' });
await page.evaluate(async () => {
  await new Promise((done) => { let y = 0; const s = () => { y += innerHeight; scrollTo(0, y);
    if (y < document.body.scrollHeight) setTimeout(s, 100); else { scrollTo(0, 0); setTimeout(done, 400); } }; s(); });
});
await page.waitForLoadState('networkidle');

const secs = await page.$$('.kf-section');
const names = ['feature', 'byPref', 'stays', 'more'];
for (let i = 0; i < secs.length; i++) {
  const out = path.join(OUTDIR, `kf-sec-${names[i] ?? i}.png`);
  await secs[i].screenshot({ path: out });
  console.log(`→ ${path.relative(process.cwd(), out)}`);
}
await browser.close();
server.close();
