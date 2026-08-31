#!/usr/bin/env node
/**
 * hitouCandidates.mjs — 全国の秘湯・一軒宿候補を多ソース座標照合にかける。
 *
 * 九州回で判明した問題への対処:
 *   ゲートを Wikipedia×OSM に固定すると、無名な一軒宿ほど ja.wiki に {{Coord}} が無く
 *   機械的に全滅する（＝無名であるほど落ちる逆選抜）。
 *   そこで座標ソースを4つに広げ、「独立した2ソースが5km以内で一致」を条件にする。
 *     A. ja.Wikipedia prop=coordinates（colimit=max 必須。既定10で黙って落ちる）
 *     B. Wikidata P625
 *     C. OSM/Nominatim（①返却名に候補名を含む ②県が一致 の2条件で厳格化）
 *     D. 国土地理院 地名検索（①titleが県から始まる ②titleに候補名を含む で厳格化）
 *   ゆるめたのはソースの選択肢であって、一致の判定基準ではない。
 *
 * さらに 既存destinationとの id/同名/正規化名の重複、3km以内の近接、
 * 候補同士の近接、確定座標の逆ジオコーディング市町村照合まで見る。
 */
import fs from 'fs';

const UA = { 'User-Agent': 'DokoIko-DataAudit/1.0 (tabidokoiko.com; contact@tabidokoiko.com)' };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const kmBetween = (a, b, c, d) => Math.hypot((a - c) * 111, (b - d) * 111 * Math.cos((a * Math.PI) / 180));

