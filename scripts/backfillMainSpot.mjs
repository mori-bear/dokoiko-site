/**
 * backfillMainSpot.mjs — mainSpot 未設定の目的地に spots[0].name を補完（Task3: hero alt具体化）
 * hero画像alt が "◯◯の風景"(汎用) → "◯◯の{名所}"(具体) になる。事実に基づく補完のみ。
 */
import fs from 'fs';
const FILE = 'src/data/destinations.json';
const dests = JSON.parse(fs.readFileSync(FILE, 'utf8'));
let filled = 0;
for (const d of dests) {
  if (d.mainSpot) continue;
  const s0 = Array.isArray(d.spots) && d.spots[0];
  const name = s0 && (typeof s0 === 'object' ? s0.name : s0);
  if (name) { d.mainSpot = name; filled++; }
}
fs.writeFileSync(FILE, JSON.stringify(dests, null, 2));
console.log(`mainSpot補完: ${filled}件`);
