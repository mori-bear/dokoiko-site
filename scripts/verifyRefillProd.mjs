#!/usr/bin/env node
/**
 * verifyRefillProd.mjs — 画像を入れ直したページが本番で正しく出ているか確かめる。
 *   ・ページが200で返るか
 *   ・ヒーロー画像のimgタグがあるか
 *   ・その画像ファイルが200で返るか
 */
import fs from 'fs';
const SITE = 'https://tabidokoiko.com';
const UA = { 'User-Agent': 'DokoIko-Verify/1.0' };
const strict = JSON.parse(fs.readFileSync('logs/refill_images1_strict.json', 'utf8'));
const retry = JSON.parse(fs.readFileSync('logs/refill_retry1.json', 'utf8'));
const ids = [...new Set([...strict.pass.map((x) => x.id), ...retry.adopted.map((x) => x.id)])]
  .filter((id) => fs.existsSync(`public/images/${id}/main.jpg`));

let ng = 0;
for (const id of ids) {
  const r = await fetch(`${SITE}/destinations/${encodeURIComponent(id)}/`, { headers: UA });
  const html = await r.text();
  const m = html.match(/<img class="dest-hero-img" src="([^"]+)"/);
  let img = 0;
  if (m) img = (await fetch(SITE + m[1], { method: 'HEAD', headers: UA })).status;
  const ok = r.status === 200 && !!m && img === 200;
  if (!ok) ng++;
  console.log(`${ok ? 'OK  ' : '❌  '} ${id.padEnd(22)} page=${r.status} hero=${m ? 'あり' : 'なし'} image=${img || '-'}`);
}
console.log(ng ? `\nNG ${ng}件 / ${ids.length}件` : `\n✅ ${ids.length}件すべて本番でヒーロー画像が出ている`);
process.exit(ng ? 1 : 0);
