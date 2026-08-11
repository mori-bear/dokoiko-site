// 検索結果カード画像のモバイル実測検証。
// 390x844(isMobile)で 高松発/1泊/グルメ を実際に検索 → 結果カードをスクショ＋
// 画像要素の computed style / 実測サイズを出力する。
import { chromium } from 'playwright';

const BASE = process.env.BASE || 'http://localhost:4321';
const OUT = process.env.OUT || 'logs/result_card_mobile.png';

const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: 390, height: 844 },
  isMobile: true,
  deviceScaleFactor: 3,
  hasTouch: true,
});
const page = await ctx.newPage();
await page.goto(BASE, { waitUntil: 'networkidle' });

// 出発地=高松: #departure-select の該当optionを選択
const depOpts = await page.$$eval('#departure-select option', os => os.map(o => ({ v: o.value, t: o.textContent.trim() })));
const dep = depOpts.find(o => o.t.includes('高松'));
if (dep) await page.selectOption('#departure-select', dep.v);
// 泊数=1泊
await page.click('[data-stay="1night"]').catch(()=>{});
// テーマ=グルメ
await page.click('[data-theme="グルメ"]').catch(()=>{});
// 検索実行
await page.click('#go-btn');

// 結果表示を待つ
await page.waitForSelector('#result:not([hidden]) .rc-card-img, .rc-card-img', { timeout: 8000 }).catch(()=>{});
await page.waitForTimeout(1200);

// 結果カード画像の実測
const measure = await page.evaluate(() => {
  const img = document.querySelector('#result-inner .rc-card-img') || document.querySelector('.rc-card-img');
  const wrap = document.querySelector('#result-inner .rc-card-img-wrap') || document.querySelector('.rc-card-img-wrap');
  if (!img) return { found: false };
  const cs = getComputedStyle(img);
  const wcs = wrap ? getComputedStyle(wrap) : null;
  const r = img.getBoundingClientRect();
  const wr = wrap ? wrap.getBoundingClientRect() : null;
  return {
    found: true,
    img: { objectFit: cs.objectFit, width: cs.width, height: cs.height,
           rectW: Math.round(r.width), rectH: Math.round(r.height),
           natW: img.naturalWidth, natH: img.naturalHeight, src: img.currentSrc || img.src },
    wrap: wcs ? { aspectRatio: wcs.aspectRatio, height: wcs.height,
                  rectW: wr && Math.round(wr.width), rectH: wr && Math.round(wr.height) } : null,
  };
});
console.log(JSON.stringify(measure, null, 2));

// 画像の実ロード状態を確認
const imgState = await page.evaluate(() => {
  const img = document.querySelector('#result-inner .rc-card-img') || document.querySelector('.rc-card-img');
  return img ? { complete: img.complete, natW: img.naturalWidth, currentSrc: img.currentSrc } : null;
});
console.log('imgState:', JSON.stringify(imgState));

// 結果カードを画面中央へスクロール → カードのビューポート矩形でクリップ撮影
await page.evaluate(() => {
  const c = document.querySelector('#result-inner .rc-card') || document.querySelector('.rc-card');
  c?.scrollIntoView({ block: 'center' });
});
await page.waitForTimeout(700);
const clip = await page.evaluate(() => {
  const c = document.querySelector('#result-inner .rc-card') || document.querySelector('.rc-card');
  const r = c.getBoundingClientRect();
  return { x: Math.max(0, r.left - 8), y: Math.max(0, r.top - 8),
           width: Math.min(390, r.width + 16), height: r.height + 16 };
});
await page.screenshot({ path: OUT, clip });
console.log('screenshot(clip) ->', OUT, JSON.stringify(clip));

await browser.close();
