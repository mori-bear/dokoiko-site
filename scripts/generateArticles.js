import Anthropic from '@anthropic-ai/sdk';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const client = new Anthropic({
  apiKey: fs.readFileSync(path.join(__dirname, '../.env'), 'utf8')
    .match(/ANTHROPIC_API_KEY=(.+)/)?.[1]?.trim()
});

const destinations = JSON.parse(
  fs.readFileSync(path.join(__dirname, '../src/data/destinations.json'), 'utf8')
);

async function generateArticle(dest) {
  const res = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 2000,
    messages: [{
      role: 'user',
      content: `
あなたは旅行メディアのライターです。
島旅女。（shimatabijo.com）のような等身大で読みやすい
旅行記事を書いてください。

目的地: ${dest.name}（${dest.prefecture}）
説明: ${dest.description}
スポット: ${dest.spots?.join('、') || 'なし'}
タグ: ${dest.tags?.join('、') || 'なし'}

【文体のルール】
- 気取らない等身大の文章
- 「〜だった」「〜がある」の体験型
- キャッチーすぎない自然な表現
- 読んでいて旅に行きたくなる
- 島旅女。のような素直な文体

以下のJSON形式で出力：
{
  "lead": "${dest.name}の魅力を自然に紹介する冒頭文（100文字程度）",
  "sections": [
    {
      "title": "スポット名またはテーマ",
      "body": "体験・感情・具体的な描写（150〜200文字）",
      "imageAlt": "写真のalt text（20文字程度）"
    }
  ],
  "tips": "旅のヒント・アドバイス（80文字程度）",
  "bestSeason": "おすすめの季節・時期（40文字程度）"
}

sectionsは${Math.max(dest.spots?.length || 0, 3)}件。
JSONのみ出力。
      `
    }]
  });

  const text = res.content[0].text.trim();
  const clean = text.replace(/```json|```/g, '').trim();
  return JSON.parse(clean);
}

async function main() {
  const outputDir = path.join(__dirname, '../src/data/articles');
  fs.mkdirSync(outputDir, { recursive: true });

  // weight上位から100件生成（既存スキップ）
  const targets = destinations
    .filter(d => !fs.existsSync(path.join(outputDir, `${d.id}.json`)))
    .sort((a, b) => (b.weight || 1) - (a.weight || 1))
    .slice(0, 100);

  console.log(`📝 ${targets.length}件生成開始（既存スキップ済み）\n`);

  let success = 0;
  let errors = 0;

  for (const dest of targets) {
    try {
      console.log(`✍️  ${dest.name}`);
      const article = await generateArticle(dest);
      fs.writeFileSync(
        path.join(outputDir, `${dest.id}.json`),
        JSON.stringify(article, null, 2),
        'utf8'
      );
      console.log(`✅ ${dest.name}: ${article.lead?.slice(0, 40)}...`);
      success++;
    } catch (e) {
      console.error(`❌ ${dest.name}: ${e.message}`);
      errors++;
    }

    if ((success + errors) % 10 === 0) {
      console.log(`\n📊 ${success}件成功 / ${errors}件エラー\n`);
    }

    await new Promise(r => setTimeout(r, 1000));
  }

  console.log(`\n🎉 完了: ${success}件成功 / ${errors}件エラー`);
}

main().catch(console.error);
