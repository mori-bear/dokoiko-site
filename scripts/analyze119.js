import fs from 'fs';
const destinations = JSON.parse(fs.readFileSync('./src/data/destinations.json', 'utf8'));

const weak = destinations.filter(d => !d.description || d.description.length < 200);

console.log('🔍 削除候補：119件の分析\n');

console.log('【県別分布】');
const byPref = {};
weak.forEach(d => {
  byPref[d.prefecture] = (byPref[d.prefecture] || 0) + 1;
});
Object.entries(byPref).sort((a,b) => b[1] - a[1]).forEach(([pref, count]) => {
  console.log(`${pref}: ${count}件`);
});

console.log('\n【サンプル（削除対象）】');
weak.slice(0, 10).forEach(d => {
  console.log(`- ${d.name} (${d.prefecture}): ${(d.description || '').length}字 id=${d.id}`);
});

console.log('\n【判定】');
console.log(`削除すると：1501 → 1382件に減少`);
