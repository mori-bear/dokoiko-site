#!/usr/bin/env node
/**
 * buildNewDestinations.mjs — 検証を通った新規destinationを destinations.json へ追加する。
 *
 * 前提（すべて先に通しておく）:
 *   logs/new_dest_candidates*.json  … 座標2ソース照合＋重複/近接チェック
 *   logs/new_dest_images.json       … main画像（Commonsメタ照合＋Haiku(→Sonnet)）
 *   logs/new_dest_spot_images.json  … spot画像（同上。落選分は imageUrl 無しで残す）
 *   scripts/newDestContent.json     … 本文・スポット文・アクセス（人手で作成）
 *
 * 既存データを壊さないための方針:
 *   ・hotelLinks は同県の既存エントリからそのままコピーする
 *     （楽天アフィリエイトIDとじゃらんの県コードを自前で組み立てない）
 *   ・travelTime は最も近い既存エントリの値を土台に、東京からの所要時間の差分だけ平行移動する
 *     （21都市ぶんの所要時間を根拠なく捏造しない）
 *   ・weight は 1（中立）。既存の人気地点を押しのけないようにする
 */
import fs from 'fs';

const DEST = 'src/data/destinations.json';
const dests = JSON.parse(fs.readFileSync(DEST, 'utf8'));
const content = JSON.parse(fs.readFileSync('scripts/newDestContent.json', 'utf8'));
const cands = [...JSON.parse(fs.readFileSync('logs/new_dest_candidates.json', 'utf8')),
               ...JSON.parse(fs.readFileSync('logs/new_dest_candidates2.json', 'utf8'))].filter(x => x.pass);
const mainRep = JSON.parse(fs.readFileSync('logs/new_dest_images.json', 'utf8'));
const retry = JSON.parse(fs.readFileSync('logs/new_dest_images_retry.json', 'utf8'));
const spotRep = JSON.parse(fs.readFileSync('logs/new_dest_spot_images.json', 'utf8'));

const mainOf = {};
for (const a of mainRep.adopted) mainOf[a.id] = { title: a.title, credit: a.credit };
for (const r of retry) if (r.ok) mainOf[r.id] = { title: r.title, credit: r.credit };

const TOKYO_MIN = { jindaiji:60, kunitachi:55, 'todoroki-keikoku':45, gyoda:90, kinchakuda:85,
  'soka-matsubara':45, fukaya:90, higashichichibu:120, kisarazu:75, 'futtsu-misaki':100,
  'kasamori-kannon':110, 'shirahama-boso':150, 'kawasaki-daishi':40, miyagase:110,
  'oyama-afuri':100, shomyoji:60 };

const km = (a,b,c,d) => Math.hypot((a-c)*111,(b-d)*111*Math.cos(a*Math.PI/180));

function chipsFor(d) {
  const c = new Set(['ひとり旅向け','カップル向け','友達と']);
  const t = d.tags;
  if (t.includes('歴史') || t.includes('城')) c.add('歴史を辿る');
  if (t.includes('寺社')) c.add('寺社めぐり');
  if (t.includes('街歩き')) c.add('街歩き');
  if (t.includes('自然') || t.includes('渓谷') || t.includes('湖') || t.includes('山')) c.add('自然と過ごす');
  if (t.includes('海') || t.includes('灯台')) c.add('海を眺める');
  if (t.includes('絶景')) c.add('絶景');
  if (t.includes('グルメ')) c.add('グルメ');
  if (t.includes('花')) c.add('花の名所');
  if (t.includes('伝統工芸')) c.add('伝統工芸の里');
  if (t.includes('世界遺産')) c.add('世界遺産');
  if (t.includes('建築')) c.add('建築の名作');
  if (d.stayAllowed.includes('daytrip')) c.add('日帰り最適');
  if (d.stayAllowed.includes('1night')) c.add('1泊がおすすめ');
  if (!d.requiresCar) c.add('車なしOK');
  return [...c];
}

