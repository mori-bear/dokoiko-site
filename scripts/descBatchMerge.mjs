/**
 * descBatchMerge.mjs
 * description強化バッチの出力（output_XX.json 群）を検証して
 * src/data/destinations.json にマージする。
 *
 * 検証（1件でも失格したdestinationはマージせずレポートへ）:
 *   - id が存在する
 *   - description が 180〜330字
 *   - spots の件数・name が完全一致（順序も）
 *   - 各spot description が 35〜95字
 * マージ対象フィールドは description / spots[].description のみ。
 * それ以外のフィールドには一切触れない。
 *
 * 使い方: node scripts/descBatchMerge.mjs <出力ディレクトリ> <レポートパス>
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEST_FILE = path.join(__dirname, '../src/data/destinations.json');
const OUT_DIR = process.argv[2];
const REPORT = process.argv[3] || path.join(OUT_DIR, 'merge-report.json');

const destinations = JSON.parse(fs.readFileSync(DEST_FILE, 'utf-8'));
const destById = Object.fromEntries(destinations.map((d) => [d.id, d]));

const applied = [];
const rejected = [];
const seen = new Set();

const files = fs.readdirSync(OUT_DIR).filter((f) => /^output_\d+\.json$/.test(f)).sort();
for (const f of files) {
  let arr;
  try {
    arr = JSON.parse(fs.readFileSync(path.join(OUT_DIR, f), 'utf-8'));
  } catch (e) {
    rejected.push({ file: f, reason: `JSONパース失敗: ${e.message}` });
    continue;
  }
  for (const item of arr) {
    const why = [];
    const dest = destById[item.id];
    if (!dest) why.push('id不明');
    if (seen.has(item.id)) why.push('重複');
    const desc = item.description || '';
    if (desc.length < 180 || desc.length > 330) why.push(`desc字数=${desc.length}`);
    const srcSpots = dest?.spots || [];
    const newSpots = item.spots || [];
    if (dest && srcSpots.length !== newSpots.length) why.push(`spot数 ${newSpots.length}≠${srcSpots.length}`);
    if (dest && srcSpots.length === newSpots.length) {
      newSpots.forEach((s, i) => {
        if (s.name !== srcSpots[i].name) why.push(`spot[${i}]名不一致`);
        const sd = s.description || '';
        if (sd.length < 35 || sd.length > 95) why.push(`spot[${i}]字数=${sd.length}`);
      });
    }
    if (why.length) {
      rejected.push({ file: f, id: item.id, reasons: why });
      continue;
    }
    dest.description = desc;
    newSpots.forEach((s, i) => { srcSpots[i].description = s.description; });
    seen.add(item.id);
    applied.push(item.id);
  }
}

fs.writeFileSync(DEST_FILE, JSON.stringify(destinations, null, 1));
fs.writeFileSync(REPORT, JSON.stringify({ appliedCount: applied.length, rejectedCount: rejected.length, rejected }, null, 1));
console.log(`✅ マージ完了: 適用=${applied.length} / 却下=${rejected.length} / 全${destinations.length}件`);
console.log(`   レポート: ${REPORT}`);
