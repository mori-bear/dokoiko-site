// featured_stay 全国展開: logs/triage_results/*.json を一括適用
// - id を destinations.json と照合（未知idはスキップして報告）
// - 既に featured_stay を持つ destination はスキップ（既存優先）
// - 同一宿名は最大2ページまで（3件目以降はスキップして報告）
// - imageQuery / 空jalanUrl は除去
import fs from 'fs';

const SRC = 'src/data/destinations.json';
const DIR = 'logs/triage_results';

const all = JSON.parse(fs.readFileSync(SRC, 'utf8'));
const byId = new Map(all.map(d => [d.id, d]));

// 既存 featured_stay の宿名出現数（重複制限は既存も含めてカウント）
const nameCount = new Map();
const norm = s => s.replace(/[\s　]/g, '');
for (const d of all) {
  if (d.featured_stay) {
    const k = norm(d.featured_stay.name);
    nameCount.set(k, (nameCount.get(k) || 0) + 1);
  }
}

let added = 0;
const skipped = { unknownId: [], hasStay: [], dup3rd: [] };

for (const f of fs.readdirSync(DIR).filter(f => f.endsWith('.json')).sort()) {
  const list = JSON.parse(fs.readFileSync(`${DIR}/${f}`, 'utf8'));
  for (const e of list) {
    const d = byId.get(e.id);
    if (!d) { skipped.unknownId.push(`${f}:${e.id}`); continue; }
    if (d.featured_stay) { skipped.hasStay.push(e.id); continue; }
    const k = norm(e.name);
    if ((nameCount.get(k) || 0) >= 2) { skipped.dup3rd.push(`${e.id}(${e.name})`); continue; }

    const entry = {
      name: e.name,
      catchcopy: e.catchcopy,
      hasShuttle: !!e.hasShuttle,
      accessStation: e.accessStation,
    };
    if (e.jalanUrl && /jalan\.net\/yad\d+/.test(e.jalanUrl)) entry.jalanUrl = e.jalanUrl;
    if (entry.hasShuttle && e.shuttleInfo) entry.shuttleInfo = e.shuttleInfo;
    if (entry.hasShuttle && !e.shuttleInfo) entry.hasShuttle = false;

    d.featured_stay = entry;
    nameCount.set(k, (nameCount.get(k) || 0) + 1);
    added++;
  }
}

fs.writeFileSync(SRC, JSON.stringify(all, null, 2));
const total = all.filter(d => d.featured_stay).length;
console.log(`新規適用 ${added}件 / 累計 featured_stay ${total}件`);
if (skipped.unknownId.length) console.log('未知id:', skipped.unknownId.join(', '));
if (skipped.hasStay.length) console.log(`既存ありスキップ: ${skipped.hasStay.length}件`);
if (skipped.dup3rd.length) console.log('3件目重複スキップ:', skipped.dup3rd.join(', '));
