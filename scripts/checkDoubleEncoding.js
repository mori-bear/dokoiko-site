import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const data = JSON.parse(fs.readFileSync(path.join(__dirname, '../src/data/destinations.json'), 'utf8'));

let doubleEnc = 0, suspicious = 0, total = 0;

data.forEach(d => {
  const links = d.hotelLinks || {};
  for (const [source, url] of Object.entries(links)) {
    if (!url) continue;
    total++;
    if (url.includes('%25')) {
      console.log('🔴 二重エンコード:', d.name, source, url.slice(0, 100));
      doubleEnc++;
    } else {
      try {
        const once = decodeURIComponent(url);
        const twice = decodeURIComponent(once);
        if (once !== url && twice !== once) {
          console.log('🟡 要確認:', d.name, source, url.slice(0, 100));
          suspicious++;
        }
      } catch (_) { /* 不正なエンコード */ }
    }
  }
});

console.log('');
console.log('総URL数:', total);
console.log('🔴 二重エンコード:', doubleEnc, '件');
console.log('🟡 要確認:', suspicious, '件');
console.log('✅ 正常:', (total - doubleEnc - suspicious), '件');
