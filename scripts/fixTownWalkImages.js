#!/usr/bin/env node
/**
 * 新規街歩き8件の画像を日本固有クエリで再取得
 * Pixabay → Wikimedia Commons の順
 * 欧州風画像を避けるため画像URL/タイトルからキーワード検証
 * md5重複チェック
 */
import fs from 'fs';
import path from 'path';
import https from 'https';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEST_FILE = path.join(__dirname, '../src/data/destinations.json');
const IMG_DIR = path.join(__dirname, '../public/images');
const PIXABAY_KEY = '55917935-4c63d9c4d75af8f3d831e21a6';
const UA = 'Mozilla/5.0';

const dests = JSON.parse(fs.readFileSync(DEST_FILE, 'utf-8'));

const TARGETS = [
  { id:'wakimachi',  jp:'脇町 徳島 うだつ',          en:'Wakimachi Tokushima Japan' },
  { id:'arimatsu',   jp:'有松 名古屋 絞り',           en:'Arimatsu Nagoya Shibori Japan' },
  { id:'asuke',      jp:'足助 香嵐渓 古い町並み',      en:'Asuke Aichi Korankei Japan' },
  { id:'unno-juku',  jp:'海野宿 長野 北国街道',       en:'Unno-juku Nagano post town Japan' },
  { id:'yame',       jp:'八女 福岡 茶 古い町並み',    en:'Yame Fukuoka tea town Japan' },
  { id:'takatori',   jp:'高取 奈良 武家屋敷',         en:'Takatori Nara samurai Japan' },
  { id:'seki-juku',  jp:'関宿 三重 東海道 宿場町',    en:'Seki-juku Mie Tokaido post town Japan' },
  { id:'hiketa',     jp:'引田 香川 醤油 古い町並み',  en:'Hiketa Kagawa soy sauce Japan' },
];

// 既存全画像のmd5
const existing = new Set();
for (const x of dests) {
  const p = path.join(IMG_DIR, x.id, 'main.jpg');
  if (fs.existsSync(p)) existing.add(crypto.createHash('md5').update(fs.readFileSync(p)).digest('hex'));
}

function get(url) {
  return new Promise((resolve, reject) => {
    let hops = 0;
    function go(u) {
      hops++;
      if (hops > 5) return reject(new Error('redirects'));
      https.get(u, { headers: { 'User-Agent': UA, 'Accept': 'application/json' } }, res => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          res.resume(); return go(res.headers.location.startsWith('http') ? res.headers.location : new URL(res.headers.location, u).toString());
        }
        if (res.statusCode !== 200) { res.resume(); return reject(new Error(`HTTP ${res.statusCode}`)); }
        let body = ''; res.setEncoding('utf-8');
        res.on('data', c => body += c);
        res.on('end', () => resolve(body));
      }).on('error', reject);
    }
    go(url);
  });
}
function downloadBuf(url) {
  return new Promise((resolve, reject) => {
    let hops = 0;
    function go(u) {
      hops++;
      if (hops > 5) return reject(new Error('redirects'));
      https.get(u, { headers: { 'User-Agent': UA } }, res => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          res.resume(); return go(res.headers.location.startsWith('http') ? res.headers.location : new URL(res.headers.location, u).toString());
        }
        if (res.statusCode !== 200) { res.resume(); return reject(new Error(`HTTP ${res.statusCode}`)); }
        const chunks = [];
        res.on('data', c => chunks.push(c));
        res.on('end', () => resolve(Buffer.concat(chunks)));
      }).on('error', reject);
    }
    go(url);
  });
}

// 欧州風画像のURLに含まれがちなキーワード
const FOREIGN_HINTS = /heidelberg|european|europe|cathedral|church|paris|prague|venice|salzburg|rome|spain|italy|france|germany|switzerland|austria|red-tiled|romanesque/i;

