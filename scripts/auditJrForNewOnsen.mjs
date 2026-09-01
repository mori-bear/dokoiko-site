#!/usr/bin/env node
/**
 * auditJrForNewOnsen.mjs — 今回追加した温泉35件について、
 * [id].astro が実際に呼んでいる pickJRService の判定結果を集計する（調査のみ）。
 *
 * [id].astro は「出発地 × 目的地」の組み合わせごとにサービスを決めているので、
 * destinationごとに1つのサービスが決まるわけではない。
 * ここでは同じ出発地リスト・同じCITY_TO_PREFを使って全組み合わせを回し、
 * ①目的地ごとの内訳 ②みどりの窓口になる件数と理由 を出す。
 */
import fs from 'fs';
import { pickJRService, SERVICE_LABEL, PREF_TO_COMPANY, SHINKANSEN_PREFS } from './jrServiceMap.js';

// [id].astro の ALL_DEPARTURE_CITIES_JP と同一
const CITIES = ['札幌', '函館', '旭川', '釧路', '帯広', '北見',
  '青森', '八戸', '盛岡', '秋田', '山形', '仙台', '福島', '水戸',
  '前橋', '高崎', '東京', '横浜', '新潟', '金沢', '富山', '甲府', '長野', '岐阜',
  '名古屋', '浜松', '京都', '大阪', '神戸', '姫路', '和歌山', '新宮', '田辺', '白浜', '串本',
  '鳥取', '岡山', '倉敷', '広島', '福山', '下関', '山口', '北九州',
  '高松', '松山', '高知', '徳島',
  '福岡', '佐賀', '長崎', '熊本', '大分', '別府', '宮崎', '鹿児島', '那覇', '宮古', '石垣'];

// [id].astro の CITY_TO_PREF と同一
const CITY_TO_PREF = {
  '札幌': '北海道', '函館': '北海道', '旭川': '北海道', '釧路': '北海道', '帯広': '北海道', '北見': '北海道',
  '青森': '青森県', '八戸': '青森県', '盛岡': '岩手県', '秋田': '秋田県', '山形': '山形県', '仙台': '宮城県',
  '福島': '福島県', '水戸': '茨城県', '前橋': '群馬県', '高崎': '群馬県', '東京': '東京都', '横浜': '神奈川県',
  '新潟': '新潟県', '金沢': '石川県', '富山': '富山県', '甲府': '山梨県', '長野': '長野県', '岐阜': '岐阜県',
  '名古屋': '愛知県', '浜松': '静岡県', '京都': '京都府', '大阪': '大阪府', '神戸': '兵庫県', '姫路': '兵庫県',
  '和歌山': '和歌山県', '新宮': '和歌山県', '田辺': '和歌山県', '白浜': '和歌山県', '串本': '和歌山県',
  '鳥取': '鳥取県', '岡山': '岡山県', '倉敷': '岡山県', '広島': '広島県', '福山': '広島県',
  '下関': '山口県', '山口': '山口県', '北九州': '福岡県',
  '高松': '香川県', '松山': '愛媛県', '高知': '高知県', '徳島': '徳島県',
  '福岡': '福岡県', '佐賀': '佐賀県', '長崎': '長崎県', '熊本': '熊本県', '大分': '大分県', '別府': '大分県',
  '宮崎': '宮崎県', '鹿児島': '鹿児島県', '那覇': '沖縄県', '宮古': '沖縄県', '石垣': '沖縄県',
};

// 今回このセッションで追加した35件
const NEW = [
  // 九州ふっこう回（9件）
  'kannojigoku', 'yunohira-onsen', 'hagenoyu-onsen', 'yunotsuru-onsen', 'tsuetate-onsen',
  'funagoya-onsen', 'kumanokawa-onsen', 'furuyu-onsen', 'hinokage-onsen',
  // 全国バッチ1（13件）
  'namari-onsen', 'geto-onsen', 'matsukawa-iwate', 'gaga-onsen', 'kuroyu', 'doroyu',
  'tokusa', 'kaikake', 'nakabusa', 'kuronagi', 'nigorigo', 'nishiyama-yama', 'umegashima',
  // 全国バッチ2（13件）
  'horoka', 'osawa-onsen', 'yubama', 'kanigasaki', 'utto', 'seorasou', 'yunohana-fk',
  'tsubame-onsen', 'yumata', 'kamikitayama', 'iwai-tottori', 'misasa2', 'yuki-hiroshima',
];

