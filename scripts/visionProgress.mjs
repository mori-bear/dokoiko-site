import fs from 'fs';
const r = JSON.parse(fs.readFileSync('logs/vision_full_audit.json', 'utf8'));
const e = Object.entries(r);
const ng = e.filter(([, v]) => v.verdict === 'ng');
const err = e.filter(([, v]) => v.verdict === 'err');
const byIssue = { A: 0, B: 0, C: 0 };
for (const [, v] of ng) for (const is of (v.issues || [])) if (byIssue[is] != null) byIssue[is]++;
console.log(`判定済 ${e.length}/3899 | NG ${ng.length} (A場所:${byIssue.A} B焼込:${byIssue.B} C構図:${byIssue.C}) | err ${err.length}`);
