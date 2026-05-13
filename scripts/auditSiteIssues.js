import fs from 'fs';
const destinations = JSON.parse(fs.readFileSync('./src/data/destinations.json', 'utf8'));

console.log('🚨 サイト問題の総合監査\n');

const himeji = destinations.filter(d => d.name.includes('姫路'));
const kusatsu = destinations.filter(d => d.name.includes('草津'));

console.log('【姫路関連】');
himeji.forEach(d => console.log(`  ${d.name} (id: ${d.id})`));

console.log('\n【草津関連】');
kusatsu.forEach(d => console.log(`  ${d.name} (id: ${d.id})`));

const imagesDir = './public/images';
const imageFiles = fs.existsSync(imagesDir) ? fs.readdirSync(imagesDir, { withFileTypes: true }).filter(e => e.isDirectory()) : [];

console.log(`\n【画像フォルダ数】: ${imageFiles.length}`);
console.log(`【目的地数】: ${destinations.length}件`);

const noImage = destinations.filter(d => !d.images || d.images.length === 0);
console.log(`\n【images未設定の目的地】: ${noImage.length}件`);

const kochiCastle = destinations.find(d => d.id === 'kochi-castle');
if (kochiCastle) {
  console.log(`\n【高知城のimages】: ${JSON.stringify(kochiCastle.images || [])}`);
}

const matsuyama = destinations.find(d => d.id === 'matsuyama');
if (matsuyama) {
  console.log(`【松山のimages】: ${JSON.stringify(matsuyama.images || [])}`);
}
