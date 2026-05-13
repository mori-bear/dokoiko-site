import fs from 'fs';
const destinations = JSON.parse(fs.readFileSync('./src/data/destinations.json', 'utf8'));

const noImage = destinations.filter(d => !d.images || d.images.length === 0);
console.log(`画像なし: ${noImage.length}件\n`);

const famous = noImage.filter(d => d.description && d.description.length >= 200);
const minor = noImage.filter(d => !d.description || d.description.length < 150);
const mid = noImage.filter(d => d.description && d.description.length >= 150 && d.description.length < 200);

console.log(`【有名地（200字以上）】: ${famous.length}件`);
famous.slice(0, 15).forEach(d => {
  console.log(`  - ${d.name} (${d.prefecture}): ${d.description.length}字`);
});

console.log(`\n【中（150-200字）】: ${mid.length}件`);
mid.slice(0, 5).forEach(d => {
  console.log(`  - ${d.name} (${d.prefecture}): ${d.description.length}字`);
});

console.log(`\n【マイナー（150字未満）】: ${minor.length}件`);
minor.slice(0, 10).forEach(d => {
  console.log(`  - ${d.name} (${d.prefecture}): ${(d.description || '').length}字`);
});
