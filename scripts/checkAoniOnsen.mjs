#!/usr/bin/env node
import { chromium } from 'playwright';
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
const page = await ctx.newPage();
const url = 'http://localhost:4323/destinations/gen_%E9%9D%92%E6%A3%AE_%E9%9D%92%E8%8D%B7%E6%B8%A9%E6%B3%89/';
const r = await page.goto(url, { waitUntil: 'networkidle' });
console.log('status:', r.status());
const text = await page.locator('body').innerText();
const hasObj = text.includes('[object Object]');
console.log('contains [object Object]:', hasObj);
if (hasObj) {
  const idx = text.indexOf('[object Object]');
  console.log('Context:', text.slice(Math.max(0,idx-100), idx+100));
}
await page.screenshot({ path: '/tmp/aoni-onsen.png', fullPage: true });
await browser.close();
