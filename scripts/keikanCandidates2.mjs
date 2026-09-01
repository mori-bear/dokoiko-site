#!/usr/bin/env node
/**
 * keikanCandidates.mjs — 絶景（宿泊と結びつくもの）の座標検証。
 * 条件（ユーザー指定）:
 *   ・現地または車1時間圏内に実在の宿泊施設がある
 *   ・単なる展望台ではなく、周辺に滞在価値がある
 * ゲートは温泉・街並みと同一（4ソースから独立2ソースが5km以内で一致、既存3km以内は不合格）。
 *
 * 候補は国指定名勝536件を機械照合して未掲載125件に絞り、そこから
 * 「宿と結びつく（温泉地や城下町が近い）」ものを選んだ（keikanCandidates.mjsの第2版）。
 * 1回目は有名すぎる絶景ばかりで、12件中8件が既存エントリのspotとして収録済みだった。
 */
import fs from 'fs';

const UA = { 'User-Agent': 'DokoIko-DataAudit/1.0 (tabidokoiko.com; contact@tabidokoiko.com)' };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const kmBetween = (a, b, c, d) => Math.hypot((a - c) * 111, (b - d) * 111 * Math.cos((a * Math.PI) / 180));

// [id, 名前, 県, 市町村, Wikipedia記事候補[], OSM名称トークン[]]
const CANDIDATES = [
  ['fukiware',    '吹割の滝',   '群馬県',   '沼田市',     ['吹割の滝'],         ['吹割の滝']],
  ['myogisan',    '妙義山',     '群馬県',   '富岡市',     ['妙義山'],           ['妙義山']],
  ['sasagawa',    '笹川流れ',   '新潟県',   '村上市',     ['笹川流れ'],         ['笹川流れ']],
  ['shomyodaki',  '称名滝',     '富山県',   '立山町',     ['称名滝'],           ['称名滝']],
  ['sotomo',      '蘇洞門',     '福井県',   '小浜市',     ['蘇洞門'],           ['蘇洞門']],
  ['shosenkyo',   '昇仙峡',     '山梨県',   '甲府市',     ['御岳昇仙峡', '昇仙峡'], ['昇仙峡']],
  ['tenryukyo',   '天龍峡',     '長野県',   '飯田市',     ['天竜峡'],           ['天竜峡']],
  ['shiramizu',   '白水滝',     '岐阜県',   '白川村',     ['白水の滝 (岐阜県)', '白水滝'], ['白水の滝']],
  ['akame',       '赤目四十八滝', '三重県', '名張市',     ['赤目四十八滝'],     ['赤目四十八滝']],
  ['rurikei',     '瑠璃渓',     '京都府',   '南丹市',     ['瑠璃渓'],           ['瑠璃渓']],
  ['kasumi-kaigan','香住海岸',  '兵庫県',   '香美町',     ['香住海岸', '但馬御火浦'], ['香住海岸']],
  ['ojika',       '小鹿渓',     '鳥取県',   '三朝町',     ['小鹿渓'],           ['小鹿渓']],
  ['kuniga',      '国賀海岸',   '島根県',   '西ノ島町',   ['国賀海岸'],         ['国賀海岸']],
  ['dangyokei',   '断魚渓',     '島根県',   '邑南町',     ['断魚渓'],           ['断魚渓']],
  ['sandankyo',   '三段峡',     '広島県',   '安芸太田町', ['三段峡'],           ['三段峡']],
  ['taishakukyo', '帝釈峡',     '広島県',   '庄原市',     ['帝釈峡'],           ['帝釈峡']],
  ['chomonkyo',   '長門峡',     '山口県',   '山口市',     ['長門峡'],           ['長門峡']],
  ['omogokei',    '面河渓',     '愛媛県',   '久万高原町', ['面河渓'],           ['面河渓']],
  ['ozuru',       '尾鈴山瀑布群', '宮崎県', '都農町',     ['尾鈴山'],           ['尾鈴山瀑布群']],
  ['nakayama-sen','中山仙境',   '大分県',   '豊後高田市', ['中山仙境'],         ['中山仙境']],
  ['sengan',      '千巌山',     '熊本県',   '上天草市',   ['千巌山'],           ['千巌山']],
  ['toriike',     '通り池',     '沖縄県',   '宮古島市',   ['通り池'],           ['通り池']],
  ['nasonoshirataki','奈曽の白瀑', '秋田県', 'にかほ市',  ['奈曽の白滝', '奈曽の白瀑谷'], ['奈曽の白滝']],
  ['oya-kigan',   '大谷の奇岩群', '栃木県', '宇都宮市',   ['大谷石', '大谷 (宇都宮市)'], ['大谷景観公園']],
  ['gokei',       '豪渓',       '岡山県',   '総社市',     ['豪渓'],             ['豪渓']],
  ['sekichukei',  '石柱渓',     '山口県',   '下関市',     ['石柱渓'],           ['石柱渓']],
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
fs.writeFileSync('logs/keikan_candidates2.json', JSON.stringify(out, null, 1));
console.log(`\n合格 ${passed.length} / ${out.length} 件 → logs/keikan_candidates2.json`);
