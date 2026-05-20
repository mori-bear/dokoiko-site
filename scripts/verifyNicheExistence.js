#!/usr/bin/env node
/**
 * verifyNicheExistence.js
 * niche_ destinationの実在性を Nominatim (OSM) + Wikipedia で検証。
 * 両方0ヒット = 架空判定 → destinations.json から削除
 * Nominatim Rate: 1req/sec (User-Agent必須)
 */
import fs from 'fs';
import path from 'path';
import https from 'https';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEST_FILE = path.join(__dirname, '../src/data/destinations.json');
const IMG_DIR = path.join(__dirname, '../public/images');

const destinations = JSON.parse(fs.readFileSync(DEST_FILE, 'utf-8'));
const UA = 'dokoiko-niche-verifier/1.0 (https://tabidokoiko.com)';

function get(url) {
  return new Promise((resolve, reject) => {
    let hops = 0;
    function go(u) {
      hops++;
      if (hops > 5) return reject(new Error('redirects'));
      https.get(u, { headers: { 'User-Agent': UA, 'Accept': 'application/json' } }, res => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          res.resume();
          return go(res.headers.location.startsWith('http') ? res.headers.location : new URL(res.headers.location, u).toString());
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

async function nominatimSearch(query, pref) {
  // pref付きで japan限定
  const q = encodeURIComponent(`${query} ${pref} Japan`);
  try {
    const body = await get(`https://nominatim.openstreetmap.org/search?q=${q}&format=json&limit=2&countrycodes=jp`);
    const arr = JSON.parse(body);
    return Array.isArray(arr) && arr.length > 0 ? arr[0] : null;
  } catch { return null; }
}

async function wikiSearch(query) {
  try {
    const body = await get(`https://ja.wikipedia.org/w/api.php?action=query&list=search&format=json&srsearch=${encodeURIComponent(query)}&srlimit=1&origin=*`);
    const j = JSON.parse(body);
    const hits = j?.query?.search || [];
    return hits.length > 0 ? hits[0] : null;
  } catch { return null; }
}

function extractCoreName(name) {
  // niche destination名から検索しやすいコア部分を抽出
  // 例: "白鷹町 べにばな温泉郷" → "べにばな温泉" or "白鷹町"
  // 例: "只見町・ブナ林と清流の里" → "只見町"
  // 例: "大江町 最上川ダム湖・紅葉峡" → "大江町"
  const parts = name.split(/[・　\s]+/);
  return parts.filter(s => s.length > 0);
}

const targets = destinations.filter(d => d.id.startsWith('niche_'));
console.log(`📍 検証対象: ${targets.length}件`);

const removed = [];
const verified = [];
let processed = 0;

for (const d of targets) {
  processed++;
  const parts = extractCoreName(d.name);
  const candidates = [];
  // フルネーム
  candidates.push(d.name);
  // city が設定されていれば city も
  if (d.city) candidates.push(d.city);
  // 各部分 (長さ2以上)
  for (const p of parts) if (p.length >= 2) candidates.push(p);

  let found = null;
  // Nominatim まず試す
  for (const q of candidates.slice(0, 3)) {
    found = await nominatimSearch(q, d.prefecture);
    if (found) break;
    await new Promise(r => setTimeout(r, 1200));  // 1req/sec
  }

  // Wikipedia 補助 (Nominatim全敗時)
  if (!found) {
    for (const q of candidates.slice(0, 2)) {
      const w = await wikiSearch(`${q} ${d.prefecture}`);
      if (w) { found = { wiki: w }; break; }
      await new Promise(r => setTimeout(r, 800));
    }
  }

  if (found) {
    verified.push(d.id);
    // Nominatim結果なら lat/lng 更新
    if (found.lat && found.lon) {
      d.lat = parseFloat(found.lat);
      d.lng = parseFloat(found.lon);
    }
  } else {
    removed.push({ id: d.id, name: d.name, prefecture: d.prefecture });
  }

  if (processed % 20 === 0 || processed === targets.length) {
    console.log(`  [${processed}/${targets.length}] verified=${verified.length} 削除候補=${removed.length}`);
  }
}

// 削除実行
const toDeleteIds = new Set(removed.map(r => r.id));
const before = destinations.length;
const filtered = destinations.filter(d => !toDeleteIds.has(d.id));
fs.writeFileSync(DEST_FILE, JSON.stringify(filtered, null, 2));

// 画像フォルダも削除
for (const r of removed) {
  const folder = path.join(IMG_DIR, r.id);
  if (fs.existsSync(folder)) fs.rmSync(folder, { recursive: true, force: true });
}

console.log(`\n=== 完了 ===`);
console.log(`  実在確認: ${verified.length}件`);
console.log(`  架空削除: ${removed.length}件`);
console.log(`  destinations: ${before} → ${filtered.length}`);
if (removed.length > 0 && removed.length <= 100) {
  console.log(`\n削除リスト:`);
  for (const r of removed) console.log(`  - ${r.id} (${r.name}, ${r.prefecture})`);
}
