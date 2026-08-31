#!/usr/bin/env node
/**
 * buildKyushuDestinations.mjs — 九州の秘湯・小規模温泉9件を destinations.json に追加する。
 *
 * 前提（すべて既存パイプラインのゲートを通過済み）:
 *   座標  … Wikipedia/Wikidata × OSM の2ソース一致 ＋ 逆ジオコーディングで市町村照合
 *           (logs/kyushu_candidates3.json, logs/kyushu_coord_verify.json)
 *   画像  … Commonsメタ照合(placeCheck) → Haiku →(グレーのみ)Sonnet → 目視確認
 *           (logs/kyushu_images.json, logs/kyushu_images2.json)
 *   営業  … 各温泉地の宿・公式サイト・予約ページを個別に確認（2026-08-31時点）
 *
 * 不採用にしたもの:
 *   日奈久温泉 … 令和8年熊本地震(2026-07-28)で源泉配管が損傷し旅館10軒が営業不能。
 *                「実在・営業中」を満たさないため除外（復旧後に再検討）。
 *   筋湯温泉/宝泉寺温泉/壁湯温泉 … Commonsに使える画像がなく画像ゲートで不合格。
 *
 * travelTime は捏造せず、最寄りの既存エントリ（いずれも6〜14km圏）の値を土台にする。
 * hotelLinks は同県既存エントリからのコピー（アフィリ変換はテンプレ側が行う）。
 */
import fs from 'fs';

const DATA = 'src/data/destinations.json';
const all = JSON.parse(fs.readFileSync(DATA, 'utf8'));
const byId = (id) => all.find((d) => d.id === id);

// 県別 hotelLinks / hotelArea（既存エントリの最多パターンをそのまま使う）
const PREF = {
  '大分県': { rakuten: 'https://travel.rakuten.co.jp/yado/oita/',     jalan: 'https://www.jalan.net/440000/', area: 'oita' },
  '熊本県': { rakuten: 'https://travel.rakuten.co.jp/yado/kumamoto/', jalan: 'https://www.jalan.net/430000/', area: 'kumamoto' },
  '福岡県': { rakuten: 'https://travel.rakuten.co.jp/yado/fukuoka/',  jalan: 'https://www.jalan.net/400000/', area: 'fukuoka' },
  '佐賀県': { rakuten: 'https://travel.rakuten.co.jp/yado/saga/',     jalan: 'https://www.jalan.net/410000/', area: 'saga' },
  '宮崎県': { rakuten: 'https://travel.rakuten.co.jp/yado/miyazaki/', jalan: 'https://www.jalan.net/450000/', area: 'miyazaki' },
};

// travelTime の土台（最寄りの既存エントリ。距離はいずれも15km以内）
const TT_BASE = {
  'kannojigoku': 'kuju-kogen', 'yunohira-onsen': 'yufuin', 'hagenoyu-onsen': 'oguni-kumamoto',
  'tsuetate-onsen': 'oguni-kumamoto', 'yunotsuru-onsen': 'izumi-kagoshima',
  'funagoya-onsen': 'yame', 'kumanokawa-onsen': 'saga', 'furuyu-onsen': 'saga',
  'hinokage-onsen': 'takachiho',
};
// 既存データに紛れている異常値（自県0分・999分）は持ち込まない
function travelTimeFrom(baseId) {
  const t = byId(baseId)?.travelTime || {};
  return Object.fromEntries(Object.entries(t).filter(([, v]) => typeof v === 'number' && v > 0 && v < 900));
}

const IMG = [
  ...JSON.parse(fs.readFileSync('logs/kyushu_images.json', 'utf8')).adopted,
  ...JSON.parse(fs.readFileSync('logs/kyushu_images2.json', 'utf8')).adopted,
];
const creditOf = (id) => IMG.find((x) => x.id === id)?.credit ?? null;

const COORD = Object.fromEntries([
  ...JSON.parse(fs.readFileSync('logs/kyushu_targets.json', 'utf8')),
  ...JSON.parse(fs.readFileSync('logs/kyushu_secret_add.json', 'utf8')),
].map((t) => [t.id, { lat: t.lat, lng: t.lng }]));

