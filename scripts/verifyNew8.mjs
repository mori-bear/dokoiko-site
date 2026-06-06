#!/usr/bin/env node
import { chromium } from 'playwright';
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
const page = await ctx.newPage();
const ids = ['hiketa','wakimachi','arimatsu','asuke','unno-juku','yame','takatori','seki-juku'];
console.log('id | desc>=200 | spots>=2 | [obj] | 宿リンク');
for (const id of ids) {
  await page.goto(`http://localhost:4323/destinations/${encodeURIComponent(id)}/`, { waitUntil: 'domcontentloaded' });
  const body = await page.locator('main').innerText().catch(()=>'');
  const hasObj = body.includes('[object Object]');
  const paras = await page.locator('main p, .content p').allInnerTexts().catch(()=>[]);
  const longest = paras.reduce((m,t)=>t.length>m.length?t:m,'');
  const descOk = longest.length >= 200;
  const spots = await page.locator('.spot-section').count();
  const hotel = await page.locator('a:has-text("楽天トラベル"), a:has-text("じゃらん")').count();
  console.log(`${id.padEnd(14)} | ${descOk?'✓':'✗'}(${longest.length}字) | ${spots>=2?'✓':'✗'}(${spots}) | ${hasObj?'✗':'✓'} | ${hotel>=1?'✓':'✗'}(${hotel})`);
}
await browser.close();
