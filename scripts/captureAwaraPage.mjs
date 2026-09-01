#!/usr/bin/env node
/**
 * captureAwaraPage.mjs — あわら温泉ページの見た目を実寸で確かめる。
 * captureHitouPages はIDに日本語が入ると currentSrc(%エンコード済) と
 * 突き合わせられず画像を0枚と数えるので、ここではデコードして比べる。
 */
import { chromium } from 'playwright';
import fs from 'fs';
import http from 'http';
import path from 'path';
const PORT = 4337;
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p.endsWith('/')) p += 'index.html';
  const f = path.join('dist', p);
  if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
  const ext = path.extname(f);
  res.writeHead(200, { 'Content-Type': ext === '.html' ? 'text/html' : ext === '.jpg' ? 'image/jpeg' : 'application/octet-stream' });
  res.end(fs.readFileSync(f));
});
await new Promise((r) => server.listen(PORT, r));
const b = await chromium.launch();
const page = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
const ID = 'niche_福井_3';
const r = await page.goto(`http://localhost:${PORT}/destinations/${encodeURIComponent(ID)}/`, { waitUntil: 'networkidle' });
const own = await page.evaluate((pid) => {
  const list = [...document.images].filter((i) => decodeURIComponent(i.currentSrc || i.src).includes(`/images/${pid}/`));
  return { total: list.length, broken: list.filter((i) => !i.complete || i.naturalWidth === 0).length,
    srcs: list.map((i) => decodeURIComponent(i.currentSrc || i.src).split('/images/')[1]) };
}, ID);
console.log(`status=${r.status()} 自ページ画像${own.total}枚 欠損${own.broken}  ${own.srcs.join(', ')}`);
console.log(`title=${await page.title()}`);
fs.mkdirSync('logs/shots', { recursive: true });
await page.screenshot({ path: 'logs/shots/awara.png' });
await b.close(); server.close();
