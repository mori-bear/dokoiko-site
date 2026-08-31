#!/usr/bin/env node
/**
 * kyushuDestCandidates.mjs — 九州の秘湯・一軒宿の新規destination候補を
 * newDestCandidates.mjs と同じ品質ゲートにかける。
 *   (1) 既存destinationとの重複（id・同名・正規化名）
 *   (2) Wikipedia(ja) と OSM Nominatim の2ソース座標が5km以内で一致
 *   (3) 既存destinationとの3km以内の近接除外
 * 通った候補だけ logs/kyushu_candidates.json に出す。落ちた候補は採用しない。
 */
import fs from 'fs';

const UA = { 'User-Agent': 'DokoIko-DataAudit/1.0 (tabidokoiko.com; contact@tabidokoiko.com)' };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const kmBetween = (la1, ln1, la2, ln2) =>
  Math.hypot((la1 - la2) * 111, (ln1 - ln2) * 111 * Math.cos((la1 * Math.PI) / 180));

// [id, 表示名, 都道府県, Wikipedia記事名, OSM検索語]
const CANDIDATES = [
  // ── 大分県 ──
  ['kabeyu-onsen',    '壁湯温泉',   '大分県', '壁湯温泉',   '壁湯温泉 大分県九重町'],
  ['kawazoko-onsen',  '川底温泉',   '大分県', '川底温泉',   '川底温泉 大分県九重町'],
  ['kannojigoku',     '寒の地獄温泉', '大分県', '寒の地獄温泉', '寒の地獄旅館 大分県九重町'],
  ['hokkein-onsen',   '法華院温泉', '大分県', '法華院温泉', '法華院温泉山荘 大分県竹田市'],
  ['akagawa-onsen',   '赤川温泉',   '大分県', '赤川温泉',   '赤川温泉 大分県竹田市'],
  ['shichirida-onsen','七里田温泉', '大分県', '七里田温泉', '七里田温泉 大分県竹田市'],
  ['sujiyu-onsen',    '筋湯温泉',   '大分県', '筋湯温泉',   '筋湯温泉 大分県九重町'],
  ['yunohira-onsen',  '湯平温泉',   '大分県', '湯平温泉',   '湯平温泉 大分県由布市'],
  // ── 熊本県 ──
  ['tarutama-onsen',  '垂玉温泉',   '熊本県', '垂玉温泉',   '垂玉温泉 熊本県南阿蘇村'],
  ['manganji-onsen',  '満願寺温泉', '熊本県', '満願寺温泉', '満願寺温泉 熊本県南小国町'],
  ['yunotsuru-onsen', '湯の鶴温泉', '熊本県', '湯の鶴温泉', '湯の鶴温泉 熊本県水俣市'],
  ['hagenoyu-onsen',  'はげの湯温泉','熊本県', '岳の湯温泉 (熊本県)', 'はげの湯温泉 熊本県小国町'],
  ['tsuetate-onsen',  '杖立温泉',   '熊本県', '杖立温泉',   '杖立温泉 熊本県小国町'],
  // ── 鹿児島県 ──
  ['yukawachi-onsen', '湯川内温泉', '鹿児島県', '湯川内温泉', '湯川内温泉 鹿児島県出水市'],
  ['shibi-onsen',     '紫尾温泉',   '鹿児島県', '紫尾温泉',   '紫尾温泉 鹿児島県さつま町'],
  ['myoken-onsen',    '妙見温泉',   '鹿児島県', '妙見温泉',   '妙見温泉 鹿児島県霧島市'],
  ['takaki-onsen',    '川内高城温泉','鹿児島県','川内高城温泉','川内高城温泉 鹿児島県薩摩川内市'],
  // ── 宮崎県 ──
  ['kyomachi-onsen',  '京町温泉',   '宮崎県', '京町温泉',   '京町温泉 宮崎県えびの市'],
  ['hinokage-onsen',  '日之影温泉', '宮崎県', '日之影町',   '日之影温泉駅 宮崎県日之影町'],
  // ── 佐賀県 ──
  ['kumanokawa-onsen','熊の川温泉', '佐賀県', '熊の川温泉', '熊の川温泉 佐賀県佐賀市'],
  ['furuyu-onsen',    '古湯温泉',   '佐賀県', '古湯温泉',   '古湯温泉 佐賀県佐賀市'],
  // ── 長崎県 ──
  ['obama-onsen',     '小浜温泉',   '長崎県', '小浜温泉',   '小浜温泉 長崎県雲仙市'],
  // ── 福岡県 ──
  ['wakita-onsen',    '脇田温泉',   '福岡県', '脇田温泉',   '脇田温泉 福岡県宮若市'],
  ['hoshinomura',     '星野村',     '福岡県', '星野村',     '星野村 福岡県八女市'],
];

