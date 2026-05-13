import fs from 'fs';
const destinations = JSON.parse(fs.readFileSync('./src/data/destinations.json', 'utf8'));

console.log('📊 目的地の粒度分析\n');

const byPrefecture = {};
destinations.forEach(d => {
  if (!byPrefecture[d.prefecture]) byPrefecture[d.prefecture] = [];
  byPrefecture[d.prefecture].push(d);
});

console.log('【県別の目的地数】');
Object.entries(byPrefecture)
  .sort((a, b) => b[1].length - a[1].length)
  .forEach(([pref, dests]) => {
    console.log(`${pref}: ${dests.length}件`);
  });

console.log('\n【同じタグを持つ目的地（統合候補？）】');
const byTag = {};
destinations.forEach(d => {
  (d.tags||[]).forEach(tag => {
    if (!byTag[tag]) byTag[tag] = [];
    byTag[tag].push(d.name);
  });
});

Object.entries(byTag)
  .filter(([tag, dests]) => dests.length > 5)
  .sort((a, b) => b[1].length - a[1].length)
  .slice(0, 10)
  .forEach(([tag, dests]) => {
    console.log(`${tag}: ${dests.length}件 - ${dests.slice(0, 3).join(', ')}...`);
  });

console.log('\n【同じ市町村（統合候補？）】');
const cities = {};
destinations.forEach(d => {
  const city = `${d.prefecture.substring(0, 2)}`;
  if (!cities[city]) cities[city] = [];
  cities[city].push({ name: d.name, id: d.id });
});

Object.entries(cities)
  .filter(([city, dests]) => dests.length > 10)
  .sort((a, b) => b[1].length - a[1].length)
  .forEach(([city, dests]) => {
    console.log(`${city}: ${dests.length}件`);
  });
