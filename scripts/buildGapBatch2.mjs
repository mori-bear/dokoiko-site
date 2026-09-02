#!/usr/bin/env node
/**
 * buildGapBatch2.mjs — カバレッジ空白バッチの第2弾。
 *
 * 第1弾のあとに残っていた穴:
 *   絶景が1件も無い  大阪 / 長崎 / 愛知 / 岡山 / 栃木 / 東京
 *   温泉が1件も無い  千葉 / 滋賀
 *
 * 検索語を変えて18件を再挑戦し、座標ゲートを5件、所在県の実測を5件、
 * 画像ゲートと厳格審査を3件が通った。
 *
 * 不採用（無理に埋めない）:
 *   野母崎(長崎)     砂浜越しの島影が暗く霞んで厳格審査に落選
 *   豪渓(岡山)       合格画像なし（8枚試行）
 *   能勢の大ケヤキ・関空展望ホール・つづら棚田・小湊温泉・落合集落
 *                    座標が2ソースで一致しなかった
 *   館山温泉・阿寺の七滝  既存に同じ場所のエントリがある
 *   須賀谷温泉(滋賀)  既存「余呉湖」から2.4km
 *   南比良温泉(滋賀)  座標が一致しなかった
 *
 * 千葉・滋賀の温泉と、愛知・岡山・東京の絶景は今回も埋まっていない。
 */
import fs from 'fs';

const DATA = 'src/data/destinations.json';
const all = JSON.parse(fs.readFileSync(DATA, 'utf8'));
const byId = (id) => all.find((d) => d.id === id);

const RAKUTEN = (pref) => `https://hb.afl.rakuten.co.jp/hgc/5113ee4b.8662cfc5.5113ee4c.119de89a/`
  + `?pc=${encodeURIComponent(`https://travel.rakuten.co.jp/yado/${pref}/`)}`;
const PREF = {
  '大阪府': { rakuten: RAKUTEN('osaka'),    jalan: 'https://www.jalan.net/270000/', area: 'osaka' },
  '長崎県': { rakuten: RAKUTEN('nagasaki'), jalan: 'https://www.jalan.net/420000/', area: 'nagasaki' },
  '栃木県': { rakuten: RAKUTEN('tochigi'),  jalan: 'https://www.jalan.net/090000/', area: 'tochigi' },
};

const BASE = { hoshida: 'osaka', 'iojima-nagasaki': 'sasebo', kirifuri: 'nikko' };
const travelTimeFrom = (id) => Object.fromEntries(
  Object.entries(byId(BASE[id])?.travelTime || {}).filter(([, v]) => typeof v === 'number' && v > 0 && v < 900));

const IMG = JSON.parse(fs.readFileSync('logs/gap_images2.json', 'utf8')).adopted;
const creditOf = (id) => IMG.find((x) => x.id === id)?.credit ?? null;
const COORD = Object.fromEntries(JSON.parse(fs.readFileSync('logs/gap_targets2.json', 'utf8'))
  .map((t) => [t.id, { lat: t.lat, lng: t.lng, city: t.city }]));

