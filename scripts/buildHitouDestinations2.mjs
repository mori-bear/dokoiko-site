#!/usr/bin/env node
/**
 * buildHitouDestinations2.mjs — 全国の温泉13件を destinations.json に追加する（第2バッチ）。
 *
 * 通過したゲート:
 *   座標 … Wikipedia / Wikidata P625 / OSM厳格Nominatim / 国土地理院 の4ソースから
 *          2つが5km以内で一致 ＋ 逆ジオコーディングで市町村照合
 *   画像 … Commonsメタ照合 → Haiku →（グレーのみ）Sonnet → 全点を目視
 *   営業 … Wikipedia→公式サイトの順に WebFetch して個別確認（2026-09-01時点）
 *
 * 不採用にしたもの:
 *   本谷温泉(愛媛) … 2026年4月に日帰り温浴施設としてリニューアルし宿泊不可。
 *                    西条市の宿泊施設一覧にも不在。宿として紹介できない
 *   下部温泉/田沢温泉/新穂高温泉/土湯温泉/西沢渓谷 … 画像の主題が合わない・規模条件外
 *
 * 季節営業は description に明記する。
 *   湯浜温泉 4月下旬〜11月上旬 ／ 湯俣温泉(晴嵐荘) 7月17日〜10月18日
 *   燕温泉の無料野天（黄金の湯・河原の湯）は冬季閉鎖
 */
import fs from 'fs';

const DATA = 'src/data/destinations.json';
const all = JSON.parse(fs.readFileSync(DATA, 'utf8'));
const byId = (id) => all.find((d) => d.id === id);

const PREF = {
  '北海道': { rakuten: 'https://travel.rakuten.co.jp/yado/hokkaido/', jalan: 'https://www.jalan.net/010000/', area: '北海道' },
  '岩手県': { rakuten: 'https://travel.rakuten.co.jp/yado/iwate/',    jalan: 'https://www.jalan.net/030000/', area: 'iwate' },
  '宮城県': { rakuten: 'https://travel.rakuten.co.jp/yado/miyagi/',   jalan: 'https://www.jalan.net/040000/', area: 'miyagi' },
  '秋田県': { rakuten: 'https://travel.rakuten.co.jp/yado/akita/',    jalan: 'https://www.jalan.net/050000/', area: 'akita' },
  '山形県': { rakuten: 'https://travel.rakuten.co.jp/yado/yamagata/', jalan: 'https://www.jalan.net/060000/', area: 'yamagata' },
  '福島県': { rakuten: 'https://travel.rakuten.co.jp/yado/fukushima/',jalan: 'https://www.jalan.net/070000/', area: 'fukushima' },
  '新潟県': { rakuten: 'https://travel.rakuten.co.jp/yado/niigata/',  jalan: 'https://www.jalan.net/ikisaki/map/niigata/', area: 'niigata' },
  '長野県': { rakuten: 'https://travel.rakuten.co.jp/yado/nagano/',   jalan: 'https://www.jalan.net/ikisaki/map/nagano/', area: 'nagano' },
  '奈良県': { rakuten: 'https://travel.rakuten.co.jp/yado/nara/',     jalan: 'https://www.jalan.net/290000/', area: 'nara' },
  '鳥取県': { rakuten: 'https://travel.rakuten.co.jp/yado/tottori/',  jalan: 'https://www.jalan.net/310000/', area: 'tottori' },
  '広島県': { rakuten: 'https://travel.rakuten.co.jp/yado/hiroshima/',jalan: 'https://www.jalan.net/340000/', area: 'hiroshima' },
};

const BASE = {
  'horoka': 'gen_北海_ぬかびら温泉', 'osawa-onsen': 'namari-onsen', 'yubama': 'kurikoma',
  'kanigasaki': 'kuroyu', 'utto': 'nyuto-onsen', 'seorasou': 'shinjou',
  'yunohana-fk': 'tokusa', 'tsubame-onsen': 'akakura-onsen', 'yumata': 'nakabusa',
  'kamikitayama': 'dorogawa-onsen', 'iwai-tottori': 'uradome', 'misasa2': 'misasa-onsen',
  'yuki-hiroshima': 'miyajima',
};
const travelTimeFrom = (id) => Object.fromEntries(
  Object.entries(byId(BASE[id])?.travelTime || {}).filter(([, v]) => typeof v === 'number' && v > 0 && v < 900));

