#!/usr/bin/env node
/**
 * generateNicheDestinations.js
 * 各都道府県のニッチ・ローカル目的地を Claude API で生成して destinations.json に追加。
 * 北海道は既に431件あるためスキップ。
 */
import fs from 'fs';
import Anthropic from '@anthropic-ai/sdk';

const envContent = fs.readFileSync('./.env', 'utf-8');
for (const line of envContent.split('\n')) {
  const m = line.match(/^([A-Z_]+)=(.+)$/);
  if (m) process.env[m[1]] = m[2].trim();
}
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const DEST_FILE = './src/data/destinations.json';
const destinations = JSON.parse(fs.readFileSync(DEST_FILE, 'utf-8'));

// 既存destination名のセット (重複検出)
const existingNames = new Set(destinations.map(d => d.name));
const existingIds = new Set(destinations.map(d => d.id));

// 県ごとの region / hub / hubCity / 代表travelTime テンプレ
const PREF_META = {
  '青森県':   { region: '東北', hub: '青森',   hubCity: '青森',   railGateway: '新青森駅' },
  '岩手県':   { region: '東北', hub: '盛岡',   hubCity: '盛岡',   railGateway: '盛岡駅' },
  '宮城県':   { region: '東北', hub: '仙台',   hubCity: '仙台',   railGateway: '仙台駅' },
  '秋田県':   { region: '東北', hub: '秋田',   hubCity: '秋田',   railGateway: '秋田駅' },
  '山形県':   { region: '東北', hub: '山形',   hubCity: '山形',   railGateway: '山形駅' },
  '福島県':   { region: '東北', hub: '仙台',   hubCity: '福島',   railGateway: '福島駅' },
  '茨城県':   { region: '関東', hub: '東京',   hubCity: '水戸',   railGateway: '水戸駅' },
  '栃木県':   { region: '関東', hub: '東京',   hubCity: '宇都宮', railGateway: '宇都宮駅' },
  '群馬県':   { region: '関東', hub: '東京',   hubCity: '前橋',   railGateway: '高崎駅' },
  '埼玉県':   { region: '関東', hub: '東京',   hubCity: '大宮',   railGateway: '大宮駅' },
  '千葉県':   { region: '関東', hub: '東京',   hubCity: '千葉',   railGateway: '千葉駅' },
  '東京都':   { region: '関東', hub: '東京',   hubCity: '東京',   railGateway: '東京駅' },
  '神奈川県': { region: '関東', hub: '東京',   hubCity: '横浜',   railGateway: '横浜駅' },
  '新潟県':   { region: '中部', hub: '新潟',   hubCity: '新潟',   railGateway: '新潟駅' },
  '富山県':   { region: '中部', hub: '富山',   hubCity: '富山',   railGateway: '富山駅' },
  '石川県':   { region: '中部', hub: '金沢',   hubCity: '金沢',   railGateway: '金沢駅' },
  '福井県':   { region: '中部', hub: '福井',   hubCity: '福井',   railGateway: '福井駅' },
  '山梨県':   { region: '中部', hub: '東京',   hubCity: '甲府',   railGateway: '甲府駅' },
  '長野県':   { region: '中部', hub: '松本',   hubCity: '松本',   railGateway: '長野駅' },
  '岐阜県':   { region: '中部', hub: '名古屋', hubCity: '岐阜',   railGateway: '岐阜駅' },
  '静岡県':   { region: '中部', hub: '東京',   hubCity: '静岡',   railGateway: '静岡駅' },
  '愛知県':   { region: '中部', hub: '名古屋', hubCity: '名古屋', railGateway: '名古屋駅' },
  '三重県':   { region: '近畿', hub: '名古屋', hubCity: '津',     railGateway: '津駅' },
  '滋賀県':   { region: '近畿', hub: '大阪',   hubCity: '大津',   railGateway: '大津駅' },
  '京都府':   { region: '近畿', hub: '京都',   hubCity: '京都',   railGateway: '京都駅' },
  '大阪府':   { region: '近畿', hub: '大阪',   hubCity: '大阪',   railGateway: '新大阪駅' },
  '兵庫県':   { region: '近畿', hub: '神戸',   hubCity: '神戸',   railGateway: '新神戸駅' },
  '奈良県':   { region: '近畿', hub: '大阪',   hubCity: '奈良',   railGateway: '奈良駅' },
  '和歌山県': { region: '近畿', hub: '大阪',   hubCity: '和歌山', railGateway: '和歌山駅' },
  '鳥取県':   { region: '中国', hub: '鳥取',   hubCity: '鳥取',   railGateway: '鳥取駅' },
  '島根県':   { region: '中国', hub: '松江',   hubCity: '松江',   railGateway: '松江駅' },
  '岡山県':   { region: '中国', hub: '岡山',   hubCity: '岡山',   railGateway: '岡山駅' },
  '広島県':   { region: '中国', hub: '広島',   hubCity: '広島',   railGateway: '広島駅' },
  '山口県':   { region: '中国', hub: '広島',   hubCity: '山口',   railGateway: '新山口駅' },
  '徳島県':   { region: '四国', hub: '徳島',   hubCity: '徳島',   railGateway: '徳島駅' },
  '香川県':   { region: '四国', hub: '高松',   hubCity: '高松',   railGateway: '高松駅' },
  '愛媛県':   { region: '四国', hub: '松山',   hubCity: '松山',   railGateway: '松山駅' },
  '高知県':   { region: '四国', hub: '高知',   hubCity: '高知',   railGateway: '高知駅' },
  '福岡県':   { region: '九州', hub: '福岡',   hubCity: '福岡',   railGateway: '博多駅' },
  '佐賀県':   { region: '九州', hub: '福岡',   hubCity: '佐賀',   railGateway: '佐賀駅' },
  '長崎県':   { region: '九州', hub: '長崎',   hubCity: '長崎',   railGateway: '長崎駅' },
  '熊本県':   { region: '九州', hub: '熊本',   hubCity: '熊本',   railGateway: '熊本駅' },
  '大分県':   { region: '九州', hub: '福岡',   hubCity: '大分',   railGateway: '大分駅' },
  '宮崎県':   { region: '九州', hub: '福岡',   hubCity: '宮崎',   railGateway: '宮崎駅' },
  '鹿児島県': { region: '九州', hub: '鹿児島', hubCity: '鹿児島', railGateway: '鹿児島中央駅' },
  '沖縄県':   { region: '沖縄', hub: '那覇',   hubCity: '那覇',   railGateway: '那覇空港駅' },
};

