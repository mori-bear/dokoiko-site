#!/usr/bin/env node
/**
 * hitouBuildTargets.mjs — 座標ゲートを通った秘湯候補に画像検索クエリを付け、
 * あわせて確定座標を逆ジオコーディングして市町村を裏取りする。
 *
 * 逆引きを全件に掛ける理由: 通過ペアの多くが wikipedia×wikidata で、
 * この2つは出典が同根なので「独立した2ソース」とは言い切れない。
 * OSMの行政界による市町村照合を全件に通して、非Wikimedia系の裏を必ず1つ取る。
 *
 * 候補同士が3km以内のペアは、知名度の高い方を残して他方を落とす。
 */
import fs from 'fs';

const UA = { 'User-Agent': 'DokoIko-DataAudit/1.0 (tabidokoiko.com; contact@tabidokoiko.com)' };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// 候補同士が近接していたペアの敗者（乳頭温泉郷内・早川町内で重複するため）
const DROP = new Set(['magoroku', 'naradani']);

const META = {
  'metoh':          { q: 'Metou Onsen Ashoro',            w: ['芽登', '足寄', 'Metou', 'Ashoro'] },
  'namari-onsen':   { q: 'Namari Onsen Hanamaki',         w: ['鉛温泉', '花巻', 'Namari', 'Hanamaki'] },
  'geto-onsen':     { q: 'Geto Onsen Kitakami',           w: ['夏油', '北上', 'Geto', 'Kitakami'] },
  'matsukawa-iwate':{ q: 'Matsukawa Onsen Hachimantai',   w: ['松川', '八幡平', 'Matsukawa', 'Hachimantai'] },
  'gaga-onsen':     { q: 'Gaga Onsen Kawasaki Miyagi',    w: ['峩々', '川崎', 'Gaga'] },
  'kuroyu':         { q: 'Kuroyu Onsen Nyuto',            w: ['黒湯', '乳頭', '仙北', 'Kuroyu', 'Nyuto'] },
  'doroyu':         { q: 'Doroyu Onsen Yuzawa Akita',     w: ['泥湯', '湯沢', 'Doroyu'] },
  'namekawa':       { q: 'Namekawa Onsen Yonezawa',       w: ['滑川', '米沢', 'Namekawa', 'Yonezawa'] },
  'tokusa':         { q: 'Tokusa Onsen Minamiaizu',       w: ['木賊', '南会津', 'Tokusa'] },
  'nukunuyu':       { q: 'Nukuyu Onsen Fukushima',        w: ['微温湯', '福島', 'Nukuyu'] },
  'kashi-onsen':    { q: 'Kashi Onsen Shirakawa',         w: ['甲子', '白河', 'Kashi'] },
  'okukinu':        { q: 'Okukinu Onsen Nikko',           w: ['奥鬼怒', '日光', 'Okukinu', '加仁湯', '八丁'] },
  'kaikake':        { q: 'Kaikake Onsen Yuzawa Niigata',  w: ['貝掛', '湯沢', 'Kaikake'] },
  'nakabusa':       { q: 'Nakabusa Onsen Azumino',        w: ['中房', '安曇野', 'Nakabusa', 'Azumino'] },
  'takamine':       { q: 'Takamine Onsen Komoro',         w: ['高峰', '小諸', 'Takamine', 'Komoro'] },
  'kuronagi':       { q: 'Kuronagi Onsen Kurobe',         w: ['黒薙', '黒部', 'Kuronagi', 'Kurobe'] },
  'babadani':       { q: 'Babadani Onsen Kurobe',         w: ['祖母谷', '黒部', 'Babadani', 'Kurobe'] },
  'nigorigo':       { q: 'Nigorigo Onsen Gero',           w: ['濁河', '下呂', 'Nigorigo', 'Gero'] },
  'fukuji':         { q: 'Fukuji Onsen Takayama Gifu',    w: ['福地', '奥飛騨', '高山', 'Fukuji'] },
  'nishiyama-yama': { q: 'Nishiyama Onsen Keiunkan',      w: ['西山温泉', '早川', '慶雲館', 'Nishiyama', 'Hayakawa'] },
  'umegashima':     { q: 'Umegashima Onsen Shizuoka',     w: ['梅ヶ島', '静岡', 'Umegashima'] },
  'chihara':        { q: 'Chihara Onsen Misato Shimane',  w: ['千原', '美郷', 'Chihara', 'Misato'] },
  'kakinoki':       { q: 'Kakinoki Onsen Yoshika',        w: ['柿木', '吉賀', 'Kakinoki', 'Yoshika'] },
};

const cands = JSON.parse(fs.readFileSync('logs/hitou_candidates.json', 'utf8'));
const passed = cands.filter((c) => c.pass && !DROP.has(c.id));

const targets = [];
for (const c of passed) {
  const m = META[c.id];
  if (!m) { console.log(`⚠️ META未定義のためスキップ: ${c.id} ${c.name}`); continue; }
  const url = `https://nominatim.openstreetmap.org/reverse?lat=${c.lat}&lon=${c.lng}&format=json&zoom=12&addressdetails=1`;
  const j = await (await fetch(url, { headers: UA })).json();
  await sleep(1200);
  const a = j.address || {};
  const city = a.city || a.town || a.village || a.county || a.municipality || '?';
  const pref = a.province || a.state || '?';
  const prefOk = pref === c.prefecture;
  const cityOk = city.includes(c.city.replace(/[市町村]$/, ''));
  const ok = prefOk && cityOk;
  console.log(`${ok ? '✅' : '⚠️ '} ${c.name.padEnd(12)} 逆引き=${pref}${city}  期待=${c.prefecture}${c.city}  照合=${c.verifiedBy.join('×')} ${c.distanceKm}km`);
  if (!ok) continue;
  targets.push({ id: c.id, name: c.name, prefecture: c.prefecture, city: c.city,
    lat: c.lat, lng: c.lng, verifiedBy: c.verifiedBy, distanceKm: c.distanceKm,
    imageQuery: m.q, localityWords: m.w });
}

fs.writeFileSync('logs/hitou_targets.json', JSON.stringify(targets, null, 2));
console.log(`\n逆引き照合を通過 ${targets.length} / ${passed.length}件 → logs/hitou_targets.json`);
