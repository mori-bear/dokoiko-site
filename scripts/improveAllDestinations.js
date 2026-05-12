import fs from 'fs';

const destinations = JSON.parse(fs.readFileSync('./src/data/destinations.json', 'utf8'));

// 改善が必要な目的地を抽出（description < 150字 or spots説明不足）
const needsImprovement = destinations.filter(d => {
  const descTooShort = !d.description || d.description.length < 150;
  const spotsWeak = !d.spots || d.spots.some(s => !s.description || s.description.length < 20);
  return descTooShort || spotsWeak;
});

console.log(`📊 改善対象: ${needsImprovement.length}件 / 全${destinations.length}件`);
console.log(`description < 150字: ${destinations.filter(d => !d.description || d.description.length < 150).length}件`);
console.log(`spots説明不足: ${destinations.filter(d => d.spots && d.spots.some(s => !s.description || s.description.length < 20)).length}件`);

// プロンプト用JSON出力
const batch = needsImprovement.slice(0, 5).map(d => ({
  id: d.id,
  name: d.name,
  prefecture: d.prefecture,
  currentDesc: d.description,
  spots: d.spots ? d.spots.map(s => ({ name: s.name, category: s.category, desc: s.description })) : []
}));

console.log('\n【改善バッチサンプル】');
console.log(JSON.stringify(batch, null, 2));