const E = [
  {
    id: 'hoshida', name: 'ほしだ園地', prefecture: '大阪府',
    railGateway: '私市駅', airportGateway: '伊丹空港', hotelSearch: '交野市',
    bestSeason: '秋', requiresCar: false, tags: ['絶景', '自然', '秋'],
    catch: '谷の上に、長さ二百八十メートルの吊り橋が渡る。',
    description: '交野の山あいにある府民の森で、金剛生駒紀泉国定公園に含まれる。園内には星のブランコと呼ばれる大吊り橋があり、長さ二百八十メートル、地上からの高さは五十メートル。木床版の吊り橋としては国内でも最大級で、渡っているあいだ足元がわずかに揺れる。橋の上からは生駒山系の谷がそのまま見渡せ、秋には斜面全体が色づく。園地には岩登りの練習場であるクライミングウォールもあり、ハイキングの人と登る人が入り混じる。京阪の私市駅から歩いて四十分ほど、大阪の市街地から一時間かからない。',
    spots: [
      { name: '星のブランコ', description: '長さ二百八十メートル、高さ五十メートルの吊り橋。木床版としては国内最大級になる。' },
      { name: '展望スポット', description: '橋の上から生駒山系の谷を見渡せる。秋になると斜面全体が色づいて視界を埋め尽くす。' },
      { name: 'クライミングウォール', description: '園内にある岩登りの練習場。ハイキングの人と登る人が同じ道で入り混じっている場所。' },
    ],
  },
  {
    id: 'iojima-nagasaki', name: '伊王島', prefecture: '長崎県',
    railGateway: '長崎駅', airportGateway: '長崎空港', hotelSearch: '伊王島',
    bestSeason: '夏', requiresCar: false, tags: ['絶景', '海', '離島', '夏'],
    catch: '橋で渡れるようになった、炭鉱の島。',
    description: '長崎港から南西へ十キロほどの海に浮かぶ、周囲七・一キロ、面積一・二四平方キロの島だ。隣の沖之島とは伊王瀬戸をはさんで三十メートルしか離れておらず、三本の橋で結ばれている。江戸期は佐賀藩の支配下にあり、昭和十年に石炭が見つかってからは炭鉱の島として栄えた。二〇一一年に伊王島大橋が開通し、車のまま渡れるようになっている。教会と灯台が島の高いところに並び、海沿いには砂浜と温泉施設がある。長崎市街から車で三十分ほど、船なら二十分ほどで着く距離だ。',
    spots: [
      { name: '伊王島大橋', description: '二〇一一年に開通した橋。車のまま渡れるようになり、長崎の市街地から三十分ほどで着く。' },
      { name: '伊王島灯台', description: '島の高いところに立つ灯台。明治期に建てられ、五島灘を行き交う船を照らし続けてきた。' },
      { name: '炭鉱の島の跡', description: '昭和十年に石炭が見つかり、島は炭鉱で栄えた。閉山したあとの遺構がいまも残っている。' },
    ],
  },
  {
    id: 'kirifuri', name: '霧降滝', prefecture: '栃木県',
    railGateway: '日光駅', airportGateway: '羽田空港', hotelSearch: '日光市',
    bestSeason: '秋', requiresCar: true, tags: ['絶景', '自然', '秋'],
    catch: '上下二段、あわせて七十五メートル。日光三名瀑のひとつ。',
    description: '板穴川の支流である霧降川にかかる滝で、上段が二十五メートル、下段が二十六メートル、全長は七十五メートルある。華厳滝・裏見滝とともに日光三名瀑に数えられ、日本の滝百選にも選ばれている。岩壁に当たって飛び散る水しぶきが霧の降るように見えることが名の由来だ。観瀑台が整えられており、駐車場から遊歩道を五分ほど歩けば滝の全景が正面に開ける。大正四年にフランス人外交官のガロアが見つけた珍しい昆虫ガロアムシが、この滝の周辺に生息している。日光インターから霧降高原道路で四キロほど。',
    spots: [
      { name: '観瀬台からの全景', description: '駐車場から遊歩道を五分ほど。上下二段の滝が正面に開け、秋は紅葉が谷を埋めていく。' },
      { name: '日光三名瀑', description: '華厳滝・裏見滝と並んで数えられる。日本の滝百選にも選ばれている滝のひとつである。' },
      { name: 'ガロアムシ', description: '大正四年にフランス人外交官が見つけた珍しい昆虫。この滝の周辺にいまも生息している。' },
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
  built.push({
    id: e.id, name: e.name, type: 'destination',
    region: base?.region ?? null, hub: base?.hub ?? null,
    stayAllowed: ['1night'], departures: base?.hub ? [base.hub] : [], weight: 1,
    description: e.description, tags: e.tags, spots: e.spots,
    shinkansenAccess: false, requiresCar: e.requiresCar, hotelSearch: e.hotelSearch,
    gateways: { rail: [e.railGateway], airport: [e.airportGateway], bus: [], ferry: [] },
    destType: 'sight', railGateway: e.railGateway, busGateway: null, ferryGateway: null,
    airportGateway: e.airportGateway, prefecture: e.prefecture, lat: c.lat, lng: c.lng,
    stayBias: 1, city: c.city, situations: ['solo', 'couple', 'friends'], catch: e.catch,
    mainSpot: e.spots[0].name, mapPoint: e.name,
    representativeStation: e.railGateway, hubStation: e.railGateway, accessStation: e.railGateway,
    hotelArea: p.area, finalAccess: { type: e.requiresCar ? 'car' : 'walk' },
    travelTime: travelTimeFrom(e.id), stayRecommendation: '1night',
    tier: 'area', tier2: 'area', icCard: base?.icCard ?? 'suica',
    bestSeason: e.bestSeason, onsenLevel: 0, hasDirectFlight: false,
    primary: e.tags.slice(0, 2), secondary: e.tags.slice(2),
    reasonChips: ['絶景', '自然と過ごす', 'ひとり旅向け', '1泊がおすすめ', ...(e.requiresCar ? [] : ['車なしOK'])],
    images: [`/images/${e.id}/main.jpg`], imageCredit: credit,
    hotelLinks: { rakuten: p.rakuten, jalan: p.jalan },
  });
}
for (const b of built) if (all.some((d) => d.id === b.id)) throw new Error(`id重複のため中止: ${b.id}`);
const out = all.concat(built);
fs.writeFileSync(DATA, JSON.stringify(out, null, 2) + '\n');
fs.writeFileSync('public/data/destinations.json', JSON.stringify(out, null, 2) + '\n');
console.log(`追加 ${built.length}件 / 総数 ${all.length} → ${out.length}\n`);
for (const b of built) {
  console.log(`  ${b.id.padEnd(16)} ${b.name.padEnd(8)} ${b.prefecture.padEnd(4)} desc=${b.description.length}字 `
    + `spot=${b.spots.map((s) => s.description.length).join('/')} tt=${Object.keys(b.travelTime).length} ic=${b.icCard}`);
}
