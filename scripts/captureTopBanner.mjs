#!/usr/bin/env node
/** captureTopBanner.mjs — トップページのヒーロー〜注目セクションを実機相当で撮る（バナー確認用）。 */
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.join(process.cwd(), 'dist');
const PORT = 4401;
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

fs.mkdirSync('logs/shots', { recursive: true });
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, locale: 'ja-JP' });
const page = await ctx.newPage();
await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'networkidle' });

const banner = await page.$('.kf-banner');
if (!banner) { console.log('❌ .kf-banner が見つからない'); }
else {
  await banner.screenshot({ path: 'logs/shots/top-kf-banner.png' });
  const box = await banner.boundingBox();
  const href = await banner.getAttribute('href');
  console.log(`✅ バナー描画 href=${href} 位置y=${Math.round(box.y)} 高さ=${Math.round(box.height)}px`);
}
await page.screenshot({ path: 'logs/shots/top-viewport.png' });
// ヒーロー直下に来ているか（スクロールなしで見えるか）
const visible = await page.evaluate(() => {
  const b = document.querySelector('.kf-banner');
  if (!b) return null;
  const r = b.getBoundingClientRect();
  return { topPx: Math.round(r.top + window.scrollY), inFirstScreen: r.top < window.innerHeight };
});
console.log(`   ページ先頭から${visible.topPx}px / 初期表示内=${visible.inFirstScreen ? 'はい' : 'いいえ（1スクロールで到達）'}`);
const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
console.log(`   横スクロール: ${overflow ? '❌あり' : 'なし'}`);
await browser.close();
server.close();
