#!/usr/bin/env node
/**
 * applyNichePatches.mjs — logs/nichePatches/*.json を destinations.json に適用
 *  - addSpot: spots が2件のままで、同名spotが無い場合のみ3件目として追加（画像なし＝テンプレは画像なしspotに対応済み）
 *  - gourmet: 本文に同文が無い場合のみ description 末尾に1文追加
 * 適用前に src/data/destinations.backup-niche.json へバックアップ
 */
import fs from 'fs';

const SRC = 'src/data/destinations.json';
const all = JSON.parse(fs.readFileSync(SRC, 'utf8'));
fs.writeFileSync('src/data/destinations.backup-niche.json', JSON.stringify(all));

const patches = {};
for (const f of fs.readdirSync('logs/nichePatches').filter(f => f.endsWith('.json'))) {
  Object.assign(patches, JSON.parse(fs.readFileSync(`logs/nichePatches/${f}`, 'utf8')));
}
console.log(`パッチ対象: ${Object.keys(patches).length}件`);

let spotAdded = 0, gourmetAdded = 0, skipped = [];
for (const d of all) {
  const p = patches[d.id];
  if (!p) continue;
  if (p.addSpot) {
    const names = (d.spots || []).map(s => s.name);
    if ((d.spots || []).length === 2 && !names.some(n => n.includes(p.addSpot.name) || p.addSpot.name.includes(n))) {
      d.spots.push({ name: p.addSpot.name, description: p.addSpot.description, googleMapsQuery: p.addSpot.googleMapsQuery });
      spotAdded++;
    } else {
      skipped.push(`${d.id}(spot: 既存${names.length}件/重複)`);
    }
  }
  if (p.gourmet && d.description && !d.description.includes(p.gourmet.slice(0, 10))) {
    d.description = d.description.replace(/\s*$/, '') + p.gourmet;
    gourmetAdded++;
  }
}
fs.writeFileSync(SRC, JSON.stringify(all, null, 2));
console.log(`spot追加: ${spotAdded} / グルメ文追加: ${gourmetAdded}`);
if (skipped.length) console.log('スキップ:', skipped.join(', '));

// 検証: niche spots分布再集計
const niche = all.filter(d => /^niche_/.test(d.id));
const bySpots = {};
for (const d of niche) { const n = (d.spots || []).length; bySpots[n] = (bySpots[n] || 0) + 1; }
console.log('適用後 niche spots数分布:', JSON.stringify(bySpots));
