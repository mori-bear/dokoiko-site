#!/usr/bin/env node
/**
 * normalizeCreditFlags.mjs — imageCredit.attributionRequired をライセンス名から導出し直す。
 *
 * 過去の取得スクリプト（kyushuDestImages.mjs）が attributionRequired を true 固定で
 * 書き出していたため、CC0 やパブリックドメインの画像にも表示義務ありと記録されていた。
 * ヒーロー画像のクレジットはこの値を見ずに描画しているので表示は変わらないが、
 * spot画像の描画はこの値で出し分けているため、データとしては正しくしておく。
 */
import fs from 'fs';
const DATA = ['src/data/destinations.json', 'public/data/destinations.json'];
const required = (lic) => !/^(CC0|Public domain|パブリック)/i.test(String(lic || ''));

let fixed = 0, checked = 0;
for (const f of DATA) {
  const all = JSON.parse(fs.readFileSync(f, 'utf8'));
  for (const d of all) {
    for (const c of [d.imageCredit, ...(d.spots || []).map((s) => s && s.imageCredit)]) {
      if (!c || !c.license) continue;
      checked++;
      const want = required(c.license);
      if (c.attributionRequired !== want) { c.attributionRequired = want; if (f === DATA[0]) fixed++; }
    }
  }
  fs.writeFileSync(f, JSON.stringify(all, null, 2) + '\n');
}
console.log(`■ クレジット ${checked}件を確認 / 表示義務フラグを直したもの ${fixed}件`);
