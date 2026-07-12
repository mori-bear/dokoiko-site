/**
 * buildNgLists.mjs — vision_full_audit.json の NG を refetch 用リストへ整形。
 * 出力:
 *   logs/ng_main.json  … main.jpg のNG（refetchVisionNG.mjs 形式 {id,name,prefecture,mainSpot,reason}）
 *   logs/ng_spot.json  … spot-N.jpg のNG（{id,name,prefecture,spotIndex,spotName,reason,confidence}）
 * 既定では confidence=high のみ（安全側）。全件は ALL=1 で。
 */
import fs from 'fs';
const audit = JSON.parse(fs.readFileSync('logs/vision_full_audit.json', 'utf8'));
const dests = JSON.parse(fs.readFileSync('src/data/destinations.json', 'utf8'));
const byId = Object.fromEntries(dests.map(d => [d.id, d]));
const ALL = process.env.ALL === '1';

const main = [], spot = [];
for (const [pathKey, v] of Object.entries(audit)) {
  if (v.verdict !== 'ng') continue;
  if (!ALL && v.confidence !== 'high') continue;
  const [id, file] = pathKey.split('/');
  const d = byId[id];
  if (!d) continue;
  const reason = `[${(v.issues || []).join('')}] ${v.reason}`;
  if (/main/i.test(file)) {
    main.push({ id, name: d.name, prefecture: d.prefecture, mainSpot: d.mainSpot, reason, confidence: v.confidence });
  } else {
    const sm = file.match(/spot-(\d+)/i);
    const idx = sm ? +sm[1] - 1 : -1;
    const sp = idx >= 0 && Array.isArray(d.spots) ? d.spots[idx] : null;
    spot.push({ id, name: d.name, prefecture: d.prefecture, file, spotIndex: idx,
      spotName: sp && (typeof sp === 'object' ? sp.name : sp) || '', reason, confidence: v.confidence });
  }
}
fs.writeFileSync('logs/ng_main.json', JSON.stringify(main, null, 1));
fs.writeFileSync('logs/ng_spot.json', JSON.stringify(spot, null, 1));
console.log(`NG整形 (${ALL ? '全件' : 'highのみ'}): main ${main.length} / spot ${spot.length}`);
const issueCount = { A: 0, B: 0, C: 0 };
for (const [, v] of Object.entries(audit)) if (v.verdict === 'ng') for (const is of (v.issues || [])) if (issueCount[is] != null) issueCount[is]++;
console.log(`観点別(全NG): A場所${issueCount.A} B焼込${issueCount.B} C構図${issueCount.C}`);
