import fs from 'fs';
const destinations = JSON.parse(fs.readFileSync('./src/data/destinations.json', 'utf8'));

console.log('🔍 全目的地の重複検出\n');

// 座標フィールドは lat/lng
const coordMap = {};
const duplicates = [];

destinations.forEach(d => {
  if (!d.lat || !d.lng) return;
  const key = `${d.lat.toFixed(3)}_${d.lng.toFixed(3)}`;
  if (coordMap[key]) {
    duplicates.push({ coord: key, items: [coordMap[key], d] });
  } else {
    coordMap[key] = d;
  }
});

if (duplicates.length > 0) {
  console.log(`⚠️ 座標重複: ${duplicates.length}件\n`);
  duplicates.forEach(dup => {
    console.log(`【${dup.coord}】`);
    dup.items.forEach(item => {
      console.log(`  - ${item.name} (${item.prefecture}) id=${item.id}`);
    });
    console.log('');
  });
} else {
  console.log(`✅ 座標重複なし\n`);
}

console.log('\n【同県・名前類似（最初の3文字一致）】');
const checked = new Set();
let sim_count = 0;
destinations.forEach(d => {
  if (d.name.length < 3) return;
  const prefix = d.name.slice(0, 3);
  destinations.forEach(d2 => {
    if (d.id === d2.id) return;
    const key = [d.id, d2.id].sort().join('|');
    if (checked.has(key)) return;
    if (d.prefecture !== d2.prefecture) return;
    if (d2.name.startsWith(prefix)) {
      checked.add(key);
      sim_count++;
      if (sim_count <= 20) console.log(`  ${d.name} ↔ ${d2.name} (${d.prefecture})`);
    }
  });
});
console.log(`計 ${sim_count}件`);
