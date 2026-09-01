#!/usr/bin/env node
/**
 * buildMachinami.mjs — 重要伝統的建造物群保存地区のうち、既存destinationsに無かった
 * 街並み・宿場町を追加する（新ジャンル「街並み」）。
 *
 * 選び方: 重伝建129地区を機械照合して未掲載29地区に絞り、京都・神戸・宮島・萩・脇町・
 * 石見銀山・美山のようにすでに親エントリがあるものを外して16地区にした。
 * そこへ温泉と同じゲート（座標2ソース一致 → commonsPlaceCheck → 2段階Vision → 目視）を
 * 通し、さらに「30km以内に営業中の宿があるか」を既存データの検証済みfeatured_stayで確かめた。
 *
 * 不採用（無理に埋めない）:
 *   須坂(長野)        Commonsは田中本家博物館の庭園写真ばかりで、重伝建の蔵の町並みが無い
 *   出羽島(徳島)      船上から撮った遠い島影しか無く、集落が写らない
 *   金ケ崎(岩手)      航空写真1枚のみで町並みが判別できない
 *   栃木嘉右衛門町    30km以内に営業中の宿を一次情報で確認できなかった
 *   土居廓中(高知)    同上
 *   入来麓・加世田麓  ja.Wikipediaに地区の記事が無く、本文の裏取りができなかった
 *   五個荘金堂(滋賀)  既存「五個荘近江商人の館」から1.1km。別立てせず既存に委ねる
 *   塩山下小田原上条・大屋町大杉  座標が2ソースで一致しなかった
 */
import fs from 'fs';

const DATA = 'src/data/destinations.json';
const all = JSON.parse(fs.readFileSync(DATA, 'utf8'));
const byId = (id) => all.find((d) => d.id === id);

const RAKUTEN = (pref) => `https://hb.afl.rakuten.co.jp/hgc/5113ee4b.8662cfc5.5113ee4c.119de89a/`
  + `?pc=${encodeURIComponent(`https://travel.rakuten.co.jp/yado/${pref}/`)}`;
const PREF = {
  '福井県': { rakuten: RAKUTEN('fukui'),     jalan: 'https://www.jalan.net/ikisaki/map/fukui/', area: 'fukui' },
  '広島県': { rakuten: RAKUTEN('hiroshima'), jalan: 'https://www.jalan.net/340000/', area: 'hiroshima' },
  '愛媛県': { rakuten: RAKUTEN('ehime'),     jalan: 'https://www.jalan.net/380000/', area: 'ehime' },
  '宮城県': { rakuten: RAKUTEN('miyagi'),    jalan: 'https://www.jalan.net/040000/', area: 'miyagi' },
  '群馬県': { rakuten: RAKUTEN('gunma'),     jalan: 'https://www.jalan.net/100000/', area: 'gunma' },
  '長野県': { rakuten: RAKUTEN('nagano'),    jalan: 'https://www.jalan.net/ikisaki/map/nagano/', area: 'nagano' },
};

// travelTime と icCard を引き継ぐ既存エントリ（同県で最も近いもの）
const BASE = {
  imajo: 'echizen-kaigan', mitarai: 'takehara', unomachi: 'ozu',
  'murata-miyagi': 'togatta-onsen', 'akaiwa-gunma': 'kusatsu-onsen', inariyama: 'matsushiro',
};
const travelTimeFrom = (id) => Object.fromEntries(
  Object.entries(byId(BASE[id])?.travelTime || {}).filter(([, v]) => typeof v === 'number' && v > 0 && v < 900));

const IMG = JSON.parse(fs.readFileSync('logs/machinami_images.json', 'utf8')).adopted;
const creditOf = (id) => IMG.find((x) => x.id === id)?.credit ?? null;
const COORD = Object.fromEntries(JSON.parse(fs.readFileSync('logs/machinami_targets.json', 'utf8'))
  .map((t) => [t.id, { lat: t.lat, lng: t.lng, city: t.city }]));

