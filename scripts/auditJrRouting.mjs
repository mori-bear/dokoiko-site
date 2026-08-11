#!/usr/bin/env node
/**
 * auditJrRouting.mjs — JR予約リンクの出し分けを全 destination × 出発地で検証する。
 * 実際に使われる pickJRService をそのまま呼び、選ばれたサービスが
 * 目的地の管轄JR会社をカバーしているかを判定する（検出のみ）。
 */
import fs from 'fs';
import { pickJRService, PREF_TO_COMPANY, SERVICE_COVERAGE, SERVICE_LABEL } from './jrServiceMap.js';

const D = JSON.parse(fs.readFileSync('src/data/destinations.json', 'utf8'));
// 出発都市 → 県（テンプレの departures に入る値）
const CITY_PREF = {
  '東京': '東京都', '大阪': '大阪府', '名古屋': '愛知県', '福岡': '福岡県', '札幌': '北海道',
  '仙台': '宮城県', '広島': '広島県', '高松': '香川県', '那覇': '沖縄県', '金沢': '石川県',
  '新潟': '新潟県', '静岡': '静岡県', '岡山': '岡山県', '鹿児島': '鹿児島県', '熊本': '熊本県',
  '長崎': '長崎県', '大分': '大分県', '宮崎': '宮崎県', '松山': '愛媛県', '高知': '高知県',
  '徳島': '徳島県', '神戸': '兵庫県', '京都': '京都府', '奈良': '奈良県', '和歌山': '和歌山県',
  '青森': '青森県', '盛岡': '岩手県', '秋田': '秋田県', '山形': '山形県', '福島': '福島県',
  '水戸': '茨城県', '前橋': '群馬県', '高崎': '群馬県', '宇都宮': '栃木県', '甲府': '山梨県',
  '長野': '長野県', '松本': '長野県', '富山': '富山県', '福井': '福井県', '岐阜': '岐阜県',
  '浜松': '静岡県', '姫路': '兵庫県', '鳥取': '鳥取県', '松江': '島根県', '山口': '山口県',
  '下関': '山口県', '佐賀': '佐賀県', '別府': '大分県', '函館': '北海道', '旭川': '北海道',
  '釧路': '北海道', '稚内': '北海道', '横浜': '神奈川県', '千葉': '千葉県', 'さいたま': '埼玉県',
  '津': '三重県', '大津': '滋賀県', '福山': '広島県', '倉敷': '岡山県', '新宮': '和歌山県',
  '田辺': '和歌山県', '白浜': '和歌山県', '串本': '和歌山県',
};

const bad = [], unknownCity = new Set();
const tally = {};
for (const d of D) {
  const dPref = d.prefecture;
  if (!dPref || !PREF_TO_COMPANY[dPref]) continue;
  const dCo = PREF_TO_COMPANY[dPref];
  for (const dep of (d.departures || [])) {
    const oPref = CITY_PREF[dep];
    if (!oPref) { unknownCity.add(dep); continue; }
    const svc = pickJRService(oPref, dPref);
    tally[svc] = (tally[svc] || 0) + 1;
    if (svc === 'midori') continue;                    // 窓口案内は対象外
    const cov = SERVICE_COVERAGE[svc];
    if (!cov) { bad.push({ id: d.id, name: d.name, dep, dPref, svc, why: 'サービス定義なし' }); continue; }
    if (!cov.includes(dCo)) {
      bad.push({ id: d.id, name: d.name, dep, oPref, dPref, dCo, svc, why: `${SERVICE_LABEL[svc] ?? svc} は ${dCo} をカバーしない` });
    }
  }
}

console.log(`\n${'═'.repeat(70)}`);
console.log(`JR予約リンクの出し分け検証（destination × 出発地）`);
console.log(`${'═'.repeat(70)}`);
console.log(`選択されたサービスの内訳:`);
for (const [k, v] of Object.entries(tally).sort((a, b) => b[1] - a[1])) console.log(`   ${String(v).padStart(6)} 件  ${SERVICE_LABEL[k] ?? k}`);
console.log(`\n❌ 目的地をカバーしないサービスが選ばれた組み合わせ: ${bad.length} 件`);
const byWhy = bad.reduce((a, b) => { (a[b.why] ||= []).push(b); return a; }, {});
for (const [why, list] of Object.entries(byWhy).sort((a, b) => b[1].length - a[1].length)) {
  console.log(`\n  ■ ${why}: ${list.length}件`);
  for (const x of list.slice(0, 6)) console.log(`     [${x.id}] ${x.name}（${x.dPref}）← 出発 ${x.dep}`);
  if (list.length > 6) console.log(`     … ほか${list.length - 6}件`);
}
if (unknownCity.size) console.log(`\n⚠️ 県が特定できない出発地（判定対象外）: ${[...unknownCity].join(', ')}`);

/* 北陸新幹線まわりの回帰確認 */
console.log(`\n■ 北陸（富山/石川/福井）への出し分け確認`);
for (const dPref of ['富山県', '石川県', '福井県']) {
  const row = ['東京都', '大阪府', '愛知県', '福岡県', '北海道'].map(o => `${o.replace(/[都道府県]/, '')}→${SERVICE_LABEL[pickJRService(o, dPref)] ?? pickJRService(o, dPref)}`);
  console.log(`   ${dPref}: ${row.join(' / ')}`);
}
fs.writeFileSync('logs/jr_routing_audit.json', JSON.stringify({ tally, bad }, null, 2));
