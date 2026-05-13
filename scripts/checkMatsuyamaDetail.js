import fs from 'fs';
const destinations = JSON.parse(fs.readFileSync('./src/data/destinations.json', 'utf8'));

console.log('🏯 松山市の現在の分割状況\n');

const matsuyama = destinations.filter(d => 
  d.prefecture === '愛媛県' && 
  (d.name.includes('松山') || d.id.includes('matsuyama'))
);

console.log(`松山市関連の目的地:\n`);
matsuyama.forEach(d => {
  console.log(`${d.name}`);
  console.log(`  id: ${d.id}`);
  console.log(`  description: ${(d.description || '').length}字`);
  console.log(`  spots: ${d.spots?.length || 0}個`);
  console.log(`  spot名: ${(d.spots||[]).map(s=>s.name).join('・')}`);
  console.log('');
});

console.log(`【現状】 ${matsuyama.length}件`);
