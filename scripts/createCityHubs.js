#!/usr/bin/env node
/**
 * createCityHubs.js
 * 5つの大都市hub destinationを作成: kyoto, osaka, tokyo, kobe, yokohama
 * hubCities.jsonから lat/lng/desc を流用、奈良(nara)を雛形に各フィールドを構築。
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEST_FILE = path.join(__dirname, '../src/data/destinations.json');
const HUB_FILE = path.join(__dirname, '../src/data/hubCities.json');

const destinations = JSON.parse(fs.readFileSync(DEST_FILE, 'utf-8'));
const hubCities = JSON.parse(fs.readFileSync(HUB_FILE, 'utf-8'));

const CITY_DEFS = {
  kyoto: {
    region: '近畿', hub: '大阪', hubCity: '京都',
    departures: ['大阪', '名古屋', '東京'],
    description: '千年前の都の空気が、いまも町のあちこちに残っている。石畳を踏む音、路地から漂う出汁の香り、清水寺の舞台から見下ろす京都盆地の景色。観光地として完成されているのに、一本路地に入ればまったく違う表情を見せる街だ。朝靄の伏見稲荷を歩き、昼は金閣寺の金色を仰ぎ、夜は祇園の灯りを抜ける。一日では到底回りきれないし、回りきろうとしない方がいい。京都は、ゆっくり繰り返し訪れる場所だ。',
    catch: '千年の都が、今もここに息づく。',
    tags: ['歴史', '寺社', '街歩き', '春'],
    spots: [
      { name: '清水寺', description: '舞台から京都盆地を見下ろす。檜の柱が支える木造の絶景は、訪れる季節ごとに違う顔を見せる。' },
      { name: '金閣寺', description: '鏡湖池に映る金色の楼閣。光の角度で表情が変わり、雪化粧の冬は特に息を呑む。' },
      { name: '伏見稲荷大社', description: '千本鳥居の朱が山の斜面を埋め尽くす。早朝は人が少なく、稲荷山の頂上まで歩いて約2時間。' },
      { name: '嵐山', description: '渡月橋と竹林。保津川の流れと、嵯峨野の静けさ。京都の郊外で過ごす半日。' },
    ],
    railGateway: '京都駅',
    accessStation: '京都駅',
    hotelArea: 'kyoto',
    fallbackCity: '京都',
    city: '京都市',
    primary: ['歴史', '寺社', '街歩き'],
    secondary: ['春'],
    reasonChips: ['歴史を辿る', '寺社めぐり', '街歩き'],
    mapPoint: '清水寺',
    mainSpot: '清水寺',
  },
  osaka: {
    region: '近畿', hub: '大阪', hubCity: '大阪',
    departures: ['東京', '名古屋', '京都', '神戸'],
    description: '東京とはまったく違う、もうひとつの都会だ。道頓堀の派手なネオン、新世界の昭和の匂い、たこ焼き屋の鉄板の音、串カツ屋のソースの香り。大阪は感情がそのまま街になっている。話しかければ知らない人でも返事をくれて、何かにつけて「儲かりまっか」が始まる。観光地として整えすぎていない雑然さが、むしろ魅力だ。梅田の高層ビル群から大阪城の天守まで、新旧が無造作に同居している街を歩く。',
    catch: '感情がそのまま街になった、もうひとつの都会。',
    tags: ['街歩き', 'グルメ', '夜景', '歴史'],
    spots: [
      { name: '道頓堀', description: 'グリコの看板、たこ焼き屋の行列、川面に映るネオン。大阪の縮図のような繁華街。' },
      { name: '新世界・通天閣', description: '昭和の匂いが残る一角。串カツの煙、ジャンジャン横丁の囲碁打ち、ビリケンさん。' },
      { name: '心斎橋・難波', description: 'アーケード商店街と路面店の混在。買い物と食事のメッカ、夜遅くまで人が絶えない。' },
      { name: '梅田スカイビル', description: '空中庭園展望台から見下ろす大阪のパノラマ。夕暮れから夜にかけてが特に美しい。' },
      { name: '大阪城', description: '豊臣秀吉が築いた天守閣。周囲の公園は桜の名所で、春は人で埋まる。' },
    ],
    railGateway: '新大阪駅',
    accessStation: '新大阪駅',
    hotelArea: 'osaka',
    fallbackCity: '大阪',
    city: '大阪市',
    primary: ['街歩き', 'グルメ', '夜景'],
    secondary: ['歴史'],
    reasonChips: ['街歩き', 'グルメ', '夜景'],
    mapPoint: '道頓堀',
    mainSpot: '道頓堀',
  },
  tokyo: {
    region: '関東', hub: '東京', hubCity: '東京',
    departures: ['横浜', '大阪', '名古屋', '仙台'],
    description: '世界で最も人口の多い都市圏のひとつ。地下鉄の路線図はまるで血管のように張り巡らされ、駅を出るたび違う街の表情に出会う。浅草の浅草寺で線香の煙を浴び、秋葉原の電気街でネオンを浴び、吉祥寺の井の頭公園で木漏れ日を浴びる。同じ「東京」とは思えないほど、地区ごとに空気が違う。世界中の料理、世界中のファッション、世界中の文化が一日で味わえる。これだけ密度の高い街は、世界を見渡しても他にない。',
    catch: '一日歩けば、世界が縮図になる。',
    tags: ['街歩き', '夜景', 'グルメ', 'ショッピング'],
    spots: [
      { name: '浅草・浅草寺', description: '雷門と仲見世通り。江戸下町の風情、人力車の声、線香の煙。スカイツリーが背景に立つ。' },
      { name: '上野', description: '美術館・博物館の集積地、アメ横の喧騒、不忍池の蓮。文化と庶民が同居する街。' },
      { name: '秋葉原', description: '電気街・アニメ・ゲームの聖地。世界中のオタクが巡礼に訪れる、世界に類を見ない街。' },
      { name: 'お台場', description: 'レインボーブリッジを望むベイエリア。観覧車、商業施設、夜景の名所。' },
      { name: '吉祥寺', description: '住みたい街ランキング常連。井の頭公園の自然、ハモニカ横丁の路地裏酒場。' },
      { name: '自由が丘', description: '洋菓子店とインテリアショップ。スイーツ巡りに最適な街、駅前は落ち着いた雰囲気。' },
      { name: '幕張', description: '海浜幕張のベイエリア。幕張メッセでイベント、QVCマリンフィールドで野球。' },
    ],
    railGateway: '東京駅',
    accessStation: '東京駅',
    hotelArea: 'tokyo',
    fallbackCity: '東京',
    city: '東京都',
    primary: ['街歩き', '夜景', 'グルメ'],
    secondary: ['ショッピング'],
    reasonChips: ['街歩き', '夜景', 'ショッピング'],
    mapPoint: '浅草寺',
    mainSpot: '浅草',
  },
  kobe: {
    region: '近畿', hub: '神戸', hubCity: '神戸',
    departures: ['大阪', '京都', '岡山', '広島'],
    description: '山と海に挟まれた、横長の港町だ。北野の異人館街を歩けば明治の空気が残り、南京町では中華の香りが立ち上り、ハーバーランドからは六甲山と海が同時に見える。神戸は密度が高い。コーヒーの名店、洋菓子の本店、ジャズの聖地、すべて徒歩圏に収まる。夜になれば山手の住宅地から見下ろす夜景が、日本三大夜景のひとつとして街を彩る。震災から復興した街には、新しさと古さが共存している。',
    catch: '山と海に挟まれた、洗練の港町。',
    tags: ['街歩き', '夜景', '港町', 'グルメ'],
    spots: [
      { name: '神戸ハーバーランド', description: '港町・神戸を象徴するベイエリア。観覧車、モザイクの夜景、ポートタワーの赤いシルエット。' },
      { name: '北野異人館街', description: '明治の異人館が点在する坂の街。風見鶏の館、うろこの家、ハーブ園へと続く異国情緒。' },
      { name: '南京町', description: '日本三大中華街のひとつ。豚まん、小籠包、屋台の活気。中央に広場、夜は提灯が灯る。' },
      { name: '六甲山', description: 'ケーブルで登る神戸の山。1000万ドルの夜景、高原のカフェ、牧場、四季折々の表情。' },
    ],
    railGateway: '新神戸駅',
    accessStation: '三宮駅',
    hotelArea: 'kobe',
    fallbackCity: '神戸',
    city: '神戸市',
    primary: ['街歩き', '夜景', '港町'],
    secondary: ['グルメ'],
    reasonChips: ['街歩き', '夜景', '港町散策'],
    mapPoint: '神戸ハーバーランド',
    mainSpot: '神戸ハーバーランド',
  },
  fukuoka: {
    region: '九州', hub: '福岡', hubCity: '福岡',
    departures: ['熊本', '大分', '長崎', '鹿児島', '広島'],
    description: '九州の玄関口にして、独立した個性を持つ街だ。博多ラーメンと屋台、もつ鍋と一蘭の発祥、明太子の本場。食の街として全国区の評価を得ながら、天神の繁華街は東京並みの密度、博多湾の夕陽はぜいたくの極み。中洲の屋台街では、見知らぬ客同士が肩を寄せ合って酒を飲む。空港から市街まで地下鉄で5分という近さも、福岡の魅力を支えている。九州を旅するなら、ここから始まる。',
    catch: '九州の玄関口、屋台の街。',
    tags: ['街歩き', 'グルメ', '港町', '夜景'],
    spots: [
      { name: 'キャナルシティ博多', description: '運河を中心に商業施設・劇場・映画館が集まる複合空間。噴水ショーが名物。' },
      { name: '中洲屋台街', description: '那珂川沿いに並ぶ100軒近い屋台。ラーメン・焼き鳥・おでん、夜の福岡の象徴。' },
      { name: '太宰府天満宮', description: '学問の神様。梅の名所として、参道の梅ヶ枝餅もセットで訪れたい。' },
      { name: '大濠公園', description: '都心の池を囲む公園。ジョギングコース、日本庭園、四季の花。' },
    ],
    railGateway: '博多駅',
    accessStation: '博多駅',
    hotelArea: 'fukuoka',
    fallbackCity: '福岡',
    city: '福岡市',
    primary: ['街歩き', 'グルメ', '港町'],
    secondary: ['夜景'],
    reasonChips: ['屋台グルメ', '街歩き', '九州玄関口'],
    mapPoint: 'キャナルシティ博多',
    mainSpot: 'キャナルシティ博多',
  },
  kanazawa: {
    region: '中部', hub: '金沢', hubCity: '金沢',
    departures: ['富山', '福井', '東京', '大阪', '名古屋'],
    description: '加賀百万石の城下町。兼六園の苔むした石灯籠、ひがし茶屋街の格子戸、近江町市場の鮮魚の山。北陸新幹線が開通してからは東京から2時間半で着くようになった。金箔の工芸、加賀友禅の染物、九谷焼の絵付け。伝統工芸の質と量で、金沢に並ぶ街は少ない。21世紀美術館では現代アートを浴び、武家屋敷では江戸の風情を辿る。新と旧が、ここまで混ざりあった街は珍しい。',
    catch: '加賀百万石、伝統と現代が混ざる街。',
    tags: ['歴史', '街歩き', '工芸', 'グルメ'],
    spots: [
      { name: '近江町市場', description: '金沢の台所。300年の歴史を持つ市場、鮮魚と海鮮丼、地元客と観光客の混在。' },
      { name: '兼六園', description: '日本三名園のひとつ。雪吊りの冬、霞ヶ池の鏡面、徽軫灯籠の絶妙な配置。' },
      { name: 'ひがし茶屋街', description: '格子戸の続く茶屋街。金箔のソフトクリーム、和小物の店、夕暮れの灯り。' },
      { name: '21世紀美術館', description: '円形のガラス建築。スイミング・プール作品で世界的に有名な現代美術館。' },
    ],
    railGateway: '金沢駅',
    accessStation: '金沢駅',
    hotelArea: 'kanazawa',
    fallbackCity: '金沢',
    city: '金沢市',
    primary: ['歴史', '街歩き', '工芸'],
    secondary: ['グルメ'],
    reasonChips: ['加賀百万石', '工芸の街', '近江町市場'],
    mapPoint: '兼六園',
    mainSpot: '兼六園',
  },
  yokohama: {
    region: '関東', hub: '横浜', hubCity: '横浜',
    departures: ['東京', '鎌倉', '熱海', '名古屋'],
    description: '東京の南、海に開かれた港町だ。みなとみらいの高層ビル群、赤レンガ倉庫の煉瓦の色、山下公園の薔薇。横浜は計画都市らしい整った美しさを持っている。中華街では本格的な中華料理を、元町ではハイカラな雰囲気を、根岸ではアメリカ統治時代の名残を感じる。観覧車のコスモクロック21が回る夜景は、東京湾岸の風景の中でも特別だ。東京と地続きでありながら、確かに違う空気がある街。',
    catch: '東京の隣に広がる、もうひとつの港町。',
    tags: ['街歩き', '夜景', '港町', 'グルメ'],
    spots: [
      { name: '横浜中華街', description: '日本最大級の中華街。200以上の店舗、本場の点心、関帝廟の朱、夜は提灯が並ぶ。' },
      { name: 'みなとみらい', description: 'ランドマークタワー、赤レンガ倉庫、観覧車。横浜を代表する近代的なベイエリア。' },
      { name: '山下公園', description: '海沿いの広い公園、氷川丸の停泊、薔薇の名所。夕暮れの散歩に最適。' },
      { name: '元町', description: 'ハイカラな商店街と石川町の坂道。山手の洋館街と一緒に巡れば、明治の横浜が見える。' },
    ],
    railGateway: '新横浜駅',
    accessStation: '横浜駅',
    hotelArea: 'yokohama',
    fallbackCity: '横浜',
    city: '横浜市',
    primary: ['街歩き', '夜景', '港町'],
    secondary: ['グルメ'],
    reasonChips: ['街歩き', '夜景', '中華街'],
    mapPoint: '横浜中華街',
    mainSpot: '横浜中華街',
  },
};

// 既存奈良を雛形に
const naraTemplate = destinations.find(d => d.id === 'nara');

function buildHub(id, def) {
  const h = hubCities.find(x => x.id === id);
  if (!h) throw new Error(`hubCity ${id} not found`);

  // travelTimeは奈良のキーをベースに(各都市から自分=0で初期化)
  const travelTime = {};
  for (const k of Object.keys(naraTemplate.travelTime)) {
    travelTime[k] = 999; // 不明値（後でデータ補強可）
  }
  travelTime[id] = 0;

  return {
    id,
    name: h.name,
    type: 'destination',
    region: def.region,
    hub: def.hub,
    stayAllowed: ['daytrip', '1night', '2night'],
    departures: def.departures,
    weight: 1.8,
    description: def.description,
    tags: def.tags,
    spots: def.spots.map(s => ({ name: s.name, description: s.description, imageUrl: null })),
    shinkansenAccess: true,
    requiresCar: false,
    hotelSearch: h.name,
    gateways: { rail: [def.railGateway], airport: [], bus: [], ferry: [] },
    accessHub: null,
    railNote: null,
    destType: 'city',
    railGateway: def.railGateway,
    busGateway: null,
    ferryGateway: null,
    airportGateway: null,
    prefecture: h.prefecture,
    lat: h.lat,
    lng: h.lng,
    stayBias: 2,
    airportHub: null,
    railProvider: 'e5489',
    travelTime,
    stayRecommendation: '1night',
    secondaryTransport: null,
    city: def.city,
    hubStation: def.railGateway,
    accessStation: def.accessStation,
    hotelArea: def.hotelArea,
    jalanPath: null,
    hotelKeyword: h.name,
    access: { steps: [{ type: 'rail', to: def.accessStation, provider: 'e5489' }] },
    fallbackCity: def.fallbackCity,
    gateway: def.railGateway,
    gatewayStations: [{ name: def.railGateway, type: 'shinkansen', priority: 1 }],
    localAccess: { type: 'walk', description: `${def.accessStation}から徒歩・地下鉄`, to: def.accessStation },
    situations: ['solo', 'couple', 'friends', 'family'],
    catch: def.catch,
    primary: def.primary,
    secondary: def.secondary,
    onsenLevel: 0,
    hasDirectFlight: false,
    mapPoint: def.mapPoint,
    subType: 'city',
    stayDescription: '夜の街を味わい、朝の街を歩く。都市を時間ごとに違う角度から見る。',
    hubCity: def.hubCity,
    stayPriority: 'high',
    representativeStation: def.accessStation,
    finalAccess: { type: 'walk' },
    accessPoint: { type: 'station', name: def.accessStation.replace('駅', '') },
    staySearchUrl: `https://travel.rakuten.co.jp/search/?keyword=${encodeURIComponent(h.name)}`,
    bookingStation: { name: def.accessStation, company: 'JR' },
    mainSpot: def.mainSpot,
    stayArea: { rakuten: h.name, jalan: h.name },
    hotelLinks: {
      rakuten: `https://travel.rakuten.co.jp/yado/${def.hotelArea}.html`,
      jalan: `https://www.jalan.net/uw/uwp2011/uww2011init.do?keyword=${encodeURIComponent(h.name)}`,
    },
    tier: 'hub',
    icCard: 'suica',
    tier2: 'hub',
    hubName: def.hub,
    rentalCarRecommended: false,
    images: [],
    reasonChips: def.reasonChips,
  };
}

let added = 0;
for (const [id, def] of Object.entries(CITY_DEFS)) {
  const exists = destinations.find(d => d.id === id);
  if (exists) {
    console.log(`⏭  ${id} は既に存在 — skip`);
    continue;
  }
  const hub = buildHub(id, def);
  destinations.push(hub);
  added++;
  console.log(`✓ ${id} (${hub.name}) を作成 — spots=${hub.spots.length}`);
}

fs.writeFileSync(DEST_FILE, JSON.stringify(destinations, null, 2));
console.log(`\n完了: ${added}件追加 / 合計destinations=${destinations.length}`);
