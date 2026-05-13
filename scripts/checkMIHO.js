import fs from 'fs';
const destinations = JSON.parse(fs.readFileSync('./src/data/destinations.json', 'utf8'));

console.log('🔍 MIHO MUSEUM の重複確認\n');

const all = destinations.filter(d => 
  d.name.includes('MIHO') || d.name.includes('ミホ') || d.id.includes('miho')
);

all.forEach(d => {
  console.log(`【${d.name}】`);
  console.log(`  ID: ${d.id}`);
  console.log(`  prefecture: ${d.prefecture}`);
  console.log(`  description: ${(d.description || '').length}字`);
  console.log(`  座標: lat=${d.lat}, lng=${d.lng}`);
  console.log(`  hub: ${d.hub}`);
  console.log('');
});

const miho1 = destinations.find(d => d.id === 'miho-museum');
const miho2 = destinations.find(d => d.id === 'miho-mountain');

console.log('【判定】');
if (miho1 && miho2 && miho1.prefecture === miho2.prefecture) {
  console.log(`❌ 同じ施設の重複: MIHO MUSEUM = ミホミュージアム`);
  console.log(`統合候補: 統一名「MIHO MUSEUM」、id=miho-museum`);
} else {
  console.log(`✅ 重複なし or 別施設`);
}
