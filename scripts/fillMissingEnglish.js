#!/usr/bin/env node
/**
 * fillMissingEnglish.js
 * 画像なしdestinationに対し、日本語名→英語/ローマ字クエリでUnsplash検索＋ダウンロード
 */
import fs from 'fs';
import path from 'path';
import https from 'https';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEST_FILE = path.join(__dirname, '../src/data/destinations.json');
const IMAGES_DIR = path.join(__dirname, '../public/images');

const envContent = fs.readFileSync(path.join(__dirname, '../.env'), 'utf-8');
for (const line of envContent.split('\n')) {
  const m = line.match(/^([A-Z_]+)=(.+)$/);
  if (m) process.env[m[1]] = m[2].trim();
}
const KEY = process.env.UNSPLASH_ACCESS_KEY;

const destinations = JSON.parse(fs.readFileSync(DEST_FILE, 'utf-8'));

// 日本語 → 英語マッピング（主要観光地）
const NAME_TO_EN = {
  '大阪城': 'Osaka Castle', '熊本城': 'Kumamoto Castle', '和歌山城': 'Wakayama Castle',
  '丸岡城': 'Maruoka Castle', '高知城': 'Kochi Castle', '佐賀城': 'Saga Castle',
  '鳥取城跡': 'Tottori Castle', '玉藻公園': 'Tamamo Park Takamatsu',
  '錦帯橋': 'Kintai Bridge', '法隆寺': 'Horyu-ji Temple', '春日大社': 'Kasuga Taisha',
  '薬師寺': 'Yakushiji Temple', '唐招提寺': 'Toshodaiji Temple',
  '道頓堀': 'Dotonbori Osaka', '新世界': 'Shinsekai Osaka',
  '梅田スカイビル': 'Umeda Sky Building', '勝尾寺': 'Katsuoji Temple',
  '蒜山高原': 'Hiruzen Highland', '湯郷温泉': 'Yunogo Onsen',
  '桂浜': 'Katsurahama Beach Kochi', '宗谷岬': 'Cape Soya Hokkaido',
  '黒部峡谷': 'Kurobe Gorge', '魚津': 'Uozu Toyama',
  '蔵王樹氷': 'Zao Snow Monsters', '最上川舟下り': 'Mogami River Boat',
  '輪島朝市': 'Wajima Morning Market', '近江町市場': 'Omicho Market Kanazawa',
  '甲子園': 'Koshien Stadium', '神戸ハーバーランド': 'Kobe Harborland',
  '飛騨大鍾乳洞': 'Hida Limestone Cave', '高崎山自然動物園': 'Takasakiyama Monkey Park',
  '西都原古墳群': 'Saitobaru Burial Mounds', '城ヶ崎海岸': 'Jogasaki Coast',
  '蓼科高原': 'Tateshina Highland', '月岡温泉': 'Tsukioka Onsen',
  '男鹿半島': 'Oga Peninsula', 'ひたち海浜公園': 'Hitachi Seaside Park',
  '那智の滝': 'Nachi Falls', '白浜温泉': 'Shirahama Onsen',
  '奥之院（高野山）': 'Koyasan Okunoin', '養老渓谷': 'Yoro Valley Chiba',
  '徳島': 'Tokushima', 'かずら橋': 'Iya Vine Bridge', '眉山': 'Mt Bizan',
  '水木しげるロード': 'Mizuki Shigeru Road', '香住・松葉ガニ': 'Kasumi Crab',
  'キャナルシティ博多': 'Canal City Hakata', '宇美八幡宮': 'Umi Hachimangu',
  '秋月城下町': 'Akizuki Castle Town', 'お台場': 'Odaiba Tokyo',
  '自由が丘': 'Jiyugaoka Tokyo', '吉祥寺': 'Kichijoji Tokyo',
  '寒霞渓': 'Kankakei Gorge', 'MIHO MUSEUM': 'Miho Museum',
  '鞍馬': 'Kurama Kyoto', '小川町': 'Ogawa Saitama',
  'ムーミンバレーパーク': 'Moominvalley Park', '埼玉県立自然の博物館': 'Saitama Natural Museum',
  '宿谷の滝': 'Shukuya Falls', '高麗神社': 'Koma Shrine',
  '稲垣温泉': 'Inagaki Onsen Aomori', '大鰐温泉': 'Owani Onsen',
  '釜臥山': 'Mt Kamafuse Aomori', '千畳敷海岸': 'Senjojiki Coast',
  '小浜': 'Obama Fukui', '越前岬': 'Echizen Cape', '人吉温泉': 'Hitoyoshi Onsen',
  '磐梯山': 'Mt Bandai Fukushima', '三春滝桜': 'Miharu Takizakura',
  '七日町通り': 'Nanokamachi Aizu', 'あはれん': 'Aharen Beach Okinawa',
  '幕張': 'Makuhari Chiba', '酒々井プレミアム・アウトレット': 'Shisui Outlet',
  '千葉動物公園': 'Chiba Zoo', '古里温泉': 'Furusato Onsen Sakurajima',
  '三輪山': 'Mt Miwa Nara', '天川村': 'Tenkawa Village',
  'ミキモト真珠島': 'Mikimoto Pearl Island', '名張': 'Nabari Mie',
  '元乃隅神社': 'Motonosumi Shrine', '上尾': 'Ageo Saitama',
  '高槻': 'Takatsuki Osaka', '泉佐野': 'Izumisano',
  '泉州・大鳥神社': 'Otori Shrine', '交野山': 'Mt Katano',
  '肥前夢街道': 'Hizen Yumekaido', '御船山楽園': 'Mifuneyama Rakuen',
  '古湯温泉': 'Furuyu Onsen Saga', '奈義町': 'Nagi Town',
  '笠岡諸島': 'Kasaoka Islands', '佐賀': 'Saga City',
  '毛呂山': 'Moroyama Saitama',
};

