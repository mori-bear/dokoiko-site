#!/usr/bin/env node
/**
 * kyushuDestCandidates3.mjs — 九州候補の座標2ソース照合（本番判定）。
 *
 * OSM側は Nominatim のフリーテキスト検索をやめ Overpass API を使う。
 *   理由: Nominatim は「筋湯温泉」で唐津の別の温泉を、「垂玉温泉」で774km先を返した。
 *         あいまい一致で全く別の場所を掴むため、2ソース照合の相方として使えない。
 *   Overpass は name タグの正規表現一致なので、拾えたものは確実にその名前の地物。
 *
 * 手順: ja.Wikipedia の座標（colimit=max 必須）と、九州bbox内でOverpassが返す
 *       同名地物の座標を突き合わせ、5km以内で一致した候補のみ採用。
 *       あわせて既存destinationとの重複・3km近接、候補同士の3km近接も見る。
 */
import fs from 'fs';

const UA = { 'User-Agent': 'DokoIko-DataAudit/1.0 (tabidokoiko.com; contact@tabidokoiko.com)' };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const kmBetween = (a, b, c, d) => Math.hypot((a - c) * 111, (b - d) * 111 * Math.cos((a * Math.PI) / 180));
const BBOX = '30.8,128.3,34.1,132.2'; // south,west,north,east（九州）

// [id, 表示名, 県, Wikipedia記事名, [OSM名称トークン...]]
const CANDIDATES = [
  ['sujiyu-onsen',     '筋湯温泉',     '大分県', '筋湯温泉',   ['筋湯温泉', '筋湯']],
  ['kannojigoku',      '寒の地獄温泉', '大分県', '寒の地獄温泉', ['寒の地獄']],
  ['tsukahara-onsen',  '塚原温泉',     '大分県', '塚原温泉',   ['塚原温泉']],
  ['hosenji-onsen',    '宝泉寺温泉',   '大分県', '宝泉寺温泉', ['宝泉寺温泉', '宝泉寺']],
  ['hakusui-kosen',    '白水鉱泉',     '大分県', '白水鉱泉',   ['白水鉱泉']],
  ['kyusuikei',        '九酔渓',       '大分県', '九酔渓',     ['九酔渓']],
  ['yunohira-onsen',   '湯平温泉',     '大分県', '湯平温泉',   ['湯平温泉', '湯平']],
  ['tarutama-onsen',   '垂玉温泉',     '熊本県', '垂玉温泉',   ['垂玉温泉', '垂玉']],
  ['hagenoyu-onsen',   'はげの湯温泉', '熊本県', '峐の湯温泉', ['はげの湯', '峐の湯']],
  ['hinagu-onsen',     '日奈久温泉',   '熊本県', '日奈久温泉', ['日奈久温泉']],
  ['yunotsuru-onsen',  '湯の鶴温泉',   '熊本県', '湯の鶴温泉', ['湯の鶴温泉', '湯の鶴']],
  ['tsuetate-onsen',   '杖立温泉',     '熊本県', '杖立温泉',   ['杖立温泉', '杖立']],
  ['takaki-onsen',     '川内高城温泉', '鹿児島県', '川内高城温泉', ['川内高城温泉', '高城温泉']],
  ['yunoo-onsen',      '湯之尾温泉',   '鹿児島県', '湯之尾温泉', ['湯之尾温泉', '湯之尾']],
  ['wakita-onsen',     '脇田温泉',     '福岡県', '脇田温泉',   ['脇田温泉']],
  ['funagoya-onsen',   '船小屋温泉',   '福岡県', '船小屋温泉', ['船小屋温泉', '船小屋']],
  ['chikugogawa-onsen','筑後川温泉',   '福岡県', '筑後川温泉', ['筑後川温泉']],
  ['kumanokawa-onsen', '熊の川温泉',   '佐賀県', '熊の川温泉', ['熊の川温泉']],
  ['furuyu-onsen',     '古湯温泉',     '佐賀県', '古湯温泉',   ['古湯温泉']],
  ['hinokage-onsen',   '日之影温泉',   '宮崎県', '日之影町',   ['日之影温泉']],
];

