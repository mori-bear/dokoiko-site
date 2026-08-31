#!/usr/bin/env node
/**
 * hitouCandidates2.mjs — 秘湯候補の第2バッチ。ゲートは hitouCandidates.mjs と同一。
 * 手薄なエリア（北海道・東北北部・北関東・北陸・近畿・中国四国）を厚めに入れている。
 */
import fs from 'fs';

const UA = { 'User-Agent': 'DokoIko-DataAudit/1.0 (tabidokoiko.com; contact@tabidokoiko.com)' };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const kmBetween = (a, b, c, d) => Math.hypot((a - c) * 111, (b - d) * 111 * Math.cos((a * Math.PI) / 180));

const CANDIDATES = [
  // 北海道
  ['nukabira',     '糠平温泉',     '北海道', '上士幌町', ['糠平温泉'],   ['糠平温泉']],
  ['horoka',       '幌加温泉',     '北海道', '上士幌町', ['幌加温泉'],   ['幌加温泉']],
  ['kanno-onsen',  'かんの温泉',   '北海道', '鹿追町',   ['然別峡かんの温泉', 'かんの温泉'], ['かんの温泉']],
  ['futamata-radium','二股らじうむ温泉','北海道','長万部町',['二股らじうむ温泉'], ['二股らじうむ温泉']],
  ['nigorikawa',   '濁川温泉',     '北海道', '森町',     ['濁川温泉'],   ['濁川温泉']],
  ['fukiage-hok',  '吹上温泉',     '北海道', '上富良野町', ['吹上温泉 (北海道)', '吹上温泉'], ['吹上温泉']],
  // 東北
  ['sarukura',     '猿倉温泉',     '青森県', '十和田市', ['猿倉温泉'],   ['猿倉温泉']],
  ['yagen',        '薬研温泉',     '青森県', 'むつ市',   ['薬研温泉'],   ['薬研温泉']],
  ['sukayu',       '酸ヶ湯温泉',   '青森県', '青森市',   ['酸ヶ湯温泉', '酸ヶ湯'], ['酸ヶ湯']],
  ['yukawa-iwate', '湯川温泉',     '岩手県', '西和賀町', ['湯川温泉 (岩手県)', '湯川温泉'], ['湯川温泉']],
  ['sugo',         '巣郷温泉',     '岩手県', '西和賀町', ['巣郷温泉'],   ['巣郷温泉']],
  ['osawa-onsen',  '大沢温泉',     '岩手県', '花巻市',   ['大沢温泉 (岩手県)', '大沢温泉'], ['大沢温泉']],
  ['fudoki',       '不忘閣',       '宮城県', '川崎町',   ['青根温泉'],   ['青根温泉']],
  ['yubama',       '湯浜温泉',     '宮城県', '栗原市',   ['湯浜温泉'],   ['湯浜温泉']],
  ['kanigasaki',   '蟹場温泉',     '秋田県', '仙北市',   ['蟹場温泉'],   ['蟹場温泉']],
  ['ougama',       '大釜温泉',     '秋田県', '仙北市',   ['大釜温泉'],   ['大釜温泉']],
  ['utto',         '打当温泉',     '秋田県', '北秋田市', ['打当温泉'],   ['打当温泉']],
  ['tainai',       '湯の沢温泉',   '山形県', '西川町',   ['湯の沢温泉'], ['湯の沢温泉']],
  ['seorasou',     '瀬見温泉',     '山形県', '最上町',   ['瀬見温泉'],   ['瀬見温泉']],
  ['akakura-yama', '赤倉温泉',     '山形県', '最上町',   ['赤倉温泉 (山形県)'], ['赤倉温泉']],
  ['numajiri',     '沼尻温泉',     '福島県', '猪苗代町', ['沼尻温泉'],   ['沼尻温泉']],
  ['tsuchiyu',     '土湯温泉',     '福島県', '福島市',   ['土湯温泉'],   ['土湯温泉']],
  ['nakanosawa',   '中ノ沢温泉',   '福島県', '猪苗代町', ['中ノ沢温泉'], ['中ノ沢温泉']],
  ['yunohana-fk',  '湯ノ花温泉',   '福島県', '南会津町', ['湯ノ花温泉'], ['湯ノ花温泉']],
  // 関東
  ['teshirosawa',  '手白澤温泉',   '栃木県', '日光市',   ['手白沢温泉', '手白澤温泉'], ['手白沢温泉']],
  ['nishizawa',    '西沢渓谷',     '山梨県', '山梨市',   ['西沢渓谷'],   ['西沢渓谷']],
  ['kuzuu',        '奥日光湯元温泉','栃木県', '日光市',   ['日光湯元温泉'], ['日光湯元温泉']],
  ['tsukiyono',    '湯宿温泉',     '群馬県', 'みなかみ町', ['湯宿温泉'], ['湯宿温泉']],
  ['kawaura',      '川浦温泉',     '山梨県', '山梨市',   ['川浦温泉'],   ['川浦温泉']],
  ['akaiwa',       '赤岩温泉',     '群馬県', '中之条町', ['沢渡温泉'],   ['沢渡温泉']],
  ['kusatsu-sainokawara','応徳温泉','群馬県','中之条町', ['応徳温泉'],   ['応徳温泉']],
  // 中部・北陸
  ['tsubame-onsen','燕温泉',       '新潟県', '妙高市',   ['燕温泉'],     ['燕温泉']],
  ['renge-niigata','蓮華温泉',     '新潟県', '糸魚川市', ['蓮華温泉'],   ['蓮華温泉']],
  ['matsunoyama',  '松之山温泉',   '新潟県', '十日町市', ['松之山温泉'], ['松之山温泉']],
  ['iwaki-toyama', '岩井戸温泉',   '富山県', '氷見市',   ['岩井戸温泉'], ['岩井戸温泉']],
  ['nakabusa2',    '白骨温泉',     '長野県', '松本市',   ['白骨温泉'],   ['白骨温泉']],
  ['tsumagoi',     '本沢温泉',     '長野県', '南牧村',   ['本沢温泉'],   ['本沢温泉']],
  ['kaisou',       '海尻温泉',     '長野県', '南牧村',   ['海尻温泉'],   ['海尻温泉']],
  ['tazawa-nagano','田沢温泉',     '長野県', '青木村',   ['田沢温泉'],   ['田沢温泉']],
  ['kutsukake',    '沓掛温泉',     '長野県', '青木村',   ['沓掛温泉'],   ['沓掛温泉']],
  ['shirahone2',   '崎温泉',       '長野県', '大町市',   ['葛温泉'],     ['葛温泉']],
  ['hirayu',       '新穂高温泉',   '岐阜県', '高山市',   ['新穂高温泉'], ['新穂高温泉']],
  ['tochio',       '栃尾温泉',     '岐阜県', '高山市',   ['栃尾温泉'],   ['栃尾温泉']],
  ['shimobe',      '下部温泉',     '山梨県', '身延町',   ['下部温泉'],   ['下部温泉']],
  ['yumata',       '湯俣温泉',     '長野県', '大町市',   ['湯俣温泉'],   ['湯俣温泉']],
  // 近畿・中国・四国
  ['totsukawa',    '十津川温泉',   '奈良県', '十津川村', ['十津川温泉'], ['十津川温泉']],
  ['kamikitayama', '入之波温泉',   '奈良県', '川上村',   ['入之波温泉'], ['入之波温泉']],
  ['dorogawa',     '洞川温泉',     '奈良県', '天川村',   ['洞川温泉'],   ['洞川温泉']],
  ['yunomine',     '湯の峰温泉',   '和歌山県', '田辺市', ['湯の峰温泉'], ['湯の峰温泉']],
  ['kawayu-waka',  '川湯温泉',     '和歌山県', '田辺市', ['川湯温泉 (和歌山県)'], ['川湯温泉']],
  ['iwai-tottori', '岩井温泉',     '鳥取県', '岩美町',   ['岩井温泉'],   ['岩井温泉']],
  ['misasa2',      '関金温泉',     '鳥取県', '倉吉市',   ['関金温泉'],   ['関金温泉']],
  ['yubara-gouraku','湯原温泉',    '岡山県', '真庭市',   ['湯原温泉'],   ['湯原温泉']],
  ['yuki-hiroshima','湯来温泉',    '広島県', '広島市',   ['湯来温泉'],   ['湯来温泉']],
  ['motoyu-shikoku','本谷温泉',    '愛媛県', '西条市',   ['本谷温泉'],   ['本谷温泉']],
  ['iyagawa',      '新祖谷温泉',   '徳島県', '三好市',   ['祖谷温泉'],   ['新祖谷温泉']],
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
    console.log(`❌ ${name.padEnd(12)} ${pref.padEnd(4)} 重複=${rec.checks.duplicate}`);
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
    console.log(`❌ ${name.padEnd(12)} ${pref.padEnd(4)} 座標=${rec.checks.coords}`);
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
  console.log(`${rec.pass ? '✅' : '❌'} ${name.padEnd(12)} ${pref.padEnd(4)} 座標=${rec.checks.coords.padEnd(30)} 近接=${rec.checks.nearby}`);
}

const passed = out.filter((r) => r.pass);
for (let i = 0; i < passed.length; i++) for (let k = i + 1; k < passed.length; k++) {
  const d = kmBetween(passed[i].lat, passed[i].lng, passed[k].lat, passed[k].lng);
  if (d < 3) console.log(`⚠️ 候補同士が近接: ${passed[i].name} ↔ ${passed[k].name} ${d.toFixed(2)}km`);
}
fs.writeFileSync('logs/hitou_candidates2.json', JSON.stringify(out, null, 2));
console.log(`\n合格 ${passed.length} / ${out.length} 件 → logs/hitou_candidates2.json`);
