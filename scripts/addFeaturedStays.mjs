// featured_stay フィールドを destinations.json へ追加（第一弾5件・Web実在/送迎確認済み 2026-07-30）
// 送迎は「公式/予約サイトで確認できた場合のみ」記載（捏造禁止）。
import fs from 'fs';

const SRC = 'src/data/destinations.json';
const all = JSON.parse(fs.readFileSync(SRC, 'utf8'));
const credits = JSON.parse(fs.readFileSync('logs/featured_stay_credits.json', 'utf8'));

const STAYS = {
  'shuzenji': {
    name: '新井旅館',
    catchcopy: '芥川龍之介や横山大観も逗留した、登録有形文化財15棟の宿',
    image: '/images/stays/shuzenji.jpg',
    jalanUrl: 'https://www.jalan.net/yad359366/',
    hasShuttle: false,
    accessStation: '修善寺駅からバス・タクシー約7分',
  },
  'kinosaki-onsen': {
    name: '西村屋本館',
    catchcopy: '江戸安政創業。城崎を代表する数寄屋造りの老舗',
    image: '/images/stays/kinosaki-onsen.jpg',
    jalanUrl: 'https://www.jalan.net/yad386200/',
    hasShuttle: true,
    shuttleInfo: '城崎温泉駅から送迎あり（特急到着時間帯・要連絡）',
    accessStation: '城崎温泉駅',
  },
  'ginzan-onsen': {
    name: '能登屋旅館',
    catchcopy: '明治25年築・木造三層。大正ロマンの温泉街を象徴する文化財の宿',
    image: '/images/stays/ginzan-onsen.jpg',
    hasShuttle: true,
    shuttleInfo: '大石田駅から送迎あり（3日前までに要予約）',
    accessStation: '大石田駅',
  },
  'nyuto-onsen': {
    name: '鶴の湯温泉',
    catchcopy: '乳白色の湯と茅葺の本陣。秘湯を代表する山の一軒宿',
    image: '/images/stays/nyuto-onsen.jpg',
    hasShuttle: true,
    shuttleInfo: 'アルパこまくさバス停から送迎あり（要予約）',
    accessStation: '田沢湖駅から路線バス「アルパこまくさ」下車',
  },
  'shima-onsen': {
    name: '積善館',
    catchcopy: '元禄四年築・現存する日本最古の湯宿建築',
    image: '/images/stays/shima-onsen.jpg',
    hasShuttle: false,
    accessStation: '中之条駅から路線バス約40分',
  },
};

let added = 0;
for (const d of all) {
  const stay = STAYS[d.id];
  if (!stay) continue;
  d.featured_stay = { ...stay, imageCredit: credits[d.id] || null };
  added++;
}
fs.writeFileSync(SRC, JSON.stringify(all, null, 2));
console.log(`featured_stay 追加: ${added}件`);
