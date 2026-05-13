import fs from 'fs';
const destinations = JSON.parse(fs.readFileSync('./src/data/destinations.json', 'utf8'));

console.log('🔍 細分化されすぎた目的地を検出\n');

const fragmented = destinations.filter(d => {
  const descLen = d.description ? d.description.length : 0;
  return descLen < 150 && (!d.spots || d.spots.length <= 2) && (!d.tags || d.tags.length <= 2);
});

console.log(`細分化されすぎた目的地: ${fragmented.length}件\n`);

fragmented.slice(0, 30).forEach(d => {
  console.log(`${d.name} (${d.prefecture})`);
  console.log(`  description: ${(d.description || '').length}字`);
  console.log(`  spots: ${d.spots?.length || 0}個`);
  console.log(`  tags: ${d.tags?.join(', ') || 'なし'}`);
  console.log('');
});
if (fragmented.length > 30) console.log(`...残り${fragmented.length-30}件`);
