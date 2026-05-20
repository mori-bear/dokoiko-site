#!/usr/bin/env node
/**
 * playwrightFullReview.mjs
 * 全destinationページをモバイルサイズ(390x844)で並列5件検査。
 * 検出: [object Object] / ヒーロー画像なし / desc<50字 / spots=0 / 上部300px白
 * 出力: /tmp/review/issues.json + /tmp/review/issues/*.png
 */
import { chromium, devices } from 'playwright';
import fs from 'fs';
import path from 'path';

const DEST_FILE = './src/data/destinations.json';
const BASE = 'http://localhost:4323';
const REVIEW_DIR = '/tmp/review';
const SHOT_DIR = path.join(REVIEW_DIR, 'issues');
fs.mkdirSync(SHOT_DIR, { recursive: true });

const destinations = JSON.parse(fs.readFileSync(DEST_FILE, 'utf-8'));
const ids = destinations.map(d => d.id);
console.log(`📋 検査対象: ${ids.length}件 (並列5)`);

const CONCURRENCY = 5;
const issues = [];

async function worker(browser, queue, workerId) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, userAgent: 'Mozilla/5.0 (iPhone)' });
  const page = await ctx.newPage();
  while (queue.length) {
    const id = queue.shift();
    if (!id) break;
    const url = `${BASE}/destinations/${encodeURIComponent(id)}/`;
    const issue = { id, url, flags: [] };
    try {
      const resp = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });
      if (!resp || resp.status() !== 200) {
        issue.flags.push(`HTTP_${resp?.status() || 'NA'}`);
        issues.push(issue);
        continue;
      }
      // 1. [object Object]
      const bodyText = await page.locator('main').innerText().catch(() => '');
      if (bodyText.includes('[object Object]')) issue.flags.push('OBJECT_OBJECT');
      // 2. ヒーロー画像 - dest-hero-img の src 解決済み
      const heroImg = page.locator('.dest-hero-img').first();
      const heroVisible = await heroImg.count() > 0;
      if (!heroVisible) {
        // 画像なしテンプレ = dest-header-noimg は正常 (画像なしdestinationの場合)
        const noimg = await page.locator('.dest-header-noimg').count();
        if (noimg === 0) issue.flags.push('NO_HERO');
      } else {
        const naturalWidth = await heroImg.evaluate(el => el.naturalWidth).catch(() => 0);
        if (!naturalWidth) issue.flags.push('HERO_BROKEN');
      }
      // 3. description<50字
      const descBlocks = await page.locator('.dest-description, p.description, [class*="dest-description"]').allInnerTexts().catch(() => []);
      const allParas = await page.locator('main p, .content p').allInnerTexts().catch(() => []);
      const longestText = [...descBlocks, ...allParas].reduce((m, t) => t.length > m.length ? t : m, '');
      if (longestText.length < 50) issue.flags.push(`DESC_SHORT_${longestText.length}`);
      // 4. spots=0
      const spotsCount = await page.locator('.spot-section').count();
      if (spotsCount === 0) issue.flags.push('SPOTS_ZERO');
      // 5. 上部300px白
      const topBlank = await page.evaluate(() => {
        const main = document.querySelector('main');
        if (!main) return true;
        const rect = main.getBoundingClientRect();
        // mainの最初の子要素が高さ300以上か(ヒーローあれば数百px)
        const firstChild = main.firstElementChild;
        if (!firstChild) return true;
        const childRect = firstChild.getBoundingClientRect();
        return childRect.height < 100;
      }).catch(() => false);
      if (topBlank) issue.flags.push('TOP_BLANK');

      if (issue.flags.length > 0) {
        issues.push(issue);
        // スクショ保存
        const safeId = id.replace(/[\/\\]/g, '_');
        await page.screenshot({ path: path.join(SHOT_DIR, `${safeId}.png`), fullPage: false }).catch(() => {});
      }
    } catch (e) {
      issue.flags.push(`EXCEPTION:${e.message.slice(0,40)}`);
      issues.push(issue);
    }
  }
  await ctx.close();
}

const browser = await chromium.launch();
const queue = [...ids];
let lastReport = Date.now();
const reportInterval = setInterval(() => {
  if (Date.now() - lastReport > 5000) {
    console.log(`  ${ids.length - queue.length}/${ids.length} 処理 (issues=${issues.length})`);
    lastReport = Date.now();
  }
}, 5000);

const workers = Array.from({ length: CONCURRENCY }, (_, i) => worker(browser, queue, i));
await Promise.all(workers);
clearInterval(reportInterval);
await browser.close();

// 集計
const counter = {};
for (const i of issues) {
  for (const f of i.flags) {
    const key = f.replace(/_\d+$/, '');
    counter[key] = (counter[key] || 0) + 1;
  }
}
console.log(`\n=== 完了 ===`);
console.log(`  全件: ${ids.length}`);
console.log(`  問題発見: ${issues.length}件`);
for (const [k, v] of Object.entries(counter).sort((a,b)=>b[1]-a[1])) {
  console.log(`  ${k}: ${v}件`);
}

fs.writeFileSync(path.join(REVIEW_DIR, 'issues.json'), JSON.stringify({ counter, issues }, null, 2));
console.log(`\n→ ${REVIEW_DIR}/issues.json`);
console.log(`→ ${SHOT_DIR}/*.png (${issues.length}枚)`);
