#!/usr/bin/env node
/** verifyHitouDeploy.mjs — 追加した秘湯ページとトップのバナーが本番に出ているかを実測する。 */
const BASE = 'https://tabidokoiko.com';
const NEW = ['namari-onsen', 'geto-onsen', 'matsukawa-iwate', 'gaga-onsen', 'kuroyu', 'doroyu',
  'tokusa', 'kaikake', 'nakabusa', 'kuronagi', 'nigorigo', 'nishiyama-yama', 'umegashima'];

const CHECKS = [
  ['/', 'kf-banner'],
  ['/', '/kyushu-fukko/'],
  ['/destinations/namari-onsen/', '白猿の湯'],
  ['/destinations/kuronagi/', '黒薙温泉旅館'],
  ['/destinations/nishiyama-yama/', '慶雲館'],
  ['/destinations/kuroyu/', '打たせ湯'],
];

let ng = 0;
for (const [p, needle] of CHECKS) {
  try {
    const r = await fetch(BASE + p, { redirect: 'follow' });
    const body = await r.text();
    const ok = r.ok && body.includes(needle);
    if (!ok) ng++;
    console.log(`${ok ? 'OK  ' : 'NG  '} ${r.status} ${p.padEnd(32)} 「${needle}」${body.includes(needle) ? 'あり' : 'なし'}`);
  } catch (e) { ng++; console.log(`NG   ERR ${p} ${String(e).slice(0, 50)}`); }
}
for (const id of NEW) {
  const [pg, img] = await Promise.all([
    fetch(`${BASE}/destinations/${id}/`, { method: 'HEAD' }),
    fetch(`${BASE}/images/${id}/main.jpg`, { method: 'HEAD' }),
  ]);
  const ok = pg.ok && img.ok;
  if (!ok) ng++;
  console.log(`${ok ? 'OK  ' : 'NG  '} ${id.padEnd(17)} page=${pg.status} image=${img.status}`);
}
console.log(ng ? `\nNG ${ng}件` : '\n✅ 追加分すべて本番反映済み');
process.exit(ng ? 1 : 0);
