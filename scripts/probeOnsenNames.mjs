#!/usr/bin/env node
/** probeOnsenNames.mjs — 未掲載判定が出た温泉について、部分文字列で全件を洗い直す（取りこぼし検出）。 */
import fs from 'fs';
const all = JSON.parse(fs.readFileSync('src/data/destinations.json', 'utf8'));
const KEYS = ['浅虫','作並','飯坂','東山','土湯','ハワイアン','強羅','山中','粟津','あわら','芦原',
  '新穂高','平湯','西浦','長島','榊原','おごと','雄琴','湯の花','湯の峰','皆生','はわい','羽合',
  'こんぴら','琴平','道後','あしずり','足摺','二日市','天ヶ瀬','天瀬','鉄輪','京町','妙見'];
for (const k of KEYS) {
  const hits = all.filter((d) => String(d.name).includes(k) || String(d.id).includes(k));
  console.log(`${k.padEnd(8)} ${hits.length ? hits.map((h) => `${h.id}(${h.name}/${h.prefecture})`).join(' , ') : '— なし'}`);
}
