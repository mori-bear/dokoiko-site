// scripts/prefectureCoverage.mjs
//
// destinations.json を都道府県別に集計し、件数が薄いエリアを洗い出す。
// 拡充の優先順位を「件数」だけで決めると人口や観光需要を無視してしまうので、
// 人口規模と観光地としての位置づけも並べて判断材料にする。
//
// 使い方:
//   node scripts/prefectureCoverage.mjs
//   node scripts/prefectureCoverage.mjs --threshold 10
//   node scripts/prefectureCoverage.mjs --json      # 機械可読で出す

import fs from 'node:fs';
import path from 'node:path';

const SRC = path.join(process.cwd(), 'src/data/destinations.json');

// 47都道府県（北から）。データ側に無い県を「0件」として検出するために全量を持つ。
const PREFS = [
  '北海道','青森県','岩手県','宮城県','秋田県','山形県','福島県',
  '茨城県','栃木県','群馬県','埼玉県','千葉県','東京都','神奈川県',
  '新潟県','富山県','石川県','福井県','山梨県','長野県','岐阜県','静岡県','愛知県',
  '三重県','滋賀県','京都府','大阪府','兵庫県','奈良県','和歌山県',
  '鳥取県','島根県','岡山県','広島県','山口県',
  '徳島県','香川県','愛媛県','高知県',
  '福岡県','佐賀県','長崎県','熊本県','大分県','宮崎県','鹿児島県','沖縄県',
];

// 総務省 住民基本台帳（2025年1月1日）ベースの概数[万人]。
// 「件数が少ない＝拡充すべき」ではなく「人口の割に少ない」を見るための分母。
const POP = {
  北海道:505,青森県:117,岩手県:114,宮城県:224,秋田県:90,山形県:100,福島県:174,
  茨城県:283,栃木県:190,群馬県:190,埼玉県:733,千葉県:625,東京都:1408,神奈川県:922,
  新潟県:211,富山県:99,石川県:110,福井県:74,山梨県:79,長野県:198,岐阜県:191,静岡県:353,愛知県:748,
  三重県:171,滋賀県:140,京都府:250,大阪府:876,兵庫県:537,奈良県:128,和歌山県:88,
  鳥取県:53,島根県:64,岡山県:183,広島県:271,山口県:129,
  徳島県:69,香川県:92,愛媛県:128,高知県:66,
  福岡県:512,佐賀県:79,長崎県:126,熊本県:170,大分県:109,宮崎県:104,鹿児島県:154,沖縄県:147,
};

const args = process.argv.slice(2);
const threshold = Number(args[args.indexOf('--threshold') + 1]) || 10;
const asJson = args.includes('--json');

const items = JSON.parse(fs.readFileSync(SRC, 'utf8'));

// prefecture が空の行は集計から漏れると実態を見誤るので、別枠で数える。
// 「長野県・岐阜県」のように県をまたぐ行があるため、区切り文字で分割して両方に計上する
// （どちらの県から見ても行き先として存在するのが実態に近いため）。
const counts = new Map(PREFS.map((p) => [p, 0]));
const unknown = [];
const multi = [];
for (const d of items) {
  const raw = (d.prefecture || '').trim();
  const parts = raw.split(/[・、,\/／]/).map((x) => x.trim()).filter(Boolean);
  const hit = parts.filter((x) => counts.has(x));
  if (hit.length === 0) {
    unknown.push({ id: d.id, name: d.name, prefecture: raw || null, region: d.region ?? null });
    continue;
  }
  if (hit.length > 1) multi.push({ id: d.id, name: d.name, prefectures: hit });
  for (const h of hit) counts.set(h, counts.get(h) + 1);
}

const rows = PREFS.map((p) => {
  const n = counts.get(p);
  const pop = POP[p];
  return { prefecture: p, count: n, pop, per100man: pop ? +(n / pop * 100).toFixed(1) : null };
});

if (asJson) {
  console.log(JSON.stringify({ total: items.length, rows, unknown }, null, 2));
  process.exit(0);
}

const total = items.length;

// 地方ブロック別の内訳（どのブロックが薄いかを掴む）
const regionCount = new Map();
for (const d of items) {
  const r = (d.region || '(未設定)').trim();
  regionCount.set(r, (regionCount.get(r) || 0) + 1);
}

console.log(`■ destinations.json 都道府県別集計`);
console.log(`  総件数 ${total} / 県をまたぐ行 ${multi.length}（各県に重複計上）/ 判定不能 ${unknown.length}`);
console.log('');
console.log('  地方ブロック別');
[...regionCount.entries()].sort((a, b) => b[1] - a[1]).forEach(([r, n]) => {
  console.log(`    ${r.padEnd(8)} ${String(n).padStart(4)}件`);
});
console.log('');
console.log('  件数の多い順');
[...rows].sort((a, b) => b.count - a.count).forEach((r, i) => {
  if (i < 10) console.log(`    ${String(i + 1).padStart(2)}. ${r.prefecture.padEnd(5)} ${String(r.count).padStart(4)}件`);
});
console.log('');
console.log('  件数の少ない順（下位15）');
[...rows].sort((a, b) => a.count - b.count).slice(0, 15).forEach((r, i) => {
  console.log(`    ${String(i + 1).padStart(2)}. ${r.prefecture.padEnd(5)} ${String(r.count).padStart(3)}件  人口${String(r.pop).padStart(4)}万人  100万人あたり${String(r.per100man).padStart(5)}件`);
});
console.log('');
console.log(`  ${threshold}件未満の都道府県`);
const thin = rows.filter((r) => r.count < threshold).sort((a, b) => a.count - b.count);
if (thin.length === 0) console.log('    なし');
thin.forEach((r) => {
  console.log(`    ${r.prefecture.padEnd(5)} ${String(r.count).padStart(3)}件  人口${String(r.pop).padStart(4)}万人  100万人あたり${String(r.per100man).padStart(5)}件`);
});
console.log('');
console.log('  100万人あたり件数が少ない順（人口の割に薄いエリア）');
[...rows].filter((r) => r.per100man !== null)
  .sort((a, b) => a.per100man - b.per100man)
  .slice(0, 12)
  .forEach((r, i) => {
    console.log(`    ${String(i + 1).padStart(2)}. ${r.prefecture.padEnd(5)} ${String(r.count).padStart(3)}件  人口${String(r.pop).padStart(4)}万人  100万人あたり${String(r.per100man).padStart(5)}件`);
  });

if (multi.length) {
  console.log('');
  console.log(`  県をまたぐ行（${multi.length}件・両県に計上済み）`);
  multi.forEach((m) => console.log(`    ${String(m.id).padEnd(20)} ${String(m.name).padEnd(14)} ${m.prefectures.join(' / ')}`));
  console.log('    ※ prefecture 列は「長野県・岐阜県」のような連結文字列。県コードで完全一致');
  console.log('       フィルタしている箇所があると、この4件がどちらの県でもヒットしない恐れがある。');
}

if (unknown.length) {
  console.log('');
  console.log(`  prefecture が未設定/不正な行（${unknown.length}件・先頭20件）`);
  unknown.slice(0, 20).forEach((u) => {
    console.log(`    ${String(u.id).padEnd(28)} ${String(u.name).padEnd(22)} prefecture=${u.prefecture} region=${u.region}`);
  });
}
