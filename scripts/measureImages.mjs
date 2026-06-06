#!/usr/bin/env node
import { chromium } from 'playwright';
import fs from 'fs';
const browser = await chromium.launch();

async function measure(viewport, label) {
  console.log(`\n=== ${label} (${viewport.width}x${viewport.height}) ===`);
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 3 });
  const page = await ctx.newPage();

  // 1. トップヒーロー
  await page.goto('https://tabidokoiko.com/', { waitUntil: 'load' });
  await page.waitForTimeout(2000);
  const hero = await page.locator('.hero').first().evaluate(el => {
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    return { h: r.height, css: cs.height };
  }).catch(()=>null);
  console.log(`トップ.hero: ${hero?.h}px (css=${hero?.css})`);
  await page.screenshot({ path: `/tmp/measure/${label}_top.png`, clip: { x:0, y:0, width: viewport.width, height: Math.min(viewport.height, 700) } });

  // 2. destinationヒーロー (3件)
  for (const id of ['kyoto', 'hiketa', 'niche_香川_1']) {
    await page.goto(`https://tabidokoiko.com/destinations/${encodeURIComponent(id)}/`, { waitUntil: 'load' });
    await page.waitForTimeout(2000);
    const dh = await page.locator('.dest-hero, .dest-header-noimg').first().evaluate(el => {
      const r = el.getBoundingClientRect();
      return { h: r.height, w: r.width, vh: (r.height/window.innerHeight*100).toFixed(1) };
    }).catch(()=>null);
    console.log(`/${id}/.dest-hero: ${dh?.h}px = ${dh?.vh}vh`);
    await page.screenshot({ path: `/tmp/measure/${label}_${id.replace(/\//g,'_')}.png`, clip: { x:0, y:0, width: viewport.width, height: Math.min(viewport.height, 600) } });
    // spot-thumb 1個目を測定
    const st = await page.locator('.spot-thumb').first().evaluate(el => {
      const r = el.getBoundingClientRect();
      return { h: r.height, w: r.width };
    }).catch(()=>null);
    if (st) console.log(`  spot-thumb: ${st.w.toFixed(0)}x${st.h.toFixed(0)}px`);
  }

  // 3. レコメンド結果カード (?from=...)
  await page.goto('https://tabidokoiko.com/?from=%E6%9D%B1%E4%BA%AC&nights=1night&theme=%E6%B8%A9%E6%B3%89', { waitUntil: 'load' });
  await page.waitForTimeout(4000);
  const rc = await page.locator('.rc-photo-wrap').first().evaluate(el => {
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    return { h: r.height, w: r.width, css: cs.height };
  }).catch(()=>null);
  console.log(`.rc-photo-wrap: ${rc?.w?.toFixed(0)}x${rc?.h?.toFixed(0)}px (css=${rc?.css})`);
  await page.screenshot({ path: `/tmp/measure/${label}_search.png`, clip: { x:0, y:0, width: viewport.width, height: Math.min(viewport.height, 700) } });

  await ctx.close();
}

fs.mkdirSync('/tmp/measure', { recursive: true });
await measure({ width: 375, height: 667 }, 'iPhoneSE');
await measure({ width: 430, height: 932 }, 'iPhone17Pro');
await browser.close();
