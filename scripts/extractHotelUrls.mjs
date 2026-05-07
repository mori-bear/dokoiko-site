import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const dataPath = join(__dirname, '../src/data/destinations.json');
const raw = readFileSync(dataPath, 'utf-8');
const data = JSON.parse(raw);
const entries = Object.values(data);
const destinations = entries.filter(e => e.type === 'destination');

// naoshima, kusatsu-onsen, mitoyo, mihonoseki, shimoda, ryujin-onsen, shirakawago-t, kamakura, mikurajima の実際のURLを確認
const targets = ['naoshima', 'kusatsu-onsen', 'mitoyo', 'mihonoseki', 'shimoda', 'ryujin-onsen', 'shirakawago-t', 'kamakura', 'mikurajima', 'atami'];

targets.forEach(id => {
  const d = destinations.find(d => d.id === id);
  if (!d) { console.log(`${id}: NOT FOUND`); return; }

  const rakuten = d.hotelLinks?.rakuten || null;
  const jalan = d.hotelLinks?.jalan || null;

  // アフィリエイトURLからリアルURLを抽出
  let realRakuten = null;
  let realJalan = null;

  if (rakuten) {
    // ?pc=URL形式
    const pcMatch = rakuten.match(/[?&]pc=([^&]+)/);
    if (pcMatch) {
      try {
        realRakuten = decodeURIComponent(pcMatch[1]);
      } catch (e) {
        realRakuten = pcMatch[1];
      }
    } else {
      realRakuten = rakuten;
    }
  }

  if (jalan) {
    // vc_url=URL形式
    const vcMatch = jalan.match(/vc_url=([^&]+)/);
    if (vcMatch) {
      try {
        realJalan = decodeURIComponent(vcMatch[1]);
      } catch (e) {
        realJalan = vcMatch[1];
      }
    } else {
      realJalan = jalan;
    }
  }

  console.log(`\n=== ${id} (${d.name}) ===`);
  console.log(`  keyword: ${d.hotelSearch || d.name}`);
  console.log(`  stayAllowed: ${JSON.stringify(d.stayAllowed)}`);
  console.log(`  railNote: ${d.railNote || 'null'}`);
  console.log(`  hub: ${d.hub || 'null'}`);
  console.log(`  REAL_RAKUTEN: ${realRakuten}`);
  console.log(`  REAL_JALAN:   ${realJalan}`);
  console.log(`  AFF_RAKUTEN:  ${rakuten?.slice(0, 100)}`);
});