const IMG = JSON.parse(fs.readFileSync('logs/hitou_images2.json', 'utf8')).adopted;
const creditOf = (id) => IMG.find((x) => x.id === id)?.credit ?? null;
const COORD = Object.fromEntries(JSON.parse(fs.readFileSync('logs/hitou_targets2.json', 'utf8'))
  .map((t) => [t.id, { lat: t.lat, lng: t.lng, city: t.city }]));

const E = [
  {
    id: 'horoka', name: '幌加温泉', prefecture: '北海道',
    railGateway: '帯広駅', airportGateway: 'とかち帯広空港', hotelSearch: '幌加温泉',
    bestSeason: '秋', requiresCar: true, tags: ['温泉', '一軒宿', '秘湯', '自然'],
    catch: '泉質の違う三つの湯船が、一列に並んでいる。',
    description: '十勝の奥、国道からわずかに入った林の中に宿が一軒だけ建っている。鹿の谷という名のこの宿には、成分の違う源泉が四つあり、混浴の内風呂にはナトリウム泉・鉄鉱泉・カルシウム泉の三つの湯船が一列に並ぶ。隣り合った湯に順に浸かると、湯の色も肌ざわりも違うのがはっきり分かる。露天にはまた別の源泉が引かれている。食事の提供はなく、泊まりは素泊まりの自炊のみ。かつては二軒あったが、もう一軒は湯守が亡くなって二〇一一年から休業したままだ。開湯は昭和二十一年ごろ。音更帯広インターから七十キロ、バスもあるが本数は少なく、実際には車で行く場所だ。',
    spots: [
      { name: '三つ並んだ内風呂', description: '混浴の内湯にナトリウム泉・鉄鉱泉・カルシウム泉の湯船が一列に並ぶ。順に入ると湯の違いが分かる。' },
      { name: '混浴の露天風呂', description: '内湯とは別の源泉が引かれている。林に囲まれ、季節によっては鹿が近くまで下りてくる。' },
      { name: '素泊まりの自炊', description: '食事の提供がなく、泊まるなら食材を持ち込む。売店も近くになく、買い出しは事前に済ませておく。' },
    ],
    featured_stay: { name: '幌加温泉湯元 鹿の谷', catchcopy: '四つの源泉をもつ十勝の一軒宿。素泊まり自炊のみの静かな湯', hasShuttle: false, accessStation: 'JR帯広駅' },
  },
  {
    id: 'osawa-onsen', name: '大沢温泉', prefecture: '岩手県',
    railGateway: '花巻駅', airportGateway: 'いわて花巻空港', hotelSearch: '大沢温泉',
    bestSeason: '秋', requiresCar: false, tags: ['温泉', '一軒宿', '湯治', '歴史'],
    catch: '豊沢川に張り出した露天は、いまも混浴のままだ。',
    description: '花巻南温泉峡の一軒宿で、旅館部の山水閣、湯治屋、それに茅葺きの菊水舘という三つの棟からなる。名物は豊沢川に張り出した混浴の露天風呂「大沢の湯」で、川面とほとんど同じ高さに湯船がある。泉質は弱アルカリ性の単純温泉。平安初期に坂上田村麻呂が見つけたと伝わり、宮沢賢治も学生時代から通った。湯治屋は今も自炊で長逗留ができる棟として現役だ。菊水舘は宿泊をやめてギャラリー「茅」になり、冬季は休館する。花巻駅からバスで大沢温泉まで直通、車なら花巻南インターから十五分ほど。',
    spots: [
      { name: '大沢の湯', description: '豊沢川に張り出した混浴の露天風呂。川面とほぼ同じ高さにあり、水の音がすぐそばで聞こえ続ける。' },
      { name: '湯治屋', description: '自炊で長逗留ができる棟が現役で残る。台所と共同の炊事場があり、数日単位で滞在する客が使う。' },
      { name: '菊水舘（ギャラリー茅）', description: '茅葺き屋根の古い棟。いまは宿泊をやめてギャラリーとして開いており、冬季は休館する。' },
    ],
    featured_stay: { name: '大沢温泉 山水閣', catchcopy: '豊沢川の露天「大沢の湯」をもつ花巻の一軒宿。湯治屋では自炊の長逗留も', hasShuttle: false, accessStation: 'JR花巻駅' },
  },
  {
    id: 'yubama', name: '湯浜温泉', prefecture: '宮城県',
    railGateway: 'くりこま高原駅', airportGateway: '仙台空港', hotelSearch: '湯浜温泉',
    bestSeason: '秋', requiresCar: true, tags: ['温泉', '一軒宿', '秘湯', '自然'],
    catch: '電気が通っていない。夜はランプの明かりだけになる。',
    description: '国道沿いの駐車場に車を置いて、山道を十分ほど下る。ぶな林の中に建つ三浦旅館は電気が通っておらず、自家発電を落とした夜はランプの明かりだけになる。テレビもラジオもなく、携帯の電波も届かない。湯は単純硫黄泉で、檜の内湯と露天がある。国道三九八号が冬に閉まるため、営業は四月下旬から十一月上旬まで。それ以外の季節、この宿には誰も入れない。二〇二六年で創業百五十年を迎えた。築館インターから九十分。連絡先は衛星電話で、宿に着くまで連絡もつかないと思っておいたほうがいい。',
    spots: [
      { name: 'ランプの灯り', description: '電気が通っておらず、自家発電を止めた夜は本当にランプだけになる。携帯の電波も届かない。' },
      { name: '檜の内湯と露天', description: '単純硫黄泉のかけ流し。ぶな林に面した露天からは、木の間を抜ける風の音しか聞こえない。' },
      { name: '駐車場からの山道', description: '国道沿いの駐車場から徒歩十分ほど下る。車では宿まで行けず、この道が唯一の入口になる。' },
    ],
    featured_stay: { name: 'ぶな林のランプの宿 湯浜温泉 三浦旅館', catchcopy: '電気の通らないランプの一軒宿。営業は四月下旬から十一月上旬まで', hasShuttle: false, accessStation: 'JRくりこま高原駅' },
  },
  {
    id: 'kanigasaki', name: '蟹場温泉', prefecture: '秋田県',
    railGateway: '田沢湖駅', airportGateway: '秋田空港', hotelSearch: '蟹場温泉',
    bestSeason: '秋', requiresCar: false, tags: ['温泉', '一軒宿', '秘湯', '自然'],
    catch: '宿から少し歩いた林の中に、唐子の湯がある。',
    description: '乳頭温泉郷の七湯のひとつで、宿は一軒だけ。名の由来は、近くの沢に蟹が多くいたことだという。源泉は蟹場硫黄と唐子の二本、いずれも五十四度前後の単純硫黄泉で、無色透明のまま湯船に注がれる。名物の混浴露天「唐子の湯」は本館から少し離れた林の中にあり、湯屋まで歩いていく道すがらだけで気分が変わる。夜の一時間は女性専用になる。ほかに木風呂と、ヒバの寝湯を備えた岩風呂、女性専用露天「ひなざくら」がある。弘化三年開湯。田沢湖駅からバスで五十五分、宿泊は通年だ。',
    spots: [
      { name: '混浴露天「唐子の湯」', description: '本館から離れた林の中にある。歩いてたどり着く湯屋で、夜の一時間は女性専用になる。' },
      { name: 'ヒバの寝湯', description: '岩風呂に併設された寝湯。ヒバの香りに包まれて、横になったまま湯に浸かっていられる。' },
      { name: '乳頭温泉郷の湯めぐり', description: '七湯のひとつで、ほかの宿の湯にも入れる湯めぐり帖がある。蟹場は郷の中でも奥まった位置。' },
    ],
    featured_stay: { name: '乳頭温泉郷 蟹場温泉', catchcopy: '弘化三年開湯。林の中の混浴露天「唐子の湯」をもつ一軒宿', hasShuttle: false, accessStation: 'JR田沢湖駅' },
  },
  {
    id: 'utto', name: '打当温泉', prefecture: '秋田県',
    railGateway: '阿仁マタギ駅', airportGateway: '大館能代空港', hotelSearch: '打当温泉',
    bestSeason: '冬', requiresCar: false, tags: ['温泉', '一軒宿', '文化', '冬'],
    catch: 'マタギの里の一軒宿で、どぶろくを飲む。',
    description: '秋田内陸線の阿仁マタギ駅から送迎で三分。熊を追う狩人マタギの集落に建つ一軒宿で、宿の名もそのまま「マタギの湯」という。湯はナトリウム・カルシウム塩化物泉、源泉五十六・六度をかけ流しにしている。宿にはどぶろく工房が併設されていて、ここでしか飲めない濁り酒がある。冬は雪が深く、除雪車が宿の前を行き来する。源泉を掘り当てたのは一九七八年、宿泊施設ができたのは一九八一年で、二〇〇〇年に今の名前になった。マタギ資料館が近くにあり、熊狩りの道具や毛皮が並ぶ。大曲インターから車で百十分。',
    spots: [
      { name: 'どぶろく工房', description: '宿に併設された工房で「幻のどぶろく」を仕込む。ここで醸したものを宿の食事と一緒に飲める。' },
      { name: '露天風呂', description: '五十六・六度の源泉をかけ流す。冬は雪に囲まれ、湯気の向こうに白い斜面だけが見える。' },
      { name: '阿仁マタギの里', description: '熊を追う狩人マタギの集落。資料館に狩りの道具や毛皮が並び、いまも猟が続いていることが分かる。' },
    ],
    featured_stay: { name: '打当温泉 マタギの湯', catchcopy: 'マタギの里の一軒宿。どぶろく工房を併設し、源泉かけ流しの湯をもつ', hasShuttle: true, accessStation: '秋田内陸線 阿仁マタギ駅' },
  },
  {
    id: 'seorasou', name: '瀬見温泉', prefecture: '山形県',
    railGateway: '瀬見温泉駅', airportGateway: '山形空港', hotelSearch: '瀬見温泉',
    bestSeason: '秋', requiresCar: false, tags: ['温泉', '湯治', '歴史', '街歩き'],
    catch: '弁慶が薙刀で岩を砕いて湧かせた、という湯。',
    description: '小国川のほとりに宿が六軒ほど並ぶ小さな温泉街で、木造の喜至楼が通りの真ん中に建っている。源義経の子の産湯を探した弁慶が、川辺の大岩を薙刀で砕いて湯を噴き出させた、という伝説が名の由来だ。泉質はナトリウム・カルシウムの塩化物・硫酸塩泉、泉温は六十八度と高い。共同浴場「せみの湯」には内湯と露天のほかに「ふかし湯」があり、温泉の蒸気を体に当てて温める全国でも珍しい入浴法が残っている。足湯の脇の源泉では温泉卵が作れる。陸羽東線の瀬見温泉駅から歩いて十分ほど。',
    spots: [
      { name: '共同浴場「せみの湯」', description: '内湯と別源泉の露天に加え、温泉の蒸気を体に当てる「ふかし湯」がある。全国でも珍しい設備。' },
      { name: '湯元 喜至楼', description: '通りの真ん中に建つ木造の旅館。この一棟が瀬見の温泉街の景観をそのまま形づくっている。' },
      { name: '弁慶ゆかりの薬研の湯', description: '弁慶が薙刀で岩を砕いて湯を出したと伝わる場所。約七十度の熱い湯が今も湧いている。' },
    ],
    featured_stay: { name: '湯元 喜至楼', catchcopy: '弁慶伝説の湯に建つ木造旅館。共同浴場「せみの湯」まで歩いてすぐ', hasShuttle: false, accessStation: 'JR瀬見温泉駅' },
  },
  {
    id: 'yunohana-fk', name: '湯ノ花温泉', prefecture: '福島県',
    railGateway: '会津高原尾瀬口駅', airportGateway: '福島空港', hotelSearch: '湯ノ花温泉',
    bestSeason: '秋', requiresCar: true, tags: ['温泉', '湯治', '秘湯', '自然'],
    catch: '三百円の券一枚で、四つの共同浴場を全部まわれる。',
    description: '集落に共同浴場が四つある。弘法の湯と湯端の湯は男女別、石湯と天神湯は混浴。どれも脱衣所があるだけの簡素な湯屋で、大人三百円の入浴券を一枚買えば、その日のうちなら四つ全部に入れる。券は集落の商店か民宿で買う。石湯は湯ノ岐川の川岸にあり、大岩をくり抜いた湯船に湯が満ちている。天神湯は湯ノ花大橋のたもと、清滝の湯を引いていて熱い。宿は民宿が五軒ほど、泊まれば共同浴場は無料になる。開湯は鎌倉時代と伝わる。会津高原尾瀬口駅からタクシーで三十分ほどかかる。',
    spots: [
      { name: '石湯', description: '湯ノ岐川の川岸にある混浴の共同浴場。大岩をくり抜いた湯船で、脱衣所しかない簡素な造り。' },
      { name: '天神湯', description: '湯ノ花大橋のたもとにある混浴の湯。清滝の湯から引いていて、四つの中でもとくに熱い。' },
      { name: '入浴券で四湯めぐり', description: '大人三百円の券を一枚買えば、その日のうちなら四つ全部に入れる。券は集落の商店か民宿で買う。' },
    ],
    featured_stay: { name: '民宿 山楽', catchcopy: '湯ノ花の民宿。泊まれば四つの共同浴場に無料で入れる', hasShuttle: false, accessStation: '会津高原尾瀬口駅' },
  },
  {
    id: 'tsubame-onsen', name: '燕温泉', prefecture: '新潟県',
    railGateway: '関山駅', airportGateway: '富山空港', hotelSearch: '燕温泉',
    bestSeason: '秋', requiresCar: false, tags: ['温泉', '秘湯', '登山', '絶景'],
    catch: '歩いて十五分の河原に、無料の混浴露天がある。',
    description: '妙高山の中腹、標高千百メートルほどの行き止まりに宿が四軒ほど身を寄せている。ここの目当ては二つの無料の野天風呂だ。黄金の湯は温泉街のすぐ上、男女別。河原の湯は谷を十五分ほど下った先にある混浴で、二〇二二年の橋の崩落で長く閉じていたが二〇二四年九月に復旧した。ただし道中の橋は今も仮設のままだ。どちらも積雪期は入れない。湯は含硫黄の炭酸水素塩・硫酸塩・塩化物泉で四十三・五度、白く濁る。弘法大師の発見と伝わり、岩ツバメが名の由来。関山駅から市営バスで二十分から三十分ほど。',
    spots: [
      { name: '河原の湯', description: '温泉街から谷を十五分ほど下った混浴の野天。無料だが積雪期は入れず、道中の橋は仮設のまま。' },
      { name: '黄金の湯', description: '温泉街のすぐ上にある男女別の野天風呂。無料で、日の出から日没まで。冬季は雪に埋まる。' },
      { name: '妙高山の登山口', description: '温泉街の突き当たりがそのまま登山道の入口になる。宿は前泊の拠点としても使われている。' },
    ],
    featured_stay: { name: '燕温泉 樺太館', catchcopy: '自家源泉かけ流しの宿。無料の野天「黄金の湯」まで歩いてすぐ', hasShuttle: false, accessStation: 'えちごトキめき鉄道 関山駅' },
  },
  {
    id: 'yumata', name: '湯俣温泉', prefecture: '長野県',
    railGateway: '信濃大町駅', airportGateway: '信州まつもと空港', hotelSearch: '湯俣温泉',
    bestSeason: '秋', requiresCar: false, tags: ['温泉', '秘湯', '登山', '自然'],
    catch: '高瀬ダムから三時間歩かないと、湯にたどり着けない。',
    description: '車では行けない。信濃大町から七倉ゲートまで車で三十分、そこからタクシーで高瀬ダムへ上がり、さらに沢沿いを三時間ほど歩いてようやく着く。湯俣川の河原に湧く単純硫黄泉は五十五度、河原を掘れば自分の湯船が作れる。すぐそばには国の天然記念物「高瀬渓谷の噴湯丘と球状石灰石」があり、白い塔のような噴湯丘から湯が吹き上がっている。宿は左岸の晴嵐荘と右岸の湯俣山荘の二軒で、どちらも山小屋だ。晴嵐荘の二〇二六年の営業は七月十七日から十月十八日まで。それ以外の季節は雪に閉ざされる。',
    spots: [
      { name: '噴湯丘', description: '国の天然記念物。白い塔のような石灰華の丘から湯が吹き上がる。晴嵐荘から歩いて十六分ほど。' },
      { name: '河原の手掘り露天', description: '湯俣川の河原を掘ると湯が湧いてくる。自分で湯船を作って浸かるのがここの流儀になっている。' },
      { name: '晴嵐荘の内湯', description: '源泉かけ流しの内湯をもつ山小屋。昭和二年に前身が開かれ、いまも三代にわたって続いている。' },
    ],
    featured_stay: { name: '湯俣温泉 晴嵐荘', catchcopy: '高瀬ダムから徒歩三時間の山小屋。二〇二六年の営業は七月十七日から十月十八日', hasShuttle: false, accessStation: 'JR信濃大町駅' },
  },
  {
    id: 'kamikitayama', name: '入之波温泉', prefecture: '奈良県',
    railGateway: '大和上市駅', airportGateway: '関西国際空港', hotelSearch: '入之波温泉',
    bestSeason: '秋', requiresCar: true, tags: ['温泉', '一軒宿', '秘湯', '自然'],
    catch: '析出物が固まって、湯船が木だと分からなくなっている。',
    description: '吉野川の上流、大迫ダムの湖畔に山鳩湯が一軒だけ建つ。ここの湯は毎分五百リットルが自噴するナトリウム炭酸水素塩・塩化物泉で、湧いたときは無色透明なのに、空気に触れると数時間で淡い黄褐色に変わる。露天は巨大なケヤキの丸太をくり抜いた湯船なのだが、析出物が年に一、二センチずつ固まっていって、いまでは木でできているとは思えない見た目になっている。内湯は総杉丸太造り。役小角の開湯伝説をもち、一九七三年の大迫ダム完成で旧温泉が水没したあと、掘り直して一九七七年に宿を開いた。大和上市駅からバスで六十分。',
    spots: [
      { name: 'ケヤキ丸太の露天', description: '巨大なケヤキをくり抜いた湯船。析出物が年に一、二センチ固まり、木の面影がほとんどない。' },
      { name: '総杉丸太造りの内湯', description: '毎分五百リットル自噴の湯を加水なしでかけ流す。湧いたときは透明で、やがて黄褐色に変わる。' },
      { name: '大迫ダムの湖畔', description: '宿の前に広がるダム湖。一九七三年の完成で旧温泉が沈み、掘り直して今の宿ができた。' },
    ],
    featured_stay: { name: '入之波温泉 山鳩湯', catchcopy: '析出物に覆われたケヤキ丸太の露天。全七室、毎分五百リットル自噴の一軒宿', hasShuttle: false, accessStation: '近鉄大和上市駅' },
  },
  {
    id: 'iwai-tottori', name: '岩井温泉', prefecture: '鳥取県',
    railGateway: '岩美駅', airportGateway: '鳥取空港', hotelSearch: '岩井温泉',
    bestSeason: '通年', requiresCar: false, tags: ['温泉', '湯治', '文化', '歴史'],
    catch: '手ぬぐいを頭に載せ、柄杓で湯をかぶって唄う。',
    description: '山陰では最も古い温泉のひとつとされ、宿は三軒だけ。ここには「湯かむり」という他所では見かけない風習が残っている。手ぬぐいを頭に被り、専用の長い柄杓で湯を叩きながら湯かむり唄を吟じ、その湯を頭からかぶるというものだ。泉質は硫酸塩泉、五十度。温泉街の入口には木のゲートが立ち、その先に木造三階建ての岩井屋が構えている。町営の共同浴場「ゆかむり温泉」があり、日帰りでも湯かむりを試せる。岩美駅からバスで十分ほど、鳥取市街から国道九号を東へ三十分。浦富海岸までは車で十分ほどの距離だ。',
    spots: [
      { name: '湯かむりの風習', description: '手ぬぐいを頭に被り、長い柄杓で湯を叩きながら唄を吟じて湯をかぶる。他所では見かけない作法。' },
      { name: '共同浴場「ゆかむり温泉」', description: '町営の共同浴場。宿泊しなくても湯かむり用の柄杓が置かれていて、作法を試すことができる。' },
      { name: '温泉街のゲートと岩井屋', description: '入口に木のゲートが立ち、その先に木造三階建ての旅館が構える。通り全体が短くまとまっている。' },
    ],
    featured_stay: { name: '岩井温泉 岩井屋', catchcopy: '山陰最古級の湯に建つ木造三階の宿。名物「湯かむり」の作法が残る', hasShuttle: false, accessStation: 'JR岩美駅' },
  },
  {
    id: 'misasa2', name: '関金温泉', prefecture: '鳥取県',
    railGateway: '倉吉駅', airportGateway: '鳥取空港', hotelSearch: '関金温泉',
    bestSeason: '通年', requiresCar: false, tags: ['温泉', '湯治', '歴史'],
    catch: '三朝に次ぐラジウム泉。無色透明で「白金の湯」と呼ぶ。',
    description: '三朝温泉から山ひとつ越えた先にある。ラドンを含む放射能泉で、含有量は三朝に次いで国内でも有数とされ、無色透明なことから古くは「銀の湯」、今は「白金の湯」と呼ばれてきた。源泉は四十度から六十二度。開湯伝説は複数あり、鶴が浸かっているのを行基が見つけ弘法大師が整えた、とも伝わる。江戸期は備中街道の関金宿として栄えた。共同浴場「関の湯」は二百円で入れて、地元の人が朝から通ってくる。日帰りのせきがね湯命館は月曜が休館。倉吉駅からバスで三十五分ほど、車なら二十分。',
    spots: [
      { name: '共同浴場「関の湯」', description: '小学生以上二百円のかけ流し。毎月一日と十五日が休みで、地元の人が朝から通ってくる。' },
      { name: 'せきがね湯命館', description: '日帰り入浴施設。日本の名湯百選に選ばれた白金の湯に入れる。月曜が休館日になっている。' },
      { name: '関金宿の街道筋', description: '江戸期は備中街道の宿場だった。温泉街というより、街道沿いの集落という佇まいが残る。' },
    ],
    featured_stay: { name: 'HOTEL星取テラスせきがね', catchcopy: '旧国民宿舎を建て替え二〇二五年開業。三朝に次ぐラジウム泉に浸かる', hasShuttle: false, accessStation: 'JR倉吉駅' },
  },
  {
    id: 'yuki-hiroshima', name: '湯来温泉', prefecture: '広島県',
    railGateway: '広島駅', airportGateway: '広島空港', hotelSearch: '湯来温泉',
    bestSeason: '秋', requiresCar: false, tags: ['温泉', '湯治', '自然'],
    catch: '広島市内なのに、バスで七十分かかる山あいの湯。',
    description: '広島市佐伯区、市内とは思えない山あいに湧く。泉質はアルカリ性の単純弱放射能温泉で、源泉は二十七度から二十八度と低く、加温して使う。開湯は大同年間と伝わり、慶長のころには芸陽で唯一の温泉場として賑わったという。中核になっているのは広島市の国民宿舎「湯来ロッジ」で、宿泊のほか日帰りでも入れる。かつての共同浴場はいったん閉じたが、二〇一九年に貸切の露天「誠の桧湯」として復活した。受付は湯来交流体験センターで、月曜が定休。五日市駅南口から広電バスで七十分ほどかかる。',
    spots: [
      { name: '貸切露天「誠の桧湯」', description: '二〇一九年に復活した源泉かけ流しの貸切露天。受付は湯来交流体験センターで、月曜が定休。' },
      { name: '湯来ロッジ', description: '広島市が運営する国民宿舎。宿泊のほか日帰り入浴もでき、湯来温泉の中核になっている。' },
      { name: '水内川の谷', description: '温泉街の前を流れる川。広島市内でありながら、バスで七十分かかる深い谷あいにある。' },
    ],
    featured_stay: { name: '広島市国民宿舎 湯来ロッジ', catchcopy: '広島市内の山あいに立つ国民宿舎。日帰り入浴もできる湯来温泉の中核', hasShuttle: false, accessStation: 'JR五日市駅' },
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
    featured_stay: e.featured_stay,
  };
  built.push(rec);
}
for (const b of built) if (all.some((d) => d.id === b.id)) throw new Error(`id重複のため中止: ${b.id}`);
const out = all.concat(built);
fs.writeFileSync(DATA, JSON.stringify(out, null, 2) + '\n');
fs.writeFileSync('public/data/destinations.json', JSON.stringify(out, null, 2) + '\n');
console.log(`追加 ${built.length}件 / 総数 ${all.length} → ${out.length}\n`);
for (const b of built) {
  console.log(`  ${b.id.padEnd(16)} ${b.name.padEnd(7)} ${b.prefecture.padEnd(4)} desc=${b.description.length}字 tt=${Object.keys(b.travelTime).length}都市 ic=${b.icCard} stay=${b.featured_stay.name}`);
}