async function pixabay(q) {
  try {
    const url = `https://pixabay.com/api/?key=${PIXABAY_KEY}&q=${encodeURIComponent(q)}&image_type=photo&lang=ja&per_page=15&safesearch=true`;
    const body = await get(url);
    const j = JSON.parse(body);
    return j?.hits || [];
  } catch { return []; }
}
async function commons(q) {
  try {
    const body = await get(`https://commons.wikimedia.org/w/api.php?action=query&format=json&generator=search&gsrnamespace=6&gsrlimit=5&gsrsearch=${encodeURIComponent(q)}&prop=imageinfo&iiprop=url&iiurlwidth=1200&origin=*`);
    const j = JSON.parse(body);
    const pages = j?.query?.pages;
    if (!pages) return [];
    return Object.values(pages).map(p => p?.imageinfo?.[0]?.thumburl).filter(Boolean);
  } catch { return []; }
}

async function findUnique(jp, en) {
  // 1. Pixabay 日本語
  for (const q of [jp, jp.split(' ')[0] + ' 古民家', jp.split(' ')[0] + ' 町並み']) {
    const hits = await pixabay(q);
    for (const hit of hits) {
      const u = hit.largeImageURL || hit.webformatURL;
      if (!u) continue;
      // タグ確認: 日本タグなければ skip
      const tags = (hit.tags || '').toLowerCase();
      if (FOREIGN_HINTS.test(tags) || FOREIGN_HINTS.test(u)) continue;
      const hasJapan = tags.includes('日本') || tags.includes('japan') || tags.includes('町') || tags.includes('村') || tags.includes('民家');
      if (!hasJapan) continue;
      try {
        const buf = await downloadBuf(u);
        if (buf.length < 5000) continue;
        const md5 = crypto.createHash('md5').update(buf).digest('hex');
        if (existing.has(md5)) continue;
        return { buf, md5, source: `pixabay:${q}` };
      } catch {}
    }
    await new Promise(r => setTimeout(r, 600));
  }
  // 2. Wikimedia Commons
  for (const q of [jp.split(' ')[0], en]) {
    const urls = await commons(q);
    for (const u of urls) {
      try {
        const buf = await downloadBuf(u);
        if (buf.length < 5000) continue;
        const md5 = crypto.createHash('md5').update(buf).digest('hex');
        if (existing.has(md5)) continue;
        return { buf, md5, source: `commons:${q}` };
      } catch {}
    }
    await new Promise(r => setTimeout(r, 600));
  }
  // 3. Pixabay 英語 final fallback
  for (const q of [en]) {
    const hits = await pixabay(q);
    for (const hit of hits) {
      const u = hit.largeImageURL;
      if (!u) continue;
      const tags = (hit.tags || '').toLowerCase();
      if (FOREIGN_HINTS.test(tags) || FOREIGN_HINTS.test(u)) continue;
      try {
        const buf = await downloadBuf(u);
        if (buf.length < 5000) continue;
        const md5 = crypto.createHash('md5').update(buf).digest('hex');
        if (existing.has(md5)) continue;
        return { buf, md5, source: `pixabay-en:${q}` };
      } catch {}
    }
  }
  return null;
}

let success = 0, fail = 0;
const stats = {};
for (const t of TARGETS) {
  const d = dests.find(x => x.id === t.id);
  if (!d) continue;
  const folder = path.join(IMG_DIR, t.id);
  const dst = path.join(folder, 'main.jpg');
  // 旧md5 削除
  if (fs.existsSync(dst)) {
    const oldMd5 = crypto.createHash('md5').update(fs.readFileSync(dst)).digest('hex');
    existing.delete(oldMd5);
  }
  const result = await findUnique(t.jp, t.en);
  if (result) {
    if (!fs.existsSync(folder)) fs.mkdirSync(folder, { recursive: true });
    fs.writeFileSync(dst, result.buf);
    existing.add(result.md5);
    if (!d.images) d.images = [];
    if (!d.images.some(p => p === `/images/${t.id}/main.jpg`)) d.images.unshift(`/images/${t.id}/main.jpg`);
    success++;
    stats[result.source.split(':')[0]] = (stats[result.source.split(':')[0]] || 0) + 1;
    console.log(`✓ ${t.id}: ${result.source}`);
  } else {
    // 取得失敗 → 既存削除して images空に
    if (fs.existsSync(dst)) fs.unlinkSync(dst);
    d.images = [];
    fail++;
    console.log(`✗ ${t.id}: 取得失敗→画像なし`);
  }
}
fs.writeFileSync(DEST_FILE, JSON.stringify(dests, null, 2));
console.log(`\n=== 完了 === ✓${success} ✗${fail}`, stats);
