// じゃらんURLのリダイレクトチェーンを追跡し、各ホップをAASA(UL)パターンと照合する。
// サーバーリダイレクトの着地先がUL対象ならSafariでアプリが起動するため、
// 「最初のURLがAASA対象外」だけでは不十分 — 全ホップの検査が必要。
// 使い方: node scripts/checkJalanRedirects.mjs <url> [<url>...]
import { isJalanAppLink } from './auditJalanAppLinks.mjs';

const IPHONE_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';

async function trace(url) {
  const hops = [];
  let current = url;
  for (let i = 0; i < 8; i++) {
    let res;
    try {
      res = await fetch(current, { redirect: 'manual', headers: { 'User-Agent': IPHONE_UA, 'Accept-Language': 'ja' } });
    } catch (e) {
      hops.push({ url: current, status: 'FETCH_ERROR ' + e.message, ul: isJalanAppLink(current) });
      break;
    }
    const ul = isJalanAppLink(current);
    hops.push({ url: current, status: res.status, ul });
    const loc = res.headers.get('location');
    if (res.status >= 300 && res.status < 400 && loc) {
      current = new URL(loc, current).href;
    } else {
      // HTML内のmeta refresh / JSロケーション遷移も粗く検出
      if ((res.headers.get('content-type') || '').includes('text/html')) {
        const body = (await res.text()).slice(0, 20000);
        const meta = body.match(/http-equiv=["']refresh["'][^>]*url=([^"'>\s]+)/i);
        const jsloc = body.match(/location\.(?:href|replace)\s*[=(]\s*["']([^"']+)["']/i);
        const next = meta?.[1] || jsloc?.[1];
        if (next && /^https?:/.test(next)) {
          current = new URL(next, current).href;
          hops.push({ url: current, status: '(meta/js遷移)', ul: isJalanAppLink(current) });
        }
      }
      break;
    }
  }
  return hops;
}

for (const url of process.argv.slice(2)) {
  console.log('====', url.slice(0, 100));
  const hops = await trace(url);
  for (const h of hops) {
    console.log(`  ${h.ul ? '🚨UL対象' : '  安全  '} [${h.status}] ${h.url.slice(0, 110)}`);
  }
  const danger = hops.some(h => h.ul);
  console.log(danger ? '  >>> このリンクはアプリ起動リスクあり' : '  >>> 全ホップUL対象外');
}
