#!/usr/bin/env node
/**
 * playwrightImageReview.mjs
 * iPhone 17 Pro 視点で全destinationのヒーロー画像を検査
 * 検出:
 *   - 画像ロード失敗 (naturalWidth=0)
 *   - 画像ファイルmd5重複 (3件以上同じファイル)
 *   - 単色判定 (canvas pixel sample で標準偏差<10)
 * 並列8
 */
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEST_FILE = path.join(__dirname, '../src/data/destinations.json');
const IMG_DIR = path.join(__dirname, '../public/images');
const REVIEW_DIR = '/tmp/review_img';
const SHOT_DIR = path.join(REVIEW_DIR, 'issues');
fs.mkdirSync(SHOT_DIR, { recursive: true });

const dests = JSON.parse(fs.readFileSync(DEST_FILE, 'utf-8'));

// 事前: 全destination main.jpg のmd5を計算
console.log('📋 md5計算中...');
const md5Map = {};  // md5 → [destId, ...]
for (const x of dests) {
  const p = path.join(IMG_DIR, x.id, 'main.jpg');
  if (!fs.existsSync(p)) continue;
  const h = crypto.createHash('md5').update(fs.readFileSync(p)).digest('hex');
  (md5Map[h] = md5Map[h] || []).push(x.id);
}
const dupIds = new Set();
for (const [h, ids] of Object.entries(md5Map)) {
  if (ids.length >= 3) for (const id of ids) dupIds.add(id);
}
console.log(`md5重複(3+): ${dupIds.size}件`);

const BASE = 'http://localhost:4323';
const issues = [];

async function worker(browser, queue) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, userAgent: 'Mozilla/5.0 (iPhone)' });
  const page = await ctx.newPage();
  while (queue.length) {
    const id = queue.shift();
    if (!id) break;
    const issue = { id, flags: [] };
    try {
      const url = `${BASE}/destinations/${encodeURIComponent(id)}/`;
      const resp = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });
      if (!resp || resp.status() !== 200) {
        issue.flags.push(`HTTP_${resp?.status() || 'NA'}`);
        issues.push(issue);
        continue;
      }
      const heroExists = await page.locator('.dest-hero-img').count();
      if (heroExists === 0) { issue.flags.push('NO_HERO'); issues.push(issue); continue; }

      // naturalWidth確認
      await page.locator('.dest-hero-img').first().scrollIntoViewIfNeeded().catch(()=>{});
      const nw = await page.locator('.dest-hero-img').first().evaluate(el => el.naturalWidth).catch(() => 0);
      if (!nw) issue.flags.push('LOAD_FAIL');

      // md5重複
      if (dupIds.has(id)) issue.flags.push('MD5_DUP');

      // canvas pixel 標準偏差 (単色判定)
      const variance = await page.locator('.dest-hero-img').first().evaluate(img => {
        try {
          const c = document.createElement('canvas');
          c.width = 50; c.height = 50;
          c.getContext('2d').drawImage(img, 0, 0, 50, 50);
          const data = c.getContext('2d').getImageData(0, 0, 50, 50).data;
          let sum = 0, sumSq = 0, n = 0;
          for (let i = 0; i < data.length; i += 4) {
            const lum = (data[i] + data[i+1] + data[i+2]) / 3;
            sum += lum; sumSq += lum*lum; n++;
          }
          const mean = sum / n;
          return Math.sqrt(sumSq / n - mean * mean);
        } catch { return -1; }
      }).catch(() => -1);
      if (variance >= 0 && variance < 8) issue.flags.push(`MONO:${variance.toFixed(1)}`);

      if (issue.flags.length > 0) {
        issues.push(issue);
        await page.screenshot({ path: path.join(SHOT_DIR, `${id.replace(/[\/\\]/g, '_')}.png`), clip: { x:0, y:0, width:390, height:500 } }).catch(()=>{});
      }
    } catch (e) {
      issue.flags.push(`EX:${e.message.slice(0,40)}`);
      issues.push(issue);
    }
  }
  await ctx.close();
}

const browser = await chromium.launch();
const queue = dests.map(d => d.id);
console.log(`📋 検査: ${queue.length}件 (並列8)`);
const total = queue.length;
const reportInterval = setInterval(() => {
  console.log(`  ${total - queue.length}/${total} 処理 (issues=${issues.length})`);
}, 30000);
await Promise.all(Array.from({length:8}, () => worker(browser, queue)));
clearInterval(reportInterval);
await browser.close();

const counter = {};
for (const i of issues) for (const f of i.flags) {
  const k = f.split(':')[0];
  counter[k] = (counter[k] || 0) + 1;
}
console.log('\n=== 完了 ===');
console.log(`問題: ${issues.length}件`);
for (const [k, v] of Object.entries(counter).sort((a,b)=>b[1]-a[1])) console.log(`  ${k}: ${v}`);

fs.writeFileSync(path.join(REVIEW_DIR, 'issues.json'), JSON.stringify({ counter, issues }, null, 2));
console.log(`\n→ ${REVIEW_DIR}/issues.json`);
