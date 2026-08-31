#!/usr/bin/env node
/**
 * verifyKyushuDeploy.mjs — 今回追加したページが本番に出ているかを実測する。
 * verifyDeploy.mjs は主要5ページしか見ないため、変更したページが未反映でも通ってしまう。
 * ここでは特設ページと新規destination 9件を直接叩き、内容の実在まで確認する。
 */
const BASE = 'https://tabidokoiko.com';
const NEW = ['kannojigoku', 'yunohira-onsen', 'hagenoyu-onsen', 'yunotsuru-onsen', 'tsuetate-onsen',
  'funagoya-onsen', 'kumanokawa-onsen', 'furuyu-onsen', 'hinokage-onsen'];

// [パス, 本文に必ず含まれるべき文字列]
const CHECKS = [
  ['/kyushu-fukko/', '九州ふっこう応援割'],
  ['/kyushu-fukko/', '注目：宿が数軒しかない温泉'],
  ['/destinations/kannojigoku/', '寒の地獄旅館'],
  ['/destinations/yunotsuru-onsen/', '鶴水荘'],
  ['/destinations/hinokage-onsen/', 'TR列車の宿'],
  ['/sitemap.xml', '/kyushu-fukko/'],
];

let ng = 0;
for (const [p, needle] of CHECKS) {
  try {
    const r = await fetch(BASE + p, { redirect: 'follow' });
    const body = await r.text();
    const ok = r.ok && body.includes(needle);
    if (!ok) ng++;
    console.log(`${ok ? 'OK  ' : 'NG  '} ${r.status} ${p.padEnd(34)} 「${needle}」${body.includes(needle) ? 'あり' : 'なし'}`);
  } catch (e) {
    ng++; console.log(`NG   ERR ${p} ${String(e).slice(0, 60)}`);
  }
}

// 新規destinationのページと画像がすべて配信されているか
for (const id of NEW) {
  const [pg, img] = await Promise.all([
    fetch(`${BASE}/destinations/${id}/`, { method: 'HEAD' }),
    fetch(`${BASE}/images/${id}/main.jpg`, { method: 'HEAD' }),
  ]);
  const ok = pg.ok && img.ok;
  if (!ok) ng++;
  console.log(`${ok ? 'OK  ' : 'NG  '} ${id.padEnd(18)} page=${pg.status} image=${img.status}`);
}

console.log(ng ? `\nNG ${ng}件` : '\n✅ 追加分すべて本番反映済み');
process.exit(ng ? 1 : 0);
