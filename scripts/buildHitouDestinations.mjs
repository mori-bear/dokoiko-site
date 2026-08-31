#!/usr/bin/env node
/**
 * buildHitouDestinations.mjs — 全国の秘湯・一軒宿13件を destinations.json に追加する（第1バッチ）。
 *
 * 通過したゲート:
 *   座標 … Wikipedia / Wikidata P625 / OSM厳格Nominatim / 国土地理院 の4ソースから
 *          2つが5km以内で一致 ＋ 逆ジオコーディングで市町村照合
 *   画像 … Commonsメタ照合(placeCheck) → Haiku →（グレーのみ）Sonnet → 全点を目視
 *   営業 … 宿ごとに公式サイト・日本秘湯を守る会・予約サイトで個別確認（2026-08-31時点）
 *
 * 不採用にしたもの:
 *   祖母谷温泉 … 2026年時点で休業中（能登半島地震で黒部峡谷鉄道が欅平まで未再開・到達不能）
 *   柿木温泉   … 宿泊施設が存在せず（日帰りのみ）。Commonsに温泉を写した画像もなし
 *   千原温泉   … 宿泊施設なし（日帰りのみ）／画像もなし
 *   芽登・滑川・微温湯・奥鬼怒・福地 … Commonsに規定サイズの画像がなく画像ゲート不合格
 *
 * 季節営業の宿は description に明記する（山中の秘湯は冬季閉鎖が多く、
 * 通年で行ける前提の紹介文は実態と食い違うため）。
 */
import fs from 'fs';

const DATA = 'src/data/destinations.json';
const all = JSON.parse(fs.readFileSync(DATA, 'utf8'));
const byId = (id) => all.find((d) => d.id === id);

const PREF = {
  '岩手県': { rakuten: 'https://travel.rakuten.co.jp/yado/iwate/',     jalan: 'https://www.jalan.net/030000/', area: 'iwate' },
  '宮城県': { rakuten: 'https://travel.rakuten.co.jp/yado/miyagi/',    jalan: 'https://www.jalan.net/040000/', area: 'miyagi' },
  '秋田県': { rakuten: 'https://travel.rakuten.co.jp/yado/akita/',     jalan: 'https://www.jalan.net/050000/', area: 'akita' },
  '福島県': { rakuten: 'https://travel.rakuten.co.jp/yado/fukushima/', jalan: 'https://www.jalan.net/070000/', area: 'fukushima' },
  '新潟県': { rakuten: 'https://travel.rakuten.co.jp/yado/niigata/',   jalan: 'https://www.jalan.net/ikisaki/map/niigata/', area: 'niigata' },
  '長野県': { rakuten: 'https://travel.rakuten.co.jp/yado/nagano/',    jalan: 'https://www.jalan.net/ikisaki/map/nagano/', area: 'nagano' },
  '富山県': { rakuten: 'https://travel.rakuten.co.jp/yado/toyama/',    jalan: 'https://www.jalan.net/160000/', area: 'toyama' },
  '岐阜県': { rakuten: 'https://travel.rakuten.co.jp/yado/gifu/',      jalan: 'https://www.jalan.net/210000/', area: 'gifu' },
  '山梨県': { rakuten: 'https://travel.rakuten.co.jp/yado/yamanashi/', jalan: 'https://www.jalan.net/ikisaki/map/yamanashi/', area: 'yamanashi' },
  '静岡県': { rakuten: 'https://travel.rakuten.co.jp/yado/shizuoka/',  jalan: 'https://www.jalan.net/220000/', area: 'shizuoka' },
};

// travelTime と icCard の土台にする最寄り既存エントリ（いずれも4〜23km圏）
const BASE = {
  'namari-onsen': 'hanamaki', 'geto-onsen': 'kitakami', 'matsukawa-iwate': 'hachimantai',
  'gaga-onsen': 'zaosan', 'kuroyu': 'shimokitazawa-nyuto', 'doroyu': 'kurikoma',
  'tokusa': 'minami-aizu', 'kaikake': 'echigo-yuzawa', 'nakabusa': 'azumino',
  'kuronagi': 'unazuki-onsen', 'nigorigo': 'gero-onsen', 'nishiyama-yama': 'minobu',
  'umegashima': 'fujinomiya',
};
const travelTimeFrom = (id) => Object.fromEntries(
  Object.entries(byId(BASE[id])?.travelTime || {}).filter(([, v]) => typeof v === 'number' && v > 0 && v < 900));

