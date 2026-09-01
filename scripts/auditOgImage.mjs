#!/usr/bin/env node
/**
 * auditOgImage.mjs — 本番の各ページ種別で og:image が実在するかを確認する（調査のみ）。
 * SNSに貼ったときカードに画像が出るかどうかは、URLが200で返るかで決まる。
 * 宣言している og:image:width/height と実寸のズレも見る。
 */
const BASE = 'https://tabidokoiko.com';

const PAGES = [
  ['/', 'トップ'],
  ['/kyushu-fukko/', '九州ふっこう特設'],
  ['/destinations/', '目的地一覧'],
  ['/list/', '全国一覧'],
  ['/about/', '運営者情報'],
  ['/contact/', 'お問い合わせ'],
  ['/privacy/', 'プライバシーポリシー'],
  ['/terms/', '利用規約'],
  ['/destinations/kuroyu/', 'destination(黒湯温泉)'],
  ['/destinations/kannojigoku/', 'destination(寒の地獄温泉)'],
  ['/destinations/hakone/', 'destination(箱根・既存)'],
  ['/hub/tokyo/', 'hub(東京)'],
];

const meta = (html, prop) => {
  const m = html.match(new RegExp(`<meta (?:property|name)="${prop}" content="([^"]*)"`));
  return m ? m[1] : null;
};

let ng = 0;
console.log('■ 各ページの og:image と到達性\n');
for (const [p, label] of PAGES) {
  const r = await fetch(BASE + p);
  if (!r.ok) { console.log(`  ⚠️  ${r.status} ${label}（ページなし）`); continue; }
  const html = await r.text();
  const img = meta(html, 'og:image');
  const tw = meta(html, 'twitter:image');
  const w = meta(html, 'og:image:width');
  const h = meta(html, 'og:image:height');
  if (!img) {
    ng++;
    console.log(`  ❌ ${label.padEnd(24)} og:image なし（SNSカードに画像が出ない）`);
    continue;
  }
  // og:image は絶対URLでないとSNS側が解決できないことがある。相対のままかも見る。
  const isAbs = /^https?:\/\//.test(img);
  const abs = isAbs ? img : BASE + img;
  const ir = await fetch(abs, { method: 'HEAD' });
  const ok = ir.ok && isAbs;
  if (!ok) ng++;
  const note = !isAbs ? ' ⚠️相対URL（絶対URL必須）' : '';
  console.log(`  ${ok ? '✅' : '❌'} ${label.padEnd(24)} ${ir.status} ${img.replace(BASE, '')}${note}`);
  if (w || h) console.log(`     宣言サイズ ${w}x${h}${tw === img ? '' : `  ※twitter:image が別値: ${tw}`}`);
}
console.log(ng ? `\nNG ${ng}件` : '\n✅ すべて到達可能');
