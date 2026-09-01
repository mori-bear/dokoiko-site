#!/usr/bin/env node
/**
 * keikanCandidates.mjs — 絶景（宿泊と結びつくもの）の座標検証。
 * 条件（ユーザー指定）:
 *   ・現地または車1時間圏内に実在の宿泊施設がある
 *   ・単なる展望台ではなく、周辺に滞在価値がある
 * ゲートは温泉・街並みと同一（4ソースから独立2ソースが5km以内で一致、既存3km以内は不合格）。
 *
 * 候補は「日本の国立公園・国定公園の主要景観」「名勝」「日本三大〇〇」から、
 * 既存destinationsに無さそうなものを選んだ。宿の裏取りは座標合格後に行う。
 */
import fs from 'fs';

const UA = { 'User-Agent': 'DokoIko-DataAudit/1.0 (tabidokoiko.com; contact@tabidokoiko.com)' };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const kmBetween = (a, b, c, d) => Math.hypot((a - c) * 111, (b - d) * 111 * Math.cos((a * Math.PI) / 180));

// [id, 名前, 県, 市町村, Wikipedia記事候補[], OSM名称トークン[]]
const CANDIDATES = [
  ['tsutanuma',     '蔦沼',         '青森県',   '十和田市',   ['蔦温泉', '蔦沼'],           ['蔦沼']],
  ['goshikinuma-ur','浄土ヶ浜',     '岩手県',   '宮古市',     ['浄土ヶ浜'],                 ['浄土ヶ浜']],
  ['kamabuchi',     '釜淵の滝',     '山形県',   '南陽市',     ['釜渡戸'],                   ['釜淵の滝']],
  ['nabekura',      '鍋倉高原',     '長野県',   '飯山市',     ['鍋倉山 (長野県)'],          ['鍋倉高原']],
  ['ryusendo',      '龍泉洞',       '岩手県',   '岩泉町',     ['龍泉洞'],                   ['龍泉洞']],
  ['himekawa',      '親不知',       '新潟県',   '糸魚川市',   ['親不知'],                   ['親不知']],
  ['tojinbo-oshima','雄島',         '福井県',   '坂井市',     ['雄島 (福井県)'],            ['雄島']],
  ['nachi-otaki',   '桑ノ木の滝',   '和歌山県', '新宮市',     ['桑ノ木の滝'],               ['桑ノ木の滝']],
  ['takachiho-amano','天岩戸神社',  '宮崎県',   '高千穂町',   ['天岩戸神社'],               ['天岩戸神社']],
  ['ohkanmon',      '青の洞門',     '大分県',   '中津市',     ['青の洞門'],                 ['青の洞門']],
  ['nariwa',        '備中松山城',   '岡山県',   '高梁市',     ['備中松山城'],               ['備中松山城']],
  ['takeda-castle', '竹田城',       '兵庫県',   '朝来市',     ['竹田城'],                   ['竹田城']],
  ['ine-funaya',    '伊根の舟屋',   '京都府',   '伊根町',     ['伊根町', '伊根の舟屋群'],   ['伊根の舟屋']],
  ['kaiyodai',      '皆野 美の山',  '埼玉県',   '皆野町',     ['美の山公園'],               ['美の山公園']],
  ['nishiizu-dogashima','堂ヶ島',   '静岡県',   '西伊豆町',   ['堂ヶ島 (静岡県)', '堂ヶ島'], ['堂ヶ島']],
  ['tsunoshima',    '角島',         '山口県',   '下関市',     ['角島'],                     ['角島']],
  ['motonosumi',    '元乃隅神社',   '山口県',   '長門市',     ['元乃隅神社'],               ['元乃隅神社']],
  ['manza-mouth',   '万座毛',       '沖縄県',   '恩納村',     ['万座毛'],                   ['万座毛']],
  ['kabira',        '川平湾',       '沖縄県',   '石垣市',     ['川平湾'],                   ['川平湾']],
  ['oshimizu',      '千里浜なぎさ', '石川県',   '羽咋市',     ['千里浜なぎさドライブウェイ'], ['千里浜なぎさドライブウェイ']],
  ['shirakami',     '青池',         '青森県',   '深浦町',     ['十二湖 (青森県)', '十二湖'], ['青池']],
  ['bijodaira',     '雨晴海岸',     '富山県',   '高岡市',     ['雨晴海岸'],                 ['雨晴海岸']],
  ['nezame',        '寝覚の床',     '長野県',   '上松町',     ['寝覚の床'],                 ['寝覚の床']],
  ['kyukamura-oku', '奥津渓',       '岡山県',   '鏡野町',     ['奥津渓'],                   ['奥津渓']],
  ['soemon',        '瀞峡',         '和歌山県', '新宮市',     ['瀞峡'],                     ['瀞峡']],
];

const existing = JSON.parse(fs.readFileSync('src/data/destinations.json', 'utf8'));
const norm = (s) => String(s || '').replace(/[\s　・（）()「」【】]/g, '')
  .replace(/(市|町|村|区|駅|温泉|温泉郷|公園|神社|寺|大橋)$/g, '');

