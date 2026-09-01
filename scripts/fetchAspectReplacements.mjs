#!/usr/bin/env node
/**
 * fetchBannerReplacements.mjs — 極端に横長な「バナー画像」を採ってしまったページの
 * 差し替え候補を集める。VisionのAPIが使えない状況なので、機械的な条件で絞ったうえで
 * 最後は目視で選ぶ。
 *
 * 機械条件: 幅1200以上 / 横長 / 縦横比が1.2〜2.2（バナーとポートレートを弾く）
 */
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import { placeCheck } from './commonsPlaceCheck.mjs';

const UA = { 'User-Agent': 'DokoIko-DataAudit/1.0 (tabidokoiko.com; contact@tabidokoiko.com)' };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const TARGETS = [
  { id: 'gen_北海_弁天台場', pref: '北海道', words: ['函館', '弁天', '北海道'], queries: ['函館 五稜郭公園', '函館山 夜景', '函館 元町 教会', '五稜郭 タワー 眺め'] },
  { id: 'bise', pref: '沖縄県', words: ['備瀬', '本部', '沖縄'], queries: ['備瀬 フクギ並木', '備瀬崎', '本部町 フクギ', '美ら海水族館'] },
  { id: 'niche_千葉_5', pref: '千葉県', words: ['御宿', '千葉'], queries: ['御宿海岸', '御宿町 月の沙漠', 'メキシコ記念塔 御宿', '御宿 海水浴場'] },
  { id: 'cape-zampa', pref: '沖縄県', words: ['残波', '読谷', '沖縄'], queries: ['残波岬 灯台', '残波岬', '読谷村 海岸', '残波ビーチ'] },
  { id: 'niche_島根_6', pref: '島根県', words: ['匹見', '益田', '島根'], queries: ['匹見峡', '匹見峡 遊歩道', '益田市 渓谷', '医光寺 益田'] },
  { id: 'kibune-kurama', pref: '京都府', words: ['鞍馬', '貴船', '京都'], queries: ['貴船神社 参道', '鞍馬寺', '貴船 川床', '鞍馬 火祭'] },
  { id: 'gen_北海_天に続く道', pref: '北海道', words: ['斜里', '知床', '北海道'], queries: ['天に続く道 斜里', '斜里町 直線道路', '知床 斜里 風景', 'ラベンダー 中富良野'] },
  { id: 'nokogiriyama', pref: '千葉県', words: ['鋸山', '富津', '鋸南', '千葉'], queries: ['鋸山 地獄のぞき', '鋸山 日本寺 大仏', '鋸山 石切場', '鋸山 ロープウェー'] },
  { id: 'oyama-afuri', pref: '神奈川県', words: ['大山', '伊勢原', '神奈川'], queries: ['大山阿夫利神社 下社', '大山寺 伊勢原 紅葉', '大山 ケーブルカー', '大山 山頂 眺望'] },
  { id: 'oita', pref: '大分県', words: ['大分', '府内'], queries: ['府内城', '高崎山 自然動物園', '大分市 街並み', '大分マリーンパレス'] },
  { id: 'mizuki-shigeru-road', pref: '鳥取県', words: ['境港', '鳥取', '水木'], queries: ['水木しげるロード', '境港 妖怪 ブロンズ', '水木しげる記念館', '境港 商店街'] },
];

async function search(query, limit = 8) {
  const api = `https://commons.wikimedia.org/w/api.php?action=query&format=json&generator=search`
    + `&gsrsearch=${encodeURIComponent('filetype:bitmap ' + query)}&gsrnamespace=6&gsrlimit=${limit * 3}`
    + `&prop=imageinfo&iiprop=url|size|extmetadata&iiurlwidth=1600`;
  let j;
  try { j = await (await fetch(api, { headers: UA })).json(); } catch { return []; }
  const out = [];
  for (const p of Object.values(j.query?.pages || {}).sort((a, b) => a.index - b.index)) {
    const ii = p.imageinfo?.[0];
    if (!ii || ii.width < 1200) continue;
    const r = ii.width / ii.height;
    if (r < 1.2 || r > 2.2) continue;          // バナーと縦長を弾く
    out.push({ title: p.title, url: ii.thumburl || ii.url, descurl: ii.descriptionurl,
      w: ii.width, h: ii.height, em: ii.extmetadata || {} });
    if (out.length >= limit) break;
  }
  return out;
}

const report = [];
for (const t of TARGETS) {
  const dir = `logs/aspect_${t.id}`;
  fs.mkdirSync(dir, { recursive: true });
  let n = 0;
  const seen = new Set();
  console.log(`\n■ ${t.id}`);
  for (const q of t.queries) {
    for (const c of await search(q)) {
      if (seen.has(c.title)) continue;
      seen.add(c.title);
      const pc = await placeCheck(c.title, t.pref, t.words).catch(() => ({ verdict: 'weak' }));
      await sleep(250);
      if (pc.verdict === 'ng') { console.log(`   -- place=ng ${c.title.replace('File:', '').slice(0, 44)}`); continue; }
      let buf;
      try { buf = Buffer.from(await (await fetch(c.url, { headers: UA })).arrayBuffer()); } catch { continue; }
      const file = path.join(dir, `${String(++n).padStart(2, '0')}.jpg`);
      await sharp(buf).resize({ width: 1200, withoutEnlargement: true }).jpeg({ quality: 82 }).toFile(file);
      const lic = c.em.LicenseShortName?.value || 'unknown';
      report.push({ id: t.id, n, file, title: c.title, w: c.w, h: c.h,
        ratio: +(c.w / c.h).toFixed(2), place: pc.verdict,
        credit: {
          author: (c.em.Artist?.value || '').replace(/<[^>]*>/g, '').split(/\n|This photo was taken/)[0].replace(/\s+/g, ' ').trim() || 'unknown',
          license: lic, url: c.descurl,
          attributionRequired: !/^(CC0|Public domain|パブリック)/i.test(lic),
        } });
      console.log(`   ${String(n).padStart(2)} ${String(c.w)}x${c.h} 比${(c.w / c.h).toFixed(2)} place=${pc.verdict.padEnd(4)} ${c.title.replace('File:', '').slice(0, 46)}`);
      if (n >= 8) break;
      await sleep(300);
    }
    if (n >= 8) break;
  }
}
fs.writeFileSync('logs/aspect_candidates.json', JSON.stringify(report, null, 1));
console.log(`\n候補 ${report.length}件 → logs/aspect_candidates.json`);
