#!/usr/bin/env node
/**
 * verifyXCard.mjs — 本番の og:image / twitter:card が X でカード表示される条件を満たすか調べる。
 *
 * Xの要件:
 *   ・twitter:card が summary_large_image（大きい画像のカード）
 *   ・twitter:image か og:image のどちらかが絶対URLで、公開されていること
 *   ・画像は JPEG / PNG / GIF / WEBP、5MB以下
 *   ・画像URLがリダイレクトなしで200を返すこと（Xのクローラはリダイレクトを嫌う）
 *   ・robots.txt で画像やページがブロックされていないこと
 *   ・og:image:width / height が実寸と一致していること（食い違うと切れる）
 */
const SITE = 'https://tabidokoiko.com';
// Xのクローラを名乗って取得する。UAで出し分けているサイトがあるため実際の挙動に近づける
const BOT = { 'User-Agent': 'Twitterbot/1.0' };
const PLAIN = { 'User-Agent': 'Mozilla/5.0 (compatible; DokoIko-Verify/1.0)' };

const PAGES = [
  ['トップ', '/'],
  ['全国一覧', '/list/'],
  ['目的地一覧', '/destinations/'],
  ['九州ふっこう特設', '/kyushu-fukko/'],
  ['destination(阿蘇)', '/destinations/aso/'],
  ['destination(湯の峰温泉)', '/destinations/yunomine/'],
  ['destination(黒川温泉)', '/destinations/kurokawa-k/'],
  ['運営者情報', '/about/'],
  ['お問い合わせ', '/contact/'],
  ['プライバシーポリシー', '/privacy/'],
  ['利用規約', '/terms/'],
];

const meta = (html, key) =>
  (html.match(new RegExp(`<meta\\s+(?:property|name)="${key}"\\s+content="([^"]*)"`, 'i')) || [])[1] ?? null;

function sizeOf(buf) {
  if (buf.length > 24 && buf.readUInt32BE(0) === 0x89504e47) return { type: 'PNG', w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
  if (buf[0] === 0xff && buf[1] === 0xd8) {
    let i = 2;
    while (i < buf.length - 9) {
      if (buf[i] !== 0xff) { i++; continue; }
      const m = buf[i + 1];
      if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) {
        return { type: 'JPEG', h: buf.readUInt16BE(i + 5), w: buf.readUInt16BE(i + 7) };
      }
      i += 2 + buf.readUInt16BE(i + 2);
    }
    return { type: 'JPEG', w: null, h: null };
  }
  if (buf.slice(0, 3).toString() === 'GIF') return { type: 'GIF', w: buf.readUInt16LE(6), h: buf.readUInt16LE(8) };
  if (buf.slice(0, 4).toString() === 'RIFF' && buf.slice(8, 12).toString() === 'WEBP') return { type: 'WEBP', w: null, h: null };
  return { type: '不明', w: null, h: null };
}

console.log('■ robots.txt');
{
  const r = await fetch(`${SITE}/robots.txt`, { headers: PLAIN });
  const t = r.ok ? await r.text() : '';
  console.log(`   ${r.status} ${r.ok ? '' : '（robots.txt が無い＝全許可）'}`);
  if (t) for (const line of t.split('\n').map((s) => s.trim()).filter(Boolean)) console.log(`   | ${line}`);
}

const seen = new Map();
let ng = 0;
for (const [label, p] of PAGES) {
  const r = await fetch(SITE + p, { headers: BOT, redirect: 'manual' });
  if (r.status >= 300 && r.status < 400) {
    console.log(`\n■ ${label} ${p}\n   ❌ ページが ${r.status} でリダイレクト → ${r.headers.get('location')}`);
    ng++; continue;
  }
  const html = await r.text();
  const card = meta(html, 'twitter:card');
  const tImg = meta(html, 'twitter:image');
  const oImg = meta(html, 'og:image');
  const w = meta(html, 'og:image:width');
  const h = meta(html, 'og:image:height');
  const title = meta(html, 'og:title');
  const desc = meta(html, 'og:description');

  console.log(`\n■ ${label} ${p}  (HTTP ${r.status})`);
  console.log(`   twitter:card        ${card ?? '（なし）'}`);
  console.log(`   twitter:image       ${tImg ?? '（なし）'}`);
  console.log(`   og:image            ${oImg ?? '（なし）'}`);
  console.log(`   og:image:width/height ${w ?? '-'} x ${h ?? '-'}`);
  console.log(`   og:title            ${title ? title.slice(0, 44) : '（なし）'}`);
  console.log(`   og:description      ${desc ? desc.slice(0, 44) + '…' : '（なし）'}`);

  const problems = [];
  if (card !== 'summary_large_image') problems.push(`twitter:card が summary_large_image でない（${card}）`);
  if (!tImg) problems.push('twitter:image が無い');
  if (!oImg) problems.push('og:image が無い');
  const url = tImg || oImg;
  if (url && !/^https:\/\//.test(url)) problems.push('画像URLが https の絶対URLでない');

  if (url && !seen.has(url)) {
    const ir = await fetch(url, { headers: BOT, redirect: 'manual' });
    if (ir.status >= 300 && ir.status < 400) {
      seen.set(url, { redirect: ir.headers.get('location'), status: ir.status });
    } else if (!ir.ok) {
      seen.set(url, { status: ir.status });
    } else {
      const buf = Buffer.from(await ir.arrayBuffer());
      seen.set(url, {
        status: ir.status, bytes: buf.length,
        ctype: ir.headers.get('content-type'),
        ...sizeOf(buf),
      });
    }
  }
  const info = seen.get(url);
  if (info) {
    if (info.redirect) { problems.push(`画像が ${info.status} でリダイレクト → ${info.redirect}`); }
    else if (info.status !== 200) { problems.push(`画像が HTTP ${info.status}`); }
    else {
      const mb = (info.bytes / 1024 / 1024);
      console.log(`   画像            ${info.status} ${info.type} ${info.w ?? '?'}x${info.h ?? '?'} ${mb.toFixed(2)}MB ${info.ctype}`);
      if (!['JPEG', 'PNG', 'GIF', 'WEBP'].includes(info.type)) problems.push(`Xが扱えない形式（${info.type}）`);
      if (info.bytes > 5 * 1024 * 1024) problems.push(`5MBを超えている（${mb.toFixed(2)}MB）`);
      if (info.w && Number(w) && Number(w) !== info.w) problems.push(`og:image:width ${w} が実寸 ${info.w} と違う`);
      if (info.h && Number(h) && Number(h) !== info.h) problems.push(`og:image:height ${h} が実寸 ${info.h} と違う`);
      if (info.w && info.h) {
        const ratio = info.w / info.h;
        if (ratio < 1.4 || ratio > 2.4) problems.push(`縦横比 ${ratio.toFixed(2)} は大きいカード向きでない（1.4〜2.4が目安）`);
        if (info.w < 300 || info.h < 157) problems.push(`小さすぎて大きいカードにならない（${info.w}x${info.h}）`);
      }
    }
  }
  if (problems.length) { ng++; for (const x of problems) console.log(`   ❌ ${x}`); }
  else console.log('   ✅ Xの大きいカードの条件を満たす');
}
console.log(ng ? `\nNG ${ng}ページ` : `\n✅ 全${PAGES.length}ページでXのカード表示条件を満たす`);
process.exit(ng ? 1 : 0);