async function wikiCoords(titles) {
  for (const t of titles) {
    const url = `https://ja.wikipedia.org/w/api.php?action=query&prop=coordinates&colimit=max`
      + `&titles=${encodeURIComponent(t)}&format=json&formatversion=2&redirects=1`;
    try {
      const p = (await (await fetch(url, { headers: UA })).json())?.query?.pages?.[0];
      const c = p?.coordinates?.[0];
      if (c) return { src: 'wikipedia', lat: c.lat, lng: c.lon, note: p.title };
    } catch { /* 次へ */ }
    await sleep(320);
  }
  return null;
}
async function wikidataCoords(label) {
  try {
    const s = `https://www.wikidata.org/w/api.php?action=wbsearchentities&search=${encodeURIComponent(label)}`
      + `&language=ja&uselang=ja&format=json&limit=4&origin=*`;
    const sj = await (await fetch(s, { headers: UA })).json();
    for (const hit of sj.search || []) {
      await sleep(220);
      const e = `https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${hit.id}&props=claims|labels&format=json&origin=*`;
      const ent = (await (await fetch(e, { headers: UA })).json()).entities?.[hit.id];
      const c = ent?.claims?.P625?.[0]?.mainsnak?.datavalue?.value;
      if (c) return { src: 'wikidata', lat: c.latitude, lng: c.longitude, note: hit.id };
    }
  } catch { /* なし */ }
  return null;
}
async function osmStrict(tokens, prefecture) {
  for (const token of tokens) {
    try {
      const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(token)}`
        + `&format=json&limit=10&countrycodes=jp&addressdetails=1&namedetails=1`;
      const rows = await (await fetch(url, { headers: UA })).json();
      await sleep(1100);
      for (const x of rows) {
        const nm = [x.namedetails?.name, x.namedetails?.['name:ja'], (x.display_name || '').split(',')[0]]
          .filter(Boolean).join(' ');
        const pref = x.address?.province || x.address?.state || '';
        if (!nm.includes(token) || pref !== prefecture) continue;
        return { src: 'osm', lat: +x.lat, lng: +x.lon, note: nm.slice(0, 30) };
      }
    } catch { await sleep(1100); }
  }
  return null;
}
async function gsiStrict(name, prefecture) {
  try {
    const j = await (await fetch(`https://msearch.gsi.go.jp/address-search/AddressSearch?q=${encodeURIComponent(name)}`, { headers: UA })).json();
    await sleep(400);
    for (const x of Array.isArray(j) ? j : []) {
      const title = x.properties?.title || '';
      const [lng, lat] = x.geometry?.coordinates ?? [];
      if (lat == null || !title.includes(name)) continue;
      return { src: 'gsi', lat, lng, note: title.slice(0, 30) };
    }
  } catch { /* なし */ }
  return null;
}

const out = [];
for (const [id, name, pref, city, wikiTitles, osmTokens] of CANDIDATES) {
  const rec = { id, name, prefecture: pref, city, checks: {} };
  const dupId = existing.find((d) => d.id === id);
  const dupName = existing.find((d) => d.name === name);
  const dupNorm = existing.filter((d) => norm(d.name) === norm(name) && d.name !== name);
  rec.checks.duplicate = dupId ? `id重複:${dupId.name}` : dupName ? `同名:${dupName.name}`
    : dupNorm.length ? `類似名:${dupNorm.map((d) => d.name).join(',')}` : 'なし';
  if (rec.checks.duplicate !== 'なし') {
    rec.pass = false; out.push(rec);
    console.log(`❌ ${name.padEnd(12)} ${pref.padEnd(5)} 重複=${rec.checks.duplicate}`);
    continue;
  }
  const srcs = [];
  for (const f of [() => wikiCoords(wikiTitles), () => wikidataCoords(name),
    () => osmStrict(osmTokens, pref), () => gsiStrict(name, pref)]) {
    const r = await f(); if (r) srcs.push(r);
  }
  rec.sources = srcs;
  let best = null;
  for (let i = 0; i < srcs.length; i++) for (let k = i + 1; k < srcs.length; k++) {
    const d = kmBetween(srcs[i].lat, srcs[i].lng, srcs[k].lat, srcs[k].lng);
    if (d <= 5 && (!best || d < best.d)) best = { a: srcs[i], b: srcs[k], d };
  }
  if (!best) {
    rec.checks.coords = srcs.length < 2 ? `2ソース未満 (${srcs.map((s) => s.src).join(',') || 'なし'})` : `一致なし (${srcs.map((s) => s.src).join(',')})`;
    rec.pass = false; out.push(rec);
    console.log(`❌ ${name.padEnd(12)} ${pref.padEnd(5)} 座標=${rec.checks.coords}`);
    continue;
  }
  rec.checks.coords = `一致 ${best.d.toFixed(2)}km (${best.a.src}×${best.b.src})`;
  rec.distanceKm = +best.d.toFixed(2);
  rec.verifiedBy = [best.a.src, best.b.src];
  rec.lat = +((best.a.lat + best.b.lat) / 2).toFixed(5);
  rec.lng = +((best.a.lng + best.b.lng) / 2).toFixed(5);
  const near = existing.filter((d) => typeof d.lat === 'number')
    .map((d) => ({ name: d.name, km: kmBetween(rec.lat, rec.lng, d.lat, d.lng) }))
    .filter((x) => x.km < 3).sort((a, b) => a.km - b.km);
  rec.checks.nearby = near.length ? near.map((x) => `${x.name}(${x.km.toFixed(1)}km)`).join(', ') : 'なし';
  rec.pass = rec.checks.nearby === 'なし';
  out.push(rec);
  console.log(`${rec.pass ? '✅' : '❌'} ${name.padEnd(12)} ${pref.padEnd(5)} 座標=${rec.checks.coords.padEnd(30)} 近接=${rec.checks.nearby}`);
}
const passed = out.filter((r) => r.pass);
fs.writeFileSync('logs/keikan_candidates.json', JSON.stringify(out, null, 1));
console.log(`\n合格 ${passed.length} / ${out.length} 件 → logs/keikan_candidates.json`);
