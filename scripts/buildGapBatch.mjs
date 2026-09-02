#!/usr/bin/env node
/**
 * buildGapBatch.mjs — 都道府県カバレッジの空白を埋めるバッチ。
 *
 * 現状の分析（coverageGap.mjs）で分かった穴:
 *   総数が中央値24件を大きく下回る  大阪17 / 埼玉18 / 徳島18 / 長崎18
 *   温泉が1件も無い                埼玉 / 千葉 / 滋賀（沖縄は地質的に妥当）
 *   絶景が1件も無い                大阪 / 長崎 / 愛知 / 宮城 / 岡山 / 栃木 / 東京
 *
 * ゲートは温泉・街並み・絶景バッチと同一
 * （座標4ソースから独立2ソースが5km以内で一致 → 所在県の実測 → commonsPlaceCheck
 *  → Haiku → Sonnetの厳格審査 → 目視 → 宿の確認）。
 *
 * 不採用（無理に埋めない）:
 *   大瀬崎(長崎)     座標が静岡県沼津の大瀬崎だった。同名異所
 *   岩湧山(大阪)     霞んだ眺望で厳格審査に落選。撮り直し候補は府庁山からの写真だった
 *   おごと温泉(滋賀)  合格画像なし（8枚試行）
 *   月ヶ谷温泉(徳島)  Commonsに候補が無い
 *   箕面大滝(大阪)   既存「勝尾寺」から2.1km
 *   龍王峡(栃木)     既存「川治温泉」から1.6km
 *   須賀谷温泉(滋賀)  既存「余呉湖」から2.4km
 *   小浜温泉(長崎)   既存「雲仙温泉」から2.3km
 *   神庭の滝(岡山)   既存「湯原温泉」から1.4km
 *   養老渓谷温泉・島原温泉・香嵐渓  既存に同じ場所のエントリがある
 *   滝畑四十八滝・白久温泉・白子温泉・大浜海岸・九十九島  座標が2ソースで一致せず
 */
import fs from 'fs';

const DATA = 'src/data/destinations.json';
const all = JSON.parse(fs.readFileSync(DATA, 'utf8'));
const byId = (id) => all.find((d) => d.id === id);

const RAKUTEN = (pref) => `https://hb.afl.rakuten.co.jp/hgc/5113ee4b.8662cfc5.5113ee4c.119de89a/`
  + `?pc=${encodeURIComponent(`https://travel.rakuten.co.jp/yado/${pref}/`)}`;
const PREF = {
  '大阪府': { rakuten: RAKUTEN('osaka'),     jalan: 'https://www.jalan.net/270000/', area: 'osaka' },
  '埼玉県': { rakuten: RAKUTEN('saitama'),   jalan: 'https://www.jalan.net/110000/', area: 'saitama' },
  '徳島県': { rakuten: RAKUTEN('tokushima'), jalan: 'https://www.jalan.net/360000/', area: 'tokushima' },
  '宮城県': { rakuten: RAKUTEN('miyagi'),    jalan: 'https://www.jalan.net/040000/', area: 'miyagi' },
};

const BASE = {
  inunakiyama: 'kishiwada', naguri: 'hanno', ryokami: 'mitsuminejinja',
  takagoya: 'tsurugi-san', 'naruko-kyo': 'naruko-onsen',
};
const travelTimeFrom = (id) => Object.fromEntries(
  Object.entries(byId(BASE[id])?.travelTime || {}).filter(([, v]) => typeof v === 'number' && v > 0 && v < 900));

const IMG = JSON.parse(fs.readFileSync('logs/gap_images.json', 'utf8')).adopted;
const creditOf = (id) => IMG.find((x) => x.id === id)?.credit ?? null;
const COORD = Object.fromEntries(JSON.parse(fs.readFileSync('logs/gap_targets.json', 'utf8'))
  .map((t) => [t.id, { lat: t.lat, lng: t.lng, city: t.city }]));

