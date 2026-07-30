// featured_stay バッチ適用: node scripts/applyStayBatch.mjs scripts/stays/batchN.mjs
import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';

const mod = await import(pathToFileURL(path.resolve(process.argv[2])).href);
const STAYS = mod.default;
const SRC = 'src/data/destinations.json';
const all = JSON.parse(fs.readFileSync(SRC, 'utf8'));
const credits = JSON.parse(fs.readFileSync('logs/featured_stay_credits.json', 'utf8'));

let added = 0;
for (const d of all) {
  const stay = STAYS[d.id];
  if (!stay) continue;
  const entry = { ...stay };
  if (!entry.image) { delete entry.image; }
  else entry.imageCredit = credits[d.id] || null;
  Object.keys(entry).forEach(k => entry[k] == null && delete entry[k]);
  d.featured_stay = entry;
  added++;
}
fs.writeFileSync(SRC, JSON.stringify(all, null, 2));
const total = all.filter(d => d.featured_stay).length;
console.log(`適用 ${added}件 / 累計 featured_stay ${total}件`);
