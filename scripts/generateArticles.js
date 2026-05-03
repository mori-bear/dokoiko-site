/**
 * generateArticles.js — Claude API で目的地記事を生成し JSON に保存
 *
 * 使い方: ANTHROPIC_API_KEY=xxx node scripts/generateArticles.js
 */

import Anthropic from '@anthropic-ai/sdk';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const DESTINATIONS = [
  {
    id: 'ishigaki',
    name: '石垣島',
    prefecture: '沖縄県',
    description: '八重山の文化と透明度抜群の珊瑚礁が広がる離島。ダイビングや離島めぐりで唯一無二の海を体感できる。',
    tags: ['離島', '海', '山', '夏'],
    spots: ['川平湾', '竹富島', '白保サンゴ礁'],
    catch: 'その海の色が、本当にターコイズブルーだった。',
  },
  {
    id: 'miyakojima',
    name: '宮古島',
    prefecture: '沖縄県',
    description: '宮古ブルーと称される透明度抜群の海を持つ離島。橋で結ばれた島々と無人のビーチで南国の美しさに浸れる。',
    tags: ['離島', '海', '山', '夏'],
    spots: ['与那覇前浜', '伊良部大橋', '砂山ビーチ'],
    catch: '砂浜に裸足で立った瞬間、全ての予定がどうでもよくなった。',
  },
  {
    id: 'yakushima',
    name: '屋久島',
    prefecture: '鹿児島県',
    description: '世界遺産に認定された原始の森が島を覆う屋久島。樹齢数千年の巨木が立ち並ぶ苔の森に圧倒される。',
    tags: ['離島', '自然', '海', '滝', '夏'],
    spots: ['縄文杉', '白谷雲水峡', '千尋の滝'],
    catch: '縄文杉の根元に立って、人間が客であることを知った。',
  },
  {
    id: 'shodoshima',
    name: '小豆島',
    prefecture: '香川県',
    description: 'オリーブと醤油の産地として知られる瀬戸内の島。干潮時に渡れる砂の道と穏やかな島時間が心を癒す。',
    tags: ['離島', '海'],
    spots: ['寒霞渓', 'エンジェルロード', 'オリーブ公園'],
    catch: '海を渡ると、オリーブの香りが出迎えてくれた。',
  },
  {
    id: 'miyajima',
    name: '宮島',
    prefecture: '広島県',
    description: '海に浮かぶ鳥居が象徴する世界遺産の神の島。干潮と満潮で変わる海と社の表情が旅の記憶に深く刻まれる。',
    tags: ['離島', '寺社', '海', '山'],
    spots: ['厳島神社', '大鳥居', '弥山'],
    catch: '満潮の夕暮れに鳥居が水面に浮かんだ。その光景が忘れられない。',
  },
  {
    id: 'izu-oshima',
    name: '伊豆大島',
    prefecture: '東京都',
    description: '伊豆諸島最大の火山島。荒涼とした山の地形と温かな漁村文化が共存し、島ならではの旅情が広がる。',
    tags: ['離島', '山', '自然', '海'],
    spots: ['三原山', '波浮港', '砂漠'],
    catch: '東京から行ける離島に、火山と温泉と海がある。',
  },
  {
    id: 'amakusa',
    name: '天草',
    prefecture: '熊本県',
    description: '世界遺産のキリシタン集落と海に囲まれた九州の島。潮風と信仰の歴史が重なる旅が、この島だけのものだ。',
    tags: ['海', '歴史', '離島'],
    spots: ['天草五橋', '崎津集落', 'イルカウォッチング'],
    catch: '海と教会が共存する天草は、日本の中の別世界だった。',
  },
  {
    id: 'tokashiki-jima',
    name: '渡嘉敷島',
    prefecture: '沖縄県',
    description: 'ケラマブルーの海が広がる沖縄の離島。那覇から30分という近さで原始の海と珊瑚礁を体感できる。',
    tags: ['離島', '海'],
    spots: ['阿波連ビーチ', '渡嘉敷ビーチ', '展望台'],
    catch: '那覇から1時間で、この透明な海に来られることに驚いた。',
  },
  {
    id: 'kumejima',
    name: '久米島',
    prefecture: '沖縄県',
    description: '手つかずの白砂浜と沖縄の原風景が残る離島。独特の地形と透明度抜群の海で深く自然に浸れる場所だ。',
    tags: ['離島', '海', '自然'],
    spots: ['はての浜', '畳石', '久米島ウミガメ館'],
    catch: '畳石と白砂浜。沖縄の原型がこの島に残っていた。',
  },
  {
    id: 'kouzushima',
    name: '神津島',
    prefecture: '東京都',
    description: '伊豆諸島の南に浮かぶ、星空と透明な海が美しい離島。山と海と集落が凝縮された、ゆっくりとした時間が流れる島だ。',
    tags: ['離島', '山', '海'],
    spots: ['前浜', '天上山', '多幸湾'],
    catch: '伊豆諸島の南で、星がこんなに見えるとは思わなかった。',
  },
];