// [id, 名前, 県, 市町村, Wikipedia記事候補[], OSM名称トークン[]]
const CANDIDATES = [
  ['marukoma',      '丸駒温泉',     '北海道', '千歳市',   ['丸駒温泉'],           ['丸駒温泉']],
  ['iwaobetsu',     '岩尾別温泉',   '北海道', '斜里町',   ['岩尾別温泉'],         ['岩尾別温泉']],
  ['metoh',         '芽登温泉',     '北海道', '足寄町',   ['芽登温泉'],           ['芽登温泉']],
  ['yoroushi',      '養老牛温泉',   '北海道', '中標津町', ['養老牛温泉'],         ['養老牛温泉']],
  ['aoni',          '青荷温泉',     '青森県', '黒石市',   ['青荷温泉'],           ['青荷温泉']],
  ['yachi-onsen',   '谷地温泉',     '青森県', '十和田市', ['谷地温泉'],           ['谷地温泉']],
  ['tsuta-onsen',   '蔦温泉',       '青森県', '十和田市', ['蔦温泉'],             ['蔦温泉']],
  ['okuyagen',      '奥薬研温泉',   '青森県', 'むつ市',   ['奥薬研温泉', '薬研温泉'], ['奥薬研温泉', '薬研温泉']],
  ['toshichi',      '藤七温泉',     '岩手県', '八幡平市', ['藤七温泉'],           ['藤七温泉']],
  ['namari-onsen',  '鉛温泉',       '岩手県', '花巻市',   ['鉛温泉'],             ['鉛温泉']],
  ['geto-onsen',    '夏油温泉',     '岩手県', '北上市',   ['夏油温泉'],           ['夏油温泉']],
  ['matsukawa-iwate','松川温泉',    '岩手県', '八幡平市', ['松川温泉 (岩手県)', '松川温泉'], ['松川温泉']],
  ['gaga-onsen',    '峩々温泉',     '宮城県', '川崎町',   ['峩々温泉'],           ['峩々温泉']],
  ['tsurunoyu',     '鶴の湯温泉',   '秋田県', '仙北市',   ['鶴の湯温泉'],         ['鶴の湯温泉', '鶴の湯']],
  ['kuroyu',        '黒湯温泉',     '秋田県', '仙北市',   ['黒湯温泉'],           ['黒湯温泉']],
  ['magoroku',      '孫六温泉',     '秋田県', '仙北市',   ['孫六温泉'],           ['孫六温泉']],
  ['doroyu',        '泥湯温泉',     '秋田県', '湯沢市',   ['泥湯温泉'],           ['泥湯温泉']],
  ['namekawa',      '滑川温泉',     '山形県', '米沢市',   ['滑川温泉'],           ['滑川温泉']],
  ['odaira-onsen',  '大平温泉',     '山形県', '米沢市',   ['大平温泉'],           ['大平温泉']],
  ['ubayu',         '姥湯温泉',     '山形県', '米沢市',   ['姥湯温泉'],           ['姥湯温泉']],
  ['tokusa',        '木賊温泉',     '福島県', '南会津町', ['木賊温泉'],           ['木賊温泉']],
  ['nukunuyu',      '微温湯温泉',   '福島県', '福島市',   ['微温湯温泉'],         ['微温湯温泉']],
  ['futamata',      '二岐温泉',     '福島県', '天栄村',   ['二岐温泉'],           ['二岐温泉']],
  ['kashi-onsen',   '甲子温泉',     '福島県', '白河市',   ['甲子温泉'],           ['甲子温泉']],
  ['kita-onsen',    '北温泉',       '栃木県', '那須町',   ['北温泉'],             ['北温泉']],
  ['sandogoya',     '三斗小屋温泉', '栃木県', '那須塩原市', ['三斗小屋温泉'],     ['三斗小屋温泉']],
  ['okukinu',       '奥鬼怒温泉郷', '栃木県', '日光市',   ['奥鬼怒温泉郷', '奥鬼怒温泉'], ['奥鬼怒', '加仁湯', '八丁の湯']],
  ['hoshi-onsen',   '法師温泉',     '群馬県', 'みなかみ町', ['法師温泉'],         ['法師温泉']],
  ['shiriyaki',     '尻焼温泉',     '群馬県', '中之条町', ['尻焼温泉'],           ['尻焼温泉']],
  ['hanashiki',     '花敷温泉',     '群馬県', '中之条町', ['花敷温泉'],           ['花敷温泉']],
  ['renge-onsen',   '蓮華温泉',     '新潟県', '糸魚川市', ['蓮華温泉'],           ['蓮華温泉']],
  ['tochiomata',    '栃尾又温泉',   '新潟県', '魚沼市',   ['栃尾又温泉'],         ['栃尾又温泉']],
  ['kaikake',       '貝掛温泉',     '新潟県', '湯沢町',   ['貝掛温泉'],           ['貝掛温泉']],
  ['nakabusa',      '中房温泉',     '長野県', '安曇野市', ['中房温泉'],           ['中房温泉']],
  ['takamine',      '高峰温泉',     '長野県', '小諸市',   ['高峰温泉'],           ['高峰温泉']],
  ['shichimi',      '七味温泉',     '長野県', '高山村',   ['七味温泉'],           ['七味温泉']],
  ['kuronagi',      '黒薙温泉',     '富山県', '黒部市',   ['黒薙温泉'],           ['黒薙温泉']],
  ['babadani',      '祖母谷温泉',   '富山県', '黒部市',   ['祖母谷温泉'],         ['祖母谷温泉']],
  ['ogawa-motoyu',  '小川温泉元湯', '富山県', '朝日町',   ['小川温泉'],           ['小川温泉']],
  ['nigorigo',      '濁河温泉',     '岐阜県', '下呂市',   ['濁河温泉'],           ['濁河温泉']],
  ['fukuji',        '福地温泉',     '岐阜県', '高山市',   ['福地温泉'],           ['福地温泉']],
  ['nishiyama-yama','西山温泉',     '山梨県', '早川町',   ['西山温泉 (山梨県)', '西山温泉'], ['西山温泉', '慶雲館']],
  ['naradani',      '奈良田温泉',   '山梨県', '早川町',   ['奈良田温泉', '奈良田'], ['奈良田温泉', '奈良田']],
  ['umegashima',    '梅ヶ島温泉',   '静岡県', '静岡市',   ['梅ヶ島温泉'],         ['梅ヶ島温泉']],
  ['kakinoki',      '柿木温泉',     '島根県', '吉賀町',   ['柿木温泉', '柿木村'], ['柿木温泉', 'はとの湯荘']],
  ['chihara',       '千原温泉',     '島根県', '美郷町',   ['千原温泉'],           ['千原温泉']],
  ['koyabara',      '小屋原温泉',   '島根県', '大田市',   ['小屋原温泉'],         ['小屋原温泉']],
  ['gouroku',       '郷緑温泉',     '岡山県', '真庭市',   ['郷緑温泉'],           ['郷緑温泉']],
  ['maga-onsen',    '真賀温泉',     '岡山県', '真庭市',   ['真賀温泉'],           ['真賀温泉']],
  ['iya-onsen',     '祖谷温泉',     '徳島県', '三好市',   ['祖谷温泉'],           ['祖谷温泉']],
  ['matsubagawa',   '松葉川温泉',   '高知県', '四万十町', ['松葉川温泉'],         ['松葉川温泉']],
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
    } catch { /* 次の候補名へ */ }
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
      if (c) return { src: 'wikidata', lat: c.latitude, lng: c.longitude, note: `${hit.id} ${ent.labels?.ja?.value ?? ''}` };
    }
  } catch { /* 取得不可 */ }
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
        return { src: 'osm', lat: +x.lat, lng: +x.lon, note: `${nm.slice(0, 32)} [${token}]` };
      }
    } catch { await sleep(1100); }
  }
  return null;
}

