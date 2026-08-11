#!/usr/bin/env node
/**
 * captureForPost.mjs — X投稿用のスクリーンショットを撮る。
 * モバイル 390x844（iPhone相当）・Retina 2x で撮影し、画像が出揃ってから保存する。
 */
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const URL = process.argv[2] || 'https://tabidokoiko.com/destinations/ubayu-onsen/';
const OUT = process.argv[3] || `${process.env.HOME}/Desktop/dokoiko_post/post_screenshot.png`;

fs.mkdirSync(path.dirname(OUT), { recursive: true });

const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,                 // Retina 相当（X上で綺麗に見せる）
  isMobile: true,
  hasTouch: true,
  locale: 'ja-JP',
  userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
});
const page = await ctx.newPage();

console.log(`撮影: ${URL}`);
await page.goto(URL, { waitUntil: 'networkidle', timeout: 60000 });

// 遅延読み込み画像を確実に出す
await page.evaluate(async () => {
  await new Promise((res) => {
    let y = 0;
    const t = setInterval(() => { window.scrollTo(0, y); y += 400; if (y > 2000) { clearInterval(t); res(); } }, 100);
  });
});
await page.evaluate(() => window.scrollTo(0, 0));
await page.waitForTimeout(1500);
await page.waitForLoadState('networkidle').catch(() => {});

await page.screenshot({ path: OUT });          // ビューポート(390x844)を撮影
const { width, height } = await page.evaluate(() => ({ width: innerWidth, height: innerHeight }));
const title = await page.title();
await browser.close();

const kb = Math.round(fs.statSync(OUT).size / 1024);
console.log(`✅ 保存: ${OUT}`);
console.log(`   ページ: ${title}`);
console.log(`   ビューポート: ${width}x${height} / 実ピクセル: 2x / ${kb}KB`);
