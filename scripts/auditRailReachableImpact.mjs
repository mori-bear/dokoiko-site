#!/usr/bin/env node
/**
 * auditRailReachableImpact.mjs — isRailReachable の判定から gateways.airport を外したときの
 * 影響範囲を測る（調査のみ・データもテンプレートも変更しない）。
 *
 * 現行:  !離島 && !access.stepsに空路/航路 && !gateways.airport && !gateways.ferry
 * 変更後: !離島 && !access.stepsに空路/航路 && !gateways.ferry
 *
 * 変更は35件だけでなく全1255件に及ぶので、新たにボタンが出るものの中に
 * 「実際には鉄道で行けない場所」が混ざっていないかを目視できる形で出す。
 */
import fs from 'fs';
const all = JSON.parse(fs.readFileSync('src/data/destinations.json', 'utf8'));

const NEW35 = new Set(['kannojigoku', 'yunohira-onsen', 'hagenoyu-onsen', 'yunotsuru-onsen', 'tsuetate-onsen',
  'funagoya-onsen', 'kumanokawa-onsen', 'furuyu-onsen', 'hinokage-onsen',
  'namari-onsen', 'geto-onsen', 'matsukawa-iwate', 'gaga-onsen', 'kuroyu', 'doroyu',
  'tokusa', 'kaikake', 'nakabusa', 'kuronagi', 'nigorigo', 'nishiyama-yama', 'umegashima',
  'horoka', 'osawa-onsen', 'yubama', 'kanigasaki', 'utto', 'seorasou', 'yunohana-fk',
  'tsubame-onsen', 'yumata', 'kamikitayama', 'iwai-tottori', 'misasa2', 'yuki-hiroshima']);

const flags = (d) => {
  const st = new Set((d.access?.steps || []).map((s) => s.type));
  return {
    island: (d.tags || []).includes('離島') || d.destType === 'island',
    nonRail: st.has('flight') || st.has('ferry'),
    airport: (d.gateways?.airport || []).length > 0,
    ferry: (d.gateways?.ferry || []).length > 0,
  };
};
const before = (d) => { const f = flags(d); return !f.island && !f.nonRail && !f.airport && !f.ferry; };
const after = (d) => { const f = flags(d); return !f.island && !f.nonRail && !f.ferry; };

const b = all.filter(before), a = all.filter(after);
const gained = all.filter((d) => !before(d) && after(d));

console.log(`■ 乗換案内ボタンの表示件数`);
console.log(`  変更前 ${b.length} / ${all.length} (${(b.length / all.length * 100).toFixed(1)}%)`);
console.log(`  変更後 ${a.length} / ${all.length} (${(a.length / all.length * 100).toFixed(1)}%)`);
console.log(`  新たに表示 ${gained.length}件（うち今回の35件は ${gained.filter((d) => NEW35.has(d.id)).length}件）\n`);

const others = gained.filter((d) => !NEW35.has(d.id));
console.log(`■ 35件以外で新たに表示されるもの ${others.length}件（鉄道で行けるか要確認）`);
// 空港ゲートウェイしか持たない＝陸路の記載が薄いものを危険度順に並べる
const risky = others.map((d) => ({
  id: d.id, name: d.name, pref: d.prefecture,
  rail: (d.gateways?.rail || []).length,
  railGateway: d.railGateway || null,
  requiresCar: !!d.requiresCar,
  type: d.destType,
})).sort((x, y) => x.rail - y.rail || (x.railGateway ? 1 : 0) - (y.railGateway ? 1 : 0));

const noRail = risky.filter((r) => r.rail === 0 && !r.railGateway);
console.log(`\n  ▼ 鉄道ゲートウェイも railGateway も無い（＝鉄道の入口が不明）: ${noRail.length}件`);
for (const r of noRail.slice(0, 40)) console.log(`     ${r.name.padEnd(16)} ${String(r.pref).padEnd(6)} type=${r.type} car=${r.requiresCar}`);
if (noRail.length > 40) console.log(`     … 他 ${noRail.length - 40}件`);

const hasRail = risky.filter((r) => r.rail > 0 || r.railGateway);
console.log(`\n  ▼ 鉄道の入口がある（表示して問題なし）: ${hasRail.length}件`);
for (const r of hasRail.slice(0, 15)) console.log(`     ${r.name.padEnd(16)} ${String(r.pref).padEnd(6)} rail=${r.railGateway ?? (d => '')(0) ?? ''}`);
if (hasRail.length > 15) console.log(`     … 他 ${hasRail.length - 15}件`);

// 沖縄・離島県の混入チェック（鉄道が無い県）
const NO_RAIL_PREF = ['沖縄県'];
const okinawa = gained.filter((d) => NO_RAIL_PREF.includes(d.prefecture));
console.log(`\n■ 鉄道の無い県（沖縄）で新たに表示されるもの: ${okinawa.length}件`);
for (const d of okinawa) console.log(`     ${d.name}（${d.prefecture}）type=${d.destType} tags=${(d.tags || []).join(',')}`);
