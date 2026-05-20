#!/usr/bin/env node
/**
 * createMore15Hubs.js
 * 15都市の hub destinationを作成: 札幌・青森・前橋・盛岡・秋田・山形・福島・甲府・松江・鳥取・山口・高知・佐賀・大分・宮崎
 * description は Claude API で 220-280字生成。
 */
import fs from 'fs';
import path from 'path';
import Anthropic from '@anthropic-ai/sdk';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEST_FILE = path.join(__dirname, '../src/data/destinations.json');
const HUB_FILE = path.join(__dirname, '../src/data/hubCities.json');

const envContent = fs.readFileSync(path.join(__dirname, '../.env'), 'utf-8');
for (const line of envContent.split('\n')) {
  const m = line.match(/^([A-Z_]+)=(.+)$/);
  if (m) process.env[m[1]] = m[2].trim();
}
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const destinations = JSON.parse(fs.readFileSync(DEST_FILE, 'utf-8'));
const hubCities = JSON.parse(fs.readFileSync(HUB_FILE, 'utf-8'));

const CITY_DEFS = {
  sapporo:   { region:'北海道', hub:'札幌',   hubCity:'札幌',   railGateway:'札幌駅',     prefecture:'北海道', departures:['新千歳','東京'], spotHints:['大通公園','時計台','すすきの','札幌駅'], shinkansen:false },
  aomori:    { region:'東北',   hub:'青森',   hubCity:'青森',   railGateway:'新青森駅',   prefecture:'青森県', departures:['東京','仙台'], spotHints:['青森ベイブリッジ','青森魚菜センター','三内丸山遺跡','八甲田'], shinkansen:true },
  maebashi:  { region:'関東',   hub:'東京',   hubCity:'前橋',   railGateway:'前橋駅',     prefecture:'群馬県', departures:['東京'], spotHints:['前橋公園','敷島公園','広瀬川','臨江閣'], shinkansen:false },
  morioka:   { region:'東北',   hub:'盛岡',   hubCity:'盛岡',   railGateway:'盛岡駅',     prefecture:'岩手県', departures:['東京','仙台'], spotHints:['岩手山','盛岡城跡公園','わんこそば','北上川'], shinkansen:true },
  akita:     { region:'東北',   hub:'秋田',   hubCity:'秋田',   railGateway:'秋田駅',     prefecture:'秋田県', departures:['東京','仙台'], spotHints:['竿燈祭り','千秋公園','男鹿半島','秋田犬'], shinkansen:true },
  yamagata:  { region:'東北',   hub:'山形',   hubCity:'山形',   railGateway:'山形駅',     prefecture:'山形県', departures:['東京','仙台'], spotHints:['山寺','蔵王','霞城公園','さくらんぼ'], shinkansen:true },
  fukushima: { region:'東北',   hub:'仙台',   hubCity:'福島',   railGateway:'福島駅',     prefecture:'福島県', departures:['東京','仙台'], spotHints:['花見山','磐梯山','信夫山','飯坂温泉'], shinkansen:true },
  kofu:      { region:'中部',   hub:'東京',   hubCity:'甲府',   railGateway:'甲府駅',     prefecture:'山梨県', departures:['東京'], spotHints:['武田神社','甲府城跡','昇仙峡','信玄餅'], shinkansen:false },
  matsue:    { region:'中国',   hub:'松江',   hubCity:'松江',   railGateway:'松江駅',     prefecture:'島根県', departures:['岡山','広島'], spotHints:['松江城','宍道湖','小泉八雲記念館','堀川遊覧'], shinkansen:false },
  tottori:   { region:'中国',   hub:'鳥取',   hubCity:'鳥取',   railGateway:'鳥取駅',     prefecture:'鳥取県', departures:['岡山','大阪'], spotHints:['鳥取砂丘','砂の美術館','久松公園','水木しげるロード'], shinkansen:false },
  yamaguchi: { region:'中国',   hub:'広島',   hubCity:'山口',   railGateway:'新山口駅',   prefecture:'山口県', departures:['広島','福岡'], spotHints:['瑠璃光寺','湯田温泉','秋吉台','山口サビエル記念聖堂'], shinkansen:true },
  kochi:     { region:'四国',   hub:'高知',   hubCity:'高知',   railGateway:'高知駅',     prefecture:'高知県', departures:['岡山','大阪'], spotHints:['桂浜','高知城','ひろめ市場','はりまや橋'], shinkansen:false },
  saga:      { region:'九州',   hub:'福岡',   hubCity:'佐賀',   railGateway:'佐賀駅',     prefecture:'佐賀県', departures:['福岡','長崎'], spotHints:['佐賀城本丸歴史館','吉野ヶ里遺跡','佐賀バルーンミュージアム','武雄温泉'], shinkansen:false },
  oita:      { region:'九州',   hub:'福岡',   hubCity:'大分',   railGateway:'大分駅',     prefecture:'大分県', departures:['福岡','熊本'], spotHints:['府内城跡','高崎山','大分マリーンパレス水族館','うみたまご'], shinkansen:false },
  miyazaki:  { region:'九州',   hub:'福岡',   hubCity:'宮崎',   railGateway:'宮崎駅',     prefecture:'宮崎県', departures:['福岡','鹿児島'], spotHints:['青島','鵜戸神宮','高千穂峡','宮崎神宮'], shinkansen:false },
};

