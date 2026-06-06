#!/usr/bin/env node
import { chromium } from 'playwright';
import fs from 'fs';
const samples = JSON.parse(fs.readFileSync('/tmp/sample20.json','utf-8'));
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
const page = await ctx.newPage();
const issues = [];
console.log('cat | id | [obj] | desc>=100 | hero | hotel | spots>=2');
for (const s of samples) {
  const url = `https://tabidokoiko.com/destinations/${encodeURIComponent(s.id)}/`;
  const resp = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 }).catch(()=>null);
  if (!resp || resp.status() !== 200) { console.log(`${s.cat} ${s.id} HTTP ${resp?.status()||'NA'}`); continue; }
  const body = await page.locator('main').innerText().catch(()=>'');
  const hasObj = body.includes('[object Object]');
  const paras = await page.locator('main p, .content p').allInnerTexts().catch(()=>[]);
  const longest = paras.reduce((m,t)=>t.length>m.length?t:m,'');
  const heroExists = await page.locator('.dest-hero-img, .dest-header-noimg').count();
  const heroNW = await page.locator('.dest-hero-img').first().evaluate(el=>el.naturalWidth).catch(()=>1);
  const heroOk = heroExists>0 && (heroNW>0 || (await page.locator('.dest-header-noimg').count())>0);
  const hotel = await page.locator('a:has-text("楽天トラベル"), a:has-text("じゃらん")').count();
  const spots = await page.locator('.spot-section').count();
  const flags = [];
  if (hasObj) flags.push('OBJ');
  if (longest.length < 100) flags.push(`SHORT:${longest.length}`);
  if (!heroOk) flags.push('NO_HERO');
  if (hotel < 1) flags.push('NO_HOTEL');
  if (spots < 2) flags.push(`SPOTS:${spots}`);
  const tag = flags.length ? '⚠️ '+flags.join(',') : '✓';
  console.log(`${s.cat.padEnd(5)}| ${s.id.padEnd(22)}| obj=${hasObj?'✗':'✓'} desc=${longest.length>=100?'✓':'✗('+longest.length+')'} hero=${heroOk?'✓':'✗'} hotel=${hotel>=1?'✓':'✗'} spots=${spots>=2?'✓':'✗'} ${tag}`);
  if (flags.length) issues.push({...s, flags});
}
await browser.close();
console.log(`\n問題: ${issues.length}件`);
if (issues.length > 0) console.log(JSON.stringify(issues, null, 2));
