#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import https from 'https';
import crypto from 'crypto';
import Anthropic from '@anthropic-ai/sdk';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEST_FILE = path.join(__dirname, '../src/data/destinations.json');
const IMG_DIR = path.join(__dirname, '../public/images');
const envContent = fs.readFileSync(path.join(__dirname, '../.env'), 'utf-8');
for (const line of envContent.split('\n')) {
  const m = line.match(/^([A-Z_]+)=(.+)$/);
  if (m) process.env[m[1]] = m[2].trim();
}
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const MODEL = 'claude-sonnet-4-6';
const PIXABAY_KEY = '55917935-4c63d9c4d75af8f3d831e21a6';
const UA = 'Mozilla/5.0';

const dests = JSON.parse(fs.readFileSync(DEST_FILE, 'utf-8'));
const existingNames = new Set(dests.map(d => d.name));

const NEW_ITEMS = [
  { id:'wakimachi',  name:'脇町',     prefecture:'徳島県', hub:'徳島',   hubCity:'徳島',   region:'四国', railGateway:'穴吹駅',     desc_hint:'うだつの商家群' },
  { id:'arimatsu',   name:'有松',     prefecture:'愛知県', hub:'名古屋', hubCity:'名古屋', region:'中部', railGateway:'有松駅',     desc_hint:'有松絞りの古い町並み' },
  { id:'asuke',      name:'足助',     prefecture:'愛知県', hub:'名古屋', hubCity:'名古屋', region:'中部', railGateway:'豊田市駅',   desc_hint:'重要伝統的建造物群保存地区' },
  { id:'unno-juku',  name:'海野宿',   prefecture:'長野県', hub:'長野',   hubCity:'長野',   region:'中部', railGateway:'田中駅',     desc_hint:'北国街道の宿場町' },
  { id:'yame',       name:'八女',     prefecture:'福岡県', hub:'福岡',   hubCity:'福岡',   region:'九州', railGateway:'羽犬塚駅',   desc_hint:'八女福島の古い町並み・八女茶' },
  { id:'takatori',   name:'高取',     prefecture:'奈良県', hub:'大阪',   hubCity:'奈良',   region:'近畿', railGateway:'壷阪山駅',   desc_hint:'土佐街道の武家屋敷' },
  { id:'seki-juku',  name:'関宿',     prefecture:'三重県', hub:'名古屋', hubCity:'津',     region:'近畿', railGateway:'関駅',       desc_hint:'東海道の宿場町' },
  { id:'hiketa',     name:'引田',     prefecture:'香川県', hub:'高松',   hubCity:'高松',   region:'四国', railGateway:'引田駅',     desc_hint:'醤油蔵と古い商家' },
];

const SYSTEM = `あなたは日本の旅情を伝える熟練観光ライターです。
各街歩き目的地について、220-280字の体験的説明文 + spots3件 + tags + catchを生成します。
- description: 五感(光・音・匂い・触感)+ 固有名詞 + 路地の雰囲気
- 「楽しめます」「有名」など紋切り型禁止
- 体言止め・余韻のある締め
- 純粋なJSONのみ`;

async function gen(items) {
  const userMsg = `次の各街歩き目的地を生成してください。

${items.map(it => `- id:${it.id}, 名前:${it.name}（${it.prefecture}）, ヒント: ${it.desc_hint}`).join('\n')}

形式: [{"id":"...","description":"220-280字","catch":"15字キャッチ","tags":["街歩き","歴史",...],"spots":[{"name":"...","description":"50-100字"},...]}]`;
  const res = await client.messages.create({ model: MODEL, max_tokens: 6000, system: SYSTEM, messages: [{role:'user', content:userMsg}] });
  const t = res.content[0].text.trim();
  const m = t.match(/\[[\s\S]*\]/);
  if (!m) throw new Error('JSON not found');
  return JSON.parse(m[0]);
}

function get(url) {
  return new Promise((resolve, reject) => {
    let hops = 0;
    function go(u) {
      hops++;
      if (hops > 5) return reject(new Error('redirects'));
      https.get(u, { headers: { 'User-Agent': UA, 'Accept': 'application/json' } }, res => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          res.resume(); return go(res.headers.location.startsWith('http') ? res.headers.location : new URL(res.headers.location, u).toString());
        }
        if (res.statusCode !== 200) { res.resume(); return reject(new Error(`HTTP ${res.statusCode}`)); }
        let body = ''; res.setEncoding('utf-8');
        res.on('data', c => body += c);
        res.on('end', () => resolve(body));
      }).on('error', reject);
    }
    go(url);
  });
}
function downloadBuf(url) {
  return new Promise((resolve, reject) => {
    let hops = 0;
    function go(u) {
      hops++;
      if (hops > 5) return reject(new Error('redirects'));
      https.get(u, { headers: { 'User-Agent': UA } }, res => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          res.resume(); return go(res.headers.location.startsWith('http') ? res.headers.location : new URL(res.headers.location, u).toString());
        }
        if (res.statusCode !== 200) { res.resume(); return reject(new Error(`HTTP ${res.statusCode}`)); }
        const chunks = [];
        res.on('data', c => chunks.push(c));
        res.on('end', () => resolve(Buffer.concat(chunks)));
      }).on('error', reject);
    }
    go(url);
  });
}
async function pixabay(name, prefecture) {
  const pref = (prefecture || '').replace(/[県府都]$/, '');
  const queries = [`${name} 古い町並み`, `${name} ${pref}`, `${pref} 街並み`];
  for (const q of queries) {
    try {
      const url = `https://pixabay.com/api/?key=${PIXABAY_KEY}&q=${encodeURIComponent(q)}&image_type=photo&lang=ja&per_page=5&safesearch=true`;
      const body = await get(url);
      const j = JSON.parse(body);
      if (j?.hits?.[0]?.largeImageURL) return j.hits[0].largeImageURL;
    } catch {}
    await new Promise(r => setTimeout(r, 600));
  }
  return null;
}