const existing = JSON.parse(fs.readFileSync('src/data/destinations.json', 'utf8'));
const norm = (s) => String(s || '').replace(/[\s　・（）()「」【】]/g, '')
  .replace(/(市|町|村|区|駅|温泉|公園|神社|寺|大橋)$/g, '');

async function wikiCoords(title) {
  const url = `https://ja.wikipedia.org/w/api.php?action=query&prop=coordinates&colimit=max&titles=${encodeURIComponent(title)}&format=json&formatversion=2&redirects=1`;
  const p = (await (await fetch(url, { headers: UA })).json())?.query?.pages?.[0];
  const c = p?.coordinates?.[0];
  return c ? { lat: c.lat, lng: c.lon, title: p.title } : null;
}

/**
 * OSM側の取得。Overpass は当環境から全ミラー到達不可（ECONNREFUSED/502）だったため
 * Nominatim を使うが、あいまい一致で別地点を掴む事故（筋湯温泉→唐津、垂玉温泉→774km先）を
 * 防ぐため、次の2条件を満たす結果だけ採用する:
 *   ① 返却された名称に候補名のトークンが実際に含まれること
 *   ② addressdetails の県が目的の県と一致すること
 * さらに九州bboxで bounded 検索し、圏外は最初から返させない。
 */
async function osmStrict(nameTokens, prefecture) {
  const VIEWBOX = '128.3,34.1,132.2,30.8'; // left,top,right,bottom
  for (const token of nameTokens) {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(token)}` +
      `&format=json&limit=10&countrycodes=jp&viewbox=${VIEWBOX}&bounded=1` +
      `&addressdetails=1&namedetails=1`;
    const r = await fetch(url, { headers: UA });
    await sleep(1100);
    if (!r.ok) continue;
    const rows = await r.json();
    for (const x of rows) {
      const nm = [x.namedetails?.name, x.namedetails?.['name:ja'], (x.display_name || '').split(',')[0]]
        .filter(Boolean).join(' ');
      const pref = x.address?.province || x.address?.state || '';
      if (!nm.includes(token)) continue;      // ① 名称に候補名を含む
      if (pref !== prefecture) continue;      // ② 県が一致
      return { lat: +x.lat, lng: +x.lon, matched: nm.slice(0, 40), pref, token };
    }
  }
  return null;
}

const out = [];
for (const [id, name, pref, wikiTitle, osmTokens] of CANDIDATES) {
  const rec = { id, name, prefecture: pref, wikiTitle, osmTokens, checks: {} };
  const w = await wikiCoords(wikiTitle); await sleep(350);
  const o = await osmStrict(osmTokens, pref);
  rec.wiki = w; rec.osm = o;

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
  console.log(`${rec.pass ? '✅' : '❌'} ${name.padEnd(12)} ${pref.padEnd(4)} 座標=${String(rec.checks.coords).padEnd(16)} 重複=${rec.checks.duplicate.padEnd(6)} 近接=${rec.checks.nearby ?? '-'}  osm=${o ? o.matched : '取得不可'}`);
}

// 候補同士の近接（同じバッチ内で3km以内に2件入れない）
const passed = out.filter((r) => r.pass);
for (let i = 0; i < passed.length; i++) {
  for (let k = i + 1; k < passed.length; k++) {
    const d = kmBetween(passed[i].lat, passed[i].lng, passed[k].lat, passed[k].lng);
    if (d < 3) console.log(`⚠️ 候補同士が近接: ${passed[i].name} ↔ ${passed[k].name} ${d.toFixed(2)}km`);
  }
}

fs.writeFileSync('logs/kyushu_candidates3.json', JSON.stringify(out, null, 2));
console.log(`\n合格 ${passed.length} / ${out.length} 件 → logs/kyushu_candidates3.json`);
