#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import https from 'https';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEST_FILE = path.join(__dirname, '../src/data/destinations.json');
const IMG_DIR = path.join(__dirname, '../public/images');
const KEY = '55917935-4c63d9c4d75af8f3d831e21a6';
const UA = 'Mozilla/5.0';
const FOREIGN = /europe|heidelberg|cathedral|paris|rome|prague|venice|salzburg|spain|italy|france|germany|switzerland|austria|red-tiled|romanesque|tudor|english|berlin|korea|busan|seoul|釜山|韓国|加徳|china|中国|台湾|thailand|vietnam/i;

const dests = JSON.parse(fs.readFileSync(DEST_FILE, 'utf-8'));
const targets = JSON.parse(fs.readFileSync('/tmp/no_img.json', 'utf-8'));

const existing = new Set();
for (const x of dests) {
  const p = path.join(IMG_DIR, x.id, 'main.jpg');
  if (fs.existsSync(p)) existing.add(crypto.createHash('md5').update(fs.readFileSync(p)).digest('hex'));
}

function get(url) {
  return new Promise((res,rej) => {
    let hops=0;
    function go(u){
      hops++;if(hops>5)return rej(new Error('redirects'));
      https.get(u,{headers:{'User-Agent':UA,'Accept':'application/json'}},r=>{
        if(r.statusCode>=300&&r.statusCode<400&&r.headers.location){r.resume();return go(r.headers.location);}
        if(r.statusCode!==200){r.resume();return rej(new Error(r.statusCode));}
        let b='';r.setEncoding('utf-8');r.on('data',c=>b+=c);r.on('end',()=>res(b));
      });
    }
    go(url);
  });
}
function dl(url) {
  return new Promise((res,rej) => {
    let hops=0;
    function go(u){
      hops++;if(hops>5)return rej(new Error('redirects'));
      https.get(u,{headers:{'User-Agent':UA}},r=>{
        if(r.statusCode>=300&&r.statusCode<400&&r.headers.location){r.resume();return go(r.headers.location);}
        if(r.statusCode!==200){r.resume();return rej(new Error(r.statusCode));}
        const cs=[];r.on('data',c=>cs.push(c));r.on('end',()=>res(Buffer.concat(cs)));
      });
    }
    go(url);
  });
}

async function pixabay(q) {
  try {
    const body = await get(`https://pixabay.com/api/?key=${KEY}&q=${encodeURIComponent(q)}&image_type=photo&lang=ja&per_page=15&safesearch=true`);
    const j = JSON.parse(body);
    return j?.hits || [];
  } catch { return []; }
}

let success = 0, fail = 0;
for (const t of targets) {
  const pref = (t.prefecture||'').replace(/[県府都]$/,'');
  const queries = [t.name, `${t.name} ${pref}`, `${t.name} 風景`];
  let saved = false;
  for (const q of queries) {
    const hits = await pixabay(q);
    for (const hit of hits) {
      const u = hit.largeImageURL;
      if (!u) continue;
      const tags = (hit.tags||'').toLowerCase();
      if (FOREIGN.test(tags + ' ' + u)) continue;
      try {
        const buf = await dl(u);
        if (buf.length < 5000) continue;
        const md5 = crypto.createHash('md5').update(buf).digest('hex');
        if (existing.has(md5)) continue;
        const folder = path.join(IMG_DIR, t.id);
        if (!fs.existsSync(folder)) fs.mkdirSync(folder, { recursive: true });
        fs.writeFileSync(path.join(folder, 'main.jpg'), buf);
        existing.add(md5);
        const d = dests.find(x => x.id === t.id);
        if (d) {
          if (!d.images) d.images = [];
          if (!d.images.some(p => p === `/images/${t.id}/main.jpg`)) d.images.unshift(`/images/${t.id}/main.jpg`);
        }
        success++;
        saved = true;
        break;
      } catch {}
    }
    if (saved) break;
    await new Promise(r => setTimeout(r, 600));
  }
  if (!saved) fail++;
}
fs.writeFileSync(DEST_FILE, JSON.stringify(dests, null, 2));
console.log(`✓${success} ✗${fail} / ${targets.length}件`);