const E = [
  {
    id: 'imajo', name: '今庄宿', prefecture: '福井県',
    railGateway: '今庄駅', airportGateway: '小松空港', hotelSearch: '南越前町',
    bestSeason: '秋', requiresCar: false, tags: ['街歩き', '歴史', 'グルメ'],
    catch: '北陸道の難所を前に、旅人が足を止めた宿場。',
    description: '山が幾重にも重なる木ノ芽峠の手前、京から北陸へ入る旅人が最後に休んだ宿場である。参勤交代の行列もここで一泊した。いまも街道沿いに百六十棟ほどの伝統的な建物が残り、そのうち八棟は江戸時代のものだ。江戸期に十五軒あった造り酒屋は四軒が今も続いており、堀口酒造・北善商店・白駒酒造・畠山酒造の看板が通りに並ぶ。二〇二一年八月、福井県では熊川宿・小浜西組に次ぐ三例目の重要伝統的建造物群保存地区に選ばれた。明治に鉄道が通ってからは機関区が置かれ、今庄駅の立ち食いそばはその名残である。',
    spots: [
      { name: '街道沿いの町並み', description: '約九・二ヘクタールに百六十棟ほどの伝統的建造物が残る。うち八棟は江戸時代に建てられたもの。' },
      { name: '四軒の造り酒屋', description: '江戸期には十五軒あった蔵のうち四軒が今も続く。通りを歩きながら蔵の看板を数えていける。' },
      { name: '今庄駅の立ち食いそば', description: '明治の鉄道開通で機関区が置かれた頃に生まれた駅そば。峠越えを待つ間の一杯が始まりだった。' },
    ],
  },
  {
    id: 'mitarai', name: '御手洗', prefecture: '広島県',
    railGateway: '広駅', airportGateway: '広島空港', hotelSearch: '呉市',
    bestSeason: '通年', requiresCar: true, tags: ['街歩き', '歴史', '海'],
    catch: '風と潮を待つあいだ、船乗りが遊んだ島の港。',
    description: '瀬戸内の大崎下島に、寛文六年に藩の認可を受けて開かれた風待ち・潮待ちの港がある。西廻り海運が確立すると北前船が次々に寄港し、中国第一の港と呼ばれるまでになった。享保九年に若胡子屋が広島藩公認の茶屋として開き、やがて四軒の茶屋が並ぶ花街ができる。最盛期には若胡子屋だけで芸妓が百人ほどいたという。いまも若胡子屋跡が資料館として残り、昭和十二年開設の映画館・乙女座は当時の姿に復元された。一九九四年に全国で三十八番目の重要伝統的建造物群保存地区に選ばれている。',
    spots: [
      { name: '若胡子屋跡', description: '享保九年開業の茶屋の建物。最盛期には芸妓が百人ほどいたとされ、いまは資料館になっている。' },
      { name: '乙女座', description: '昭和十二年に開かれた映画館。当時の姿に復元され、木の座席と舞台がそのまま残されている。' },
      { name: '住吉神社', description: '文政十一年に建てられた本格的な住吉造の社。港に出入りする船の無事を祈ってきた社である。' },
    ],
  },
  {
    id: 'unomachi', name: '卯之町', prefecture: '愛媛県',
    railGateway: '卯之町駅', airportGateway: '松山空港', hotelSearch: '西予市',
    bestSeason: '通年', requiresCar: false, tags: ['街歩き', '歴史', '文化'],
    catch: '白壁と鬼瓦。宇和島街道の在郷町がそのまま残る。',
    description: '戦国期には城下町、城が移ってからは宇和島街道の宿場町であり、明石寺の門前町でもあった町だ。江戸中期から昭和初期にかけての建物が街道の両側に連なり、白い漆喰壁、細工を凝らした鬼瓦、細かい格子の窓が続く。町並みのなかには国の重要文化財である開明学校が建つ。明治期の擬洋風建築で、当時の教科書や机がそのまま置かれている。二〇〇九年十二月、全国で八十六番目の重要伝統的建造物群保存地区に選ばれた。予讃線の卯之町駅から歩いて行ける距離にあり、車がなくても回れる。',
    spots: [
      { name: '開明学校', description: '明治十五年築の擬洋風校舎で国の重要文化財。アーチ窓が並び、当時の教科書や机が残されている。' },
      { name: '中町の町並み', description: '江戸中期から昭和初期の建物が街道の両側に続く。白壁と鬼瓦、細かい格子が家ごとに違う。' },
      { name: '明石寺', description: '四国八十八箇所の第四十三番札所。卯之町はこの寺の門前町として人が集まってきた町である。' },
    ],
  },
  {
    id: 'murata-miyagi', name: '村田の蔵の町', prefecture: '宮城県',
    railGateway: '白石蔵王駅', airportGateway: '仙台空港', hotelSearch: '村田町',
    bestSeason: '通年', requiresCar: true, tags: ['街歩き', '歴史', 'グルメ'],
    catch: 'なまこ壁の店蔵が向かい合う、紅花で栄えた町。',
    description: '江戸時代、この町は紅花の集積地だった。最上紅花を京へ送り、帰りの荷で上方の品を持ち帰る商いで財を成した商人たちが、白い漆喰になまこ壁をあしらった店蔵を競って建てた。明治に入ると養蚕製品の集散地となり、蔵はさらに増える。いまも街道の両側に重厚な店蔵と黒い門が向かい合い、みちのく宮城の小京都と呼ばれてきた。二〇一四年九月、七・四ヘクタールが重要伝統的建造物群保存地区に選ばれた。特産はそら豆で、六月にはそら豆まつりが開かれる。東北自動車道の村田インターから町の中心まですぐだ。',
    spots: [
      { name: '店蔵の並ぶ通り', description: '白い漆喰になまこ壁をあしらった店蔵と黒い門が、街道の両側で向かい合って並んでいる。' },
      { name: '旧大沼家住宅', description: '紅花商人の屋敷。格子窓と重い扉に、京と行き来した商いの規模がそのまま表れている。' },
      { name: 'そら豆まつり', description: '六月第二日曜に開かれる町の祭り。特産のそら豆を目当てに、町の外からも人がやって来る。' },
    ],
  },
  {
    id: 'akaiwa-gunma', name: '六合赤岩', prefecture: '群馬県',
    railGateway: '長野原草津口駅', airportGateway: '羽田空港', hotelSearch: '中之条町',
    bestSeason: '秋', requiresCar: false, tags: ['街歩き', '歴史', '自然'],
    catch: '三階建ての養蚕農家が、段丘の上に並んでいる。',
    description: '白砂川の河岸段丘に、養蚕で暮らしてきた集落がそのまま残っている。昭和三十年代まで村のほとんどの家が蚕を飼い、二階三階を蚕室にした背の高い家が石垣で造成した畑に囲まれて建つ。中でも湯本家住宅は文化三年に建て直された主屋と明治三十年建設の蚕室からなる三階建てで、幕末に蘭学者の高野長英がかくまわれたと伝わる長英の間が二階に残る。二〇〇六年七月、群馬県で初めての重要伝統的建造物群保存地区に選ばれた。長野原草津口駅からバスで十五分、南大橋を降りて歩いて五分と近い。',
    spots: [
      { name: '湯本家住宅', description: '文化三年再建の主屋と明治三十年の蚕室からなる三階建て。二階に高野長英の隠れ部屋が残る。' },
      { name: '段丘の集落', description: '石垣で造成した畑に囲まれ、蚕室を載せた背の高い家が段丘の上に並ぶ。六十三ヘクタール。' },
      { name: '草津・尻焼への道', description: '草津温泉まで車で二十分ほど。川底から湯が湧く尻焼温泉や花敷温泉も同じ谷筋にある。' },
    ],
  },
  {
    id: 'inariyama', name: '稲荷山宿', prefecture: '長野県',
    railGateway: '稲荷山駅', airportGateway: '羽田空港', hotelSearch: '千曲市',
    bestSeason: '通年', requiresCar: false, tags: ['街歩き', '歴史'],
    catch: '善光寺街道で最大の宿場は、絹で栄えた商都だった。',
    description: '天正十年に上杉景勝が稲荷山城を築いたとき、城の縄張りとともに町割りと伝馬の制度が敷かれた。善光寺参りの人々が通う北国西街道の宿場となり、文久二年には家四百三十六軒、人千六百二十五人を数えて街道最大の宿場に育つ。月に九回も市が立ち、呉服問屋を軸に商いが回っていた。弘化四年の善光寺地震でほぼ全焼したが復興し、明治には繭と生糸と絹織物で北信濃随一の商都になる。そのころ建てられた土蔵造りの家がいまも残り、二〇一四年十二月に百九番目の重要伝統的建造物群保存地区に選ばれた。',
    spots: [
      { name: '土蔵造りの町並み', description: '善光寺地震のあと火に強い土蔵造りで建て直された家が残る。白壁と重い扉が通りに続く。' },
      { name: '旧北国西街道', description: '善光寺参りの人が歩いた道。月九回の市が立ち、呉服問屋が軒を連ねた通りがそのまま残る。' },
      { name: '善光寺への道', description: '稲荷山から善光寺までは車で三十分ほど。宿場に泊まって朝いちばんに参る旅程が組める。' },
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
    destType: 'city', railGateway: e.railGateway, busGateway: null, ferryGateway: null,
    airportGateway: e.airportGateway, prefecture: e.prefecture, lat: c.lat, lng: c.lng,
    stayBias: 1, city: c.city, situations: ['solo', 'couple', 'friends'], catch: e.catch,
    mainSpot: e.spots[0].name, mapPoint: e.spots[0].name,
    representativeStation: e.railGateway, hubStation: e.railGateway, accessStation: e.railGateway,
    hotelArea: p.area, finalAccess: { type: e.requiresCar ? 'car' : 'walk' },
    travelTime: travelTimeFrom(e.id), stayRecommendation: '1night',
    tier: 'area', tier2: 'area', icCard: base?.icCard ?? 'suica',
    bestSeason: e.bestSeason, onsenLevel: 0, hasDirectFlight: false,
    primary: e.tags.slice(0, 2), secondary: e.tags.slice(2),
    reasonChips: ['街歩き', '歴史を辿る', 'ひとり旅向け', '1泊がおすすめ', ...(e.requiresCar ? [] : ['車なしOK'])],
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
  console.log(`  ${b.id.padEnd(15)} ${b.name.padEnd(9)} ${b.prefecture.padEnd(4)} desc=${b.description.length}字 `
    + `spot=${b.spots.map((s) => s.description.length).join('/')} tt=${Object.keys(b.travelTime).length} ic=${b.icCard}`);
}
