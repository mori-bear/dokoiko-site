#!/usr/bin/env node
/**
 * buildBrandShareImage.mjs — X投稿用の固定シェア画像 brand_share.png を作る。
 *
 * サイズ 1200×675（16:9）。日付や一時的な情報は入れず、使い回せる形にする。
 *
 * 背景写真の選定について:
 *   掲載写真の多くは CC BY-SA（継承）で、ブランド画像の背景に使うと
 *   合成物まで同じライセンスで配布する義務が生じてしまう。
 *   そのため継承義務のない CC BY / パブリックドメインの中から選び、
 *   表示義務があるものは画像内にクレジットを焼き込む。
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const OUT_DIR = process.argv[2] || path.join(os.homedir(), 'Desktop', 'dokoiko_post');
const OUT = path.join(OUT_DIR, 'brand_share.png');

// 背景に使う写真（CC BY 2.1 JP＝表示のみ・継承義務なし）
const PHOTO = 'public/images/kuroyu/main.jpg';
const CREDIT = 'Photo: aki / CC BY 2.1 JP — 黒湯温泉（秋田県 乳頭温泉郷）';

const destinations = JSON.parse(fs.readFileSync('src/data/destinations.json', 'utf8'));
const count = destinations.length.toLocaleString();

if (!fs.existsSync(PHOTO)) { console.error(`背景写真がない: ${PHOTO}`); process.exit(1); }
const b64 = fs.readFileSync(PHOTO).toString('base64');
fs.mkdirSync(OUT_DIR, { recursive: true });

const html = `<!doctype html><html lang="ja"><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Noto+Serif+JP:wght@300;400&family=Noto+Sans+JP:wght@300;400;500&display=swap" rel="stylesheet">
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { width:1200px; height:675px; overflow:hidden; }
  .card { position:relative; width:1200px; height:675px; background:#1e4d38; overflow:hidden; }
  .bg { position:absolute; inset:0; width:100%; height:100%; object-fit:cover; }
  /* 緑をしっかり残しつつ写真が透ける濃度にする。中央は文字が乗るのでさらに落とす。 */
  .tint { position:absolute; inset:0; background:#1e4d38; opacity:0.72; }
  .vignette { position:absolute; inset:0;
    background: radial-gradient(ellipse at center, rgba(10,35,25,0.30) 0%, rgba(10,35,25,0.68) 72%, rgba(10,35,25,0.82) 100%); }
  .inner { position:absolute; inset:0; display:flex; flex-direction:column;
    align-items:center; justify-content:center; text-align:center; color:#fff; }
  .logo { font-family:'Noto Serif JP',serif; font-weight:300; font-size:118px;
    letter-spacing:0.10em; text-indent:0.10em; line-height:1.1;
    text-shadow:0 2px 24px rgba(0,0,0,0.45); }
  .logo-en { font-family:'Noto Sans JP',sans-serif; font-weight:300; font-size:17px;
    letter-spacing:0.52em; text-indent:0.52em; color:rgba(255,255,255,0.72); margin-top:16px; }
  .rule { width:76px; height:1px; background:#C9A84C; margin:30px 0 26px; }
  .sub { font-family:'Noto Serif JP',serif; font-weight:300; font-size:33px;
    letter-spacing:0.11em; text-indent:0.11em; color:rgba(255,255,255,0.94);
    text-shadow:0 2px 18px rgba(0,0,0,0.4); }
  .foot { position:absolute; left:0; right:0; bottom:38px;
    display:flex; align-items:flex-end; justify-content:space-between; padding:0 54px; }
  .count { font-family:'Noto Sans JP',sans-serif; font-size:17px; letter-spacing:0.10em;
    color:rgba(255,255,255,0.80); }
  .count b { font-weight:500; color:#C9A84C; font-size:20px; letter-spacing:0.06em; }
  .domain { font-family:'Noto Sans JP',sans-serif; font-size:17px; letter-spacing:0.16em;
    color:rgba(255,255,255,0.80); }
  .credit { position:absolute; left:54px; bottom:16px;
    font-family:'Noto Sans JP',sans-serif; font-size:10px; letter-spacing:0.05em;
    color:rgba(255,255,255,0.42); }
</style></head><body>
<div class="card">
  <img class="bg" src="data:image/jpeg;base64,${b64}">
  <div class="tint"></div>
  <div class="vignette"></div>
  <div class="inner">
    <div class="logo">どこ行こ？</div>
    <div class="logo-en">DOKOIKO</div>
    <div class="rule"></div>
    <div class="sub">まだ知らない街と、出会おう。</div>
  </div>
  <div class="foot">
    <div class="count">全国 <b>${count}</b> か所を掲載</div>
    <div class="domain">tabidokoiko.com</div>
  </div>
  <div class="credit">${CREDIT}</div>
</div></body></html>`;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 675 }, deviceScaleFactor: 1 });
await page.setContent(html, { waitUntil: 'networkidle' });
await page.evaluate(() => document.fonts.ready);
await page.waitForTimeout(600);
await page.screenshot({ path: OUT, type: 'png' });
await browser.close();

const st = fs.statSync(OUT);
console.log(`✅ ${OUT}`);
console.log(`   1200×675 / ${(st.size / 1024).toFixed(0)}KB`);
console.log(`   背景: ${PHOTO}（${CREDIT}）`);
console.log(`   掲載数: ${count}か所`);