// 各県で生成する件数 (既存件数が少ない県を多めに、北海道はスキップ)
function targetCount(pref) {
  const existing = destinations.filter(d => d.prefecture === pref).length;
  if (existing < 18) return 8;
  if (existing < 25) return 6;
  if (existing < 35) return 5;
  return 4;
}

function rakutenLink(keyword) {
  const inner = encodeURIComponent(`https://travel.rakuten.co.jp/search/?keyword=${encodeURIComponent(keyword)}`);
  return `https://hb.afl.rakuten.co.jp/hgc/5113ee4b.8662cfc5.5113ee4c.119de89a/?pc=${inner}`;
}
function jalanLink(keyword) {
  const inner = encodeURIComponent(`https://www.jalan.net/uw/uwp2011/uww2011init.do?keyword=${encodeURIComponent(keyword)}`);
  return `https://ck.jp.ap.valuecommerce.com/servlet/referral?sid=3764408&pid=892559858&vc_url=${inner}`;
}

// 同県のサンプル destination から travelTime テンプレを取得
function templateTravelTime(pref) {
  const sample = destinations.find(d => d.prefecture === pref && d.travelTime && Object.keys(d.travelTime).length > 5);
  return sample?.travelTime || {};
}

function nicheIdFor(name, pref) {
  // 安全な id生成: 'niche_<prefshort>_<num>'
  const prefshort = pref.replace(/[県府都]$/, '').slice(0, 3);
  for (let i = 1; i < 1000; i++) {
    const id = `niche_${prefshort}_${i}`;
    if (!existingIds.has(id)) {
      existingIds.add(id);
      return id;
    }
  }
  throw new Error('id slot exhausted');
}

