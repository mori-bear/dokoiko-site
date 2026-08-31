#!/usr/bin/env node
/**
 * hitouCandidates3.mjs — 第3バッチ。西日本（近畿・中国・四国）と手薄な県を厚めにした温泉候補。
 * ゲートは hitouCandidates.mjs / 2 と同一（4ソースから独立2ソースが5km以内で一致）。
 * 件数の少ない県: 大阪17 / 埼玉18 / 徳島18 / 愛媛18 / 長崎18 / 三重20 / 兵庫20 /
 *                 和歌山20 / 鳥取20 / 広島20（prefCoverage.mjs 実測）
 */
import fs from 'fs';

const UA = { 'User-Agent': 'DokoIko-DataAudit/1.0 (tabidokoiko.com; contact@tabidokoiko.com)' };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const kmBetween = (a, b, c, d) => Math.hypot((a - c) * 111, (b - d) * 111 * Math.cos((a * Math.PI) / 180));

// [id, 名前, 県, 市町村, Wikipedia記事候補[], OSM名称トークン[]]
const CANDIDATES = [
  // ── 三重 ──
  ['sakakibara',   '榊原温泉',   '三重県', '津市',     ['榊原温泉'],   ['榊原温泉']],
  ['yunoyama',     '湯の山温泉', '三重県', '菰野町',   ['湯の山温泉'], ['湯の山温泉']],
  ['kahada',       '香肌峡温泉', '三重県', '松阪市',   ['香肌峡温泉'], ['香肌峡温泉']],
  // ── 滋賀 ──
  ['sugatani',     '須賀谷温泉', '滋賀県', '長浜市',   ['須賀谷温泉'], ['須賀谷温泉']],
  ['ogoto',        'おごと温泉', '滋賀県', '大津市',   ['雄琴温泉'],   ['雄琴温泉', 'おごと温泉']],
  // ── 京都 ──
  ['yunohana-kyo', '湯の花温泉', '京都府', '亀岡市',   ['湯の花温泉'], ['湯の花温泉']],
  ['kumihama',     '久美浜温泉', '京都府', '京丹後市', ['久美浜温泉'], ['久美浜温泉']],
  ['kutsukake-kyo','夕日ヶ浦温泉','京都府','京丹後市', ['夕日ヶ浦温泉'], ['夕日ヶ浦温泉']],
  // ── 大阪 ──
  ['inunakiyama',  '犬鳴山温泉', '大阪府', '泉佐野市', ['犬鳴山温泉', '犬鳴山'], ['犬鳴山温泉', '犬鳴山']],
  // ── 兵庫 ──
  ['yumura-hyogo', '湯村温泉',   '兵庫県', '新温泉町', ['湯村温泉 (兵庫県)'], ['湯村温泉']],
  ['shioda',       '塩田温泉',   '兵庫県', '姫路市',   ['塩田温泉'],   ['塩田温泉']],
  ['kannabe',      '神鍋温泉',   '兵庫県', '豊岡市',   ['神鍋温泉'],   ['神鍋温泉']],
  ['sumoto-onsen', '洲本温泉',   '兵庫県', '洲本市',   ['洲本温泉'],   ['洲本温泉']],
  // ── 奈良 ──
  ['tenkawa',      '天川温泉',   '奈良県', '天川村',   ['天川村'],     ['天の川温泉', '天川温泉']],
  // ── 和歌山 ──
  ['ryujin',       '龍神温泉',   '和歌山県', '田辺市', ['龍神温泉'],   ['龍神温泉']],
  ['hanayama',     '花山温泉',   '和歌山県', '和歌山市', ['花山温泉'], ['花山温泉']],
  ['watarase',     '渡瀬温泉',   '和歌山県', '田辺市', ['渡瀬温泉'],   ['渡瀬温泉']],
  // ── 鳥取 ──
  ['misasa',       '三朝温泉',   '鳥取県', '三朝町',   ['三朝温泉'],   ['三朝温泉']],
  ['shikano',      '鹿野温泉',   '鳥取県', '鳥取市',   ['鹿野温泉'],   ['鹿野温泉']],
  ['hamamura',     '浜村温泉',   '鳥取県', '鳥取市',   ['浜村温泉'],   ['浜村温泉']],
  ['togo',         '東郷温泉',   '鳥取県', '湯梨浜町', ['東郷温泉'],   ['東郷温泉']],
  ['hawai',        'はわい温泉', '鳥取県', '湯梨浜町', ['はわい温泉'], ['はわい温泉']],
  ['yoshioka',     '吉岡温泉',   '鳥取県', '鳥取市',   ['吉岡温泉'],   ['吉岡温泉']],
  // ── 島根 ──
  ['yunotsu',      '温泉津温泉', '島根県', '大田市',   ['温泉津温泉'], ['温泉津温泉']],
  ['arifuku',      '有福温泉',   '島根県', '江津市',   ['有福温泉'],   ['有福温泉']],
  ['yunokawa-shim','湯の川温泉', '島根県', '出雲市',   ['湯の川温泉 (島根県)'], ['湯の川温泉']],
  ['sanbe',        '三瓶温泉',   '島根県', '大田市',   ['三瓶温泉'],   ['三瓶温泉']],
  ['izumoyumura',  '出雲湯村温泉','島根県','雲南市',   ['出雲湯村温泉'], ['出雲湯村温泉']],
  ['tonbara',      '頓原温泉',   '島根県', '飯南町',   ['頓原温泉'],   ['頓原温泉']],
  // ── 岡山 ──
  ['okutsu',       '奥津温泉',   '岡山県', '鏡野町',   ['奥津温泉'],   ['奥津温泉']],
  ['yunogo',       '湯郷温泉',   '岡山県', '美作市',   ['湯郷温泉'],   ['湯郷温泉']],
  ['hannyaji',     '般若寺温泉', '岡山県', '鏡野町',   ['般若寺温泉'], ['般若寺温泉']],
  ['yubara-onsen', '湯原温泉郷', '岡山県', '真庭市',   ['湯原温泉郷'], ['砂湯', '湯原温泉郷']],
  // ── 広島 ──
  ['yano-onsen',   '矢野温泉',   '広島県', '府中市',   ['矢野温泉'],   ['矢野温泉']],
  ['kimita',       '君田温泉',   '広島県', '三次市',   ['君田温泉'],   ['君田温泉']],
  ['ushiobara',    '潮原温泉',   '広島県', '廿日市市', ['潮原温泉'],   ['潮原温泉']],
  ['miyahama',     '宮浜温泉',   '広島県', '廿日市市', ['宮浜温泉'],   ['宮浜温泉']],
  // ── 山口 ──
  ['yuda',         '湯田温泉',   '山口県', '山口市',   ['湯田温泉'],   ['湯田温泉']],
  ['nagatoyumoto', '長門湯本温泉','山口県','長門市',   ['長門湯本温泉'], ['長門湯本温泉']],
  ['tawarayama',   '俵山温泉',   '山口県', '長門市',   ['俵山温泉'],   ['俵山温泉']],
  ['kawatana',     '川棚温泉',   '山口県', '下関市',   ['川棚温泉'],   ['川棚温泉']],
  ['yumen',        '湯免温泉',   '山口県', '長門市',   ['湯免温泉'],   ['湯免温泉']],
  ['yuno-yamaguchi','湯野温泉',  '山口県', '周南市',   ['湯野温泉'],   ['湯野温泉']],
  // ── 徳島 ──
  ['kamiyama',     '神山温泉',   '徳島県', '神山町',   ['神山温泉'],   ['神山温泉']],
  ['tsukigatani',  '月ヶ谷温泉', '徳島県', '上勝町',   ['月ヶ谷温泉'], ['月ヶ谷温泉']],
  ['hinomine',     '日和佐温泉', '徳島県', '美波町',   ['日和佐温泉'], ['日和佐温泉']],
  // ── 香川 ──
  ['shionoe',      '塩江温泉',   '香川県', '高松市',   ['塩江温泉'],   ['塩江温泉']],
  // ── 愛媛 ──
  ['nibukawa',     '鈍川温泉',   '愛媛県', '今治市',   ['鈍川温泉'],   ['鈍川温泉']],
  ['yunoura',      '湯ノ浦温泉', '愛媛県', '今治市',   ['湯ノ浦温泉'], ['湯ノ浦温泉']],
  ['kaminada',     '中山越? ',   '愛媛県', '西予市',   ['宇和島'],     ['__skip__']],
  // ── 高知 ──
  ['yunotani-koc', '湯之谷温泉', '高知県', '土佐市',   ['湯之谷温泉'], ['湯之谷温泉']],
  ['ashizuri',     'あしずり温泉郷','高知県','土佐清水市',['あしずり温泉郷','足摺温泉'], ['あしずり温泉', '足摺温泉']],
  // ── 福井・石川 ──
  ['hatogayu',     '鳩ヶ湯温泉', '福井県', '大野市',   ['鳩ヶ湯温泉'], ['鳩ヶ湯温泉']],
  ['chugu',        '中宮温泉',   '石川県', '白山市',   ['中宮温泉'],   ['中宮温泉']],
  ['iwama',        '岩間温泉',   '石川県', '白山市',   ['岩間温泉'],   ['岩間温泉']],
  ['yuwaku',       '湯涌温泉',   '石川県', '金沢市',   ['湯涌温泉'],   ['湯涌温泉']],
  ['ichirino',     '白山一里野温泉','石川県','白山市', ['一里野温泉'], ['一里野温泉']],
  // ── 長崎・その他九州の手薄分 ──
  ['hirado-senri', '平戸千里ヶ浜温泉','長崎県','平戸市',['平戸千里ヶ浜温泉'], ['千里ヶ浜温泉']],
  ['shimabara-onsen','島原温泉', '長崎県', '島原市',   ['島原温泉'],   ['島原温泉']],
  // ── 埼玉 ──
  ['tokigawa',     '都幾川温泉', '埼玉県', 'ときがわ町',['都幾川温泉'], ['都幾川温泉']],
  ['otaki-saitama','大滝温泉',   '埼玉県', '秩父市',   ['大滝温泉 (埼玉県)'], ['大滝温泉']],
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
    if (token === '__skip__') continue;
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
for (let i = 0; i < passed.length; i++) for (let k = i + 1; k < passed.length; k++) {
  const d = kmBetween(passed[i].lat, passed[i].lng, passed[k].lat, passed[k].lng);
  if (d < 3) console.log(`⚠️ 候補同士が近接: ${passed[i].name} ↔ ${passed[k].name} ${d.toFixed(2)}km`);
}
fs.writeFileSync('logs/hitou_candidates3.json', JSON.stringify(out, null, 2));
console.log(`\n合格 ${passed.length} / ${out.length} 件 → logs/hitou_candidates3.json`);
