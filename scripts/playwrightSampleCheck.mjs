#!/usr/bin/env node
import { chromium } from 'playwright';
import fs from 'fs';

const SAMPLES = JSON.parse(fs.readFileSync('/tmp/check_samples.json','utf-8'));
const BASE = 'http://localhost:4323';

const all = [
  ...SAMPLES.normal.map(id => ({id, cat:'normal'})),
  ...SAMPLES.niche.map(id => ({id, cat:'niche'})),
  ...SAMPLES.hub.map(id => ({id, cat:'hub'})),
];

const results = [];

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ ignoreHTTPSErrors: true });
  const page = await ctx.newPage();

  for (const {id, cat} of all) {
    const url = `${BASE}/destinations/${encodeURIComponent(id)}/`;
    const r = { id, cat, url, desc_ok:null, spots_ok:null, hotel_ok:null, jr_east_ok:null, jr_west_ok:null, errors:[] };

    try {
      const resp = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });
      if (!resp || resp.status() !== 200) {
        r.errors.push(`HTTP ${resp?.status()}`);
        results.push(r);
        continue;
      }

      // 1. description
      const bodyText = await page.locator('body').innerText().catch(() => '');
      const hasBadStr = /\[object Object\]|undefined|null/i.test(bodyText.replace(/null-/g,'')); // null- は除外
      // descriptionは長文を探す
      const paragraphs = await page.locator('p, .lead, .dest-description, [class*="description"]').allInnerTexts();
      const longText = paragraphs.find(t => t && t.length >= 100);
      r.desc_ok = !!longText && !hasBadStr;
      if (!r.desc_ok) {
        r.errors.push(longText ? `bad-string検出: [object Object]/undefined/null` : `100字以上のテキストなし`);
      }

      // 2. spots: 実際の class は .spot-section / .spot-title
      const spotElements = await page.locator('.spot-section').count();
      r.spots_ok = spotElements >= 2;
      if (!r.spots_ok) {
        const altCount = await page.locator('.spot-title').count();
        r.spots_ok = altCount >= 2;
        if (!r.spots_ok) r.errors.push(`spots<2 (section=${spotElements}, title=${altCount})`);
      }

      // 3. 宿リンク
      const hotelLinks = page.locator('a:has-text("宿"), a:has-text("ホテル"), a:has-text("楽天トラベル"), a:has-text("じゃらん")');
      const hotelCount = await hotelLinks.count();
      let hotelOk = hotelCount > 0;
      if (hotelOk) {
        for (let i = 0; i < hotelCount; i++) {
          const href = await hotelLinks.nth(i).getAttribute('href');
          if (!href || href === '#' || href === '' || href.includes('undefined')) {
            hotelOk = false;
            r.errors.push(`bad hotel href: ${href}`);
            break;
          }
        }
      } else {
        r.errors.push('宿リンクなし');
      }
      r.hotel_ok = hotelOk;

      // 4. JR ボタン: 出発地 select
      const sel = page.locator('select#departure-select');
      if (await sel.count() > 0) {
        // 東京
        await sel.selectOption({ label: '東京' }).catch(() => {});
        await page.waitForTimeout(200);
        const blockTokyo = page.locator('.travel-time-block[data-city="東京"]');
        if (await blockTokyo.count() > 0) {
          const jrTextEast = await blockTokyo.first().locator('.booking-btn-navitime').innerText().catch(() => '');
          // 東京→目的地のJR判定: 東日本(東北・関東・甲信越) ならえきねっと、それ以外はスマートEX/JR九州
          // destPrefを取得
          const destPrefMeta = await page.locator('meta[name="prefecture"], .dest-noimg-pref, .dest-hero-pref').first().innerText().catch(() => '');
          const eastJP = ['北海道','青森','岩手','宮城','秋田','山形','福島','茨城','栃木','群馬','埼玉','千葉','東京','神奈川','新潟','長野','山梨'];
          const isEast = eastJP.some(p => destPrefMeta.includes(p));
          const expected = isEast ? 'えきねっと' : (destPrefMeta.includes('九州') || /福岡|佐賀|長崎|熊本|大分|宮崎|鹿児島/.test(destPrefMeta) ? 'JR九州' : 'スマートEX');
          r.jr_east_ok = jrTextEast.includes(expected);
          if (!r.jr_east_ok) r.errors.push(`東京JR異 [destPref=${destPrefMeta}] expected=${expected} got="${jrTextEast.trim()}"`);
        } else {
          r.jr_east_ok = null; // travelTimeに東京なし
        }
        // 大阪
        await sel.selectOption({ label: '大阪' }).catch(() => {});
        await page.waitForTimeout(200);
        const blockOsaka = page.locator('.travel-time-block[data-city="大阪"]');
        if (await blockOsaka.count() > 0) {
          const jrTextWest = await blockOsaka.first().locator('.booking-btn-navitime').innerText().catch(() => '');
          // 大阪→目的地: 西日本内ならe5489、東日本ならスマートEX、九州ならJR九州
          const destPrefMeta = await page.locator('.dest-noimg-pref, .dest-hero-pref').first().innerText().catch(() => '');
          const expected = /福岡|佐賀|長崎|熊本|大分|宮崎|鹿児島/.test(destPrefMeta) ? 'JR九州'
            : (/北海道|青森|岩手|宮城|秋田|山形|福島|茨城|栃木|群馬|埼玉|千葉|東京|神奈川|新潟|長野|山梨/.test(destPrefMeta) ? 'スマートEX' : 'e5489');
          r.jr_west_ok = jrTextWest.includes(expected) || jrTextWest.includes('スマートEX');
          if (!r.jr_west_ok) r.errors.push(`大阪JR異 [destPref=${destPrefMeta}] expected=${expected} got="${jrTextWest.trim()}"`);
        } else {
          r.jr_west_ok = null;
        }
      } else {
        r.jr_east_ok = null;
        r.jr_west_ok = null;
        r.errors.push('departure-select なし');
      }
    } catch (e) {
      r.errors.push(`exception: ${e.message}`);
    }
    results.push(r);
    console.log(`  [${cat}] ${id}: desc=${r.desc_ok} spots=${r.spots_ok} hotel=${r.hotel_ok} jrE=${r.jr_east_ok} jrW=${r.jr_west_ok} errs=${r.errors.length}`);
  }

  // 宿リンク実クリック検証 (3件サンプル)
  console.log('\n--- 宿リンクHEAD検証 (3件) ---');
  const hotelSamples = results.filter(r => r.hotel_ok).slice(0, 3);
  for (const r of hotelSamples) {
    await page.goto(r.url, { waitUntil: 'domcontentloaded' });
    const link = page.locator('a:has-text("楽天トラベル"), a:has-text("宿"), a:has-text("ホテル")').first();
    const href = await link.getAttribute('href');
    if (href && href.startsWith('http')) {
      try {
        const resp = await page.request.head(href, { timeout: 10000, maxRedirects: 5 });
        const code = resp.status();
        console.log(`  ${r.id} → ${href.slice(0,60)}... HTTP ${code}`);
        if (code >= 400) r.errors.push(`hotel HEAD ${code}`);
      } catch (e) {
        console.log(`  ${r.id} → HEAD失敗: ${e.message}`);
      }
    }
  }

  await browser.close();

  // 結果集計
  console.log('\n=== 集計 ===');
  const cats = ['normal','niche','hub'];
  for (const cat of cats) {
    const sub = results.filter(r => r.cat === cat);
    const cnt = (k) => sub.filter(r => r[k] === true).length;
    console.log(`${cat} (${sub.length}件): desc=${cnt('desc_ok')} spots=${cnt('spots_ok')} hotel=${cnt('hotel_ok')} jrEast=${cnt('jr_east_ok')} jrWest=${cnt('jr_west_ok')}`);
  }
  // NG一覧
  const ngs = results.filter(r => r.errors.length > 0);
  console.log(`\n=== NG (${ngs.length}件) ===`);
  for (const r of ngs) console.log(`  ${r.id}: ${r.errors.join(' | ')}`);

  fs.writeFileSync('/tmp/playwright_result.json', JSON.stringify(results, null, 2));
})();
