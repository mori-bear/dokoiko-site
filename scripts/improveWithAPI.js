import fs from 'fs';

const destinations = JSON.parse(fs.readFileSync('./src/data/destinations.json', 'utf8'));

// 改善対象：description < 150字 の260件
const needsImprovement = destinations.filter(d => !d.description || d.description.length < 150);

console.log(`📝 改善対象: ${needsImprovement.length}件`);

// Anthropic API に投げるプロンプトを生成
const improvements = needsImprovement.slice(0, 50).map(d => ({
  id: d.id,
  name: d.name,
  prefecture: d.prefecture,
  tags: (d.tags || []).slice(0, 3),
  spots: (d.spots || []).map(s => typeof s === 'string' ? s : s.name)
}));

console.log('改善対象（先頭50件）:');
improvements.forEach((d, i) => {
  console.log(`${i+1}. ${d.name} (${d.prefecture}) - tags: ${d.tags.join(', ')}`);
});

// API 投げ用プロンプト
const prompt = `以下の50個の日本の観光地について、各々200-300字の高品質な説明文を生成してください。

形式: JSON で以下の形式で返してください（Markdown コードブロックなし、JSON のみ）
[
  { "id": "目的地ID", "description": "新しい説明文（200-300字）" },
  ...
]

対象地：
${improvements.map(d => `- id: ${d.id}, 名前: ${d.name}（${d.prefecture}）, タグ: ${d.tags.join(', ')}, スポット: ${d.spots.join(', ')}`).join('\n')}

要件：
- 各目的地ごとに個別で、独特な説明文を書く（テンプレート的な同じ書き出しは避ける）
- 200-300字で、体験的・文学的なトーン
- その地の歴史・特徴・見どころを含む
- 「この場所に行きたい」と思わせる表現
- 具体的な感覚・情景描写を含める
- 参考例：「フェリーに乗って、海を渡る。その時点で、もう旅が始まっている。」のような引き込む書き出し`;

fs.writeFileSync('/tmp/api-prompt.txt', prompt);
console.log('\n💾 プロンプトを /tmp/api-prompt.txt に保存しました');