async function generateForPref(pref) {
  const meta = PREF_META[pref];
  const count = targetCount(pref);
  const existing = destinations.filter(d => d.prefecture === pref).map(d => d.name).slice(0, 30);

  const SYSTEM = `あなたは日本のローカル観光に詳しいライターです。
県内の「ニッチで日帰り〜1泊で行けるローカル目的地」を提案します。
- 有名観光地は禁止 (例: 京都→金閣寺、奈良→東大寺、北海道→札幌・小樽 など主要地)
- 地元民が知る、旅行サイトに載らない、でも行く価値がある場所
- ジャンル例: 小さい港町・漁村、ローカル温泉、古い商店街、展望台・岬、ダム湖、廃線跡、小さい島、地方の城下町、名もない滝・渓谷、ユニークな道の駅周辺、地元の祭りで有名な町、特産品で知られる小さい町
- 既存リストにあるものは出さない
- 各destinationのdescriptionは220〜280字で五感・固有名詞・体験を含める
- ハルシネーション禁止: 実在する場所のみ。確信が持てない場合は出さない
- 純粋なJSONのみ出力、マークダウン禁止`;

  const userMsg = `${pref}の「ふらっと行けるニッチ・ローカル目的地」を${count}件提案してください。
既存リスト (避ける): ${existing.join('、')}

応答形式 (JSONのみ):
[
  {
    "name": "目的地名",
    "city": "市町村名",
    "description": "220-280字の体験的説明",
    "tags": ["タグ1", "タグ2", "タグ3"],
    "spots": [
      {"name": "spot名", "description": "50-100字"},
      {"name": "spot名", "description": "50-100字"}
    ],
    "bestSeason": "春/夏/秋/冬/通年",
    "destType": "sight/onsen/island/town/nature/food/historic",
    "isIsland": false
  }
]`;

  const res = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 6000,
    system: SYSTEM,
    messages: [{ role: 'user', content: userMsg }],
  });
  const text = res.content[0].text.trim();
  const m = text.match(/\[[\s\S]*\]/);
  if (!m) throw new Error('JSON not found');
  return JSON.parse(m[0]);
}

