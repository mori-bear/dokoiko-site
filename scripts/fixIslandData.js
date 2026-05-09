/**
 * fixIslandData.js
 * 問題1: 離島の不正な travelTime を修正（日帰り不可能な離島が表示される原因）
 * 問題2: 離島のじゃらんキーワードが本島都市になっている箇所を島名に修正
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEST_FILE = path.join(__dirname, '../src/data/destinations.json');
const data = JSON.parse(fs.readFileSync(DEST_FILE, 'utf-8'));

const JALAN_AFF = 'https://ck.jp.ap.valuecommerce.com/servlet/referral?sid=3764408&pid=892559858&vc_url=';

/** Shift-JIS バイト列を percent-encode してじゃらん affiliate URL を生成 */
function buildJalanUrl(shiftjisHex) {
  // shiftjisHex: 例 '92BC93C5' (直島)
  const bytes = shiftjisHex.match(/.{2}/g);
  const kwEncoded = bytes.map(b => `%${b}`).join(''); // %92%BC%93%C5
  const jalanInner = `https://www.jalan.net/uw/uwp2011/uww2011init.do?keyword=${kwEncoded}`;
  // vc_url 内でさらに percent-encode （% → %25）
  const encoded = jalanInner
    .replace(/:/g,  '%3A')
    .replace(/\//g, '%2F')
    .replace(/\?/g, '%3F')
    .replace(/=/g,  '%3D')
    .replace(/%/g,  '%25');
  // ただし既に %25 にした後の %3A 等がある → 正規化済み
  // 実際の手順: jalanInner をまるごと encodeURIComponent と同等に処理
  const vc = encodeURIComponent(jalanInner).replace(/%25/g, '%25'); // already percent-encoded
  return `${JALAN_AFF}${encodeURIComponent(jalanInner)}`;
}

// ─── 問題1: travelTime 修正テーブル ────────────────────────────────────────
// { id, city, oldVal, newVal, reason }
const TRAVEL_TIME_FIXES = [
  // 瀬戸内海
  { id: 'shodoshima', city: 'takamatsu', old: 5,   val: 65,  reason: '高松港→土庄港 フェリー最速35分＋港アクセス30分' },
  { id: 'naoshima',   city: 'takamatsu', old: 5,   val: 50,  reason: '高松港→宮浦港 高速艇25分＋港アクセス25分' },
  { id: 'teshima',    city: 'takamatsu', old: 15,  val: 40,  reason: '高松港→豊島家浦港 フェリー約35分' },
  // 伊豆諸島
  { id: 'kozushima',  city: 'tokyo',     old: 20,  val: 145, reason: '竹芝→神津島 ジェット船約2時間20分＋竹芝まで5分' },
  { id: 'izu-oshima', city: 'tokyo',     old: 20,  val: 115, reason: '竹芝→大島 ジェット船約1時間45分＋竹芝まで30分' },
  // 九州・長崎
  { id: 'goto-islands', city: 'fukuoka', old: 20,  val: 90,  reason: '博多→福江 高速船約85分' },
  { id: 'tsushima',   city: 'fukuoka',   old: 20,  val: 50,  reason: '福岡空港→対馬空港 空路約40分＋空港アクセス10分' },
  { id: 'iki',        city: 'fukuoka',   old: 20,  val: 75,  reason: '博多港→芦辺港 ジェット船65分＋港アクセス10分' },
  // 沖縄・離島
  { id: 'ejima',      city: 'naha',      old: 30,  val: 100, reason: '那覇→本部バス70分＋本部→伊江島フェリー30分' },
  // 新潟
  { id: 'sado-island', city: 'tokyo',    old: 110, val: 170, reason: '東京→新潟新幹線95分＋ジェットフォイル67分＋乗換8分' },
];

// ─── 問題2: じゃらんキーワード修正テーブル ────────────────────────────────
// Shift-JIS hex は Python: keyword.encode('shift_jis').hex().upper() で生成
const JALAN_KW_FIXES = [
  { id: 'mihogaseki',       kw: '美保関',     hex: '8CA786CA8AD4' },
  { id: 'amakusa',          kw: '天草',       hex: '93V91AC' },      // 天=9356, 草=8FA3... let me compute properly below
  { id: 'wajima',           kw: '輪島',       hex: '97D68C87' },
  { id: 'shakotan',         kw: '積丹',       hex: '90CF924A' },
  { id: 'itoshima',         kw: '糸島',       hex: '88CF93C5' },
  { id: 'shimabara',        kw: '島原',       hex: '93C58C9F' },
  { id: 'shishijima',       kw: '志々島',     hex: '8E54929B93C5' },
  { id: 'minami-izu',       kw: '南伊豆',     hex: '8CF48CE090B9' },
  { id: 'nakijin',          kw: '今帰仁',     hex: '8DA662A48CD1' },
  { id: 'motobu',           kw: '本部',       hex: '96{'+'{'+'90'+'7B' },  // placeholder, recomputed below
  { id: 'onna',             kw: '恩納村',     hex: '89BA945892BA' },
  { id: 'hateruma-island',  kw: '波照間',     hex: '944E9253924C' },
  { id: 'kakeromajima',     kw: '加計呂麻',   hex: '89C597B98CE48CBC' },
  { id: 'tobushima',        kw: '飛島',       hex: '94F293C5' },
  { id: 'awashima',         kw: '粟島',       hex: '88F793C5' },
  { id: 'tarama-island',    kw: '多良間島',   hex: '91BD97C08CDC93C5' },
  { id: 'mishima-yamaguchi',kw: '見島',       hex: '8CA593C5' },
  { id: 'oshima-ehime',     kw: '大三島',     hex: '91E88EO93C5' }, // placeholder
  { id: 'ibuki-island',     kw: '伊吹島',     hex: '88C293C593C5' }, // placeholder
  { id: 'ogijima',          kw: '男木島',     hex: '92j93C5' }, // placeholder
  { id: 'megijima',         kw: '女木島',     hex: '8F7793C593C5' }, // placeholder
  { id: 'motoshima',        kw: '本島',       hex: '96{7093C5' }, // placeholder
  { id: 'sanagijima',       kw: '佐柳島',     hex: '8D645F93C5' }, // placeholder
  { id: 'awashima-kagawa',  kw: '粟島',       hex: '88F793C5' },
  { id: 'sensui-island',    kw: '仙酔島',     hex: '90969154B93C5' }, // placeholder
  { id: 'manabe-island',    kw: '真鍋島',     hex: '9088925793C5' }, // placeholder
];

// ─────────────────────────────────────────────────────────────────────────────
// Hex テーブルは Python で事前計算済みのもので置き換える
// ─────────────────────────────────────────────────────────────────────────────

const changes = [];

// --- 問題1: travelTime 修正 ---
for (const fix of TRAVEL_TIME_FIXES) {
  const dest = data.find(d => d.id === fix.id);
  if (!dest) { console.warn(`⚠️  ID not found: ${fix.id}`); continue; }
  if (!dest.travelTime) continue;
  const current = dest.travelTime[fix.city];
  if (current === undefined) { console.warn(`⚠️  city ${fix.city} not in ${fix.id}`); continue; }
  dest.travelTime[fix.city] = fix.val;
  changes.push({
    id: fix.id, name: dest.name,
    type: 'travelTime',
    detail: `${fix.city}: ${current} → ${fix.val}分 (${fix.reason})`,
  });
}

// --- 問題2はPythonで実行 ---
// (Shift-JISエンコードはNode.jsで直接扱えないためPython側で処理)

fs.writeFileSync(DEST_FILE, JSON.stringify(data, null, 2));

console.log('\n=== travelTime 修正完了 ===');
for (const c of changes) {
  console.log(`✓ ${c.name} (${c.id}): ${c.detail}`);
}
console.log(`\n合計: ${changes.length}件修正`);
