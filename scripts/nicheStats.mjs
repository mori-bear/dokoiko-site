// niche_ destination の現状統計（spots数・説明文長・グルメ/アクセス情報の有無）
import fs from 'fs';
const all = JSON.parse(fs.readFileSync('src/data/destinations.json', 'utf8'));
const niche = all.filter(d => /^niche_/.test(d.id));
console.log(`全destination: ${all.length} / niche: ${niche.length}`);

const bySpots = {};
let shortDesc = 0, noGourmet = 0, noAccess = 0;
for (const d of niche) {
  const spots = Array.isArray(d.spots) ? d.spots : [];
  bySpots[spots.length] = (bySpots[spots.length] || 0) + 1;
  for (const s of spots) {
    const len = (s.description || '').length;
    if (len < 40) shortDesc++;
  }
  const body = JSON.stringify(d);
  if (!/グルメ|名物|食/.test(body)) noGourmet++;
  if (!/駐車|所要|アクセス/.test(body)) noAccess++;
}
console.log('spots数分布:', JSON.stringify(bySpots));
console.log(`説明文40字未満のspot: ${shortDesc}`);
console.log(`グルメ言及なし: ${noGourmet} / アクセス実用情報なし: ${noAccess}`);
console.log('--- niche 1件サンプル ---');
const sample = niche.find(d => (d.spots || []).length < 3) || niche[0];
console.log(JSON.stringify(sample, null, 1).slice(0, 2000));
