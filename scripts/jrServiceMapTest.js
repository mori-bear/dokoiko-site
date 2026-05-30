#!/usr/bin/env node
/**
 * jrServiceMapTest.js
 * pickJRService の振り分けを代表都市ペアで検証する。
 * 北陸独立ゾーン化後の回帰テスト。
 */
import { pickJRService, jrServiceLabel } from './jrServiceMap.js';

// 都市 → 都道府県
const CITY_PREF = {
  '札幌': '北海道', '秋田': '秋田県', '仙台': '宮城県', '東京': '東京都',
  '富山': '富山県', '金沢': '石川県', '福井': '福井県',
  '名古屋': '愛知県', '大阪': '大阪府', '京都': '京都府', '広島': '広島県',
  '高松': '香川県', '福岡': '福岡県', '鹿児島': '鹿児島県', '那覇': '沖縄県',
};

// [出発, 目的地, 期待サービス, 備考]
const CASES = [
  ['那覇', '東京',   'air',      '沖縄絡み'],
  ['秋田', '金沢',   'ekinet',   '★旧バグ:smartex誤り → 北陸新幹線'],
  ['東京', '金沢',   'ekinet',   '北陸新幹線(東海道経由しない)'],
  ['富山', '東京',   'ekinet',   '北陸-東日本'],
  ['大阪', '金沢',   'e5489',    '北陸-西日本(サンダーバード)'],
  ['名古屋', '金沢', 'e5489',    '北陸-東海(しらさぎ)'],
  ['富山', '福井',   'e5489',    '北陸内移動'],
  ['広島', '金沢',   'e5489',    '北陸-西日本'],
  ['福岡', '金沢',   'e5489',    '北陸-九州'],
  ['札幌', '金沢',   'midori',   '北陸-北海道(極端な飛ばし)'],
  ['札幌', '東京',   'ekinet',   '北海道-東日本'],
  ['仙台', '東京',   'ekinet',   '東日本内'],
  ['東京', '京都',   'smartex',  '東日本-西日本(東海道) 維持'],
  ['東京', '名古屋', 'smartex',  '東日本-東海 維持'],
  ['東京', '福岡',   'smartex',  '東日本-九州(東海道山陽通し)'],
  ['札幌', '大阪',   'midori',   '本州縦断(北海道発着はsmartex対象外)'],
  ['福岡', '鹿児島', 'jrkyushu', '九州内 維持'],
  ['大阪', '広島',   'e5489',    '西日本内 維持'],
  ['大阪', '福岡',   'e5489',    '西日本-九州(山陽乗継)'],
  ['高松', '大阪',   'e5489',    '四国-西日本'],
];

let pass = 0, fail = 0;
const rows = [];
for (const [from, to, expect, note] of CASES) {
  const got = pickJRService(CITY_PREF[from], CITY_PREF[to]);
  const ok = got === expect;
  ok ? pass++ : fail++;
  rows.push({
    route: `${from}→${to}`,
    expect: `${expect}(${jrServiceLabel(expect)})`,
    got: `${got}(${jrServiceLabel(got)})`,
    result: ok ? '✓' : '✗ NG',
    note,
  });
}

console.log('=== pickJRService 検証結果 ===\n');
const pad = (s, n) => String(s) + ' '.repeat(Math.max(0, n - [...String(s)].length * 1.7 | 0));
for (const r of rows) {
  console.log(`${r.result.padEnd(5)} ${r.route.padEnd(14, '　')} 期待:${r.expect.padEnd(18)} 実際:${r.got.padEnd(18)} ${r.note}`);
}
console.log(`\n合計: ${pass} pass / ${fail} fail`);
process.exit(fail === 0 ? 0 : 1);
