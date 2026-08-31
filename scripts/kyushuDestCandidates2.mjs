#!/usr/bin/env node
/**
 * kyushuDestCandidates2.mjs — 1次パス(kyushuDestCandidates.mjs)で座標が取れなかった
 * 候補の再判定。Wikipedia記事名・OSM検索語をそれぞれ複数試し、当たった時点で採用する。
 *
 * 注意: 記事名バリアントは「同じ場所を指す別名」だけに限る。
 *   例) 法華院温泉 → 法華院温泉山荘 は可。壁湯温泉 → 宝泉寺温泉 は別の温泉地なので不可。
 *   ここを緩めると2ソース照合が形骸化して同名異所を通してしまう。
 * 判定基準（5km一致 / 重複なし / 既存3km以内なし）は1次パスと同一。
 */
import fs from 'fs';

const UA = { 'User-Agent': 'DokoIko-DataAudit/1.0 (tabidokoiko.com; contact@tabidokoiko.com)' };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const kmBetween = (a, b, c, d) => Math.hypot((a - c) * 111, (b - d) * 111 * Math.cos((a * Math.PI) / 180));

// [id, 名前, 県, [Wikipedia候補...], [OSM検索語...]]
const CANDIDATES = [
  ['kabeyu-onsen',   '壁湯温泉',     '大分県', ['壁湯温泉'],                    ['壁湯温泉', '福元屋 九重町', '壁湯天然洞窟温泉']],
  ['kawazoko-onsen', '川底温泉',     '大分県', ['川底温泉'],                    ['川底温泉', '蛍川荘 九重町']],
  ['kannojigoku',    '寒の地獄温泉', '大分県', ['寒の地獄温泉'],                ['寒の地獄旅館', '寒の地獄温泉', 'Kannojigoku Onsen']],
  ['hokkein-onsen',  '法華院温泉',   '大分県', ['法華院温泉山荘', '法華院温泉'], ['法華院温泉山荘', '法華院温泉']],
  ['akagawa-onsen',  '赤川温泉',     '大分県', ['赤川温泉'],                    ['赤川温泉', '赤川荘 竹田市']],
  ['shichirida-onsen','七里田温泉',  '大分県', ['七里田温泉'],                  ['七里田温泉', '七里田温泉館 竹田市']],
  ['sujiyu-onsen',   '筋湯温泉',     '大分県', ['筋湯温泉'],                    ['筋湯温泉', '筋湯 うたせ大浴場', 'Sujiyu Onsen']],
  ['tarutama-onsen', '垂玉温泉',     '熊本県', ['垂玉温泉'],                    ['垂玉温泉', '山口旅館 南阿蘇村', 'Tarutama Onsen']],
  ['manganji-onsen', '満願寺温泉',   '熊本県', ['満願寺温泉'],                  ['満願寺温泉', '満願寺 南小国町']],
  ['hagenoyu-onsen', 'はげの湯温泉', '熊本県', ['岳の湯温泉', 'わいた温泉郷'],  ['はげの湯温泉', '岳の湯温泉 小国町']],
  ['yukawachi-onsen','湯川内温泉',   '鹿児島県', ['湯川内温泉'],                ['湯川内温泉', 'かじか荘 出水市']],
  ['shibi-onsen',    '紫尾温泉',     '鹿児島県', ['紫尾温泉'],                  ['紫尾温泉', '紫尾神社 さつま町']],
  ['myoken-onsen',   '妙見温泉',     '鹿児島県', ['妙見温泉'],                  ['妙見温泉', '妙見温泉 霧島市', 'Myoken Onsen']],
  ['takaki-onsen',   '川内高城温泉', '鹿児島県', ['川内高城温泉'],              ['川内高城温泉', '高城温泉 薩摩川内市']],
  ['kyomachi-onsen', '京町温泉',     '宮崎県', ['京町温泉'],                    ['京町温泉', '京町温泉駅 えびの市']],
  ['wakita-onsen',   '脇田温泉',     '福岡県', ['脇田温泉'],                    ['脇田温泉', '楠水閣 宮若市', 'Wakita Onsen']],
  ['hoshinomura',    '星野村',       '福岡県', ['星野村'],                      ['星野村 八女市', '星のふるさと公園 八女市', '福岡県八女市星野村']],
];

