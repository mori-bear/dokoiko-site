#!/usr/bin/env node
/**
 * playwrightFullReview2.mjs
 * 全destinationを並列5でモバイル検査 (390x844)
 * 検出: OBJECT_OBJECT / DESC_SHORT / SPOTS_ZERO / TITLE_BAD / NO_HOTEL_LINK / TOP_BLANK_400
 */
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const DEST_FILE = './src/data/destinations.json';
const BASE = 'http://localhost:4323';
const REVIEW_DIR = '/tmp/review2';
fs.mkdirSync(REVIEW_DIR, { recursive: true });

const destinations = JSON.parse(fs.readFileSync(DEST_FILE, 'utf-8'));
const ids = destinations.map(d => d.id);
console.log(`📋 検査対象: ${ids.length}件 (並列5)`);

const CONCURRENCY = 5;
const issues = [];

async function worker(browser, queue) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, userAgent: 'Mozilla/5.0 (iPhone)' });
  const page = await ctx.newPage();
  while (queue.length) {
    const id = queue.shift();
    if (!id) break;
    const url = `${BASE}/destinations/${encodeURIComponent(id)}/`;
    const issue = { id, flags: [] };
    try {
      const resp = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });
      if (!resp || resp.status() !== 200) {
        issue.flags.push(`HTTP_${resp?.status() || 'NA'}`);
        issues.push(issue);
        continue;
      }
      const bodyText = await page.locator('main').innerText().catch(() => '');
      // 1. [object Object]
      if (bodyText.includes('[object Object]')) issue.flags.push('OBJECT_OBJECT');
      // 2. description<50
      const allParas = await page.locator('main p, .content p').allInnerTexts().catch(() => []);
      const longestText = allParas.reduce((m, t) => t.length > m.length ? t : m, '');
      if (longestText.length < 50) issue.flags.push(`DESC_SHORT_${longestText.length}`);
      // 3. spots=0
      const spotsCount = await page.locator('.spot-section').count();
      if (spotsCount === 0) issue.flags.push('SPOTS_ZERO');
      // 4. title undefined/null
      const title = await page.title();
      const h1 = await page.locator('h1').first().innerText().catch(() => '');
      if (/undefined|null/i.test(title) || /undefined|null/i.test(h1) || !h1) issue.flags.push(`TITLE_BAD:${h1.slice(0,30)}`);
      // 5. 宿リンクなし
      const hotelLinks = await page.locator('a:has-text("楽天トラベル"), a:has-text("じゃらん"), a:has-text("宿"), a:has-text("ホテル")').count();
      if (hotelLinks === 0) issue.flags.push('NO_HOTEL_LINK');
      // 6. 上部400px白
      const topBlank = await page.evaluate(() => {
        const main = document.querySelector('main');
        if (!main) return true;
        const firstChild = main.firstElementChild;
        if (!firstChild) return true;
        return firstChild.getBoundingClientRect().height < 150;
      }).catch(() => false);
      if (topBlank) issue.flags.push('TOP_BLANK_400');

      if (issue.flags.length > 0) issues.push(issue);
    } catch (e) {
      issue.flags.push(`EX:${e.message.slice(0,40)}`);
      issues.push(issue);
    }
  }
  await ctx.close();
}

const browser = await chromium.launch();
const queue = [...ids];
const reportInterval = setInterval(() => {
  console.log(`  ${ids.length - queue.length}/${ids.length} 処理 (issues=${issues.length})`);
}, 30000);
await Promise.all(Array.from({length: CONCURRENCY}, () => worker(browser, queue)));
clearInterval(reportInterval);
await browser.close();

const counter = {};
for (const i of issues) {
  for (const f of i.flags) {
    const key = f.replace(/:.*$/, '').replace(/_\d+$/, '');
    counter[key] = (counter[key] || 0) + 1;
  }
}
console.log(`\n=== 完了 ===`);
console.log(`  問題発見: ${issues.length}件`);
for (const [k, v] of Object.entries(counter).sort((a,b)=>b[1]-a[1])) console.log(`  ${k}: ${v}件`);
fs.writeFileSync(path.join(REVIEW_DIR, 'issues.json'), JSON.stringify({ counter, issues }, null, 2));
console.log(`\n→ ${REVIEW_DIR}/issues.json`);