function buildFullDestination(gen, pref) {
  const meta = PREF_META[pref];
  const id = nicheIdFor(gen.name, pref);
  const travelTime = { ...templateTravelTime(pref) };
  return {
    id,
    name: gen.name,
    type: 'destination',
    region: meta.region,
    hub: meta.hub,
    stayAllowed: gen.destType === 'island' ? ['daytrip', '1night'] : ['daytrip', '1night'],
    departures: [meta.hub],
    weight: 0.8,
    description: gen.description,
    tags: (gen.tags || []).slice(0, 5),
    spots: (gen.spots || []).slice(0, 4).map(s => ({
      name: s.name,
      description: (s.description || '').slice(0, 200),
      googleMapsQuery: s.googleMapsQuery || `${s.name} ${pref}`,
    })),
    shinkansenAccess: ['東京都','大阪府','京都府','愛知県','兵庫県','岡山県','広島県','福岡県','宮城県','岩手県','青森県','新潟県','石川県','富山県','福井県','長野県','鹿児島県','熊本県'].includes(pref),
    requiresCar: gen.destType === 'nature' || gen.tags?.includes('車推奨') || false,
    hotelSearch: gen.name,
    gateways: { rail: [meta.railGateway], airport: [], bus: [], ferry: [] },
    accessHub: null,
    railNote: null,
    destType: gen.destType || 'sight',
    railGateway: meta.railGateway,
    busGateway: null,
    ferryGateway: null,
    airportGateway: null,
    prefecture: pref,
    lat: null,
    lng: null,
    stayBias: 1,
    airportHub: null,
    railProvider: 'e5489',
    travelTime,
    stayRecommendation: 'daytrip',
    secondaryTransport: null,
    city: gen.city || meta.hubCity,
    hubStation: meta.railGateway,
    accessStation: meta.railGateway,
    hotelArea: pref.replace(/[県府都]$/, '').toLowerCase(),
    jalanPath: null,
    hotelKeyword: gen.name,
    access: { steps: [{ type: 'rail', to: meta.railGateway, provider: 'e5489' }] },
    fallbackCity: meta.hubCity,
    gateway: meta.railGateway,
    gatewayStations: [{ name: meta.railGateway, type: 'rail', priority: 1 }],
    localAccess: { type: 'walk', description: `${meta.railGateway}から路線バス・車`, to: meta.railGateway },
    situations: ['solo', 'couple', 'friends'],
    catch: gen.description.split(/[。、]/)[0].slice(0, 30),
    primary: (gen.tags || []).slice(0, 3),
    secondary: [],
    onsenLevel: gen.destType === 'onsen' ? 2 : 0,
    hasDirectFlight: false,
    mapPoint: gen.spots?.[0]?.name || gen.name,
    subType: gen.destType || 'sight',
    stayDescription: '',
    hubCity: meta.hubCity,
    stayPriority: 'medium',
    representativeStation: meta.railGateway,
    finalAccess: { type: 'walk' },
    accessPoint: { type: 'station', name: meta.railGateway.replace('駅', '') },
    staySearchUrl: rakutenLink(gen.name),
    bookingStation: { name: meta.railGateway, company: 'JR' },
    mainSpot: gen.spots?.[0]?.name || gen.name,
    stayArea: { rakuten: gen.name, jalan: gen.name },
    hotelLinks: { rakuten: rakutenLink(gen.name), jalan: jalanLink(gen.name) },
    tier: 'spot',
    icCard: null,
    tier2: 'niche',
    hubName: meta.hub,
    rentalCarRecommended: gen.destType === 'nature',
    images: [],
    reasonChips: [],  // refineChipsAndSeason.js で後付け
    bestSeason: gen.bestSeason || '通年',
    isIsland: !!gen.isIsland,
  };
}

// 失敗した残20県のみ再実行
const FAILED_PREFS = ['兵庫県','奈良県','和歌山県','鳥取県','島根県','岡山県','広島県','山口県','徳島県','香川県','愛媛県','高知県','福岡県','佐賀県','長崎県','熊本県','大分県','宮崎県','鹿児島県','沖縄県'];
const targetPrefs = FAILED_PREFS;  // 残のみ
console.log(`📍 対象都道府県: ${targetPrefs.length}件`);

let totalAdded = 0;
let failedPrefs = [];

for (let i = 0; i < targetPrefs.length; i++) {
  const pref = targetPrefs[i];
  const targetN = targetCount(pref);
  try {
    const generated = await generateForPref(pref);
    let added = 0;
    for (const gen of generated) {
      if (!gen.name || existingNames.has(gen.name)) continue;
      const d = buildFullDestination(gen, pref);
      destinations.push(d);
      existingNames.add(gen.name);
      added++;
    }
    totalAdded += added;
    console.log(`  ${i+1}/${targetPrefs.length} ${pref}: +${added}件 (要求${targetN}件)`);
  } catch (e) {
    failedPrefs.push(pref);
    console.log(`  ✗ ${pref}: ${e.message}`);
  }
  if ((i + 1) % 5 === 0) {
    fs.writeFileSync(DEST_FILE, JSON.stringify(destinations, null, 2));
  }
  await new Promise(r => setTimeout(r, 1500));
}
fs.writeFileSync(DEST_FILE, JSON.stringify(destinations, null, 2));

console.log(`\n=== 完了 ===`);
console.log(`  追加: ${totalAdded}件`);
console.log(`  失敗県: ${failedPrefs.join(', ') || 'なし'}`);
console.log(`  destinations合計: ${destinations.length}件`);
