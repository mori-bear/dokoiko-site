import fs from 'fs';
const destinations = JSON.parse(fs.readFileSync('./src/data/destinations.json', 'utf8'));

console.log('🔍 美保関温泉の確認\n');

const mihoseki = destinations.filter(d => 
  d.name.includes('美保') || d.id.includes('miho') || d.name.includes('保関')
);

if (mihoseki.length > 0) {
  console.log(`✅ 美保関温泉は存在します:\n`);
  mihoseki.forEach(d => {
    console.log(`${d.name} (id: ${d.id})`);
    console.log(`  prefecture: ${d.prefecture}`);
    console.log(`  description: ${(d.description || '').length}字`);
    console.log(`  ${(d.description || '').substring(0, 80)}...\n`);
  });
} else {
  console.log(`❌ 美保関温泉は登録されていません`);
}

console.log('\n【島根県の現在の目的地】');
const shimane = destinations.filter(d => d.prefecture === '島根県');
console.log(`${shimane.length}件`);
shimane.forEach(d => {
  console.log(`- ${d.name}`);
});
