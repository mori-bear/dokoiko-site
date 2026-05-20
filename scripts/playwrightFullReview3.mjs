#!/usr/bin/env node
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const DEST_FILE = './src/data/destinations.json';
const BASE = 'http://localhost:4323';
const REVIEW = '/tmp/review3';
fs.mkdirSync(REVIEW, { recursive: true });

const dests = JSON.parse(fs.readFileSync(DEST_FILE, 'utf-8'));
const ids = dests.map(d => d.id);
console.log(`📋 検査: ${ids.length}件 (並列8)`);

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
      if (!resp || resp.status() !== 200) { issue.flags.push(`HTTP_${resp?.status() || 'NA'}`); issues.push(issue); continue; }
      // 1. [object Object]
      const main = await page.locator('main').innerText().catch(() => '');
      if (main.includes('[object Object]')) issue.flags.push('OBJ_OBJ');
      // 2. title長すぎ (h1)
      const h1 = await page.locator('h1').first().innerText().catch(() => '');
      if (h1.length > 12) issue.flags.push(`TITLE_LONG:${h1.length}`);
      // 3. description<100字
      const allParas = await page.locator('main p, .content p').allInnerTexts().catch(() => []);
      const longest = allParas.reduce((m, t) => t.length > m.length ? t : m, '');
      if (longest.length < 100) issue.flags.push(`DESC_SHORT:${longest.length}`);
      // 4. spots≤1
      const spots = await page.locator('.spot-section').count();
      if (spots <= 1) issue.flags.push(`SPOTS:${spots}`);
      // 5. ヒーロー画像なし
      const heroSrc = await page.locator('.dest-hero-img').first().getAttribute('src').catch(() => null);
      const noimgHeader = await page.locator('.dest-header-noimg').count();
      if (!heroSrc && noimgHeader === 0) issue.flags.push('NO_HERO');
      // 6. 宿リンク
      const hotels = await page.locator('a:has-text("楽天トラベル"), a:has-text("じゃらん")').count();
      if (hotels === 0) issue.flags.push('NO_HOTEL');

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
await Promise.all(Array.from({length: 8}, () => worker(browser, queue)));
clearInterval(reportInterval);
await browser.close();

const counter = {};
for (const i of issues) for (const f of i.flags) {
  const key = f.split(':')[0];
  counter[key] = (counter[key] || 0) + 1;
}
console.log(`\n=== 完了 ===`);
console.log(`  問題件数: ${issues.length}`);
for (const [k, v] of Object.entries(counter).sort((a,b)=>b[1]-a[1])) console.log(`  ${k}: ${v}件`);
fs.writeFileSync(path.join(REVIEW, 'issues.json'), JSON.stringify({ counter, issues }, null, 2));