const existing = JSON.parse(fs.readFileSync('src/data/destinations.json', 'utf8'));
const norm = (s) => String(s || '').replace(/[\s　・（）()「」【】]/g, '')
  .replace(/(市|町|村|区|駅|温泉|公園|神社|寺|大橋)$/g, '');

async function wikiCoords(title) {
  const url = `https://ja.wikipedia.org/w/api.php?action=query&prop=coordinates&titles=${encodeURIComponent(title)}&format=json&formatversion=2&redirects=1`;
  const r = await fetch(url, { headers: UA });
  if (!r.ok) return null;
  const p = (await r.json())?.query?.pages?.[0];
  const c = p?.coordinates?.[0];
  return c ? { lat: c.lat, lng: c.lon, title: p.title } : null;
}
async function osmCoords(q) {
  const r = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=1&countrycodes=jp`, { headers: UA });
  if (!r.ok) return null;
  const j = await r.json();
  return j?.[0] ? { lat: +j[0].lat, lng: +j[0].lon, label: j[0].display_name, q } : null;
}

const out = [];
for (const [id, name, pref, titles, osmQueries] of CANDIDATES) {
  const rec = { id, name, prefecture: pref, checks: {} };
  let w = null;
  for (const t of titles) { w = await wikiCoords(t); await sleep(350); if (w) break; }
  let o = null;
  for (const q of osmQueries) { o = await osmCoords(q); await sleep(1100); if (o) break; }
  rec.wiki = w; rec.osm = o; rec.wikiTitle = w?.title ?? null; rec.osmQuery = o?.q ?? null;

  const dupId = existing.find((d) => d.id === id);
  const dupName = existing.find((d) => d.name === name);
  const dupNorm = existing.filter((d) => norm(d.name) === norm(name) && d.name !== name);
  rec.checks.duplicate = dupId ? `id重複:${dupId.name}` : dupName ? `同名:${dupName.name}`
    : dupNorm.length ? `類似名:${dupNorm.map((d) => d.name).join(',')}` : 'なし';

  if (!w || !o) rec.checks.coords = `取得不可 (wiki=${w ? 'o' : 'x'} osm=${o ? 'o' : 'x'})`;
  else {
    const d = kmBetween(w.lat, w.lng, o.lat, o.lng);
    rec.distanceKm = +d.toFixed(2);
    rec.checks.coords = d <= 5 ? `一致 ${d.toFixed(2)}km` : `不一致 ${d.toFixed(2)}km`;
    if (d <= 5) { rec.lat = +((w.lat + o.lat) / 2).toFixed(5); rec.lng = +((w.lng + o.lng) / 2).toFixed(5); }
  }
  if (rec.lat != null) {
    const near = existing.filter((d) => typeof d.lat === 'number')
      .map((d) => ({ name: d.name, km: kmBetween(rec.lat, rec.lng, d.lat, d.lng) }))
      .filter((x) => x.km < 3).sort((a, b) => a.km - b.km);
    rec.checks.nearby = near.length ? near.map((x) => `${x.name}(${x.km.toFixed(1)}km)`).join(', ') : 'なし';
  }
  rec.pass = rec.checks.duplicate === 'なし' && String(rec.checks.coords).startsWith('一致') && rec.checks.nearby === 'なし';
  out.push(rec);
  console.log(`${rec.pass ? '✅' : '❌'} ${name.padEnd(12)} ${pref.padEnd(4)} wiki=${rec.wikiTitle ?? '-'} osm=${rec.osmQuery ?? '-'} 座標=${rec.checks.coords} 近接=${rec.checks.nearby ?? '-'}`);
}
fs.writeFileSync('logs/kyushu_candidates2.json', JSON.stringify(out, null, 2));
console.log(`\n合格 ${out.filter((o) => o.pass).length} / ${out.length} 件 → logs/kyushu_candidates2.json`);
