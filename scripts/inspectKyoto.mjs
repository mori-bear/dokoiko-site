#!/usr/bin/env node
import { chromium } from 'playwright';

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, userAgent: 'Mozilla/5.0 (iPhone)' });
const page = await ctx.newPage();
await page.goto('http://localhost:4323/destinations/kyoto/', { waitUntil: 'networkidle' });

const checks = {
  'hotel-section count': await page.locator('.hotel-section').count(),
  'hotel-card count': await page.locator('.hotel-card').count(),
  'hotel-section visible': await page.locator('.hotel-section').first().isVisible().catch(() => 'N/A'),
  'access-section count': await page.locator('.access-section').count(),
  'access-section visible': await page.locator('.access-section').first().isVisible().catch(() => 'N/A'),
  'travel-times visible': await page.locator('.travel-times').first().isVisible().catch(() => 'N/A'),
  'departure-select visible': await page.locator('#departure-select').isVisible().catch(() => 'N/A'),
  'spot-section count': await page.locator('.spot-section').count(),
};
console.log('=== 京都ページ要素検査 (iPhone 390x844) ===');
for (const [k, v] of Object.entries(checks)) console.log(`  ${k}: ${v}`);

// hotel-section テキスト
const hotelText = await page.locator('.hotel-section').first().innerText().catch(() => 'NOT FOUND');
console.log(`\n--- hotel-section テキスト ---\n${hotelText.slice(0,300)}`);

// access-section テキスト
const accessText = await page.locator('.access-section').first().innerText().catch(() => 'NOT FOUND');
console.log(`\n--- access-section テキスト ---\n${accessText.slice(0,300)}`);

// スクショ保存
await page.screenshot({ path: '/tmp/kyoto-mobile.png', fullPage: true });
console.log('\n→ スクショ: /tmp/kyoto-mobile.png');

await browser.close();
