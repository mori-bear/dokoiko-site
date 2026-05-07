import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const articlesDir = path.join(__dirname, '../src/data/articles');

// ルール定義（適用順が重要: 複合パターンを先に）
const RULES = [
  // ── だと〜 複合パターン（先に処理） ──
  { label: 'だと思っていた→だ',    from: /だと思っていた/g,    to: 'だ' },
  { label: 'だと思っている→だ',    from: /だと思っている/g,    to: 'だ' },
  { label: 'だと思う→だ',          from: /だと思う/g,          to: 'だ' },
  { label: 'だと思った→だ',        from: /だと思った/g,        to: 'だ' },
  { label: 'だと感じた→だ',        from: /だと感じた/g,        to: 'だ' },

  // ── かもしれない ──
  { label: 'なのかもしれない→だ',  from: /なのかもしれない/g,  to: 'だ' },
  { label: 'のかもしれない→だ',    from: /のかもしれない/g,    to: 'だ' },
  { label: 'かもしれない→だ',      from: /かもしれない/g,      to: 'だ' },

  // ── と思った / と思う（文末のみ・文中削除はリスク大のため除外） ──
  { label: '、と思った。→。',       from: /、と思った。/g,       to: '。' },
  { label: 'と思った。→。',         from: /と思った。/g,         to: '。' },
  { label: 'と思っていた。→。',     from: /と思っていた。/g,     to: '。' },
  { label: 'と思う。→。',           from: /と思う。/g,           to: '。' },

  // ── と感じた ──
  { label: 'と感じた。→。',         from: /と感じた。/g,         to: '。' },
  { label: 'と感じた、→、',         from: /と感じた、/g,         to: '、' },
  { label: 'と感じた→削除',         from: /と感じた/g,           to: '' },

  // ── に驚いた（名詞+に のみ・素直に などの副詞誤マッチを回避） ──
  // 安全策: 句読点・スペース・改行・助詞の後の「に驚いた」のみ対象
  { label: 'に驚いた。→だ。',       from: /([^\s一-龯ぁ-んァ-ヶa-zA-Z])に驚いた。/g, to: '$1だ。' },
  { label: 'に驚いた→削除',         from: /([^\s一-龯ぁ-んァ-ヶa-zA-Z])に驚いた/g,  to: '$1' },

  // ── だった → だ（文末・行末・改行前） ──
  { label: 'だった。→だ。',         from: /だった。/g,           to: 'だ。' },
  { label: 'だった+改行→だ+改行',   from: /だった\n/g,           to: 'だ\n' },
  { label: 'だった行末→だ',         from: /だった$/gm,           to: 'だ' },

  // ── なかった → ない（文末・行末・改行前） ──
  { label: 'なかった。→ない。',      from: /なかった。/g,          to: 'ない。' },
  { label: 'なかった+改行→ない+改行',from: /なかった\n/g,          to: 'ない\n' },
  { label: 'なかった行末→ない',      from: /なかった$/gm,          to: 'ない' },

  // ── ていた → ている（過去進行形 → 現在進行形） ──
  { label: 'ていた。→ている。',      from: /ていた。/g,            to: 'ている。' },
  { label: 'ていた+改行→ている+改行',from: /ていた\n/g,            to: 'ている\n' },
  { label: 'ていた行末→ている',      from: /ていた$/gm,            to: 'ている' },

  // ── してみた → する / してみてほしい → してほしい ──
  { label: 'してみてほしい→してほしい', from: /してみてほしい/g,  to: 'してほしい' },
  { label: 'してみてください→してください', from: /してみてください/g, to: 'してください' },
  { label: 'してみた→する',          from: /してみた/g,           to: 'する' },
];

// 再帰的に全stringフィールドにルール適用
function applyRulesToValue(value, counts) {
  if (typeof value === 'string') {
    let result = value;
    for (const rule of RULES) {
      const matches = result.match(rule.from);
      if (matches) {
        counts[rule.label] = (counts[rule.label] || 0) + matches.length;
        result = result.replace(rule.from, rule.to);
      }
    }
    return result;
  }
  if (Array.isArray(value)) return value.map(v => applyRulesToValue(v, counts));
  if (value && typeof value === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value)) out[k] = applyRulesToValue(v, counts);
    return out;
  }
  return value;
}

// メイン処理
const files = fs.readdirSync(articlesDir).filter(f => f.endsWith('.json'));
const totalCounts = {};
let modifiedFiles = 0;
let skippedFiles = 0;

for (const file of files) {
  const filepath = path.join(articlesDir, file);
  const raw = fs.readFileSync(filepath, 'utf8');
  let parsed;
  try { parsed = JSON.parse(raw); }
  catch { skippedFiles++; continue; }

  const fileCounts = {};
  const rewritten = applyRulesToValue(parsed, fileCounts);
  const changed = Object.keys(fileCounts).length > 0;

  if (changed) {
    fs.writeFileSync(filepath, JSON.stringify(rewritten, null, 2) + '\n', 'utf8');
    modifiedFiles++;
    for (const [label, count] of Object.entries(fileCounts)) {
      totalCounts[label] = (totalCounts[label] || 0) + count;
    }
  }
}

// レポート出力
const totalReplacements = Object.values(totalCounts).reduce((a, b) => a + b, 0);
console.log(`\n===== 文体リライト完了 =====`);
console.log(`処理ファイル: ${files.length}件 → 変更あり: ${modifiedFiles}件 / 変更なし: ${files.length - modifiedFiles - skippedFiles}件`);
console.log(`\n置換件数（ルール別）:`);
for (const [label, count] of Object.entries(totalCounts).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${String(count).padStart(5)}件  ${label}`);
}
console.log(`\n合計置換: ${totalReplacements}件`);
