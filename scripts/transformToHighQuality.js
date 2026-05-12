import fs from 'fs';

const destinations = JSON.parse(fs.readFileSync('./src/data/destinations.json', 'utf8'));

// 改善対象: description < 150字 の 260件
const needsImprovement = destinations.filter(d => 
  !d.description || d.description.length < 150
);

console.log(`📝 高品質化対象: ${needsImprovement.length}件`);
console.log(`\n【改善パターン】`);
console.log(`✓ description を 300字レベルに拡張`);
console.log(`✓ 物語性・体験的なトーンで改善`);
console.log(`✓ reasonChips を自動生成`);

// バッチ処理用に最初の20件を抽出
const batch1 = needsImprovement.slice(0, 20);
console.log(`\n【第1バッチ（20件）】`);
batch1.forEach((d, i) => {
  console.log(`${i+1}. ${d.name} (${d.prefecture})`);
});