const SYSTEM = `あなたは日本の旅情を伝えるベテラン観光記事ライターです。
都市について、その地ならではの空気感・五感・固有名詞を含めた説明文を書きます。
出力は必ず220〜280字、紋切り型禁止、純粋なJSONのみ。`;

async function batchDescriptions(items) {
  const userMsg = `次の各都市について、220-280字の体験的な説明文を書いてください。

${items.map(({id, name, prefecture, spotHints}) => `- id: ${id}, 都市名: ${name}（${prefecture}）, 代表スポット: ${spotHints.join('・')}`).join('\n')}

応答形式 (JSONのみ): [{"id":"...","description":"...","catch":"15-25字キャッチ"},...]`;
  const res = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 5000,
    system: SYSTEM,
    messages: [{ role: 'user', content: userMsg }],
  });
  const text = res.content[0].text.trim();
  const m = text.match(/\[[\s\S]*\]/);
  if (!m) throw new Error('JSON not found');
  return JSON.parse(m[0]);
}

function rakutenLink(keyword) {
  const inner = encodeURIComponent(`https://travel.rakuten.co.jp/search/?keyword=${encodeURIComponent(keyword)}`);
  return `https://hb.afl.rakuten.co.jp/hgc/5113ee4b.8662cfc5.5113ee4c.119de89a/?pc=${inner}`;
}
function jalanLink(keyword) {
  const inner = encodeURIComponent(`https://www.jalan.net/uw/uwp2011/uww2011init.do?keyword=${encodeURIComponent(keyword)}`);
  return `https://ck.jp.ap.valuecommerce.com/servlet/referral?sid=3764408&pid=892559858&vc_url=${inner}`;
}

const naraTemplate = destinations.find(d => d.id === 'nara');

