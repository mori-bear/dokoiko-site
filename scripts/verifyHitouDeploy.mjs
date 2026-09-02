#!/usr/bin/env node
/** verifyHitouDeploy.mjs — 追加した秘湯ページとトップのバナーが本番に出ているかを実測する。 */
const BASE = 'https://tabidokoiko.com';
const NEW = ['hoshida', 'iojima-nagasaki', 'kirifuri'];

const CHECKS = [
  ['/', 'kf-banner'],
  ['/', '/kyushu-fukko/'],
  ['/destinations/yubama/', 'ランプ'],
  ['/destinations/kamikitayama/', '山鳩湯'],
  ['/destinations/iwai-tottori/', '湯かむり'],
  ['/destinations/yumata/', '晴嵐荘'],
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