const existing = JSON.parse(fs.readFileSync('src/data/destinations.json', 'utf8'));
const norm = (s) => String(s || '').replace(/[\s　・（）()「」【】]/g, '')
  .replace(/(市|町|村|区|駅|温泉|公園|神社|寺|大橋)$/g, '');

async function wikiCoords(title) {
  const url = `https://ja.wikipedia.org/w/api.php?action=query&prop=coordinates&titles=${encodeURIComponent(title)}&format=json&formatversion=2`;
  const r = await fetch(url, { headers: UA });
  if (!r.ok) return null;
  const j = await r.json();
  const c = j?.query?.pages?.[0]?.coordinates?.[0];
  return c ? { lat: c.lat, lng: c.lon } : null;
}

async function osmCoords(q) {
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=1&countrycodes=jp`;
  const r = await fetch(url, { headers: UA });
  if (!r.ok) return null;
  const j = await r.json();
  return j?.[0] ? { lat: +j[0].lat, lng: +j[0].lon } : null;
}

const out = [];
for (const [id, name, pref, wikiTitle, osmQuery] of CANDIDATES) {
  const rec = { id, name, prefecture: pref, wikiTitle, osmQuery, checks: {} };

  const dupId = existing.find((d) => d.id === id);
  const dupName = existing.find((d) => d.name === name);
  const dupNorm = existing.filter((d) => norm(d.name) === norm(name) && d.name !== name);
  rec.checks.duplicate = dupId ? `id重複:${dupId.name}`
    : dupName ? `同名:${dupName.name}`
    : dupNorm.length ? `類似名:${dupNorm.map((d) => d.name).join(',')}` : 'なし';

  const w = await wikiCoords(wikiTitle); await sleep(400);
  const o = await osmCoords(osmQuery);   await sleep(1100);
  rec.wiki = w; rec.osm = o;
  if (!w || !o) {
    rec.checks.coords = `取得不可 (wiki=${w ? 'o' : 'x'} osm=${o ? 'o' : 'x'})`;
  } else {
    const d = kmBetween(w.lat, w.lng, o.lat, o.lng);
    rec.distanceKm = +d.toFixed(2);
    rec.checks.coords = d <= 5 ? `一致 ${d.toFixed(2)}km` : `不一致 ${d.toFixed(2)}km`;
    if (d <= 5) { rec.lat = +((w.lat + o.lat) / 2).toFixed(5); rec.lng = +((w.lng + o.lng) / 2).toFixed(5); }
  }

  if (rec.lat != null) {
    const near = existing
      .filter((d) => typeof d.lat === 'number' && typeof d.lng === 'number')
      .map((d) => ({ name: d.name, km: kmBetween(rec.lat, rec.lng, d.lat, d.lng) }))
      .filter((x) => x.km < 3).sort((a, b) => a.km - b.km);
    rec.checks.nearby = near.length ? near.map((x) => `${x.name}(${x.km.toFixed(1)}km)`).join(', ') : 'なし';
  }

  rec.pass = rec.checks.duplicate === 'なし'
    && String(rec.checks.coords).startsWith('一致')
    && (rec.checks.nearby === 'なし' || rec.checks.nearby === undefined);
  out.push(rec);
  console.log(`${rec.pass ? '✅' : '❌'} ${name.padEnd(12)} ${pref.padEnd(4)} 座標=${rec.checks.coords} 重複=${rec.checks.duplicate} 近接=${rec.checks.nearby ?? '-'}`);
}

fs.mkdirSync('logs', { recursive: true });
fs.writeFileSync('logs/kyushu_candidates.json', JSON.stringify(out, null, 2));
console.log(`\n合格 ${out.filter((o) => o.pass).length} / ${out.length} 件 → logs/kyushu_candidates.json`);