const ENTRIES = [
  {
    id: 'kannojigoku', name: '寒の地獄温泉', prefecture: '大分県', city: '玖珠郡九重町',
    hub: '大分', railGateway: '豊後中村駅', airportGateway: '大分空港',
    hotelSearch: '寒の地獄温泉', bestSeason: '夏', onsenLevel: 3, requiresCar: true,
    tags: ['温泉', '秘湯', '一軒宿', '自然'],
    catch: '十三度の湯に入る。痛いのは、最初の三分だけ。',
    description: '湯に入るのに覚悟がいる宿がある。九重連山のふところ、森の中に一軒だけ建つ寒の地獄旅館。ここの湯は十三度から十四度、毎分二トンの冷たい硫黄泉が石造りの浴槽に流れ込み続ける。入った瞬間は皮膚が痛いほどだが、三分ほどで痛みが引き、体の芯だけが冷えていく不思議な感覚が残る。冷泉に浸かっては暖房室で温まる、それを繰り返すのが嘉永二年から続く湯治の作法だ。かつては夏だけ開く宿だったが、暖の地獄サウナができてからは通年営業になった。建物は昭和三年の創業当時の木造のまま、前を流れる沢は硫黄で白く濁っている。日本秘湯を守る会の一軒宿。豊後中村駅からタクシーで三十分、たどり着くまでが既に旅である。',
    spots: [
      { name: '冷泉の湯船', description: '十三度の硫黄泉が毎分二トン注ぎ続ける石造りの浴槽。水着着用の男女混浴で、入って三分を過ぎると痛みが引いていく。' },
      { name: '暖房室', description: '冷泉から上がった体を薪ストーブで温め直す部屋。冷やして温めてを繰り返すのが、この宿に伝わる湯治の作法。' },
      { name: '宿前の沢', description: '建物の前を流れる沢は硫黄で乳白色に濁る。湯の音と鳥の声しかせず、携帯の電波も心もとない。' },
    ],
    featured_stay: { name: '寒の地獄温泉 山の宿 寒の地獄旅館', catchcopy: '嘉永二年開湯、十三度の冷泉に浸かる日本秘湯を守る会の一軒宿', hasShuttle: false, accessStation: 'JR豊後中村駅' },
  },
  {
    id: 'yunohira-onsen', name: '湯平温泉', prefecture: '大分県', city: '由布市',
    hub: '大分', railGateway: '湯平駅', airportGateway: '大分空港',
    hotelSearch: '湯平温泉', bestSeason: '冬', onsenLevel: 3, requiresCar: true,
    tags: ['温泉', '湯治', '街歩き', '冬'],
    catch: '三百メートルの石畳を、下駄の音で上がっていく。',
    description: '由布院から車で三十分、同じ市内とは思えないほど時間の流れが違う。江戸期に敷かれた三百メートルの石畳の坂道が温泉街の背骨で、その両側に木造の旅館と共同浴場が肩を寄せ合う。坂は思ったより急で、下駄で歩くとからころと音が返ってくる。湯はナトリウム塩化物・硫酸塩泉、加水も加温も塩素消毒もしない源泉かけ流しだ。昭和の初めには別府に次ぐ九州第二位の入湯客を集めた湯治場で、今も家族経営の小さな宿が十数軒残っている。共同浴場は現在、銀の湯と橋本温泉の二か所が営業中（金の湯・中の湯・砂湯は泉源調整のため休止）。拠点は湯平駅だが駅から温泉街までは離れているので、車のほうが確実だ。',
    spots: [
      { name: '石畳の坂道', description: '江戸期に敷かれた全長三百メートルの石畳。両側に旅館と共同浴場が並び、下駄の音が坂に響く。' },
      { name: '銀の湯', description: '現在営業している共同浴場のひとつ。加水加温なしの源泉かけ流しで、地元の人が朝から通ってくる。' },
      { name: '湯平駅', description: '温泉街からは離れた山あいの久大本線の駅。ホームから温泉街までは車で十分ほどかかる。' },
    ],
    featured_stay: { name: '湯平温泉 山城屋', catchcopy: '石畳の坂に立つ家族経営の小旅館。源泉かけ流しの湯を静かに使う', hasShuttle: false, accessStation: 'JR湯平駅' },
  },
  {
    id: 'hagenoyu-onsen', name: 'はげの湯温泉', prefecture: '熊本県', city: '阿蘇郡小国町',
    hub: '熊本', railGateway: '引治駅', airportGateway: '熊本空港',
    hotelSearch: 'はげの湯温泉', bestSeason: '秋', onsenLevel: 3, requiresCar: true,
    tags: ['温泉', '秘湯', '絶景', '自然'],
    catch: '地面から湯気が上がる高原に、宿は四軒だけ。',
    description: '地面のあちこちから蒸気が噴き上がっている。小国富士と呼ばれる涌蓋山の西麓、標高七百六十メートルの高原に湧く硫黄泉で、温泉街というものがない。旅館は四軒ほど、あとは貸切風呂が斜面に点在するだけだ。だから湯はたいてい貸切で、露天に浸かると阿蘇の外輪山まで見渡せる。名物は地熱の蒸気で蒸す料理で、鶏を丸ごと蒸し上げる鶏の丸蒸しは予約すれば宿でも味わえる。わいた温泉郷と総称される六つの湯のひとつで、黒川温泉から車で二十分と近いのに、人の密度がまるで違う。最寄りの引治駅から九キロ、路線バスはあてにしにくいので車で来るのが前提になる。',
    spots: [
      { name: '貸切の露天風呂', description: '斜面に点在する家族湯。湯船から涌蓋山と阿蘇の外輪山まで見渡せて、時間貸しで独り占めできる。' },
      { name: '地獄蒸し', description: '地熱の蒸気で食材を蒸す小屋が集落に点在する。鶏を丸ごと蒸し上げる鶏の丸蒸しが名物。' },
      { name: '噴気の風景', description: '集落のあちこちから白い蒸気が立ちのぼる。夕方、斜めの光が入ると湯けむりの輪郭がはっきり見える。' },
    ],
    featured_stay: { name: '和楽の宿 たけの蔵', catchcopy: '湯の花が浮く四つの風呂をもつ全八室の小さな宿', hasShuttle: false, accessStation: 'JR引治駅' },
  },
  {
    id: 'yunotsuru-onsen', name: '湯の鶴温泉', prefecture: '熊本県', city: '水俣市',
    hub: '熊本', railGateway: '水俣駅', airportGateway: '鹿児島空港',
    hotelSearch: '湯の鶴温泉', bestSeason: '通年', onsenLevel: 3, requiresCar: true,
    tags: ['温泉', '秘湯', '湯治', '自然'],
    catch: '看板の少ない谷に、湯治の宿が数軒だけ残る。',
    description: '水俣の市街地から車で二十分、湯出川の谷に入ると急に視界が狭くなり、木造の旅館が川の両岸に数軒並ぶ集落に出る。宿は四軒から六軒、自炊のできる湯治棟が今も現役で残っている。七百年ほど前、平家の落人が傷ついた鶴の湯浴みを見つけたのが始まりと伝わり、かつては湯出温泉と呼ばれた。湯は単純硫化水素泉で、肌に触れるとはっきりぬるりとする。共同浴場のほたるの湯は地元の人の生活の場で、夕方になると自転車が並ぶ。観光地として整備された気配がほとんどなく、看板も少ない。肥薩おれんじ鉄道の水俣駅からみなくるバスが出ているが本数は限られ、実際には車のほうが動きやすい。',
    spots: [
      { name: '湯出川沿いの湯治宿', description: '川の両岸に木造の宿が数軒並ぶ。自炊のできる湯治棟が今も現役で、長期滞在の客が台所を使っている。' },
      { name: 'ほたるの湯', description: '湯の鶴温泉保健センターの共同浴場。地元の人の生活の湯で、夕方には自転車が何台も並ぶ。' },
      { name: '貸切風呂めぐり', description: '宿によっては貸切風呂を日帰りで開放している。硫化水素泉のぬるりとした感触を数軒で比べられる。' },
    ],
    featured_stay: { name: '湯宿 鶴水荘', catchcopy: '貸切風呂を六か所もつ、湯出川沿いのかけ流しの宿', hasShuttle: false, accessStation: '肥薩おれんじ鉄道 水俣駅' },
  },
  {
    id: 'tsuetate-onsen', name: '杖立温泉', prefecture: '熊本県', city: '阿蘇郡小国町',
    hub: '熊本', railGateway: '日田駅', airportGateway: '熊本空港',
    hotelSearch: '杖立温泉', bestSeason: '春', onsenLevel: 3, requiresCar: false,
    tags: ['温泉', '湯治', '街歩き', '春'],
    catch: '九十八度の源泉が、谷全体を白くかすませる。',
    description: '谷が狭い。杖立川の両岸のわずかな土地に、木造の旅館が十八軒ほど積み上がるように建っている。源泉は九十八度と高温で、路地のあちこちから湯けむりが上がり、冬は街全体が白くかすむ。細い石段と路地が迷路のように入り組み、宿と宿のあいだを縫って歩けるのが面白い。共同浴場が五つ、足湯もある。名物は蒸し場で、持ち込んだ食材を温泉の蒸気で蒸せる。四月から五月の連休にかけては川の上空に三千匹を超える鯉のぼりが渡され、谷いっぱいに泳ぐ。応神天皇の産湯という伝承をもち、昭和のはじめには九州の奥座敷と呼ばれた湯治の街だ。日田駅からバスで五十分ほどで着く。',
    spots: [
      { name: '鯉のぼり祭り', description: '四月から五月の連休にかけて、杖立川の上空に三千匹を超える鯉のぼりが渡される。谷を埋めつくす光景。' },
      { name: '蒸し場', description: '持ち込んだ食材を温泉の蒸気で蒸せる共同の設備。卵や野菜なら二十分ほどで仕上がる。' },
      { name: '背戸屋の路地', description: '宿と宿のあいだを縫う細い石段と路地。方向感覚を失うが、歩き続ければどこかで川沿いに出る。' },
    ],
    featured_stay: { name: 'つえたて温泉 ひぜんや', catchcopy: '熊本と大分の県境をまたぐ「県境の宿」。敷地内に十一本の源泉', hasShuttle: false, accessStation: 'JR日田駅' },
  },
  {
    id: 'funagoya-onsen', name: '船小屋温泉', prefecture: '福岡県', city: '筑後市',
    hub: '福岡', railGateway: '筑後船小屋駅', airportGateway: '福岡空港',
    hotelSearch: '船小屋温泉', bestSeason: '通年', onsenLevel: 2, requiresCar: false,
    tags: ['温泉', '一軒宿', '歴史'],
    catch: '新幹線の駅から歩ける、含鉄炭酸泉の一軒宿。',
    description: '九州新幹線の筑後船小屋駅から歩いて二十分、矢部川のほとりに日本有数の含鉄炭酸泉が湧く。源泉は十九度の冷鉱泉で、鉄分と炭酸を高濃度に含み、湧き出したところは赤茶色に染まっている。かつて雀地獄と呼ばれた湧水地で、明治十九年に日本一の含鉄炭酸泉と認定された。全盛期には旅館が軒を連ねたが、いま温泉旅館として営業を続けるのは明治十九年創業のホテル樋口軒がほぼ一軒だけ。そのぶん湯治場の名残が静かに残っている。飲泉のできる船小屋鉱泉場があり、鉄の味のする水を口に含める。日帰りなら川の駅船小屋の恋ぼたる温泉館へ。新幹線の駅から歩けるのに、この静けさは意外だ。',
    spots: [
      { name: '船小屋鉱泉場', description: '飲泉のできる施設。鉄分と炭酸を含む冷鉱泉は口に含むと明確に鉄の味がして、後から炭酸が舌に残る。' },
      { name: '矢部川の川沿い', description: '温泉の背後を流れる矢部川。堤には大楠の並木があり、駅から宿までの二十分はほぼ川沿いの道になる。' },
      { name: '恋ぼたる温泉館', description: '川の駅船小屋に併設された日帰り入浴施設。無料の足湯があり、火曜が定休で入浴は大人七百円。' },
    ],
    featured_stay: { name: '船小屋温泉 ホテル樋口軒', catchcopy: '明治十九年創業。日本有数の含鉄炭酸泉を守る、いまや一軒だけの宿', hasShuttle: false, accessStation: 'JR筑後船小屋駅' },
  },
  {
    id: 'kumanokawa-onsen', name: '熊の川温泉', prefecture: '佐賀県', city: '佐賀市',
    hub: '佐賀', railGateway: '佐賀駅', airportGateway: '佐賀空港',
    hotelSearch: '熊の川温泉', bestSeason: '通年', onsenLevel: 3, requiresCar: false,
    tags: ['温泉', '秘湯', '湯治', '自然'],
    catch: '宿は二軒。九州有数のラドン泉に、ただ長く浸かる。',
    description: '佐賀市街から車で三十分、嘉瀬川をさかのぼった山あいに、泊まれる宿が二軒だけの温泉がある。湯はラドンを含む単純弱放射能泉で、含有量は九州でも有数。湯温は二十四度から三十九度と低い、いわゆるぬる湯なので長く浸かっていられる。弘仁十二年、空海が水浴びする水鳥を見て見つけたという伝承が残り、昭和四十一年に国民保養温泉地に指定された。宿泊できるのはお宿夢千鳥と民宿みみの二軒で、あとは日帰りの共同浴場と立ち寄り湯が三つ。元湯熊ノ川浴場は地元の人が通う簡素な浴場だ。三キロほど上流の古湯温泉と合わせて古湯・熊の川温泉郷と呼ばれる。佐賀駅からバスで三十分ほど。',
    spots: [
      { name: '元湯熊ノ川浴場', description: '地元の人が通う簡素な共同浴場。ラドンを含むぬる湯につかると、皆おそろしく長湯していることに気づく。' },
      { name: '嘉瀬川の渓流', description: '宿の前を流れる嘉瀬川。夏は川遊びの家族連れが河原に降り、秋になると両岸の木々が一斉に色づく。' },
      { name: '温泉館 湯招花', description: '日帰り入浴の温泉館。露天と貸切があり、ぬる湯とあつ湯を行き来しながら半日つぶせる。' },
    ],
    featured_stay: { name: 'お宿 夢千鳥', catchcopy: '宿泊できる二軒のうちの一軒。九州有数のラドン泉をぬる湯で味わう', hasShuttle: false, accessStation: 'JR佐賀駅' },
  },
  {
    id: 'furuyu-onsen', name: '古湯温泉', prefecture: '佐賀県', city: '佐賀市',
    hub: '佐賀', railGateway: '佐賀駅', airportGateway: '佐賀空港',
    hotelSearch: '古湯温泉', bestSeason: '秋', onsenLevel: 3, requiresCar: false,
    tags: ['温泉', '湯治', '歴史', '秋'],
    catch: '三十八度の湯に、一時間。それが古湯の作法。',
    description: '湯温が三十八度前後。人肌よりわずかに温かい程度のアルカリ性単純温泉で、いつまでも入っていられるのが古湯の身上だ。無色無臭でぬめりがあり、美人の湯とも呼ばれる。二千年ほど前に徐福が見つけたという伝承をもち、寛政三年に傷を癒す鶴を見て再発見されたと伝わる。斎藤茂吉が大正九年に三週間滞在して多くの歌を詠んだ湯治場でもあり、温泉街には茂吉通りの名が残っている。宿は十軒ほど、足元から湧く天然砂湯をもつ鶴霊泉のような老舗から、洗練されたONCRIまで幅がある。嘉瀬川の谷あいで、佐賀の平野からわずか三十分とは思えない静けさがある。バスもあるが、車のほうが自由がきく。',
    spots: [
      { name: '鶴霊泉の砂湯', description: '浴槽の底の砂から湯が湧き上がる天然砂湯。足の裏に泡が当たる感触は、ここでしか味わえない。' },
      { name: '茂吉通り', description: '斎藤茂吉が三週間滞在したことにちなむ通りの名。歌碑が置かれ、温泉街の道筋をそのままたどれる。' },
      { name: 'ぬる湯の長湯', description: '三十八度前後の湯は人肌よりわずかに温かい程度で、一時間つかっていてものぼせない。本を持ち込む人もいる。' },
    ],
    featured_stay: { name: '鶴の恩返し よみがえりの宿 鶴霊泉', catchcopy: '浴槽の底から湯が湧く天然砂湯を守る、古湯の老舗', hasShuttle: false, accessStation: 'JR佐賀駅' },
  },
  {
    id: 'hinokage-onsen', name: '日之影温泉', prefecture: '宮崎県', city: '西臼杵郡日之影町',
    hub: '宮崎', railGateway: '延岡駅', airportGateway: '熊本空港',
    hotelSearch: '日之影温泉', bestSeason: '秋', onsenLevel: 2, requiresCar: true,
    tags: ['温泉', '一軒宿', '絶景', '鉄道'],
    catch: '列車の来ない駅に泊まって、谷を見下ろす湯に入る。',
    description: '二〇〇八年に廃止された高千穂鉄道の日之影温泉駅が、そのまま温泉になっている。五ヶ瀬川の峡谷に張り出したホームの下に浴場があり、露天からは深い谷と鉄橋が見える。泉質はアルカリ性単純温泉。さらに珍しいのは、廃線になった車両二両を改装したTR列車の宿で、実際に列車の中に泊まれることだ。客室は六室、予約は電話のみという素朴さが残る。線路はもう続いていないが、駅名標も待合室もそのままで、列車が来ないホームに立つ時間はやけに長く感じる。高千穂から車で二十分ほど。鉄道が廃止された町なので、たどり着くには車がいる。二〇二六年に設備工事で入浴を休止していたが、七月十九日から再開している。',
    spots: [
      { name: 'TR列車の宿', description: '廃線になった高千穂鉄道の車両二両をそのまま改装した宿。客室は六室、予約は電話のみという素朴さ。' },
      { name: '渓谷の露天風呂', description: '五ヶ瀬川の峡谷に面した露天。深い谷と鉄橋を見下ろしながら、アルカリ性単純温泉に浸かる。' },
      { name: '旧日之影温泉駅のホーム', description: '列車の来ないホームと駅名標がそのまま残る。線路の先は途切れ、時間の進み方が変わる場所。' },
    ],
    featured_stay: { name: '日之影温泉駅 TR列車の宿', catchcopy: '廃線になった車両二両を改装した全六室。線路の上で眠る一軒宿', hasShuttle: false, accessStation: 'JR延岡駅' },
  },
];

