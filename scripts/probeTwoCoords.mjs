#!/usr/bin/env node
/** probeTwoCoords.mjs — 座標を逆ジオコーディングして、何を指しているか確かめる。 */
const UA = { 'User-Agent': 'DokoIko-Verify/1.0 (tabidokoiko.com)' };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
for (let i = 2; i < process.argv.length; i += 3) {
  const [label, lat, lng] = [process.argv[i], +process.argv[i + 1], +process.argv[i + 2]];
  const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&zoom=15&addressdetails=1&accept-language=ja`;
  try {
    const j = await (await fetch(url, { headers: UA })).json();
    console.log(`${label.padEnd(28)} ${lat}, ${lng}\n   → ${j.display_name || '取得できず'}`);
  } catch { console.log(`${label}: 取得できず`); }
  await sleep(1200);
}