const IMG = JSON.parse(fs.readFileSync('logs/hitou_images.json', 'utf8')).adopted;
const creditOf = (id) => IMG.find((x) => x.id === id)?.credit ?? null;
const COORD = Object.fromEntries(JSON.parse(fs.readFileSync('logs/hitou_targets.json', 'utf8'))
  .map((t) => [t.id, { lat: t.lat, lng: t.lng, city: t.city }]));

const E = [
  {
    id: 'namari-onsen', name: '鉛温泉', prefecture: '岩手県',
    railGateway: '花巻駅', airportGateway: 'いわて花巻空港', hotelSearch: '鉛温泉',
    bestSeason: '通年', requiresCar: true, tags: ['温泉', '一軒宿', '湯治', '歴史'],
    catch: '深さ一・二五メートル。座れないから、立って湯に浸かる。',
    description: '豊沢川のほとり、木造三階建ての本館が建っている。ここの湯は変わっていて、天然の岩をくりぬいた浴槽の底から湯が湧き、深さが一・二五メートルある。だから座って浸かることができない。立ったまま、肩まで湯につかる。白猿の湯と呼ばれるこの自噴岩風呂は日本一深い岩風呂を名乗り、本館とともに国の登録有形文化財に指定されている。開湯は六百年以上前、傷を癒す白猿を見つけたのが始まりと伝わる。宿は藤三旅館一軒だけで、旅館部と自炊のできる湯治部に分かれ、長逗留の作法が今も生きている。宮沢賢治は遠戚にあたるこの宿を何度も訪れ、なめとこ山の熊に鉛の湯として書き残した。花巻駅から車で三十分ほど。',
    spots: [
      { name: '白猿の湯', description: '岩をくりぬいた浴槽の底から湯が湧く立ち湯。深さ一・二五メートルで、座れないので立ったまま肩まで浸かる。' },
      { name: '総ケヤキ造りの本館', description: '昭和十六年築の木造三階建て。豊沢川に面して立ち、白猿の湯とともに国の登録有形文化財。' },
      { name: '湯治部', description: '共同炊事場を備えた自炊棟が現役で残る。旅館部とは別の入口から、昔ながらの長逗留ができる。' },
    ],
    featured_stay: { name: '鉛温泉 藤三旅館', catchcopy: '開湯六百年。日本一深い自噴岩風呂「白猿の湯」をもつ登録有形文化財の一軒宿', hasShuttle: false, accessStation: 'JR花巻駅' },
  },
  {
    id: 'geto-onsen', name: '夏油温泉', prefecture: '岩手県',
    railGateway: '北上駅', airportGateway: 'いわて花巻空港', hotelSearch: '夏油温泉',
    bestSeason: '秋', requiresCar: true, tags: ['温泉', '秘湯', '湯治', '自然'],
    catch: '五月に道が開き、十一月に閉まる。冬は誰も入れない谷。',
    description: '五月の連休前後に道が開き、十一月には閉まる。冬のあいだ、この谷には誰も入れない。夏油川の渓谷沿いに七つの源泉が自噴し、大湯・真湯・滝の湯・疝気の湯といった露天が川床に点在する。どれも足元の岩の間から湯が湧いていて、湯船の底が源泉そのものだ。混浴だが女性専用の時間帯が設けられている。建武二年、傷ついた白猿が湯を浴びるのを平家の落人が見つけたのが始まりと伝わる。宿は元湯夏油ほか二軒で、自炊の湯治棟が今も使われている。名の由来はアイヌ語のグット・オ、崖のあるところだとされる。路線バスは廃止済みで、北上市街から車で一時間かかる。',
    spots: [
      { name: '川床の露天群', description: '夏油川沿いに大湯・真湯・滝の湯などが点在する。どれも足元の岩から湯が湧く自噴の湯船。' },
      { name: '天狗の岩', description: '日本最大の石灰華ドームで国の特別天然記念物。二〇一六年の台風で遊歩道が崩落し現在は立入禁止。' },
      { name: '自炊の湯治棟', description: '共同炊事場を備えた自炊棟が現役で残っている。数日から一週間ほど、湯に通うだけの滞在ができる。' },
    ],
    featured_stay: { name: '元湯夏油', catchcopy: '七つの自噴源泉と川床の露天群。五月から十一月だけ開く湯治宿', hasShuttle: false, accessStation: 'JR北上駅' },
  },
  {
    id: 'matsukawa-iwate', name: '松川温泉', prefecture: '岩手県',
    railGateway: '盛岡駅', airportGateway: 'いわて花巻空港', hotelSearch: '松川温泉',
    bestSeason: '秋', requiresCar: true, tags: ['温泉', '秘湯', '紅葉', '自然'],
    catch: '透明な湯が、空気に触れて白く濁っていく。',
    description: '湧き出したときは透明で、空気に触れると乳白色に変わる。単純硫化水素泉の露天に肩まで沈むと、目の前は八幡平の原生林しかない。享保年間に山伏が見つけ、寛保三年にその息子が開いたと伝わる古い湯だ。宿は峡雲荘と松川荘の二軒。かつて洞窟岩風呂で知られた松楓荘は、二百八十年続いたのち二〇二三年に事業を停止して閉館した。すぐ近くには一九六六年に運転を始めた日本初の商用地熱発電所があり、その蒸気が長く宿の暖房に使われてきた。盛岡駅からのバスは一日二本。冬は路面が凍るため四輪駆動が要る。紅葉のころの松川渓谷が美しい。',
    spots: [
      { name: '乳白色の露天風呂', description: '湧出時は透明で、空気に触れると白く濁る硫黄泉。混浴の露天には女性専用の時間帯がある。' },
      { name: '松川地熱発電所', description: '一九六六年に運転を始めた日本初の商用地熱発電所。併設の地熱館でその仕組みを見られる。' },
      { name: '松川渓谷', description: '宿の周囲を流れる渓流と原生林。紅葉の時期には谷全体が色づき、露天に浸かったまま眺められる。' },
    ],
    featured_stay: { name: '松川温泉 峡雲荘', catchcopy: '八幡平の原生林に向かって開く、乳白色の硫黄泉かけ流し', hasShuttle: false, accessStation: 'JR盛岡駅' },
  },
  {
    id: 'gaga-onsen', name: '峩々温泉', prefecture: '宮城県',
    railGateway: '白石蔵王駅', airportGateway: '仙台空港', hotelSearch: '峩々温泉',
    bestSeason: '通年', requiresCar: true, tags: ['温泉', '一軒宿', '湯治', '自然'],
    catch: '浸かる、かける、飲む。胃腸の名湯の作法。',
    description: '周りに店が一軒もない。公式サイトが「完全な一軒宿ですので周辺に飲食店等の施設はございません」と書くとおり、蔵王の山中、標高八百メートルほどの濁川沿いに宿が一軒あるだけだ。ここの湯は胃腸に効くとされ、日本三大胃腸病の名湯に数えられる。浸かる、かける、飲む。四十七度のあつ湯と三十八度前後のぬる湯を行き来し、飲泉もするのが伝えられてきた入り方だ。嘉永年間に猟師が見つけ、明治九年に硫黄採掘を任された者が宿を建てたのが始まりとされる。名は露天から見える峩々たる岩山に由来する。混浴の露天は落雪の危険があるため厳冬期は閉じる。',
    spots: [
      { name: 'あつ湯とぬる湯', description: '四十七度と三十八度前後の浴槽を行き来する。胃腸に効くとされ、飲泉もこの宿の作法のひとつ。' },
      { name: '貸切露天「天空の湯」', description: '蔵王の山並みに向かって開いた貸切の露天。周囲に灯りがひとつもなく、夜は驚くほど星が見える。' },
      { name: '濁川の渓谷', description: '宿の前を流れる阿武隈川支流の濁川。店も民家も一軒もなく、聞こえてくるのは水の音だけになる。' },
    ],
    featured_stay: { name: '峩々温泉', catchcopy: '蔵王の山中に一軒だけ。浸かる・かける・飲むの三拍子で知られる胃腸の名湯', hasShuttle: true, accessStation: 'JR白石蔵王駅' },
  },
  {
    id: 'kuroyu', name: '黒湯温泉', prefecture: '秋田県',
    railGateway: '田沢湖駅', airportGateway: '秋田空港', hotelSearch: '黒湯温泉',
    bestSeason: '秋', requiresCar: true, tags: ['温泉', '秘湯', '湯治', '自然'],
    catch: '四月に開いて十一月に閉じる、乳頭の最奥。',
    description: '乳頭温泉郷のいちばん奥、先達川の上流に茅葺きと杉皮葺きの湯小屋が並んでいる。敷地の中で源泉が音を立てて自噴していて、湯量は郷内でも随一だ。名物は打たせ湯で、男湯にも女湯にも混浴にもそれぞれ備わっている。単純硫化水素泉の白く濁った湯が、肩を叩き続ける。開かれたのは三百三十年ほど前と伝わる。旅館部と自炊部があり、囲炉裏のついた茅葺きの自炊棟が今も使われている。ただしここは雪深く、営業は四月中旬から十一月上旬まで。冬のあいだは閉じてしまう。田沢湖駅からバスで乳頭温泉まで来て、そこから徒歩二十五分ほど登ることになる。',
    spots: [
      { name: '打たせ湯', description: '男湯・女湯・混浴のそれぞれに備わる黒湯の名物。白く濁った硫黄泉が肩を叩き続ける。' },
      { name: '源泉の湧く河原', description: '敷地の中で源泉が音を立てて自噴している。湧き出す湯の量は乳頭温泉郷でも随一とされる。' },
      { name: '茅葺きの自炊棟', description: '囲炉裏のついた茅葺きの棟が現役。二階建ての自炊棟とあわせ、昔ながらの湯治ができる。' },
    ],
    featured_stay: { name: '乳頭温泉郷 黒湯温泉', catchcopy: '茅葺きの湯小屋と打たせ湯。四月中旬から十一月上旬だけ開く乳頭の最奥', hasShuttle: false, accessStation: 'JR田沢湖駅' },
  },
  {
    id: 'doroyu', name: '泥湯温泉', prefecture: '秋田県',
    railGateway: '湯沢駅', airportGateway: '秋田空港', hotelSearch: '泥湯温泉',
    bestSeason: '秋', requiresCar: true, tags: ['温泉', '秘湯', '自然'],
    catch: '泥のような灰白色の湯が、三つの露天で色を変える。',
    description: '奥羽山脈の奥、高松岳の北麓に灰白色に濁った湯が湧く。泥のような色から泥湯の名がついた。源泉は六十七度、露天には川原の湯・天狗の湯・岩の湯と名がつき、それぞれ泉質が違う。宿は奥山旅館と小椋旅館の二軒だが、泊まれるのは奥山旅館だけで、小椋旅館は日帰り入浴のみを続けている。奥山旅館は二〇一六年の火災で本館と別館を焼失し、二〇一九年四月に宿泊営業を再開した。近くには日本三大霊地に数えられる川原毛地獄が広がり、草木の生えない白い斜面から蒸気が上がっている。硫化水素が溜まることがあるので、指定された場所以外には立ち入らないこと。',
    spots: [
      { name: '三つの露天', description: '川原の湯・天狗の湯・岩の湯の三つ。ひとつの宿の中で泉質の違う灰白色の湯を入り比べられる。' },
      { name: '川原毛地獄', description: '草木の生えない白い斜面から蒸気が上がる噴気地帯。日本三大霊地のひとつに数えられる。' },
      { name: '小椋旅館の日帰り湯', description: '明治期からの建物が残り、いまは日帰り入浴のみを続けている。十二月から三月は冬季休業。' },
    ],
    featured_stay: { name: '泥湯温泉 奥山旅館', catchcopy: '泉質の異なる三つの露天をもつ、灰白色の濁り湯の宿', hasShuttle: false, accessStation: 'JR湯沢駅' },
  },
  {
    id: 'tokusa', name: '木賊温泉', prefecture: '福島県',
    railGateway: '会津高原尾瀬口駅', airportGateway: '福島空港', hotelSearch: '木賊温泉',
    bestSeason: '秋', requiresCar: true, tags: ['温泉', '秘湯', '湯治', '自然'],
    catch: '川床から湧く岩風呂は、流されるたびに建て直されてきた。',
    description: '西根川の川床に、屋根だけかかった岩風呂がある。大岩を削った二つの浴槽で、湯は底の岩の割れ目から直に湧いている。共同浴場で入浴料は二百円、混浴だが女性用の湯浴み着を借りられる。二〇一九年の台風で流されたこの岩風呂は、二〇二一年に再建された。それ以前にも二〇一七年、二〇一八年と続けて被災していて、そのたびに地元が建て直してきた湯だ。開かれたのは治暦年間と伝わり、名は川べりに群生していたトクサに由来する。標高七百九十五メートル、宿は五軒ほどが谷に散らばるだけ。会津高原尾瀬口駅からバスとタクシーを乗り継ぐが、車のほうが確実だ。',
    spots: [
      { name: '岩風呂（共同浴場）', description: '西根川の川床にある屋根付きの混浴露天。大岩を削った浴槽の底から源泉が直に湧いている。' },
      { name: '西根川の渓谷', description: '岩風呂のすぐ脇を流れる川。増水すると入浴できなくなるほど、湯船と川面の高さが近づく。' },
      { name: '谷に散る宿', description: '温泉街というまとまりがなく、宿が谷のあちこちに離れて建つ。日が落ちると本当に暗い。' },
    ],
    // 井筒屋は日本秘湯を守る会・JTBともネット予約が0件で営業実態を確認できなかったため
    // featured_stay は設定しない（宿名を出して予約導線を作らない）
    featured_stay: null,
  },
  {
    id: 'kaikake', name: '貝掛温泉', prefecture: '新潟県',
    railGateway: '越後湯沢駅', airportGateway: '新潟空港', hotelSearch: '貝掛温泉',
    bestSeason: '冬', requiresCar: false, tags: ['温泉', '一軒宿', '湯治', '冬'],
    catch: '三十七度の湯に、目を浸す。日本三大眼の温泉。',
    description: '三十七度。人肌よりぬるい湯に、目を浸すために来る人がいる。メタホウ酸を多く含むこの湯は古くから眼病に効くとされ、箱根の姥子、福島の微温湯とともに日本三大眼の温泉に数えられてきた。鎌倉時代に旅の僧が見つけたと伝わり、上杉謙信の隠し湯だったという話も残る。清津川の支流かっさ川のほとり、カラマツ林に囲まれて庄屋造りの宿が一軒だけ建つ。毎分四百リットルが自然に湧き、内湯四つと露天三つを満たしている。ぬるいので一時間でも入っていられる。冬は雪見の露天になり、越後湯沢駅からバスで二十分と、秘湯にしてはたどり着きやすい。',
    spots: [
      { name: '目の湯治', description: '源泉に目を浸す独特の入浴法。メタホウ酸を多く含み、日本三大眼の温泉のひとつとされる。' },
      { name: '三十七度のぬる湯', description: '人肌よりぬるい源泉かけ流しの湯船。のぼせることがなく、一時間でも浸かっていられる。' },
      { name: '庄屋造りの一軒宿', description: 'カラマツ林に囲まれて建つ重厚な木造の宿。周囲に他の建物はなく、冬は雪見の露天になる。' },
    ],
    featured_stay: { name: '奥湯沢 貝掛温泉', catchcopy: '毎分四百リットル自噴の三十七度。目を浸す湯治で知られる庄屋造りの一軒宿', hasShuttle: false, accessStation: 'JR越後湯沢駅' },
  },
  {
    id: 'nakabusa', name: '中房温泉', prefecture: '長野県',
    railGateway: '穂高駅', airportGateway: '信州まつもと空港', hotelSearch: '中房温泉',
    bestSeason: '秋', requiresCar: false, tags: ['温泉', '一軒宿', '登山', '自然'],
    catch: '源泉三十六か所、湯船は二十以上。標高千四百六十二メートル。',
    description: '標高千四百六十二メートル、燕岳の登山口に湯がある。源泉は三十六か所、湧出温度は五十六度から九十七度に達し、露天と内湯をあわせて二十以上の湯船が斜面に散らばっている。すべて加水なしのかけ流しだ。変わっているのは地熱浴場で、地面の熱の上にすのこを敷いて寝転ぶ天然の岩盤浴になっている。地面に埋めて蒸したじゃがいもが塩付きで出てくる。文政四年、松本藩の命でミョウバンを採るために湯小屋が開かれたのが始まり。雪に閉ざされるため営業は四月下旬から十一月下旬まで、穂高駅からのバスもその期間だけ走る。登山口の駐車場は事前予約制になっている。',
    spots: [
      { name: '白滝の湯', description: '本館から歩いて五分ほど、原生林に囲まれた最奥の混浴露天。斜面に散る湯船のひとつ。' },
      { name: '地熱浴場', description: '地面の熱の上にすのこを敷いた天然の岩盤浴。埋めて蒸したじゃがいもが塩付きで供される。' },
      { name: '燕岳登山口', description: '北アルプス表銀座の起点が宿の目の前にある。登る人と湯だけを目当てに来る人が交ざる。' },
    ],
    featured_stay: { name: '中房温泉', catchcopy: '源泉三十六か所・湯船二十以上。燕岳登山口に立つ四月下旬から十一月下旬の宿', hasShuttle: false, accessStation: 'JR穂高駅' },
  },
  {
    id: 'kuronagi', name: '黒薙温泉', prefecture: '富山県',
    railGateway: '宇奈月温泉駅', airportGateway: '富山空港', hotelSearch: '黒薙温泉',
    bestSeason: '秋', requiresCar: false, tags: ['温泉', '一軒宿', '鉄道', '絶景'],
    catch: 'トロッコを降りて二十分歩く。宇奈月の湯は、ここから来ている。',
    description: '車では行けない。宇奈月からトロッコ電車に乗り、黒薙駅で降りて、山道を二十分ほど下る。着いた先の河原に二十八畳の露天風呂がある。源泉は九十八度、毎分四百七十九リットル。あまりに熱いので加水して使う。正保二年に発見され、慶応四年に加賀藩が開湯を許した古い湯で、大正十三年に引湯管が通ってからは、六キロ以上下流の宇奈月温泉のすべての宿がこの黒薙の湯を使っている。つまり宇奈月の源泉そのものだ。混浴の大露天のほかに女性専用の天女の湯がある。営業は黒部峡谷鉄道が走る五月から十一月下旬まで。冬は道ごと雪に埋まる。',
    spots: [
      { name: '二十八畳の河原露天', description: '黒薙川の渓谷に面した混浴の大露天。二十八畳の広さがあり、加水しても熱い源泉が注ぎ込む。' },
      { name: '後曳橋', description: '黒部峡谷鉄道の沿線で最も深い谷に架かる高さ約六十メートルの橋。トロッコの車窓から見える。' },
      { name: '駅からの山道', description: '黒薙駅から宿まで徒歩二十分ほど。この区間は歩くしかなく、それがそのまま秘湯の入口になる。' },
    ],
    featured_stay: { name: '黒薙温泉旅館', catchcopy: '宇奈月温泉の源泉を守る谷底の一軒宿。二十八畳の河原露天は五月から十一月だけ', hasShuttle: false, accessStation: '黒部峡谷鉄道 黒薙駅' },
  },
  {
    id: 'nigorigo', name: '濁河温泉', prefecture: '岐阜県',
    railGateway: '飛騨小坂駅', airportGateway: '中部国際空港', hotelSearch: '濁河温泉',
    bestSeason: '秋', requiresCar: true, tags: ['温泉', '秘湯', '登山', '自然'],
    catch: '標高千八百メートル。湧いた湯が、見ている間に濁っていく。',
    description: '標高千八百メートル。通年で営業する温泉地としては日本でも有数の高さにある。御嶽山の飛騨側の登山口で、明治二十年ごろから登山者のための宿として開かれた。湯は鉄分を含む炭酸水素塩泉で、湧いたときは透明でも空気に触れると茶褐色に濁っていく。源泉は五十三度前後、毎分六百リットル。旅館は数軒あり、原生林に囲まれた市営露天風呂もあるが、こちらは四月下旬から十一月上旬までの季節営業だ。県道の御嶽パノラマラインは冬も通れるが、路面が凍るのでスタッドレスかチェーンがいる。飛騨小坂駅から車で一時間、公共交通はあてにできない。',
    spots: [
      { name: '茶褐色の露天', description: '鉄分を含む湯が空気に触れて濁っていく。原生林に囲まれた露天で、湯の色の変化がよく見える。' },
      { name: '市営露天風呂', description: '四月下旬から十一月上旬までの季節営業。原生林の中にある公共の露天で、日帰りで入れる。' },
      { name: '御嶽山 飛騨口', description: '標高千八百メートルの登山基地で、ここから御嶽山の飛騨頂上へ向かう道が始まっている。' },
    ],
    featured_stay: { name: '濁河温泉 朝日荘', catchcopy: '標高千八百メートルで通年営業。空気に触れて茶褐色に変わる鉄泉の宿', hasShuttle: false, accessStation: 'JR飛騨小坂駅' },
  },
  {
    id: 'nishiyama-yama', name: '西山温泉', prefecture: '山梨県',
    railGateway: '身延駅', airportGateway: '静岡空港', hotelSearch: '西山温泉',
    bestSeason: '通年', requiresCar: true, tags: ['温泉', '歴史', '一軒宿', '自然'],
    catch: '西暦七〇五年創業。世界最古の宿としてギネスに載っている。',
    description: '西暦七〇五年創業。慶雲二年に藤原真人が川の岩間から噴く湯を見つけたのが始まりと伝わり、以来千三百年、同じ源泉が使われてきた。二〇一一年に世界最古の宿泊施設としてギネス世界記録に認定されている。自然に噴く源泉が毎分四百リットル、掘削した新源泉が千六百三十リットル、あわせて毎分二千リットルを超える湯が湧き、客室の風呂も給湯も加水加温なしの源泉かけ流しでまかなわれている。武田信玄や徳川家康の隠し湯だったとも伝わる。早川渓谷を見下ろす展望野天風呂は二〇二六年三月に改装された。日帰り入浴はなく、泊まった人だけが入れる。身延駅から送迎で五十分。',
    spots: [
      { name: '展望野天風呂', description: '早川渓谷を見下ろす源泉かけ流しの露天。二〇二六年三月の改装で新しく生まれ変わった。' },
      { name: '洞窟風呂の空間', description: '湯治宿だった時代の洞窟風呂を再現した施設。雨畑硯石を使った岩盤浴も併設されている。' },
      { name: '早川の渓谷', description: '南アルプスの山あいを流れる早川。宿へ向かう道は、この谷をひたすらさかのぼっていくことになる。' },
    ],
    featured_stay: { name: '西山温泉 慶雲館', catchcopy: '西暦七〇五年創業、ギネス認定の世界最古の宿。全館が源泉かけ流し', hasShuttle: true, accessStation: 'JR身延駅' },
  },
  {
    id: 'umegashima', name: '梅ヶ島温泉', prefecture: '静岡県',
    railGateway: '静岡駅', airportGateway: '静岡空港', hotelSearch: '梅ヶ島温泉',
    bestSeason: '秋', requiresCar: false, tags: ['温泉', '湯治', '滝', '自然'],
    catch: '安倍川をさかのぼった源流に、木造の宿が並んでいる。',
    description: '静岡駅からバスで一時間四十五分。安倍川をひたすらさかのぼった先、標高千メートル近い源流部に木造の宿が一直線に並ぶ。湯はpH九・六のアルカリ性単純硫黄泉で、源泉は三十九度と低く、無色透明でぬるりとする。源泉は十二本あり、百合の湯、黄金の湯、椿の湯といった名がそれぞれについている。応神天皇の時代に黄金湯の名を賜ったという伝承をもち、戦国期には武田信玄の隠し湯だったと伝わる。二〇一七年に梅ヶ島温泉郷として国民保養温泉地に指定された。宿は八軒ほど、家庭的な規模のまま残っている。落差八十五メートルの安倍の大滝までは歩いて四十分ほど。',
    spots: [
      { name: '安倍の大滝', description: '落差八十五メートル、日本の滝百選。吊り橋を三本渡る一・二キロの遊歩道を四十分ほど歩く。' },
      { name: '三段の滝', description: '温泉街の湯橋から五百メートル、歩いて十分足らず。三段に分かれて落ちる落差三十メートルの滝。' },
      { name: 'おゆのふるさと公園', description: '赤い橋を渡った先にある公園。源泉の湧く洞窟と湯之神社があり、無料の足湯も置かれている。' },
    ],
    featured_stay: { name: '梅ヶ島温泉 ホテル梅薫楼', catchcopy: '明治元年創業。安倍川源流のpH九・六のアルカリ性硫黄泉', hasShuttle: false, accessStation: 'JR静岡駅' },
  },
];

