import fs from 'fs';
const destinations = JSON.parse(fs.readFileSync('./src/data/destinations.json', 'utf8'));

console.log('🔍 道後温泉の存在確認\n');

const dogo = destinations.filter(d => 
  d.name.includes('道後') || d.id.includes('dogo')
);

if (dogo.length > 0) {
  console.log(`✅ 道後温泉は存在します:\n`);
  dogo.forEach(d => {
    console.log(`${d.name} (id: ${d.id})`);
    console.log(`  prefecture: ${d.prefecture}`);
    console.log(`  description: ${(d.description || '').length}字`);
    console.log(`  spots: ${d.spots?.length || 0}個`);
    console.log(`  tags: ${d.tags?.join(', ') || 'なし'}\n`);
  });
} else {
  console.log(`❌ 道後温泉は独立目的地として存在しません`);
}

const matsuyama = destinations.find(d => d.id === 'matsuyama');
console.log('【松山（matsuyama）の現在の spots】');
matsuyama.spots.forEach(s => {
  console.log(`- ${s.name}`);
});
