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
    max_tokens: 8000,
    messages: [{
      role: 'user',
      content: `
あなたは旅行メディアのライターです。
島旅女。（shimatabijo.com）のように実際に行った人が書いたような
丁寧で読みやすい旅行記事を書いてください。

目的地: ${dest.name}（${dest.prefecture}）
説明: ${dest.description}
キャッチ: ${dest.catch}
スポット: ${dest.spots?.join('、') || 'なし'}
タグ: ${dest.tags?.join('、') || 'なし'}

【文体のルール】
- 気取らない等身大の文章
- 「〜だった」「〜がある」の体験型
- キャッチーすぎない自然な表現
- 島旅女。のような素直で丁寧な文体
- 各スポットは具体的なエピソード・描写を含める
- 読者が「行きたい」と思えるような臨場感

以下のJSON形式で出力：
{
  "lead": "冒頭文（200〜300文字）。${dest.name}の魅力・雰囲気・どんな人に向いているかを自然に紹介",
  "sections": [
    {
      "title": "スポット名またはテーマ（具体的に）",
      "body": "本文（400〜500文字）。スポットの詳細・見どころ・実際に行くとどう感じるか・具体的な描写・営業情報なども含める",
      "imageAlt": "写真のalt text（20文字程度）",
      "info": "■ スポット名\\n所在地・料金・営業時間など実用情報（わかる範囲で）"
    }
  ],
  "modelCourse": {
    "daytrip": "日帰りモデルコース（100文字程度）。時間帯ごとの動き方",
    "onenight": "1泊モデルコース（150文字程度）。1日目・2日目の過ごし方"
  },
  "tips": "旅のヒント・アドバイス・注意点（150〜200文字）。移動手段・混雑時期・持ち物など",
  "bestSeason": "おすすめの季節・時期と理由（80〜100文字）"
}

sectionsは${Math.max(dest.spots?.length || 0, 3)}件。
各sectionは必ず400文字以上書くこと。
JSONのみ出力。説明文・マークダウン不要。
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

  // weight上位110件（既存スキップ）
  const targets = destinations
    .sort((a, b) => (b.weight || 1) - (a.weight || 1))
    .slice(0, 110)
    .filter(d => !fs.existsSync(path.join(outputDir, `${d.id}.json`)));

  console.log(`📝 ${targets.length}件生成開始\n`);

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

    await new Promise(r => setTimeout(r, 1500));
  }

  console.log(`\n🎉 完了: ${success}件成功 / ${errors}件エラー`);
}

main().catch(console.error);