function buildHub(id, def, descriptionText, catchText) {
  const hubMeta = hubCities.find(h => h.id === id);
  const lat = hubMeta?.lat || null;
  const lng = hubMeta?.lng || null;
  const travelTime = {};
  if (naraTemplate?.travelTime) for (const k of Object.keys(naraTemplate.travelTime)) travelTime[k] = 999;
  travelTime[id] = 0;

  return {
    id, name: hubCities.find(h => h.id === id)?.name || def.hubCity,
    type: 'destination',
    region: def.region,
    hub: def.hub,
    stayAllowed: ['daytrip', '1night', '2night'],
    departures: def.departures,
    weight: 1.5,
    description: descriptionText,
    tags: ['街歩き', 'グルメ', '歴史'],
    spots: def.spotHints.slice(0, 4).map(s => ({ name: s, description: `${s}は${def.hubCity}の代表的なスポット。`, imageUrl: null })),
    shinkansenAccess: def.shinkansen,
    requiresCar: false,
    hotelSearch: def.hubCity,
    gateways: { rail: [def.railGateway], airport: [], bus: [], ferry: [] },
    accessHub: null, railNote: null,
    destType: 'city',
    railGateway: def.railGateway,
    busGateway: null, ferryGateway: null, airportGateway: null,
    prefecture: def.prefecture,
    lat, lng,
    stayBias: 2,
    airportHub: null, railProvider: 'e5489',
    travelTime,
    stayRecommendation: '1night',
    secondaryTransport: null,
    city: def.hubCity + '市',
    hubStation: def.railGateway,
    accessStation: def.railGateway,
    hotelArea: id,
    jalanPath: null,
    hotelKeyword: def.hubCity,
    access: { steps: [{ type: 'rail', to: def.railGateway, provider: 'e5489' }] },
    fallbackCity: def.hubCity,
    gateway: def.railGateway,
    gatewayStations: [{ name: def.railGateway, type: def.shinkansen ? 'shinkansen' : 'rail', priority: 1 }],
    localAccess: { type: 'walk', description: `${def.railGateway}から徒歩・路線バス`, to: def.railGateway },
    situations: ['solo','couple','friends','family'],
    catch: catchText || `${def.hubCity}の街を歩く。`,
    primary: ['街歩き','グルメ','歴史'],
    secondary: [],
    onsenLevel: 0,
    hasDirectFlight: false,
    mapPoint: def.spotHints[0],
    subType: 'city',
    stayDescription: '街の表情を朝と夜で見比べる、都市の小さな旅。',
    hubCity: def.hubCity,
    stayPriority: 'high',
    representativeStation: def.railGateway,
    finalAccess: { type: 'walk' },
    accessPoint: { type: 'station', name: def.railGateway.replace('駅','') },
    staySearchUrl: rakutenLink(def.hubCity),
    bookingStation: { name: def.railGateway, company: 'JR' },
    mainSpot: def.spotHints[0],
    stayArea: { rakuten: def.hubCity, jalan: def.hubCity },
    hotelLinks: { rakuten: rakutenLink(def.hubCity), jalan: jalanLink(def.hubCity) },
    tier: 'hub',
    icCard: 'suica',
    tier2: 'hub',
    hubName: def.hub,
    rentalCarRecommended: false,
    images: [],
    reasonChips: ['街歩き','歴史を辿る','グルメ'],
    bestSeason: '通年',
    isIsland: false,
  };
}

const items = Object.entries(CITY_DEFS)
  .filter(([id]) => !destinations.find(d => d.id === id))
  .map(([id, def]) => ({ id, name: def.hubCity, prefecture: def.prefecture, spotHints: def.spotHints }));

console.log(`新規作成対象: ${items.length}件`);
if (items.length === 0) {
  console.log('すでに全件存在');
  process.exit(0);
}

const descMap = {};
const BATCH = 5;
for (let i = 0; i < items.length; i += BATCH) {
  const batch = items.slice(i, i + BATCH);
  try {
    const results = await batchDescriptions(batch);
    for (const r of results) descMap[r.id] = { description: r.description, catch: r.catch };
    console.log(`  ${Math.min(i+BATCH, items.length)}/${items.length} OK`);
  } catch (e) {
    console.log(`  batch ${i}: ${e.message}`);
  }
  await new Promise(r => setTimeout(r, 1500));
}

let added = 0;
for (const { id } of items) {
  const def = CITY_DEFS[id];
  const desc = descMap[id]?.description || `${def.hubCity}は${def.prefecture}の中心都市。${def.spotHints.join('・')}など見どころが集まる。駅から徒歩で街歩きを楽しめる。`;
  const catchTxt = descMap[id]?.catch || `${def.hubCity}を旅する。`;
  destinations.push(buildHub(id, def, desc, catchTxt));
  added++;
}
fs.writeFileSync(DEST_FILE, JSON.stringify(destinations, null, 2));
console.log(`\n✓ 完了: ${added}件追加 / destinations合計=${destinations.length}`);
