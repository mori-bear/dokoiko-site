#!/usr/bin/env node
/**
 * captureKyushuFukko.mjs — 九州ふっこう特設ページと新規destinationページを
 * モバイル実機相当(390x844 / 2x)で撮る。dist を静的配信してローカルで確認する。
 * 画像の読み込み完了と横スクロール発生の有無もあわせて出す。
 */
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.join(process.cwd(), 'dist');
const OUTDIR = path.join(process.cwd(), 'logs', 'shots');
const PORT = 4399;

const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript',
  '.json': 'application/json', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
  '.svg': 'image/svg+xml', '.webp': 'image/webp', '.xml': 'application/xml', '.ico': 'image/x-icon' };

const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  let f = path.join(ROOT, p);
  if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, 'index.html');
  if (!fs.existsSync(f)) { res.writeHead(404); res.end('404'); return; }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
});
await new Promise((r) => server.listen(PORT, r));

fs.mkdirSync(OUTDIR, { recursive: true });
const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: 390, height: 844 }, deviceScaleFactor: 2,
  isMobile: true, hasTouch: true, locale: 'ja-JP',
});
const page = await ctx.newPage();

const TARGETS = [
  ['kyushu-fukko-top', '/kyushu-fukko/', false],
  ['kyushu-fukko-full', '/kyushu-fukko/', true],
  ['dest-kannojigoku', '/destinations/kannojigoku/', false],
  ['dest-yunotsuru', '/destinations/yunotsuru-onsen/', false],
];

for (const [name, url, full] of TARGETS) {
  const resp = await page.goto(`http://localhost:${PORT}${url}`, { waitUntil: 'networkidle' });
  // loading="lazy" の画像は画面外だと naturalWidth=0 のままなので、
  // 一度最下部までスクロールして実際に読み込ませてから判定する（欠損の誤検出を避ける）
  await page.evaluate(async () => {
    await new Promise((done) => {
      let y = 0;
      const step = () => {
        y += window.innerHeight;
        window.scrollTo(0, y);
        if (y < document.body.scrollHeight) setTimeout(step, 120);
        else { window.scrollTo(0, 0); setTimeout(done, 400); }
      };
      step();
    });
  });
  await page.waitForLoadState('networkidle');
  // 画像が全部読めたか
  const imgs = await page.evaluate(() => {
    const list = [...document.images];
    return { total: list.length, broken: list.filter((i) => !i.complete || i.naturalWidth === 0).map((i) => i.currentSrc || i.src) };
  });
  // 横スクロールが出ていないか（テンプレの約束事）
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  const out = path.join(OUTDIR, `${name}.png`);
  await page.screenshot({ path: out, fullPage: full });
  console.log(`${resp.status()} ${url.padEnd(34)} 画像${imgs.total}枚 欠損${imgs.broken.length} 横スクロール${overflow ? '❌あり' : 'なし'} → ${path.relative(process.cwd(), out)}`);
  for (const b of imgs.broken.slice(0, 5)) console.log(`    欠損: ${b}`);
}

await browser.close();
server.close();
