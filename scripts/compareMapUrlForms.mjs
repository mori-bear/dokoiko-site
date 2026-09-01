#!/usr/bin/env node
/**
 * compareMapUrlForms.mjs — 目的地を指す3つのURL形式を実際に開いて比べる。
 *   A 座標のみ            search/?api=1&query=<lat>,<lng>        （採用中）
 *   B 地点名を座標付近で検索 search/<name>/@<lat>,<lng>,15z
 *   C 地点名のみ           search/?api=1&query=<name> <pref>      （修正前の形）
 * 宿泊検索に化けないか、地点名が出るかを見て、Aのままでよいか判断する。
 */
import { chromium } from 'playwright';
import fs from 'node:fs';

const all = JSON.parse(fs.readFileSync('src/data/destinations.json', 'utf8'));
const d = all.find((x) => x.id === 'yunotsuru-onsen');
const coord = `${d.lat},${d.lng}`;

const FORMS = [
  ['A 座標のみ（採用中）', `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(coord)}`],
  ['B 名前を座標付近で検索', `https://www.google.com/maps/search/${encodeURIComponent(d.name)}/@${d.lat},${d.lng},15z`],
  ['C 名前のみ（修正前）', `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${d.name} ${d.prefecture}`)}`],
];

fs.mkdirSync('logs/shots/map', { recursive: true });
const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: 412, height: 900 }, deviceScaleFactor: 2, isMobile: true, locale: 'ja-JP',
  userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
});

for (const [label, url] of FORMS) {
  const page = await ctx.newPage();
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.waitForTimeout(6000);
    const body = (await page.textContent('body').catch(() => '')) || '';
    // 宿泊検索に化けたときに出る語（価格ピンの画面に必ず現れる）
    const hotel = ['1泊', '空室', 'チェックイン', '¥', '料金'].filter((w) => body.includes(w));
    const named = body.includes(d.name);
    const file = `logs/shots/map/form-${label[0]}.png`;
    await page.screenshot({ path: file });
    console.log(`■ ${label}`);
    console.log(`   最終URL: ${page.url().slice(0, 100)}`);
    console.log(`   地点名が出る: ${named ? '✅' : '—'}   宿泊系の語: ${hotel.length ? '⚠️ ' + hotel.join('/') : '✅ なし'}`);
  } catch (e) {
    console.log(`■ ${label}: 失敗 ${String(e).slice(0, 60)}`);
  }
  await page.close();
}
await browser.close();