const all = JSON.parse(fs.readFileSync('src/data/destinations.json', 'utf8'));
const byId = Object.fromEntries(all.map((d) => [d.id, d]));

// [id].astro と同じ除外条件（自分の街は出発地に出さない）
const originsFor = (d) => CITIES.filter((c) => c !== d.hubCity && c !== d.name && c !== d.city);

// midori になった理由を pickJRService のロジックから逆算して説明する
function midoriReason(oPref, dPref) {
  const o = PREF_TO_COMPANY[oPref], d = PREF_TO_COMPANY[dPref];
  if (!o || !d) return '県→会社の対応が取れない';
  if (o === 'hokkaido' || d === 'hokkaido') return '北海道↔本州（東日本以外）で複数社にまたがる';
  if (o === 'hokuriku' || d === 'hokuriku') return '北陸↔北海道で飛ばしすぎ';
  if (d === 'kyushu') return '九州行きだが出発が四国/北海道でJR九州ネット予約の範囲外';
  if (d === 'central') {
    const ex = SHINKANSEN_PREFS.has(oPref) && SHINKANSEN_PREFS.has(dPref);
    return ex ? '不明' : 'JR東海管内だが新幹線停車県同士でなく在来線特急が要る（スマートEX不可）';
  }
  return 'その他';
}

const rows = [];
const grandTotal = { total: 0, byService: {} };
const midoriReasons = {};

for (const id of NEW) {
  const d = byId[id];
  if (!d) { console.log(`⚠️ 見つからない: ${id}`); continue; }
  const origins = originsFor(d);
  const count = {};
  const mReasons = {};
  for (const c of origins) {
    const svc = pickJRService(CITY_TO_PREF[c] || '', d.prefecture || '');
    count[svc] = (count[svc] || 0) + 1;
    grandTotal.byService[svc] = (grandTotal.byService[svc] || 0) + 1;
    grandTotal.total++;
    if (svc === 'midori') {
      const r = midoriReason(CITY_TO_PREF[c] || '', d.prefecture || '');
      mReasons[r] = (mReasons[r] || 0) + 1;
      midoriReasons[r] = (midoriReasons[r] || 0) + 1;
    }
  }
  const top = Object.entries(count).sort((a, b) => b[1] - a[1]);
  rows.push({ id, name: d.name, pref: d.prefecture, n: origins.length, count, top, mReasons });
}

const L = (s) => SERVICE_LABEL[s] ?? s;

console.log('■ 目的地ごとの内訳（出発地の数え上げ／主サービス＝最多のもの）\n');
console.log('  目的地           県        出発地  主サービス      内訳');
for (const r of rows) {
  const main = `${L(r.top[0][0])}(${r.top[0][1]})`;
  const detail = r.top.map(([s, n]) => `${L(s)}:${n}`).join(' ');
  console.log(`  ${r.name.padEnd(12)} ${r.pref.padEnd(5)} ${String(r.n).padStart(4)}  ${main.padEnd(16)} ${detail}`);
}

console.log('\n■ 全体の内訳（35件 × 出発地 の全組み合わせ）');
for (const [s, n] of Object.entries(grandTotal.byService).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${L(s).padEnd(14)} ${String(n).padStart(5)} 件  ${(n / grandTotal.total * 100).toFixed(1)}%`);
}
console.log(`  ${'合計'.padEnd(13)} ${String(grandTotal.total).padStart(5)} 件`);

console.log('\n■ みどりの窓口になった理由の内訳');
const mTotal = grandTotal.byService.midori || 0;
for (const [r, n] of Object.entries(midoriReasons).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${String(n).padStart(5)} 件 (${(n / mTotal * 100).toFixed(1)}%)  ${r}`);
}

console.log('\n■ みどりの窓口の比率が高い目的地（上位）');
const byMidori = rows.map((r) => ({ ...r, m: r.count.midori || 0, pct: (r.count.midori || 0) / r.n * 100 }))
  .sort((a, b) => b.pct - a.pct);
for (const r of byMidori.slice(0, 12)) {
  if (!r.m) continue;
  console.log(`  ${r.name.padEnd(12)} ${r.pref.padEnd(5)} ${String(r.m).padStart(3)}/${r.n} (${r.pct.toFixed(0)}%)  ${Object.entries(r.mReasons).map(([k, v]) => `${k}×${v}`).join(' / ')}`);
}
const noMidori = rows.filter((r) => !r.count.midori);
console.log(`\n  みどりの窓口が1件も出ない目的地: ${noMidori.length}件 — ${noMidori.map((r) => r.name).join('、')}`);
