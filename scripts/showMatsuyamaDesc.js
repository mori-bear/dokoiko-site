import fs from 'fs';
const destinations = JSON.parse(fs.readFileSync('./src/data/destinations.json', 'utf8'));
const matsuyama = destinations.find(d => d.id === 'matsuyama');

console.log('【現在の松山 description】');
console.log(`${matsuyama.description}`);
console.log(`\n現在: ${matsuyama.description.length}字`);
console.log(`必要: 200字（あと ${200 - matsuyama.description.length}字）`);

console.log('\n【拡張案】');
console.log('+ 松山城の歴史的価値を強調');
console.log('+ 坂の上の雲のストーリーを追加');
console.log('+ 四季の魅力を付け加える');
