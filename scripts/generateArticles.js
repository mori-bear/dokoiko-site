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
あなたは実際に${dest.name}を旅した経験のある旅行ライターです。
実際に行った体験をもとに、読者に伝えるように書いてください。

目的地: ${dest.name}（${dest.prefecture}）
スポット: ${dest.spots?.join('、') || 'なし'}
タグ: ${dest.tags?.join('、') || 'なし'}

【文体のルール - 必ず守ること】
- 一人称「私」は使わない
- 「〜した」「〜だった」「〜がある」を自然に混ぜる
- センテンスは短め（30字以内）で改行を多用
- 「。」の後は改行する（島旅女。スタイル）
- 観光パンフレット的な表現は絶対に使わない
- AIが書いたような「〜することができます」は使わない
- 感情・驚き・発見を自然に入れる
- 具体的な数字・時間・料金を入れる

【悪い例】
「豊島美術館は素晴らしい施設で、多くの観光客が訪れます。」

【良い例】
「予約して、坂を上って、やっとたどり着く。
それだけの手間をかけた先に、あの空間がある。
入口に立った瞬間、来てよかったと思った。」

以下のJSON形式で出力：
{
  "lead": "冒頭文（150〜200文字）。改行を使って読みやすく。${dest.name}の空気感・なぜここに来たくなるのかを伝える",
  "sections": [
    {
      "title": "スポット名｜印象的なサブタイトル（例：地中美術館｜地面の下で、光と時間が溶けていく）",
      "body": "本文（300〜400文字）。センテンス短め・改行多用・体験型・感情あり",
      "imageAlt": "写真のalt（20文字以内）",
      "info": "■ スポット名\\n住所・料金・営業時間など"
    }
  ],
  "modelCourse": {
    "daytrip": "日帰りモデルコース（80文字程度）",
    "onenight": "1泊2日モデルコース（120文字程度）"
  },
  "tips": "旅のヒント（100〜150文字）。センテンス短め",
  "bestSeason": "おすすめの季節（60文字程度）"
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
