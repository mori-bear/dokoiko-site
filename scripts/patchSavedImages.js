#!/usr/bin/env node
// Patch destinations.json for the 4 images saved by fixVisionNgMedium.js
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEST_JSON = path.join(__dirname, '../src/data/destinations.json');

const patches = [
  {
    id: 'aizu',
    imageCredit: { author: 'Okajun', license: 'CC BY-SA 3.0', url: 'https://commons.wikimedia.org/wiki/File:Aizuwakamatsu,_Fukushima_Oka.jpg', attributionRequired: true },
  },
  {
    id: 'nyuto-onsen',
    imageCredit: { author: 'Markmark28', license: 'CC BY-SA 3.0', url: 'https://commons.wikimedia.org/wiki/File:Tsurunoyu_onsen_rotenburo.JPG', attributionRequired: true },
  },
  {
    id: 'hakusan',
    imageCredit: { author: 'Alpsdake', license: 'CC BY-SA 3.0', url: 'https://commons.wikimedia.org/wiki/File:Mount_Haku_from_Onanjimine_2011-07-17.jpg', attributionRequired: true },
  },
  {
    id: 'osorezan-area',
    imageCredit: { author: 'あおもりくま', license: 'CC BY-SA 3.0', url: 'https://commons.wikimedia.org/wiki/File:Sacred_Mount_Osorezan_20200601a_stitching9.jpg', attributionRequired: true },
  },
];

const destinations = JSON.parse(fs.readFileSync(DEST_JSON, 'utf8'));
let count = 0;

for (const patch of patches) {
  const idx = destinations.findIndex(d => d.id === patch.id);
  if (idx < 0) { console.log(`SKIP ${patch.id}: not found`); continue; }
  const d = destinations[idx];
  const imgPath = `/images/${patch.id}/main.jpg`;
  destinations[idx] = {
    ...d,
    images: [imgPath, ...(d.images || []).filter(u => u !== imgPath)],
    imageCredit: patch.imageCredit,
  };
  delete destinations[idx].unsplashUrl;
  delete destinations[idx].unsplashCredit;
  delete destinations[idx].unsplashCreditUrl;
  delete destinations[idx].unsplashPhotoUrl;
  console.log(`✓ Patched ${patch.id}`);
  count++;
}

fs.writeFileSync(DEST_JSON, JSON.stringify(destinations, null, 2));
console.log(`\nDone: ${count} destinations updated.`);
