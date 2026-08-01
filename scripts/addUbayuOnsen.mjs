// 姥湯温泉 destination 新規追加（2026-08-01 Web確認: 桝形屋 2026年営業4/28〜11/5・峠駅送迎あり）
import fs from 'fs';

const SRC = 'src/data/destinations.json';
const all = JSON.parse(fs.readFileSync(SRC, 'utf8'));
if (all.some(d => d.id === 'ubayu-onsen')) {
  console.log('既に存在'); process.exit(0);
}

const hijori = all.find(d => d.id === 'hijori-onsen');

const ubayu = {
  id: 'ubayu-onsen',
  name: '姥湯温泉',
  type: 'destination',
  region: '東北',
  hub: '米沢',
  stayAllowed: ['1night'],
  departures: ['仙台', '東京', '山形', '福島'],
  weight: 1.4,
  description:
    '吾妻連峰の標高約1300メートル、切り立った岩壁にぐるりと囲まれた谷底に、姥湯温泉はぽつんと湯けむりを上げる。宿は開湯およそ五百年と伝わる一軒宿・桝形屋のみ。乳白色の硫黄泉を湛えた野天風呂に身を沈めると、目の前に迫る岩峰と空だけが視界を占める。秋には全山が紅葉に染まり、湯船が燃えるような錦繡に包まれる。玄関口はスイッチバックで知られる奥羽本線の秘境駅・峠駅。ここから送迎車で山道を約30分登る道のりが、すでに旅のハイライトだ。冬季は雪に閉ざされ、営業は例年4月下旬から11月上旬まで。',
  tags: ['温泉', '秘湯', '絶景', '紅葉', '山'],
  spots: [
    {
      name: '桝形屋',
      description: '開湯約五百年と伝わる姥湯唯一の一軒宿。日本秘湯を守る会の会員宿で、源泉かけ流しの白濁湯を守り続ける。',
      googleMapsQuery: '姥湯温泉桝形屋 山形県米沢市',
    },
    {
      name: '岩壁の野天風呂',
      description: '荒々しい岩壁を仰ぎながら浸かる乳白色の野天風呂。紅葉期は湯船ごと錦の谷に包まれる姥湯の象徴。',
      googleMapsQuery: '姥湯温泉 露天風呂',
    },
    {
      name: '峠駅',
      description: 'スイッチバック遺構が残る奥羽本線の秘境駅。ホームで立ち売りされる名物「峠の力餅」も旅情を誘う。',
      googleMapsQuery: '峠駅 山形県米沢市',
    },
  ],
  shinkansenAccess: false,
  requiresCar: true,
  hotelSearch: '姥湯温泉',
  gateways: { rail: ['峠駅'], airport: [], bus: [], ferry: [] },
  accessHub: '米沢',
  railNote: '送迎',
  secondaryTransport: null,
  destType: 'onsen',
  railGateway: '峠駅',
  busGateway: null,
  ferryGateway: null,
  airportGateway: null,
  prefecture: '山形県',
  lat: 37.7799,
  lng: 140.1837,
  stayBias: 1,
  airportHub: null,
  railProvider: 'ekinet',
  travelTime: Object.fromEntries(
    Object.entries(hijori.travelTime).map(([k, v]) => [k, Math.max(120, v - 30)])
  ),
  stayRecommendation: '1night',
  city: '米沢市',
  hubStation: '米沢駅',
  accessStation: '峠駅',
  hotelArea: 'yamagata',
  featured_stay: {
    name: '桝形屋',
    catchcopy: '開湯約五百年・岩壁の谷底にただ一軒。乳白色の野天が待つ秘湯',
    jalanUrl: 'https://www.jalan.net/yad349715/',
    hasShuttle: true,
    shuttleInfo: '峠駅から送迎車あり（宿泊者のみ・要予約・約30分）',
    accessStation: '峠駅（営業は例年4月下旬〜11月上旬）',
  },
};

// hijoriが持つ残りの共通フィールドを既定値で補完（スキーマ整合）
for (const k of Object.keys(hijori)) {
  if (!(k in ubayu)) ubayu[k] = hijori[k] === null ? null : (typeof hijori[k] === 'object' && !Array.isArray(hijori[k]) ? hijori[k] : hijori[k]);
}
// 補完で紛れた肘折固有値を修正
if (ubayu.hotelKeyword) ubayu.hotelKeyword = '姥湯温泉';
if (ubayu.jalanPath) ubayu.jalanPath = null;

all.push(ubayu);
fs.writeFileSync(SRC, JSON.stringify(all, null, 2));
console.log('姥湯温泉 追加。総destination:', all.length);
