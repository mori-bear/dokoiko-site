import fs from 'fs';
const r = JSON.parse(fs.readFileSync('logs/vision_full_audit.json', 'utf8'));
const reasons = {};
let ok = 0, ng = 0, err = 0;
for (const [, v] of Object.entries(r)) {
  if (v.verdict === 'err') { err++; const key = (v.reason || '').slice(0, 45); reasons[key] = (reasons[key] || 0) + 1; }
  else if (v.verdict === 'ng') ng++;
  else ok++;
}
console.log(`ok ${ok} / ng ${ng} / err ${err}`);
console.log('=== err理由内訳 ===');
for (const [k, c] of Object.entries(reasons).sort((a, b) => b[1] - a[1])) console.log(`  ${c}\t${k}`);