const E = [
  {
    id: 'inunakiyama', name: '犬鳴山温泉', prefecture: '大阪府', destType: 'onsen',
    railGateway: '日根野駅', airportGateway: '関西空港', hotelSearch: '犬鳴山温泉',
    bestSeason: '秋', requiresCar: false, tags: ['温泉', '自然', '寺社', '秋'],
    catch: '大阪府で唯一の温泉郷は、修験の山の谷にある。',
    description: '泉佐野の山あいを流れる樫井川の上流に、宿が三軒だけ並んでいる。大阪府内で温泉郷と呼べるのはここだけだ。山は千三百年あまり前に修験道場として開かれ、十世紀ごろの義犬伝説にちなんで犬鳴山と呼ばれるようになった。南北朝の兵士が傷を癒したという言い伝えも残る。泉質はナトリウム炭酸水素塩泉の冷鉱泉で、泉温は十六度から二十度、pHは八・六から八・八。純重曹泉で肌がなめらかになる。関西空港から車で三十分ほどという近さから、世界に一番近い温泉と称されることもある。',
    spots: [
      { name: '七宝瀧寺', description: '修験道の行場として千三百年あまり前に開かれた寺。谷に沿って滝と行場が点在している。' },
      { name: '樫井川の谷', description: '宿三軒が川沿いに並ぶ。大阪府内で唯一の温泉郷で、市街地からは一時間もかからない。' },
      { name: '義犬伝説', description: '主人を蛇から救った犬の話が山の名の由来。十世紀ごろの出来事として伝えられている。' },
    ],
    featured_stay: { name: '犬鳴山温泉 不動口館', catchcopy: '大阪唯一の温泉郷。修験の谷にある純重曹泉の宿', hasShuttle: false, accessStation: 'JR日根野駅' },
  },
  {
    id: 'naguri', name: '名栗温泉', prefecture: '埼玉県', destType: 'onsen',
    railGateway: '飯能駅', airportGateway: '羽田空港', hotelSearch: '名栗温泉',
    bestSeason: '秋', requiresCar: false, tags: ['温泉', '自然', '湯治', '秋'],
    catch: '鎌倉時代、傷ついた鹿が湯に浸かっていた一軒宿。',
    description: '名栗川の河畔に宿が一軒だけある。鎌倉時代、猟師が傷を負った鹿の湯浴みを見つけたのが始まりと伝わり、いまの大松閣が創業したのは大正の初めだ。泉質は低張性アルカリ性の冷鉱泉で、泉温は十七度。加温して使う湯だが、肌にまとわりつくような柔らかさがある。すぐ上流には名栗湖があり、湖畔には日帰り入浴のさわらびの湯が建つ。都心から電車と バスで二時間かからない位置にありながら、谷に入ると川音のほかに聞こえるものが無くなる。飯能駅からバスで四十分ほど。',
    spots: [
      { name: '名栗湖', description: '有間ダムがせき止めた湖。周囲を歩く道が整い、湖面に山が映る夕暮れの眺めがいい場所。' },
      { name: 'さわらびの湯', description: '名栗湖の下にある日帰り入浴施設。泊まらずに湯だけ立ち寄ることもできる場所である。' },
      { name: '名栗川の谷', description: '宿の前を流れる川。都心から二時間かからないのに、谷に入ると川音しか聞こえなくなる。' },
    ],
    featured_stay: { name: '名栗温泉 大松閣', catchcopy: '大正初期創業の一軒宿。鎌倉期の鹿の湯の伝説を継ぐ', hasShuttle: false, accessStation: '西武飯能駅' },
  },
  {
    id: 'ryokami', name: '両神温泉', prefecture: '埼玉県', destType: 'onsen',
    railGateway: '西武秩父駅', airportGateway: '羽田空港', hotelSearch: '両神温泉',
    bestSeason: '春', requiresCar: true, tags: ['温泉', '自然', '山', '春'],
    catch: '埼玉で唯一の国民宿舎と、道の駅の湯。',
    description: '四阿屋山の山麓に湧く湯で、昭和五十年の開湯と歴史は新しい。温泉街と呼べるものは無く、道の駅両神温泉薬師の湯と国民宿舎の両神荘という二つの施設に集約されている。両神荘は埼玉県で唯一の国民宿舎で、泉質はpH九・一の強アルカリ性単純冷鉱泉。ぬるりとした肌ざわりから美肌の湯と呼ばれ、露天からは小森川のせせらぎが聞こえる。道の駅では秩父名物のしゃくし菜漬が並ぶ。二月から三月にかけては四阿屋山の福寿草とロウバイが咲き、この時期に訪れる人が多い。',
    spots: [
      { name: '道の駅両神温泉薬師の湯', description: '日帰り入浴のできる道の駅。秩父名物のしゃくし菜漬が並び、湯上がりに買って帰れる。' },
      { name: '四阿屋山', description: '温泉が湧く山。二月から三月にかけて福寿草とロウバイが咲き、登山道から見て回れる。' },
      { name: '小森川', description: '両神荘の露天のすぐ下を流れる川。せせらぎを聞きながら強アルカリ性の湯に浸かれる。' },
    ],
    featured_stay: { name: '両神温泉国民宿舎 両神荘', catchcopy: '埼玉唯一の国民宿舎。pH9.1の美肌の湯と武州和牛', hasShuttle: false, accessStation: '西武秩父駅' },
  },
  {
    id: 'takagoya', name: '高越山', prefecture: '徳島県', destType: 'sight',
    railGateway: '山川駅', airportGateway: '徳島空港', hotelSearch: '吉野川市',
    bestSeason: '春', requiresCar: true, tags: ['絶景', '自然', '山', '寺社'],
    catch: '阿波富士と呼ばれる、平野からいきなり立つ山。',
    description: '剣山地の北端、吉野川がつくる細長い平野に面してそびえる標高千百三十三メートルの山だ。平野からの標高差がおよそ千メートルあるため、里から見上げると端正な三角形に立ち上がる。その姿から阿波富士と呼ばれ、地元ではおこうつさんと親しまれてきた。山頂には高越寺という古刹があり、四国百名山にも数えられる。四国最大級のオンツツジの群落があり、五月には斜面が朱に染まる。衣笠山、木綿麻山、摩尼珠山といった別名を持つのも、古くから信仰を集めてきた証しである。山川駅から車で四十分ほど。',
    spots: [
      { name: '高越寺', description: '山頂近くに建つ古刹。修験の山として開かれ、いまも参道を登って詣でる人が絶えない。' },
      { name: 'オンツツジの群落', description: '四国最大級とされる群落。五月になると斜面が朱に染まり、この時期だけ人出が増える。' },
      { name: '吉野川の眺め', description: '平野からの標高差が千メートルある。山頂からは吉野川と細長い平野が一望できてしまう。' },
    ],
  },
  {
    id: 'naruko-kyo', name: '鳴子峡', prefecture: '宮城県', destType: 'sight',
    railGateway: '鳴子温泉駅', airportGateway: '仙台空港', hotelSearch: '大崎市',
    bestSeason: '秋', requiresCar: true, tags: ['絶景', '自然', '秋'],
    catch: '深さ百メートルの断崖が、四キロ続く。',
    description: '大谷川が台地を削ってできた峡谷で、深さ八十から百メートルの断崖が四キロにわたって続く。狭いところは幅十メートルのV字谷、広いところは幅百メートルのU字谷になる。白い石英粗面岩質の凝灰角礫岩が侵食され、立岩、衝立岩、獅子岩、仁王岩、虫喰岩、九曜岩、烏帽子岩、天柱岩と名の付いた奇岩が並ぶ。形が作られ始めたのは最終氷期の終わり、およそ一万年前からだ。栗駒国定公園に含まれ、宮城県の名勝に指定されている。紅葉の時期は大深沢橋からの眺めに人が集まる。鳴子温泉から車で十分ほど。',
    spots: [
      { name: '大深沢橋', description: '峡谷に架かる橋。紅葉の時期はここから見下ろす眺めを目当てに人が集まってくる場所。' },
      { name: '名の付いた奇岩', description: '立岩・衝立岩・獅子岩・仁王岩など、白い凝灰角礫岩が削られてできた岩が並んでいる。' },
      { name: '鳴子温泉', description: '車で十分ほどの湯の町。峡谷を歩いたあと、そのまま宿に入る旅程が組みやすい距離にある。' },
    ],
  },
];

