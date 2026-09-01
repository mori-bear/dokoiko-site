#!/usr/bin/env node
/**
 * auditRailReachableNewOnsen.mjs — 追加35件で isRailReachable がどうなっているかを調べる（調査のみ）。
 *
 * [id].astro は isRailReachable が false だと
 * Yahoo!乗換案内への「電車・バスで行く」ボタンを出さない。
 * みどりの窓口案内（リンクなしのテキスト）しか出ない組み合わせで、
 * この乗換ボタンまで消えていると、実行できる導線がゼロになる。
 */
import fs from 'fs';

const NEW = ['kannojigoku', 'yunohira-onsen', 'hagenoyu-onsen', 'yunotsuru-onsen', 'tsuetate-onsen',
  'funagoya-onsen', 'kumanokawa-onsen', 'furuyu-onsen', 'hinokage-onsen',
  'namari-onsen', 'geto-onsen', 'matsukawa-iwate', 'gaga-onsen', 'kuroyu', 'doroyu',
  'tokusa', 'kaikake', 'nakabusa', 'kuronagi', 'nigorigo', 'nishiyama-yama', 'umegashima',
  'horoka', 'osawa-onsen', 'yubama', 'kanigasaki', 'utto', 'seorasou', 'yunohana-fk',
  'tsubame-onsen', 'yumata', 'kamikitayama', 'iwai-tottori', 'misasa2', 'yuki-hiroshima'];

const all = JSON.parse(fs.readFileSync('src/data/destinations.json', 'utf8'));
const byId = Object.fromEntries(all.map((d) => [d.id, d]));

let railOk = 0;
const reasons = {};
console.log('■ 追加35件の isRailReachable\n');
for (const id of NEW) {
  const d = byId[id];
  const stepTypes = new Set((d.access?.steps || []).map((s) => s.type));
  const hasNonRail = stepTypes.has('flight') || stepTypes.has('ferry');
  const hasAirport = (d.gateways?.airport || []).length > 0;
  const hasFerry = (d.gateways?.ferry || []).length > 0;
  const isIsland = (d.tags || []).includes('離島') || d.destType === 'island';
  const ok = !isIsland && !hasNonRail && !hasAirport && !hasFerry;
  if (ok) railOk++;
  const why = [isIsland && '離島', hasNonRail && 'access.stepsに空路/航路', hasAirport && 'gateways.airportあり', hasFerry && 'gateways.ferryあり'].filter(Boolean).join(' / ') || '—';
  for (const r of why.split(' / ')) if (r !== '—') reasons[r] = (reasons[r] || 0) + 1;
  console.log(`  ${ok ? '✅' : '❌'} ${d.name.padEnd(12)} ${d.prefecture.padEnd(5)} airport=${JSON.stringify(d.gateways?.airport || [])}  ${why}`);
}
console.log(`\n  乗換ボタンが出る: ${railOk} / ${NEW.length}件`);
console.log('  出ない理由の内訳:');
for (const [r, n] of Object.entries(reasons)) console.log(`    ${r}: ${n}件`);

// 既存全体との比較
const allRail = all.filter((d) => {
  const st = new Set((d.access?.steps || []).map((s) => s.type));
  return !((d.tags || []).includes('離島') || d.destType === 'island')
    && !(st.has('flight') || st.has('ferry'))
    && !((d.gateways?.airport || []).length > 0)
    && !((d.gateways?.ferry || []).length > 0);
});
console.log(`\n■ 参考: サイト全体では ${allRail.length} / ${all.length}件 (${(allRail.length / all.length * 100).toFixed(0)}%) で乗換ボタンが出る`);
