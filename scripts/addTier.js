import { readFileSync, writeFileSync } from 'fs';

const path = './src/data/destinations.json';
const data = JSON.parse(readFileSync(path, 'utf8'));

const AREA_TYPES = new Set(['city', 'onsen']);

let added = 0;
for (const d of data) {
  d.tier = AREA_TYPES.has(d.destType) ? 'area' : 'spot';
  added++;
}

writeFileSync(path, JSON.stringify(data, null, 2), 'utf8');
console.log(`✅ tier追加完了: ${added}件`);

// 内訳
const counts = {};
for (const d of data) counts[d.tier] = (counts[d.tier] || 0) + 1;
Object.entries(counts).forEach(([k, v]) => console.log(`  ${k}: ${v}件`));