async function searchUnsplash(query) {
  const url = `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=1&orientation=landscape`;
  try {
    const res = await fetch(url, { headers: { Authorization: `Client-ID ${KEY}` } });
    if (!res.ok) return null;
    const j = await res.json();
    return j?.results?.[0]?.urls?.regular || null;
  } catch { return null; }
}

function download(url, dest) {
  return new Promise((resolve, reject) => {
    let hops = 0;
    function go(u) {
      hops++;
      if (hops > 5) return reject(new Error('redirects'));
      https.get(u, { headers: { 'User-Agent': 'dokoiko/1.0' } }, res => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          res.resume();
          return go(res.headers.location.startsWith('http') ? res.headers.location : new URL(res.headers.location, u).toString());
        }
        if (res.statusCode !== 200) { res.resume(); return reject(new Error(`HTTP ${res.statusCode}`)); }
        const file = fs.createWriteStream(dest);
        res.pipe(file);
        file.on('finish', () => file.close(resolve));
      }).on('error', reject);
    }
    go(url);
  });
}

const targets = destinations.filter(d => !d.images || d.images.length === 0);
console.log(`📷 英語クエリ画像取得: ${targets.length}件`);

let success = 0, fail = 0;
for (let i = 0; i < targets.length; i++) {
  const d = targets[i];
  const enQuery = NAME_TO_EN[d.name] || `${d.name} ${d.prefecture}`;
  const img = await searchUnsplash(enQuery);
  if (img) {
    const folder = path.join(IMAGES_DIR, d.id);
    if (!fs.existsSync(folder)) fs.mkdirSync(folder, { recursive: true });
    try {
      await download(img, path.join(folder, 'main.jpg'));
      d.images = [`/images/${d.id}/main.jpg`];
      success++;
    } catch (e) { fail++; }
  } else fail++;

  if ((i + 1) % 20 === 0) {
    console.log(`  ${i+1}/${targets.length}: 成功${success} 失敗${fail}`);
    fs.writeFileSync(DEST_FILE, JSON.stringify(destinations, null, 2));
  }
  await new Promise(r => setTimeout(r, 72000));  // 50/hr Free tier
}
fs.writeFileSync(DEST_FILE, JSON.stringify(destinations, null, 2));
console.log(`\n完了: ${success}件成功 / ${fail}件失敗`);