function rakutenLink(keyword) {
  const inner = encodeURIComponent(`https://travel.rakuten.co.jp/search/?keyword=${encodeURIComponent(keyword)}`);
  return `https://hb.afl.rakuten.co.jp/hgc/5113ee4b.8662cfc5.5113ee4c.119de89a/?pc=${inner}`;
}
const JALAN_CODE = {'徳島県':'36','愛知県':'23','長野県':'20','福岡県':'40','奈良県':'29','三重県':'24','香川県':'37'};
function jalanLink(pref) { return `https://www.jalan.net/${(JALAN_CODE[pref]||'13')}0000/`; }

// 既存名チェック
const newItems = NEW_ITEMS.filter(it => {
  const dup = dests.find(d => d.name === it.name && d.prefecture === it.prefecture);
  if (dup) { console.log(`⏭  ${it.name}: 既存(${dup.id})スキップ`); return false; }
  if (dests.find(d => d.id === it.id)) { console.log(`⏭  ${it.id}: id重複スキップ`); return false; }
  return true;
});
console.log(`📝 新規生成: ${newItems.length}件`);

// 同県の travelTime テンプレ取得
function templateTT(pref) {
  const sample = dests.find(d => d.prefecture === pref && d.travelTime && Object.keys(d.travelTime).length > 5);
  return sample?.travelTime ? { ...sample.travelTime } : { tokyo:300, osaka:200 };
}

const gens = await gen(newItems);
const genMap = {};
for (const g of gens) genMap[g.id] = g;

let added = 0;
for (const it of newItems) {
  const g = genMap[it.id];
  if (!g) { console.log(`✗ ${it.id}: gen failed`); continue; }
  const img = await pixabay(it.name, it.prefecture);
  let imageUrl = null;
  if (img) {
    try {
      const buf = await downloadBuf(img);
      if (buf.length > 5000) {
        const folder = path.join(IMG_DIR, it.id);
        if (!fs.existsSync(folder)) fs.mkdirSync(folder, { recursive: true });
        fs.writeFileSync(path.join(folder, 'main.jpg'), buf);
        imageUrl = `/images/${it.id}/main.jpg`;
      }
    } catch {}
  }
  const tt = templateTT(it.prefecture);
  const newDest = {
    id: it.id, name: it.name, type: 'destination', region: it.region,
    hub: it.hub, stayAllowed: ['daytrip','1night'], departures: [it.hub, '大阪', '名古屋'].filter((v,i,a)=>a.indexOf(v)===i),
    weight: 1.2, description: g.description,
    tags: (g.tags || ['街歩き','歴史','古い町並み']).slice(0, 5),
    spots: (g.spots || []).slice(0, 3).map(s => ({ name:s.name, description:(s.description||'').slice(0,160), imageUrl:null })),
    shinkansenAccess: false, requiresCar: false, hotelSearch: it.name,
    gateways: { rail: [it.railGateway], airport: [], bus: [], ferry: [] },
    accessHub: null, railNote: null, destType: 'town',
    railGateway: it.railGateway, busGateway: null, ferryGateway: null, airportGateway: null,
    prefecture: it.prefecture, lat: null, lng: null, stayBias: 1,
    airportHub: null, railProvider: 'e5489', travelTime: tt,
    stayRecommendation: 'daytrip', secondaryTransport: null, city: it.name + '市',
    hubStation: it.railGateway, accessStation: it.railGateway,
    hotelArea: it.id, jalanPath: null, hotelKeyword: it.name,
    access: { steps: [{ type:'rail', to:it.railGateway, provider:'e5489' }] },
    fallbackCity: it.hubCity, gateway: it.railGateway,
    gatewayStations: [{ name:it.railGateway, type:'rail', priority:1 }],
    localAccess: { type:'walk', description:`${it.railGateway}から徒歩`, to:it.railGateway },
    situations: ['solo','couple','friends'], catch: g.catch || `${it.name}の古い町を歩く。`,
    primary: ['街歩き','歴史','古い町並み'], secondary: [], onsenLevel: 0,
    hasDirectFlight: false, mapPoint: g.spots?.[0]?.name || it.name, subType: 'town',
    stayDescription: '', hubCity: it.hubCity, stayPriority: 'medium',
    representativeStation: it.railGateway, finalAccess: { type:'walk' },
    accessPoint: { type:'station', name: it.railGateway.replace('駅','') },
    staySearchUrl: rakutenLink(it.name),
    bookingStation: { name:it.railGateway, company:'JR' },
    mainSpot: g.spots?.[0]?.name || it.name,
    stayArea: { rakuten:it.name, jalan:it.name },
    hotelLinks: { rakuten: rakutenLink(it.name), jalan: jalanLink(it.prefecture) },
    tier: 'spot', icCard: null, tier2: 'town', hubName: it.hub,
    rentalCarRecommended: false,
    images: imageUrl ? [imageUrl] : [],
    reasonChips: ['街歩き','歴史を辿る','古い町並み'],
    bestSeason: '通年', isIsland: false,
  };
  dests.push(newDest);
  added++;
  console.log(`✓ ${it.id} (${it.name}) ${imageUrl?'画像あり':'画像なし'}`);
}
fs.writeFileSync(DEST_FILE, JSON.stringify(dests, null, 2));
console.log(`\n=== 完了 === 追加: ${added}件 / total: ${dests.length}`);
