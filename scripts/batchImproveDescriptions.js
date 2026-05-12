import fs from 'fs';

const destinations = JSON.parse(fs.readFileSync('./src/data/destinations.json', 'utf8'));

// 改善対象を抽出
const needsImprovement = destinations.filter(d => {
  return !d.description || d.description.length < 150;
}).slice(0, 10); // 最初の10件をテスト

console.log(`📝 改善対象（テスト10件）:`);
needsImprovement.forEach((d, i) => {
  console.log(`${i+1}. ${d.name} (${d.prefecture}) - 現在: ${d.description?.length || 0}字`);
});

// Claude API へ投げるプロンプト
const prompt = `以下の10個の日本の観光地について、各々200-300字の魅力的な説明文を書いてください。

形式: JSON で以下の形式で返してください（Markdown コードブロックなし、JSON のみ）
[
  { "id": "目的地ID", "description": "新しい説明文（200-300字）" },
  ...
]

対象地：
${needsImprovement.map(d => `- ${d.name}（${d.prefecture}）`).join('\n')}

要件：
- 体験的・文学的なトーン
- その地の歴史・特徴・見どころを含む
- 「この場所に行きたい」と思わせる表現
- テンプレート的な定型文は避ける`;

console.log('\n【API投げるプロンプト】');
console.log(prompt.substring(0, 300) + '...');

fs.writeFileSync('/tmp/improvement-batch.json', JSON.stringify(needsImprovement, null, 2));
