// 検索結果カード画像のスマホ実測スクリプト
// 使い方: node scripts/measureResultCardMobile.mjs [baseUrl]
//   baseUrl 省略時は https://tabidokoiko.com
// iPhone相当(390x844, isMobile, DPR3)で 高松/1泊/グルメ を検索し、
// カード画像の computed style・実寸・naturalサイズをダンプ+スクショ保存。
import { chromium } from 'playwright';
import path from 'path';
import { fileURLToPath } from 'url';

const base = process.argv[2] || 'https://tabidokoiko.com';
const outDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'logs');

const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 3,
  isMobile: true,
  hasTouch: true,
  userAgent:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
});
const page = await ctx.newPage();

const url = `${base}/?from=${encodeURIComponent('高松')}&nights=1night&theme=${encodeURIComponent('グルメ')}`;
console.log('[open]', url);
await page.goto(url, { waitUntil: 'networkidle' });

await page.waitForSelector('#result:not([hidden])', { timeout: 15000 });
await page.waitForTimeout(1500); // 画像ロード待ち

const info = await page.evaluate(() => {
  const pick = (el, props) => {
    const cs = getComputedStyle(el);
    const o = {};
    for (const p of props) o[p] = cs.getPropertyValue(p);
    const r = el.getBoundingClientRect();
    o._rect = { w: Math.round(r.width), h: Math.round(r.height) };
    return o;
  };
  const result = { htmlSnippet: null, cards: [] };
  const inner = document.getElementById('result-inner');
  if (inner) result.htmlSnippet = inner.innerHTML.slice(0, 1200);
  document.querySelectorAll('.rc-card').forEach((card) => {
    const wrap = card.querySelector('.rc-card-img-wrap');
    const img = card.querySelector('.rc-card-img');
    result.cards.push({
      wrap: wrap ? pick(wrap, ['aspect-ratio', 'width', 'height', 'position']) : null,
      img: img
        ? {
            ...pick(img, ['object-fit', 'width', 'height', 'position', 'inset']),
            src: img.currentSrc || img.src,
            natural: { w: img.naturalWidth, h: img.naturalHeight },
            complete: img.complete,
          }
        : null,
    });
  });
  // 旧マークアップ(単一カード)も検出
  const legacy = document.querySelector('.rc-hero-img');
  if (legacy) {
    result.legacyHeroImg = {
      ...pick(legacy, ['object-fit', 'width', 'height']),
      src: legacy.currentSrc || legacy.src,
      natural: { w: legacy.naturalWidth, h: legacy.naturalHeight },
    };
  }
  return result;
});
console.log(JSON.stringify(info, null, 2));

await page.locator('#result').scrollIntoViewIfNeeded();
await page.waitForTimeout(600);
const shot = path.join(outDir, 'result_card_mobile_live.png');
await page.screenshot({ path: shot });
console.log('[screenshot]', shot);

const fullShot = path.join(outDir, 'result_card_mobile_live_full.png');
await page.screenshot({ path: fullShot, fullPage: true });
console.log('[screenshot-full]', fullShot);

await browser.close();
