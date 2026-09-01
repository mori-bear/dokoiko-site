#!/usr/bin/env node
/**
 * verifyTransitButtonProd.mjs — 本番の公開ページを実際に取得して、
 * 乗換案内ボタン(booking-btn-navitime)が出ているかを確認する。
 * あわせて、離島ページでは従来どおり出ていないこと（回帰なし）も見る。
 */
const BASE = 'https://tabidokoiko.com';

const SHOULD_HAVE = [
  ['horoka', '幌加温泉（みどりの窓口が主）'],
  ['nigorigo', '濁河温泉（みどりの窓口が主）'],
  ['umegashima', '梅ヶ島温泉（みどりの窓口が主）'],
  ['kannojigoku', '寒の地獄温泉（九州回）'],
  ['kuronagi', '黒薙温泉（全国1）'],
  ['kamikitayama', '入之波温泉（全国2）'],
  ['asahikawa', '旭川（既存・新たに表示）'],
];
const SHOULD_NOT = [
  ['yakushima', '屋久島（離島・従来どおり非表示のはず）'],
  ['amami', '奄美大島（離島）'],
  ['himeshima', '姫島（離島）'],
];

let ng = 0;
console.log('■ 出るべきページ');
for (const [id, label] of SHOULD_HAVE) {
  const r = await fetch(`${BASE}/destinations/${id}/`);
  if (!r.ok) { console.log(`  ⚠️  ${r.status} ${id}（ページなし・判定対象外）`); continue; }
  const has = (await r.text()).includes('booking-btn-navitime');
  if (!has) ng++;
  console.log(`  ${has ? '✅' : '❌'} ${label}`);
}
console.log('\n■ 出ないべきページ（回帰確認）');
for (const [id, label] of SHOULD_NOT) {
  const r = await fetch(`${BASE}/destinations/${id}/`);
  if (!r.ok) { console.log(`  ⚠️  ${r.status} ${id}`); continue; }
  const has = (await r.text()).includes('booking-btn-navitime');
  if (has) ng++;
  console.log(`  ${has ? '❌ 出てしまっている' : '✅ 非表示のまま'} ${label}`);
}
console.log(ng ? `\nNG ${ng}件` : '\n✅ 本番反映を確認');
process.exit(ng ? 1 : 0);