async function gsiStrict(name, prefecture) {
  try {
    const url = `https://msearch.gsi.go.jp/address-search/AddressSearch?q=${encodeURIComponent(name)}`;
    const j = await (await fetch(url, { headers: UA })).json();
    await sleep(400);
    for (const x of Array.isArray(j) ? j : []) {
      const title = x.properties?.title || '';
      const [lng, lat] = x.geometry?.coordinates ?? [];
      if (lat == null) continue;
      // 地名検索は「温泉」を落として部分一致するため、県一致と完全名含有の両方を必須にする
      if (!title.startsWith(prefecture) && !title.includes(name)) continue;
      if (!title.includes(name)) continue;
      return { src: 'gsi', lat, lng, note: title.slice(0, 32) };
    }
  } catch { /* 取得不可 */ }
  return null;
}

const out = [];
for (const [id, name, pref, city, wikiTitles, osmTokens] of CANDIDATES) {
  const rec = { id, name, prefecture: pref, city, checks: {} };

  // ① 重複
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

  // ② 座標を4ソースから集める
  const srcs = [];
  for (const f of [() => wikiCoords(wikiTitles), () => wikidataCoords(name),
    () => osmStrict(osmTokens, pref), () => gsiStrict(name, pref)]) {
    const r = await f();
    if (r) srcs.push(r);
  }
  rec.sources = srcs.map((s) => ({ ...s, lat: +s.lat.toFixed(5), lng: +s.lng.toFixed(5) }));

  // ③ 5km以内で一致するペアを探す（最も近い2つを採用）
  let best = null;
  for (let i = 0; i < srcs.length; i++) {
    for (let k = i + 1; k < srcs.length; k++) {
      const d = kmBetween(srcs[i].lat, srcs[i].lng, srcs[k].lat, srcs[k].lng);
      if (d <= 5 && (!best || d < best.d)) best = { a: srcs[i], b: srcs[k], d };
    }
  }
  if (!best) {
    rec.checks.coords = srcs.length < 2
      ? `2ソース未満 (${srcs.map((s) => s.src).join(',') || 'なし'})`
      : `一致なし (${srcs.map((s) => s.src).join(',')})`;
    rec.pass = false; out.push(rec);
    console.log(`❌ ${name.padEnd(12)} ${pref.padEnd(4)} 座標=${rec.checks.coords}`);
    continue;
  }
  rec.checks.coords = `一致 ${best.d.toFixed(2)}km (${best.a.src}×${best.b.src})`;
  rec.distanceKm = +best.d.toFixed(2);
  rec.verifiedBy = [best.a.src, best.b.src];
  rec.lat = +((best.a.lat + best.b.lat) / 2).toFixed(5);
  rec.lng = +((best.a.lng + best.b.lng) / 2).toFixed(5);

  // ④ 既存との近接
  const near = existing.filter((d) => typeof d.lat === 'number')
    .map((d) => ({ name: d.name, km: kmBetween(rec.lat, rec.lng, d.lat, d.lng) }))
    .filter((x) => x.km < 3).sort((a, b) => a.km - b.km);
  rec.checks.nearby = near.length ? near.map((x) => `${x.name}(${x.km.toFixed(1)}km)`).join(', ') : 'なし';

  rec.pass = rec.checks.nearby === 'なし';
  out.push(rec);
  console.log(`${rec.pass ? '✅' : '❌'} ${name.padEnd(12)} ${pref.padEnd(4)} 座標=${rec.checks.coords.padEnd(30)} 近接=${rec.checks.nearby}`);
}

// 候補同士の近接
const passed = out.filter((r) => r.pass);
for (let i = 0; i < passed.length; i++) {
  for (let k = i + 1; k < passed.length; k++) {
    const d = kmBetween(passed[i].lat, passed[i].lng, passed[k].lat, passed[k].lng);
    if (d < 3) console.log(`⚠️ 候補同士が近接: ${passed[i].name} ↔ ${passed[k].name} ${d.toFixed(2)}km`);
  }
}

fs.mkdirSync('logs', { recursive: true });
fs.writeFileSync('logs/hitou_candidates.json', JSON.stringify(out, null, 2));
console.log(`\n合格 ${passed.length} / ${out.length} 件 → logs/hitou_candidates.json`);
