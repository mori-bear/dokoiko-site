/**
 * auditSeoLinks.mjs — Task3(alt/meta) + Task5(tags) の機械監査（ネットワーク無し・無料）
 * meta description の空/重複、tags/reasonChips 0件、hero alt が汎用に落ちる件数を集計。
 * 出力: logs/seo_audit.json
 */
import fs from 'fs';
const dests = JSON.parse(fs.readFileSync('src/data/destinations.json', 'utf8'));

// astro [id].astro の meta description ロジックを再現
function toMeta(text) {
  if (!text) return '';
  if (text.length <= 130) return text;
  const head = text.slice(0, 130);
  const cut = head.lastIndexOf('。');
  return cut >= 60 ? head.slice(0, cut + 1) : head.slice(0, 118) + '…';
}
function metaOf(d) {
  return toMeta(d.description) || `${d.name}（${d.prefecture}）への行き方・宿・観光スポット情報。`;
}

const seen = new Map();
let noDesc = 0, shortDesc = 0, genericFallback = 0, noTags = 0, noChips = 0, heroGeneric = 0;
const dupGroups = {};
for (const d of dests) {
  const m = metaOf(d);
  if (!d.description) { noDesc++; genericFallback++; }
  else if (d.description.length < 60) shortDesc++;
  if (!d.tags || d.tags.length === 0) noTags++;
  if (!d.reasonChips || d.reasonChips.length === 0) noChips++;
  if (!d.mainSpot) heroGeneric++;   // hero alt が "◯◯の風景" に落ちる
  const key = m.trim();
  if (!seen.has(key)) seen.set(key, []);
  seen.get(key).push(d.id);
}
for (const [k, ids] of seen) if (ids.length > 1) dupGroups[k.slice(0, 40)] = ids;

const report = {
  total: dests.length,
  metaEmptyOrGeneric: genericFallback,
  descMissing: noDesc,
  descShort: shortDesc,
  metaDuplicateGroups: Object.keys(dupGroups).length,
  metaDuplicateSample: Object.fromEntries(Object.entries(dupGroups).slice(0, 15)),
  tagsZero: noTags,
  reasonChipsZero: noChips,
  heroAltGeneric_noMainSpot: heroGeneric,
};
fs.writeFileSync('logs/seo_audit.json', JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