const built = [];
for (const e of E) {
  const c = COORD[e.id];
  const p = PREF[e.prefecture];
  const credit = creditOf(e.id);
  if (!c) throw new Error(`座標なし: ${e.id}`);
  if (!p) throw new Error(`県設定なし: ${e.prefecture}`);
  if (!credit) throw new Error(`画像クレジットなし: ${e.id}`);
  const base = byId(BASE[e.id]);

  const rec = {
    id: e.id, name: e.name, type: 'destination',
    region: base?.region ?? null, hub: base?.hub ?? null,
    stayAllowed: ['1night'], departures: base?.hub ? [base.hub] : [], weight: 1,
    description: e.description, tags: e.tags, spots: e.spots,
    shinkansenAccess: false, requiresCar: e.requiresCar, hotelSearch: e.hotelSearch,
    gateways: { rail: [e.railGateway], airport: [e.airportGateway], bus: [], ferry: [] },
    destType: 'onsen', railGateway: e.railGateway, busGateway: null, ferryGateway: null,
    airportGateway: e.airportGateway, prefecture: e.prefecture, lat: c.lat, lng: c.lng,
    stayBias: 1, city: c.city, situations: ['solo', 'couple'], catch: e.catch,
    mainSpot: e.spots[0].name, mapPoint: e.spots[0].name,
    representativeStation: e.railGateway, hubStation: e.railGateway, accessStation: e.railGateway,
    hotelArea: p.area, finalAccess: { type: e.requiresCar ? 'car' : 'walk' },
    travelTime: travelTimeFrom(e.id), stayRecommendation: '1night',
    tier: 'area', tier2: 'area', icCard: base?.icCard ?? 'suica',
    bestSeason: e.bestSeason, onsenLevel: 3, hasDirectFlight: false,
    primary: e.tags.slice(0, 2), secondary: e.tags.slice(2),
    reasonChips: ['温泉', 'ひとり旅向け', 'カップル向け', '1泊がおすすめ', ...(e.requiresCar ? [] : ['車なしOK'])],
    images: [`/images/${e.id}/main.jpg`], imageCredit: credit,
    hotelLinks: { rakuten: p.rakuten, jalan: p.jalan },
  };
  if (e.featured_stay) rec.featured_stay = e.featured_stay;
  built.push(rec);
}

for (const b of built) if (all.some((d) => d.id === b.id)) throw new Error(`id重複のため中止: ${b.id}`);
const out = all.concat(built);
fs.writeFileSync(DATA, JSON.stringify(out, null, 2) + '\n');
fs.writeFileSync('public/data/destinations.json', JSON.stringify(out, null, 2) + '\n');
console.log(`追加 ${built.length}件 / 総数 ${all.length} → ${out.length}\n`);
for (const b of built) {
  console.log(`  ${b.id.padEnd(17)} ${b.name.padEnd(7)} ${b.prefecture} desc=${b.description.length}字 tt=${Object.keys(b.travelTime).length}都市 ic=${b.icCard} stay=${b.featured_stay?.name ?? '（なし）'}`);
}