// ── 投入前に字数を機械測定する（description 200〜300字 / spot 40〜80字）──
const bad = [];
for (const e of E) {
  if (e.description.length < 200 || e.description.length > 300) bad.push(`${e.name} description ${e.description.length}字`);
  if (e.spots.length !== 3) bad.push(`${e.name} spotが${e.spots.length}件`);
  for (const s of e.spots) {
    if (s.description.length < 40 || s.description.length > 80) bad.push(`${e.name} spot「${s.name}」${s.description.length}字`);
  }
}
if (bad.length) {
  console.log('■ 字数が範囲外');
  for (const b of bad) console.log(`  ❌ ${b}`);
  console.log(`\n投入を中止した（${bad.length}件）`);
  process.exit(1);
}

const built = [];
for (const e of E) {
  const c = COORD[e.id];
  const p = PREF[e.prefecture];
  const credit = creditOf(e.id);
  if (!c) throw new Error(`座標なし: ${e.id}`);
  if (!p) throw new Error(`県設定なし: ${e.prefecture}`);
  if (!credit) throw new Error(`画像クレジットなし: ${e.id}`);
  const base = byId(BASE[e.id]);
  const isOnsen = e.destType === 'onsen';
  built.push({
    id: e.id, name: e.name, type: 'destination',
    region: base?.region ?? null, hub: base?.hub ?? null,
    stayAllowed: ['1night'], departures: base?.hub ? [base.hub] : [], weight: 1,
    description: e.description, tags: e.tags, spots: e.spots,
    shinkansenAccess: false, requiresCar: e.requiresCar, hotelSearch: e.hotelSearch,
    gateways: { rail: [e.railGateway], airport: [e.airportGateway], bus: [], ferry: [] },
    destType: e.destType, railGateway: e.railGateway, busGateway: null, ferryGateway: null,
    airportGateway: e.airportGateway, prefecture: e.prefecture, lat: c.lat, lng: c.lng,
    stayBias: 1, city: c.city, situations: ['solo', 'couple', 'friends'], catch: e.catch,
    mainSpot: e.spots[0].name, mapPoint: e.name,
    representativeStation: e.railGateway, hubStation: e.railGateway, accessStation: e.railGateway,
    hotelArea: p.area, finalAccess: { type: e.requiresCar ? 'car' : 'walk' },
    travelTime: travelTimeFrom(e.id), stayRecommendation: '1night',
    tier: 'area', tier2: 'area', icCard: base?.icCard ?? 'suica',
    bestSeason: e.bestSeason, onsenLevel: isOnsen ? 3 : 0, hasDirectFlight: false,
    primary: e.tags.slice(0, 2), secondary: e.tags.slice(2),
    reasonChips: [isOnsen ? '温泉' : '絶景', isOnsen ? '湯に浸かる' : '自然と過ごす',
      'ひとり旅向け', '1泊がおすすめ', ...(e.requiresCar ? [] : ['車なしOK'])],
    images: [`/images/${e.id}/main.jpg`], imageCredit: credit,
    hotelLinks: { rakuten: p.rakuten, jalan: p.jalan },
    ...(e.featured_stay ? { featured_stay: e.featured_stay } : {}),
  });
}
for (const b of built) if (all.some((d) => d.id === b.id)) throw new Error(`id重複のため中止: ${b.id}`);
const out = all.concat(built);
fs.writeFileSync(DATA, JSON.stringify(out, null, 2) + '\n');
fs.writeFileSync('public/data/destinations.json', JSON.stringify(out, null, 2) + '\n');
console.log(`追加 ${built.length}件 / 総数 ${all.length} → ${out.length}\n`);
for (const b of built) {
  console.log(`  ${b.id.padEnd(14)} ${b.name.padEnd(8)} ${b.prefecture.padEnd(4)} ${b.destType.padEnd(6)} desc=${b.description.length}字 `
    + `spot=${b.spots.map((s) => s.description.length).join('/')} tt=${Object.keys(b.travelTime).length} ic=${b.icCard}`);
}
