#!/usr/bin/env node
/**
 * applyNicheCoordFixes.mjs — 4ソースで裏を取れた座標誤りを反映する。
 *
 * 反映するのは logs/niche_gap_verify.json で
 *   ・独立2ソースが5km以内で一致した点が出ている
 *   ・登録値との距離が400mを超える
 * ものだけ。判定できなかったものは触らない。
 *
 * 移動後に3km以内の既存エントリが現れないかも見る。
 * 別の旅先の真上に移ってしまうと、重複扱いになるため。
 */
import fs from 'fs';
const DATA = ['src/data/destinations.json', 'public/data/destinations.json'];
const km = (a, b, c, d) => Math.hypot((a - c) * 111, (b - d) * 111 * Math.cos((a * Math.PI) / 180));

const verify = JSON.parse(fs.readFileSync('logs/niche_gap_verify.json', 'utf8'));
const fixes = verify.filter((x) => x.fix && x.gapM > 400);
console.log(`■ 反映対象 ${fixes.length}件`);

const base = JSON.parse(fs.readFileSync(DATA[0], 'utf8'));
for (const f of fixes) {
  const [lat, lng] = f.fix;
  const near = base.filter((d) => d.id !== f.id && typeof d.lat === 'number')
    .map((d) => ({ name: d.name, km: km(lat, lng, d.lat, d.lng) }))
    .filter((x) => x.km < 3).sort((a, b) => a.km - b.km);
  f.nearAfter = near.map((x) => `${x.name}(${x.km.toFixed(1)}km)`);
}

let applied = 0;
for (const file of DATA) {
  const all = JSON.parse(fs.readFileSync(file, 'utf8'));
  for (const f of fixes) {
    const d = all.find((x) => x.id === f.id);
    if (!d) { console.log(`⚠️ ${f.id} が無い`); continue; }
    d.lat = f.fix[0]; d.lng = f.fix[1];
    if (file === DATA[0]) applied++;
  }
  fs.writeFileSync(file, JSON.stringify(all, null, 2) + '\n');
}

for (const f of fixes.sort((a, b) => b.gapM - a.gapM)) {
  console.log(`  ${String(f.gapM).padStart(6)}m ${f.id.padEnd(16)} ${f.name.padEnd(20)} ${f.agree}`);
  console.log(`          ${f.cur[0]}, ${f.cur[1]} → ${f.fix[0]}, ${f.fix[1]}`);
  if (f.nearAfter.length) console.log(`          ⚠️ 移動後3km以内: ${f.nearAfter.join(', ')}`);
}
console.log(`\n反映 ${applied}件`);