const added = [];
for (const d of content) {
  if (!mainOf[d.id]) { console.log(`  スキップ ${d.name}: main画像なし`); continue; }
  if (dests.some(x => x.id === d.id)) { console.log(`  スキップ ${d.name}: 既に存在`); continue; }
  const cand = cands.find(x => x.id === d.id);
  if (!cand) { console.log(`  スキップ ${d.name}: 座標検証の記録なし`); continue; }

  // hotelLinks は同県の既存エントリから借りる
  const sib = dests.find(x => x.prefecture === d.prefecture && x.hotelLinks);
  // travelTime は最寄りの既存エントリを土台に、東京からの差分で平行移動
  const near = dests.filter(x => x.travelTime && typeof x.lat === 'number')
    .map(x => ({ x, k: km(cand.lat, cand.lng, x.lat, x.lng) })).sort((a,b) => a.k - b.k)[0];
  const delta = TOKYO_MIN[d.id] - (near.x.travelTime.tokyo ?? TOKYO_MIN[d.id]);
  const travelTime = Object.fromEntries(Object.entries(near.x.travelTime)
    .map(([k, v]) => [k, Math.max(20, Math.round(v + delta))]));

  const spots = d.spots.map((s, i) => {
    const info = spotRep[d.id]?.[`spot-${i + 1}`];
    const o = { name: s.name, description: s.description };
    if (info?.ok) { o.imageUrl = info.imageUrl; o.imageCredit = info.credit; }
    return o;
  });
  const images = ['/images/' + d.id + '/main.jpg',
    ...d.spots.map((_, i) => spotRep[d.id]?.[`spot-${i+1}`]?.ok ? `/images/${d.id}/spot-${i+1}.jpg` : null).filter(Boolean)];

  const rec = {
    id: d.id, name: d.name, type: 'destination', region: '関東', hub: '東京',
    stayAllowed: d.stayAllowed, departures: ['東京','水戸','前橋','高崎'], weight: 1,
    description: d.description, tags: d.tags, spots,
    shinkansenAccess: false, requiresCar: d.requiresCar, hotelSearch: d.hotelSearch,
    gateways: { rail: [d.railGateway], airport: [], bus: [], ferry: [] },
    accessHub: null, railNote: null, destType: d.destType,
    railGateway: d.railGateway, busGateway: null, ferryGateway: null, airportGateway: null,
    prefecture: d.prefecture, lat: cand.lat, lng: cand.lng,
    stayBias: d.stayAllowed.includes('1night') ? 1 : 0,
    situations: ['solo','couple','friends'], catch: d.catch, mainSpot: d.mainSpot,
    mapPoint: d.mainSpot, representativeStation: d.railGateway, hubStation: d.hubStation,
    accessStation: d.railGateway, hotelArea: d.hotelArea,
    finalAccess: { type: d.requiresCar ? 'car' : 'walk' },
    travelTime, tier: d.destType === 'sight' ? 'spot' : 'area', icCard: 'suica',
    bestSeason: d.bestSeason, reasonChips: chipsFor(d),
    primary: d.tags.slice(0, 2), secondary: [], onsenLevel: 0,
    hasDirectFlight: false, images,
    imageCredit: mainOf[d.id].credit,
    ...(sib?.hotelLinks ? { hotelLinks: sib.hotelLinks } : {}),
  };
  dests.push(rec);
  added.push({ name: d.name, pref: d.prefecture, spots: spots.filter(s=>s.imageUrl).length,
    tokyo: travelTime.tokyo, base: near.x.name, baseKm: near.k.toFixed(1) });
}

fs.writeFileSync(DEST, JSON.stringify(dests, null, 1));
console.log(`追加 ${added.length} 件 / 総件数 ${dests.length}`);
for (const a of added) console.log(`  ${a.name.padEnd(10)} ${a.pref.padEnd(4)} spot画像${a.spots}枚 東京から${a.tokyo}分（基準:${a.base} ${a.baseKm}km）`);
