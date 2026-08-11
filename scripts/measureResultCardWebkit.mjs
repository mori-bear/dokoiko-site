// iPhone実機相当(WebKitエンジン)で実フォーム操作により検索結果カードを実測
// 使い方: node scripts/measureResultCardWebkit.mjs [baseUrl]
import { webkit, devices } from 'playwright';
import path from 'path';
import { fileURLToPath } from 'url';

const base = process.argv[2] || 'https://tabidokoiko.com';
const outDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'logs');

const iphone = devices['iPhone 12']; // 390x844, DPR3, WebKit
const browser = await webkit.launch();
const ctx = await browser.newContext({ ...iphone });
const page = await ctx.newPage();

console.log('[open]', base, 'viewport=', iphone.viewport);
await page.goto(base + '/', { waitUntil: 'networkidle' });

// 実フォーム操作: 出発地=高松, 1泊(既定), テーマ=グルメ → どこ行こ？
await page.selectOption('#departure-select', '高松');
await page.click('[data-theme="グルメ"]');
await page.click('#go-btn');

await page.waitForSelector('#result:not([hidden])', { timeout: 15000 });
await page.waitForTimeout(2000); // 画像ロード待ち

const info = await page.evaluate(() => {
  const out = [];
  document.querySelectorAll('.rc-card').forEach((card) => {
    const wrap = card.querySelector('.rc-card-img-wrap');
    const img = card.querySelector('.rc-card-img');
    const cw = wrap && getComputedStyle(wrap);
    const ci = img && getComputedStyle(img);
    const rw = wrap?.getBoundingClientRect();
    const ri = img?.getBoundingClientRect();
    out.push({
      wrap: wrap ? { aspectRatio: cw.aspectRatio, w: Math.round(rw.width), h: Math.round(rw.height) } : null,
      img: img ? {
        objectFit: ci.objectFit, position: ci.position,
        w: Math.round(ri.width), h: Math.round(ri.height),
        natural: { w: img.naturalWidth, h: img.naturalHeight },
        src: (img.currentSrc || img.src).split('/').slice(-2).join('/'),
        complete: img.complete,
      } : null,
    });
  });
  return out;
});
console.log(JSON.stringify(info, null, 2));

await page.locator('#result').scrollIntoViewIfNeeded();
await page.waitForTimeout(600);
await page.screenshot({ path: path.join(outDir, 'result_card_webkit.png') });
console.log('[screenshot]', path.join(outDir, 'result_card_webkit.png'));
await browser.close();