// ── 組み立て ──
const built = [];
for (const e of ENTRIES) {
  const c = COORD[e.id];
  if (!c) throw new Error(`座標未取得: ${e.id}`);
  const p = PREF[e.prefecture];
  const credit = creditOf(e.id);
  if (!credit) throw new Error(`画像クレジット未取得: ${e.id}`);

  built.push({
    id: e.id, name: e.name, type: 'destination', region: '九州', hub: e.hub,
    stayAllowed: ['1night'], departures: [e.hub], weight: 1,
    description: e.description, tags: e.tags, spots: e.spots,
    shinkansenAccess: e.id === 'funagoya-onsen', requiresCar: e.requiresCar,
    hotelSearch: e.hotelSearch,
    gateways: { rail: [e.railGateway], airport: [e.airportGateway], bus: [], ferry: [] },
    destType: 'onsen', railGateway: e.railGateway, busGateway: null, ferryGateway: null,
    airportGateway: e.airportGateway, prefecture: e.prefecture, lat: c.lat, lng: c.lng,
    stayBias: 1, railProvider: 'jrkyushu', city: e.city,
    situations: ['solo', 'couple'], catch: e.catch,
    mainSpot: e.spots[0].name, mapPoint: e.spots[0].name,
    representativeStation: e.railGateway, hubStation: e.railGateway, accessStation: e.railGateway,
    hotelArea: p.area, finalAccess: { type: e.requiresCar ? 'car' : 'walk' },
    travelTime: travelTimeFrom(TT_BASE[e.id]),
    stayRecommendation: '1night', tier: 'area', tier2: 'area', icCard: 'nimoca',
    bestSeason: e.bestSeason, onsenLevel: e.onsenLevel, hasDirectFlight: false,
    primary: e.tags.slice(0, 2), secondary: e.tags.slice(2),
    reasonChips: ['温泉', 'ひとり旅向け', 'カップル向け', '1泊がおすすめ', ...(e.requiresCar ? [] : ['車なしOK'])],
    images: [`/images/${e.id}/main.jpg`],
    imageCredit: credit,
    hotelLinks: { rakuten: p.rakuten, jalan: p.jalan },
    featured_stay: e.featured_stay,
  });
}

// ── 重複防止と書き出し ──
for (const b of built) {
  if (all.some((d) => d.id === b.id)) throw new Error(`id重複のため中止: ${b.id}`);
}
const out = all.concat(built);
fs.writeFileSync(DATA, JSON.stringify(out, null, 2) + '\n');
fs.writeFileSync('public/data/destinations.json', JSON.stringify(out, null, 2) + '\n');
console.log(`追加 ${built.length}件 / 総数 ${all.length} → ${out.length}`);
for (const b of built) {
  console.log(`  ${b.id.padEnd(18)} ${b.name.padEnd(8)} ${b.prefecture} desc=${b.description.length}字 spots=${b.spots.length} tt=${Object.keys(b.travelTime).length}都市 stay=${b.featured_stay.name}`);
}
