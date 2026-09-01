#!/usr/bin/env node
/**
 * captureAccessBlock.mjs — 幌加温泉のアクセス欄を、みどりの窓口になる出発地
 * （札幌＝北海道↔本州で複数社またぎ）を選んだ状態で撮り、
 * 乗換案内ボタンが実際に押せる形で出ているか目視できるようにする。
 */
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.join(process.cwd(), 'dist');
const PORT = 4405;
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
const ctx = await browser.newContext({ viewport: { width: 390, height: 900 }, deviceScaleFactor: 2, isMobile: true, locale: 'ja-JP' });
const page = await ctx.newPage();

for (const [id, city] of [['horoka', '大阪'], ['nigorigo', '東京']]) {
  await page.goto(`http://localhost:${PORT}/destinations/${id}/`, { waitUntil: 'networkidle' });
  await page.selectOption('#departure-select', city).catch(() => {});
  await page.waitForTimeout(500);
  const block = await page.$(`.travel-time-block[data-city="${city}"]`);
  if (!block) { console.log(`⚠️ ${id}: ${city}のブロックが見つからない`); continue; }
  const info = await block.evaluate((el) => ({
    navitime: !!el.querySelector('.booking-btn-navitime'),
    midori: !!el.querySelector('.midori-note'),
    jr: el.querySelector('.booking-btn-jr .booking-btn-label')?.textContent?.trim() ?? null,
    buttons: [...el.querySelectorAll('a.booking-btn')].map((a) => a.querySelector('.booking-btn-label')?.textContent?.trim()),
  }));
  const out = `logs/shots/access-${id}-${city}.png`;
  await block.screenshot({ path: out });
  console.log(`${info.navitime ? '✅' : '❌'} ${id} / ${city}発  乗換ボタン=${info.navitime ? 'あり' : 'なし'} みどり案内=${info.midori ? 'あり' : 'なし'} JR=${info.jr ?? '—'}`);
  console.log(`     押せるボタン: ${info.buttons.filter(Boolean).join(' / ')}`);
}
await browser.close();
server.close();
