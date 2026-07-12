import fs from 'fs';
const a = JSON.parse(fs.readFileSync('logs/vision_full_audit.json', 'utf8'));
const rows = [];
let ok = 0, err = 0;
for (const [key, v] of Object.entries(a)) {
  if (v.verdict === 'ok') { ok++; continue; }
  if (v.verdict === 'err') { err++; continue; }
  rows.push({ key, issues: (v.issues || []).join(''), conf: v.confidence, reason: v.reason });
}
rows.sort((x, y) => (y.conf === 'high') - (x.conf === 'high') || x.key.localeCompare(y.key));
const L = ['# Vision画像監査 NG一覧', ''];
L.push(`- 総判定: ${ok + rows.length + err} / OK ${ok} / NG ${rows.length} / 未検証(残高切れ) ${err}`);
const iss = { A: 0, B: 0, C: 0 };
for (const r of rows) for (const c of r.issues) if (iss[c] != null) iss[c]++;
L.push(`- 観点: A場所/内容不一致 ${iss.A} ・ B焼込(テキスト/ロゴ/PR透かし) ${iss.B} ・ C構図(アスペクト/トリミング/帯) ${iss.C}`);
L.push(`- 確信度: high ${rows.filter(r => r.conf === 'high').length} / mid ${rows.filter(r => r.conf === 'mid').length}`, '');
L.push('| 画像 | 観点 | 確信 | 理由 |', '|---|---|---|---|');
for (const r of rows) L.push(`| ${r.key} | ${r.issues} | ${r.conf} | ${(r.reason || '').replace(/\|/g, '/').slice(0, 90)} |`);
fs.writeFileSync('logs/vision_ng_report.md', L.join('\n'));
console.log(`NGレポート出力: logs/vision_ng_report.md (${rows.length}行)`);
