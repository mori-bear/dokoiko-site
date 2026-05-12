import fs from 'fs';

const destinations = JSON.parse(fs.readFileSync('./src/data/destinations.json', 'utf8'));

const needsImprovement = destinations.filter(d => !d.description || d.description.length < 150);

console.log(`📝 全改善対象: ${needsImprovement.length}件\n`);

const batchSize = 60;
const batches = [];
for (let i = 0; i < needsImprovement.length; i += batchSize) {
  batches.push(needsImprovement.slice(i, i + batchSize));
}

console.log(`📦 バッチ分割: ${batches.length}バッチ（各${batchSize}件）`);
batches.forEach((batch, batchIndex) => {
  console.log(`\nバッチ${batchIndex + 1}: ${batch.length}件 / 県別:`);
  const byPref = {};
  batch.forEach(d => { byPref[d.prefecture] = (byPref[d.prefecture]||0)+1; });
  Object.entries(byPref).sort((a,b)=>b[1]-a[1]).slice(0,10).forEach(([p,c]) => console.log(`  ${p}: ${c}`));
});

fs.writeFileSync('/tmp/full-batch-info.json', JSON.stringify({
  totalTargets: needsImprovement.length,
  batches: batches.length,
}, null, 2));
