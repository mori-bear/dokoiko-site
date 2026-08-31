#!/usr/bin/env node
/**
 * kyushuSecretOnsenAdd.mjs — 一軒宿クラスの秘湯2件を追加検証する。
 *
 * なぜ別扱いか:
 *   本命の一軒宿秘湯は ja.Wikipedia に {{Coord}} が無く、通常ゲートで全滅していた
 *   （無名であるほど落ちるという逆選抜）。第2ソースを Wikidata P625 に替えて拾い直す。
 *   Wikidata が主張する所在自治体を OSM の行政界（逆ジオコーディング）で裏取りし、
 *   さらに既存destination・候補同士の3km近接も見る。
 *
 * 対象:
 *   寒の地獄温泉 … Wikipedia座標あり(2ソース一致0.08km)。既存「久住高原」と2.6kmで
 *                  近接ルールに触れるが、久住高原は高原リゾート、こちらは冷泉の一軒宿で
 *                  実体が別。ここは近接ルールの例外として扱い、理由を記録する。
 *   壁湯温泉     … Wikidata座標のみ。名称一致のOSM検索は不発のため自治体照合止まり。
 *                  検証強度が他候補より一段弱いことを verifyLevel に明記する。
 */
import fs from 'fs';

const UA = { 'User-Agent': 'DokoIko-DataAudit/1.0 (tabidokoiko.com; contact@tabidokoiko.com)' };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const kmBetween = (a, b, c, d) => Math.hypot((a - c) * 111, (b - d) * 111 * Math.cos((a * Math.PI) / 180));

const ADD = [
  {
    id: 'kannojigoku', name: '寒の地獄温泉', prefecture: '大分県', city: '九重町',
    lat: 33.11347, lng: 131.22711,
    verifyLevel: 'wikipedia+osm名称一致(0.08km)',
    proximityException: '既存「久住高原」と2.6km。高原リゾートと冷泉一軒宿で実体が別のため採用',
    imageQuery: 'Kannojigoku Onsen Kokonoe',
    localityWords: ['寒の地獄', '九重', 'Kokonoe', 'Kannojigoku', '田野'],
  },
  {
    id: 'kabeyu-onsen', name: '壁湯温泉', prefecture: '大分県', city: '九重町',
    lat: 33.20519, lng: 131.16958,
    verifyLevel: 'wikidata P625 + OSM行政界照合のみ（名称一致は不発）',
    proximityException: null,
    imageQuery: 'Kabeyu Onsen Fukumotoya Kokonoe',
    localityWords: ['壁湯', '九重', 'Kokonoe', 'Kabeyu', '福元屋'],
  },
];

const existing = JSON.parse(fs.readFileSync('src/data/destinations.json', 'utf8'));
const adopted = JSON.parse(fs.readFileSync('logs/kyushu_targets.json', 'utf8'));

for (const a of ADD) {
  // ① 逆ジオコーディングで自治体を裏取り
  const url = `https://nominatim.openstreetmap.org/reverse?lat=${a.lat}&lon=${a.lng}&format=json&zoom=12&addressdetails=1`;
  const j = await (await fetch(url, { headers: UA })).json();
  await sleep(1200);
  const ad = j.address || {};
  const gotPref = ad.province || ad.state || '?';
  const gotCity = ad.city || ad.town || ad.village || ad.county || ad.municipality || '?';
  const cityOk = gotCity.includes(a.city.replace(/[市町村]$/, ''));
  const prefOk = gotPref === a.prefecture;

  // ② 重複・近接
  const dupId = existing.find((d) => d.id === a.id);
  const dupName = existing.find((d) => d.name === a.name);
  const nearExisting = existing.filter((d) => typeof d.lat === 'number')
    .map((d) => ({ name: d.name, km: kmBetween(a.lat, a.lng, d.lat, d.lng) }))
    .filter((x) => x.km < 3).sort((x, y) => x.km - y.km);
  const nearCand = adopted.filter((t) => t.id !== a.id)
    .map((t) => ({ name: t.name, km: kmBetween(a.lat, a.lng, t.lat, t.lng) }))
    .filter((x) => x.km < 3).sort((x, y) => x.km - y.km);

  console.log(`■ ${a.name} (${a.id})`);
  console.log(`   検証強度  : ${a.verifyLevel}`);
  console.log(`   逆引き    : ${gotPref}${gotCity}  期待=${a.prefecture}${a.city}  ${prefOk && cityOk ? '✅一致' : '❌不一致'}`);
  console.log(`   id/同名重複: ${dupId ? 'id重複' : dupName ? '同名' : 'なし'}`);
  console.log(`   既存3km内 : ${nearExisting.length ? nearExisting.map((x) => `${x.name}(${x.km.toFixed(1)}km)`).join(', ') : 'なし'}`);
  console.log(`   候補3km内 : ${nearCand.length ? nearCand.map((x) => `${x.name}(${x.km.toFixed(1)}km)`).join(', ') : 'なし'}`);
  if (a.proximityException) console.log(`   近接例外  : ${a.proximityException}`);
  console.log('');
}

fs.writeFileSync('logs/kyushu_secret_add.json', JSON.stringify(ADD, null, 2));
console.log('→ logs/kyushu_secret_add.json');
