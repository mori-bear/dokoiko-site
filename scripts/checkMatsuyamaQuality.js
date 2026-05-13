import fs from 'fs';
const destinations = JSON.parse(fs.readFileSync('./src/data/destinations.json', 'utf8'));

const matsuyama = destinations.find(d => d.id === 'matsuyama');
const dogo = destinations.find(d => d.id === 'dogo-onsen');

console.log('📊 松山 vs 道後温泉の品質比較\n');

console.log('【松山（統合後）】');
console.log(`description: ${matsuyama.description.length}字`);
console.log(`${matsuyama.description}\n`);
console.log(`spots: ${matsuyama.spots.length}個`);
matsuyama.spots.forEach(s => {
  console.log(`- ${s.name}: ${s.description ? s.description.length + '字' : 'なし'}`);
});
console.log(`reasonChips: ${(matsuyama.reasonChips||[]).join(', ')}`);
console.log(`keywords: ${matsuyama.keywords?.join(', ') || 'なし'}`);
console.log(`alternateNames: ${matsuyama.alternateNames?.join(', ') || 'なし'}\n`);

if (dogo) {
  console.log('【道後温泉（参考）】');
  console.log(`description: ${dogo.description.length}字`);
  console.log(`${dogo.description}\n`);
} else {
  console.log('【道後温泉】削除済み（松山に統合）');
}

console.log('\n【品質評価】');
console.log(`松山 description: ${matsuyama.description.length >= 200 ? '✅ OK（200字以上）' : '⚠️ 改善必要（< 200字）'}`);
console.log(`松山 spots説明: ${matsuyama.spots.filter(s => s.description && s.description.length > 30).length}/${matsuyama.spots.length} 件が詳しい`);
