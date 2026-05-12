import fs from 'fs';

function jalanUrl(kw) {
  const buf = [];
  // Shift-JIS encode (Node Buffer + iconv-lite なしで簡易) - 日本語は urlencode で代用
  const enc = encodeURIComponent(kw);
  return `https://ck.jp.ap.valuecommerce.com/servlet/referral?sid=3764408&pid=892559858&vc_url=${encodeURIComponent(`https://www.jalan.net/uw/uwp2011/uww2011init.do?keyword=${enc}`)}`;
}
function rakutenUrl(kw) {
  return `https://hb.afl.rakuten.co.jp/hgc/5113ee4b.8662cfc5.5113ee4c.119de89a/?pc=${encodeURIComponent(`https://travel.rakuten.co.jp/yado/japan.html?f_query=${encodeURIComponent(kw)}`)}`;
}

const destinations = JSON.parse(fs.readFileSync('./src/data/destinations.json', 'utf8'));

const ryugado = {
  id: 'ryugado',
  name: '龍河洞',
  type: 'destination',
  region: '四国',
  prefecture: '高知県',
  hub: '高知',
  hubName: '高知',
  hubCity: '高知',
  stayAllowed: ['daytrip', '1night'],
  departures: ['高知'],
  weight: 1.0,
  description: '日本三大鍾乳洞の一つ、高知県香美市の龍河洞。1億7500万年前から自然が刻んだ鍾乳石と、弥生時代の生活痕が今も残る神秘の地下空間。総延長約4kmの洞内は照明と通路が整備され、特に「神の壷」と呼ばれる弥生土器が鍾乳石に取り込まれた光景は世界的にも稀。冒険コースもあり、子連れにも人気の四国屈指の鍾乳洞観光地。',
  tags: ['秘境', '自然', '歴史', '鍾乳洞'],
  spots: [
    { name: '龍河洞本洞', description: '1億7500万年前から形成された鍾乳石の地下回廊。整備された約1km の観光コースで、滝・池・絞り穴など多彩な造形美が見られる。', imageUrl: null },
    { name: '神の壷', description: '弥生時代の人々が置いた壺が鍾乳石に飲み込まれた世界的にも珍しい遺跡。2000年の時を刻む自然と人類の合作。' },
    { name: '龍河洞博物館', description: '洞内から出土した弥生土器や石器を展示。穴居人の暮らしと地質学的解説で、洞窟見学前後の理解が深まる。' }
  ],
  reasonChips: ['秘境感あり', '歴史を辿る', '家族で楽しめる'],
  shinkansenAccess: false,
  requiresCar: true,
  isIsland: false,
  destType: 'sight',
  hotelSearch: '香美 土佐山田',
  lat: 33.6553,
  lng: 133.7339,
  travelTime: {
    'kochi': 50,
    'takamatsu': 195,
    'tokyo': 295,
    'osaka': 200,
    'nagoya': 260,
    'fukuoka': 270,
  },
  stayRecommendation: 'daytrip',
  gateways: { rail: ['土佐山田駅'], airport: [], bus: ['龍河洞バス停'], ferry: [] },
  hotelLinks: {
    rakuten: rakutenUrl('香美 土佐山田'),
    jalan: jalanUrl('香美 土佐山田'),
  },
  rentalCarRecommended: true,
  images: ['/images/ryugado/main.jpg'],
};

// 既存重複チェック
const existing = destinations.findIndex(d => d.id === 'ryugado');
if (existing >= 0) {
  destinations[existing] = ryugado;
  console.log('⚠️  既存ryugadoを更新');
} else {
  destinations.push(ryugado);
  console.log('✅ 龍河洞を追加');
}

fs.writeFileSync('./src/data/destinations.json', JSON.stringify(destinations, null, 2));
console.log(`現在: ${destinations.length}件`);