async function generateArticle(dest) {
  const prompt = `あなたは日本の旅行ライターです。以下の目的地について、旅の読み物記事を書いてください。

目的地: ${dest.name}（${dest.prefecture}）
特徴: ${dest.description}
キャッチ: ${dest.catch}
主なスポット: ${dest.spots.join('、')}
タグ: ${dest.tags.join('、')}

以下の構成でJSONを出力してください（他のテキストは一切出力しないこと）:
{
  "lead": "300字程度のリード文（この場所の魅力を感情的に伝える）",
  "sections": [
    {
      "heading": "見出し（20字以内）",
      "body": "本文（200字程度）"
    }
  ],
  "tips": [
    "旅のヒント1（60字以内）",
    "旅のヒント2（60字以内）",
    "旅のヒント3（60字以内）"
  ],
  "bestSeason": "おすすめの季節（例: 4〜6月）",
  "stayNight": "おすすめ泊数（例: 1泊2日）"
}

sectionは3つ。leadは旅情を感じさせる口語調で。ポエムにならず実用的な情報を含めること。`;

  const message = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1500,
    messages: [{ role: 'user', content: prompt }],
  });

  const raw = message.content[0].text;
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error(`JSONが見つからない: ${dest.name}`);
  return JSON.parse(jsonMatch[0]);
}

async function fetchImage(name) {
  try {
    const encoded = encodeURIComponent(name);
    const res = await fetch(`https://ja.wikipedia.org/api/rest_v1/page/summary/${encoded}`);
    if (!res.ok) return null;
    const data = await res.json();
    return data.thumbnail?.source || data.originalimage?.source || null;
  } catch {
    return null;
  }
}

async function main() {
  const outDir = join(__dirname, '../src/data/articles');
  if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });

  for (const dest of DESTINATIONS) {
    const outFile = join(outDir, `${dest.id}.json`);
    if (existsSync(outFile)) {
      console.log(`skip (exists): ${dest.name}`);
      continue;
    }

    console.log(`generating: ${dest.name}...`);
    try {
      const [article, image] = await Promise.all([
        generateArticle(dest),
        fetchImage(dest.name),
      ]);

      const output = {
        id: dest.id,
        name: dest.name,
        prefecture: dest.prefecture,
        description: dest.description,
        catch: dest.catch,
        tags: dest.tags,
        spots: dest.spots,
        image: image || null,
        ...article,
      };

      writeFileSync(outFile, JSON.stringify(output, null, 2), 'utf-8');
      console.log(`  saved: ${dest.name} (image: ${image ? 'yes' : 'no'})`);
    } catch (err) {
      console.error(`  error: ${dest.name}: ${err.message}`);
    }

    await new Promise(r => setTimeout(r, 500));
  }

  console.log('done.');
}

main();
