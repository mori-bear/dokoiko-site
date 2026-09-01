#!/usr/bin/env node
/**
 * checkMapLinkBehavior.mjs — 生成した地図URLに実際に遷移して、
 * ①目的地にピンが立つか ②宿泊検索の画面に化けていないか を見る。
 *
 * Googleマップは遷移後にURLを書き換えるので、最終URLの形で判定できる。
 *   ・座標指定が効いていれば /maps/place/... や /maps/search/ に @lat,lng が残る
 *   ・宿泊検索に化けると hotel / lodging 系のパラメータやUIが出る
 * 画面も保存して目視できるようにする。
 */
import { chromium } from 'playwright';
import fs from 'node:fs';

const all = JSON.parse(fs.readFileSync('src/data/destinations.json', 'utf8'));
const TARGETS = ['yunotsuru-onsen', 'ubayu-onsen', 'kannojigoku'];

fs.mkdirSync('logs/shots/map', { recursive: true });
const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: 412, height: 900 }, deviceScaleFactor: 2, isMobile: true, locale: 'ja-JP',
  userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
});

for (const id of TARGETS) {
  const d = all.find((x) => x.id === id);
  if (!d) { console.log(`⚠️ ${id} なし`); continue; }
  const coord = `${d.lat},${d.lng}`;
  const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(coord)}`;
  const page = await ctx.newPage();
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.waitForTimeout(5000);
    const final = page.url();
    const body = (await page.textContent('body').catch(() => '')) || '';
    // 宿泊検索に化けたときに出る語
    const hotelWords = ['ホテル', '料金', '1泊', '空室', 'チェックイン'];
    const hits = hotelWords.filter((w) => body.includes(w));
    // 座標が最終URLに残っているか（＝その一点を見ている）
    const keptCoord = final.includes(String(d.lat).slice(0, 7)) || final.includes(encodeURIComponent(coord));
    await page.screenshot({ path: `logs/shots/map/${id}.png` });
    console.log(`■ ${d.name}（${coord}）`);
    console.log(`   最終URL: ${final.slice(0, 110)}`);
    console.log(`   座標が保持されている: ${keptCoord ? '✅' : '❌'}`);
    console.log(`   宿泊検索らしい語: ${hits.length ? '⚠️ ' + hits.join('/') : '✅ なし'}`);
  } catch (e) {
    console.log(`■ ${d.name}: 取得失敗 ${String(e).slice(0, 70)}`);
  }
  await page.close();
}
await browser.close();
