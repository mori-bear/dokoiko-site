#!/usr/bin/env node
/** kurokawaBannerSrc.mjs — 山みず木バナーの説明文を読み、元写真（通常比率）が Commons にあるか探す。 */
const UA = { 'User-Agent': 'DokoIko-DataAudit/1.0 (tabidokoiko.com; contact@tabidokoiko.com)' };
const api = `https://commons.wikimedia.org/w/api.php?action=query&format=json`
  + `&titles=${encodeURIComponent('File:Kurokawa Onsen Yamamizuki Banner.jpg')}`
  + `&prop=imageinfo&iiprop=url|size|extmetadata`;
const j = await (await fetch(api, { headers: UA })).json();
for (const p of Object.values(j.query.pages)) {
  const em = p.imageinfo[0].extmetadata;
  for (const k of ['ImageDescription', 'Artist', 'Credit', 'LicenseShortName', 'Categories']) {
    if (em[k]) console.log(`${k}: ${String(em[k].value).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 400)}`);
  }
}
