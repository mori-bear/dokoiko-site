import fs from 'fs';
const destinations = JSON.parse(fs.readFileSync('./src/data/destinations.json', 'utf8'));

console.log('🏙️  市町村単位での目的地クラスタ分析\n');

const matsuyamaDests = destinations.filter(d => 
  d.prefecture === '愛媛県' && (d.name.includes('松山') || d.id.includes('matsuyama'))
);

console.log('【松山市関連の目的地】');
matsuyamaDests.forEach(d => {
  console.log(`${d.name} (id: ${d.id})`);
  console.log(`  description: ${(d.description || '').length}字`);
  console.log(`  spots: ${d.spots?.length || 0}個`);
  console.log(`  tags: ${d.tags?.join(', ') || 'なし'}\n`);
});

const kamiDests = destinations.filter(d => 
  d.prefecture === '高知県' && (d.name.includes('香美') || d.id.includes('kami') || d.id === 'kochi-anpanman' || d.id === 'ryugado')
);

console.log('\n【香美市関連の目的地】');
kamiDests.forEach(d => {
  console.log(`${d.name} (id: ${d.id})`);
  console.log(`  description: ${(d.description || '').length}字\n`);
});

console.log('【提案】');
console.log('- 松山市: 複数の松山関連目的地を「松山」に統合');
console.log('- 香美市: アンパンマンミュージアム + 龍河洞 → 「香美市」に統合');
