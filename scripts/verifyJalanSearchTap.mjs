// じゃらん検索リンクのタップ検証: ローカルビルドのdestinationページから
// じゃらんボタンを実際にクリックし、着地ページのタイトル・結果件数を確認、スクショ保存。
// 使い方: node scripts/verifyJalanSearchTap.mjs [baseUrl] (省略時 http://localhost:4173)
import { webkit, devices } from 'playwright';
import path from 'path';
import { fileURLToPath } from 'url';

const base = process.argv[2] || 'http://localhost:4173';
const outDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'logs');
const PAGES = ['kamakura', 'shuzenji', 'kinosaki-onsen'];

const browser = await webkit.launch();
const ctx = await browser.newContext({ ...devices['iPhone 12'], locale: 'ja-JP' });

for (const id of PAGES) {
  const page = await ctx.newPage();
  await page.goto(`${base}/destinations/${id}/`, { waitUntil: 'domcontentloaded' });
  // 現地宿の「じゃらんで探す」カード(最初のhotel-card-jalan)をタップ
  const btn = page.locator('a.hotel-card-jalan').first();
  const href = await btn.getAttribute('href');
  await btn.scrollIntoViewIfNeeded();
  const [popup] = await Promise.all([
    page.waitForEvent('popup', { timeout: 20000 }).catch(() => null),
    btn.click(),
  ]);
  const target = popup || page;
  await target.waitForLoadState('domcontentloaded', { timeout: 30000 }).catch(() => {});
  await target.waitForTimeout(4000); // JS描画待ち
  const title = await target.title();
  const url = target.url();
  const bodyText = await target.evaluate(() => document.body.innerText.slice(0, 3000)).catch(() => '');
  const hitM = bodyText.match(/([\d,]+)\s*件/);
  const notFound = /見つかりません|該当する(宿|ホテル)が(?:ありません|ございません)/.test(bodyText);
  const mojibake = /骼|[�]{2,}/.test(title + bodyText.slice(0, 500));
  const shot = path.join(outDir, `jalan_search_${id}.png`);
  await target.screenshot({ path: shot }).catch(() => {});
  console.log(`== ${id} ==`);
  console.log('  href(先頭):', (href || '').slice(0, 90));
  console.log('  着地URL:', url.slice(0, 100));
  console.log('  title:', title.slice(0, 60));
  console.log('  件数表示:', hitM ? hitM[1] : '?', '| 0件/該当なし:', notFound, '| 文字化け:', mojibake);
  console.log('  screenshot:', shot);
  await target.close().catch(() => {});
  if (popup) await page.close().catch(() => {});
}
await browser.close();
