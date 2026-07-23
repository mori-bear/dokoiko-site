// spot 2件の niche destination を作業用に一覧出力（3件目spot追加のための文脈）
import fs from 'fs';
const all = JSON.parse(fs.readFileSync('src/data/destinations.json', 'utf8'));
const targets = all.filter(d => /^niche_/.test(d.id) && (d.spots || []).length === 2);
const from = +process.env.FROM || 0;
const to = +process.env.TO || targets.length;
console.log(`対象 ${targets.length}件中 ${from}〜${Math.min(to, targets.length) - 1} を表示`);
for (const d of targets.slice(from, to)) {
  const foodHit = /グルメ|名物|食|味|うどん|そば|ラーメン|海鮮|寿司|酒|スイーツ|甘味/.test(d.description || '');
  console.log(`\n■${d.id}|${d.name}|${d.city || ''}|${d.prefecture}|食言及:${foodHit ? 'あり' : 'なし'}`);
  console.log(`本文: ${(d.description || '').slice(0, 220)}`);
  console.log(`既存spot: ${(d.spots || []).map(s => s.name).join(' / ')}`);
}
