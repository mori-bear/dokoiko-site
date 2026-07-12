import fs from 'fs';
const F = 'logs/vision_full_audit.json';
const r = JSON.parse(fs.readFileSync(F, 'utf8'));
let purged = 0;
for (const [k, v] of Object.entries(r)) {
  if (v.verdict === 'err' || v.reason === 'NO_RESULT') { delete r[k]; purged++; }
}
fs.writeFileSync(F, JSON.stringify(r, null, 1));
console.log(`err/NO_RESULT を ${purged} 件除去。残り確定 ${Object.keys(r).length} 件。再実行で未判定分のみ処理されます。`);
