#!/usr/bin/env node
/**
 * newDestCandidates.mjs — 首都圏の新規destination候補について、
 * (1) 既存1204件との重複チェック（同名・類似名・近接座標）
 * (2) Wikipedia(ja) と OpenStreetMap Nominatim の2ソース座標一致
 * を行い、両方を通った候補だけを logs/new_dest_candidates.json に出す。
 *
 * resolveCoords.mjs と同じ「2ソースが5km以内で一致した場合のみ採用」方針。
 * 品質ゲート: ここで落ちた候補は採用しない（無理に件数を埋めない）。
 */
import fs from 'fs';

const UA = { 'User-Agent': 'DokoIko-DataAudit/1.0 (tabidokoiko.com; contact@tabidokoiko.com)' };
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const kmBetween = (la1, ln1, la2, ln2) =>
  Math.hypot((la1 - la2) * 111, (ln1 - ln2) * 111 * Math.cos(la1 * Math.PI / 180));

// [id, 表示名, 都道府県, Wikipedia記事名, OSM検索語]
const CANDIDATES = [
  // ── 東京都（本土）──
  ['jindaiji',      '深大寺',       '東京都', '深大寺',           '深大寺 東京都調布市'],
  ['todoroki-keikoku','等々力渓谷', '東京都', '等々力渓谷',        '等々力渓谷 東京都世田谷区'],
  ['yanaka',        '谷中',         '東京都', '谷中 (台東区)',     '谷中 東京都台東区'],
  ['kiyosumi-shirakawa','清澄白河', '東京都', '清澄白河',          '清澄白河駅 東京都江東区'],
  ['kunitachi',     '国立',         '東京都', '国立市',            '国立駅 東京都国立市'],
  // ── 埼玉県 ──
  ['gyoda',         '行田',         '埼玉県', '行田市',            '行田市 埼玉県'],
  ['kinchakuda',    '巾着田',       '埼玉県', '巾着田',            '巾着田 埼玉県日高市'],
  ['soka-matsubara','草加松原',     '埼玉県', '草加松原',          '草加松原 埼玉県草加市'],
  ['fukaya',        '深谷',         '埼玉県', '深谷市',            '深谷駅 埼玉県深谷市'],
  ['higashichichibu','東秩父村',    '埼玉県', '東秩父村',          '東秩父村 埼玉県'],
  // ── 千葉県 ──
  ['kisarazu',      '木更津',       '千葉県', '木更津市',          '木更津駅 千葉県木更津市'],
  ['futtsu-misaki', '富津岬',       '千葉県', '富津岬',            '富津岬 千葉県富津市'],
  ['kasamori-kannon','笠森観音',    '千葉県', '笠森寺',            '笠森寺 千葉県長南町'],
  ['shirahama-boso','南房総白浜',   '千葉県', '白浜町 (千葉県)',   '野島埼灯台 千葉県南房総市'],
  ['nagareyama-honcho','流山本町',  '千葉県', '流山市',            '流山本町 千葉県流山市'],
  // ── 神奈川県 ──
  ['oyama-afuri',   '大山',         '神奈川県', '大山 (神奈川県)', '大山阿夫利神社 神奈川県伊勢原市'],
  ['miyagase',      '宮ヶ瀬',       '神奈川県', '宮ヶ瀬ダム',      '宮ヶ瀬湖 神奈川県清川村'],
  ['hayama',        '葉山',         '神奈川県', '葉山町',          '葉山町 神奈川県'],
  ['kobouyama',     '弘法山',       '神奈川県', '弘法山公園',      '弘法山 神奈川県秦野市'],
  ['kawasaki-daishi','川崎大師',    '神奈川県', '平間寺',          '川崎大師 神奈川県川崎市'],
];

const existing = JSON.parse(fs.readFileSync('src/data/destinations.json', 'utf8'));

// 表記ゆれを吸収した簡易正規化（重複判定用）
const norm = (s) => String(s || '').replace(/[\s　・（）()「」【】]/g, '')
  .replace(/(市|町|村|区|駅|温泉|公園|神社|寺|大橋)$/g, '');

async function wikiCoords(title) {
  const url = `https://ja.wikipedia.org/w/api.php?action=query&prop=coordinates&titles=${encodeURIComponent(title)}&format=json&formatversion=2`;
  const r = await fetch(url, { headers: UA });
  if (!r.ok) return null;
  const j = await r.json();
  const p = j?.query?.pages?.[0];
  const c = p?.coordinates?.[0];
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

  // ① 重複チェック（id・同名・正規化名の一致）
  const dupId   = existing.find((d) => d.id === id);
  const dupName = existing.find((d) => d.name === name);
  const dupNorm = existing.filter((d) => norm(d.name) === norm(name) && d.name !== name);
  rec.checks.duplicate = dupId ? `id重複:${dupId.name}` :
                         dupName ? `同名:${dupName.name}` :
                         dupNorm.length ? `類似名:${dupNorm.map(d=>d.name).join(',')}` : 'なし';

  // ② 座標2ソース照合
  const w = await wikiCoords(wikiTitle); await sleep(400);
  const o = await osmCoords(osmQuery);   await sleep(1100); // Nominatim は 1req/s

  rec.wiki = w; rec.osm = o;
  if (!w || !o) {
    rec.checks.coords = `取得不可 (wiki=${w?'o':'x'} osm=${o?'o':'x'})`;
  } else {
    const d = kmBetween(w.lat, w.lng, o.lat, o.lng);
    rec.distanceKm = +d.toFixed(2);
    rec.checks.coords = d <= 5 ? `一致 ${d.toFixed(2)}km` : `不一致 ${d.toFixed(2)}km`;
    if (d <= 5) { rec.lat = +((w.lat + o.lat) / 2).toFixed(5); rec.lng = +((w.lng + o.lng) / 2).toFixed(5); }
  }

  // ③ 近接する既存destinationがないか（3km以内は実質同じ場所とみなす）
  if (rec.lat != null) {
    const near = existing
      .filter((d) => typeof d.lat === 'number' && typeof d.lng === 'number')
      .map((d) => ({ name: d.name, km: kmBetween(rec.lat, rec.lng, d.lat, d.lng) }))
      .filter((x) => x.km < 3).sort((a, b) => a.km - b.km);
    rec.checks.nearby = near.length ? near.map(x=>`${x.name}(${x.km.toFixed(1)}km)`).join(', ') : 'なし';
  }

  const pass = rec.checks.duplicate === 'なし'
            && String(rec.checks.coords).startsWith('一致')
            && (rec.checks.nearby === 'なし' || rec.checks.nearby === undefined);
  rec.pass = pass;
  out.push(rec);
  console.log(`${pass ? '✅' : '❌'} ${name.padEnd(8)} ${pref.padEnd(4)} 座標=${rec.checks.coords} 重複=${rec.checks.duplicate} 近接=${rec.checks.nearby ?? '-'}`);
}

fs.mkdirSync('logs', { recursive: true });
fs.writeFileSync('logs/new_dest_candidates.json', JSON.stringify(out, null, 2));
console.log(`\n合格 ${out.filter(o=>o.pass).length} / ${out.length} 件 → logs/new_dest_candidates.json`);
