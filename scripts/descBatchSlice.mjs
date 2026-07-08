/**
 * descBatchSlice.mjs
 * description強化バッチ用の入力スライスを生成する。
 * 各destinationから「事実ソースとして許可するフィールド」だけを抽出し、
 * N件ずつのJSONファイルに分割して出力する。
 *
 * 使い方: node scripts/descBatchSlice.mjs <出力ディレクトリ> [1スライスの件数=30]
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEST_FILE = path.join(__dirname, '../src/data/destinations.json');
const OUT_DIR = process.argv[2];
const CHUNK = parseInt(process.argv[3] || '30', 10);

const destinations = JSON.parse(fs.readFileSync(DEST_FILE, 'utf-8'));
fs.mkdirSync(OUT_DIR, { recursive: true });

const items = destinations.map((d) => ({
  id: d.id,
  name: d.name,
  prefecture: d.prefecture,
  region: d.region,
  destType: d.destType,
  subType: d.subType,
  bestSeason: d.bestSeason,
  catch: d.catch,
  description: d.description,
  stayDescription: d.stayDescription,
  tags: d.tags,
  mainSpot: d.mainSpot,
  spots: (d.spots || []).map((s) => ({ name: s.name, description: s.description })),
  // アクセス系（事実ソース）
  representativeStation: d.representativeStation,
  accessStation: d.accessStation,
  railGateway: d.railGateway,
  busGateway: d.busGateway,
  ferryGateway: d.ferryGateway,
  airportGateway: d.airportGateway,
  hubName: d.hubName,
  hubStation: d.hubStation,
  requiresCar: d.requiresCar,
  rentalCarRecommended: d.rentalCarRecommended,
  shinkansenAccess: d.shinkansenAccess,
  railNote: d.railNote,
  secondaryTransport: d.secondaryTransport,
}));

let n = 0;
for (let i = 0; i < items.length; i += CHUNK) {
  const slice = items.slice(i, i + CHUNK);
  const file = path.join(OUT_DIR, `input_${String(n).padStart(2, '0')}.json`);
  fs.writeFileSync(file, JSON.stringify(slice, null, 1));
  n++;
}
console.log(`✅ ${items.length} 件を ${n} スライスに分割 (${CHUNK}件/スライス) → ${OUT_DIR}`);
