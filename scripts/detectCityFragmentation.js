import fs from 'fs';
const destinations = JSON.parse(fs.readFileSync('./src/data/destinations.json', 'utf8'));

console.log('🔍 全体スキャン：細分化されてる観光地の検出\n');

const cityMap = {};
destinations.forEach(d => {
  // name の先頭2文字をキーに使う（同じ市の可能性）
  if (d.name.length < 2) return;
  const prefix = d.name.substring(0, 2);
  const key = `${d.prefecture}|${prefix}`;
  if (!cityMap[key]) cityMap[key] = [];
  cityMap[key].push(d);
});

const fragmented = Object.entries(cityMap)
  .filter(([key, items]) => items.length > 1)
  .sort((a, b) => b[1].length - a[1].length);

console.log(`【同県・名前先頭2文字一致グループ】\n`);

fragmented.slice(0, 30).forEach(([key, items]) => {
  const [pref, prefix] = key.split('|');
  console.log(`${pref} / ${prefix}〜: ${items.length}件`);
  items.slice(0, 5).forEach(d => {
    console.log(`  - ${d.name} (${d.id})`);
  });
  console.log('');
});

console.log(`計 ${fragmented.length}グループ`);
