# どこ行こ？ (tabidokoiko.com) — 引き継ぎメモ

**最終更新**: 2026-05-19
**サイトURL**: https://tabidokoiko.com/
**リポジトリ**:
- ソース: `~/MORI-LAB/projects/dokoiko-site/`
- 公開: `~/MORI-LAB/projects/dokoiko/` (GitHub Pages from `main` branch)

---

## 現状サマリー

| 指標 | 値 |
|---|---|
| destinations 件数 | **1,380** |
| 都道府県カバレッジ | 47/47 |
| destination画像カバレッジ | **96.7%** (1,335/1,380) |
| spots総数 | 約4,076 |
| 記事品質 | 全件 4点満点（固有名詞・五感・連続「ます」・200字以上） |
| QA | 18,559 PASS / 0 FAIL |
| ビルドページ数 | 1,432 + リダイレクト1,380 = 1,432pages |

---

## アーキテクチャ

- **静的サイト**: Astro v6.2
- **データソース**: `src/data/destinations.json` (1,380件) + `src/data/hubCities.json` (出発都市)
- **画像**: `public/images/{id}/main.jpg` (destination), `public/images/spots/{id}/{n}.jpg` (spot)
- **記事**: `src/data/articles/{id}.json`（一部のみ）
- **テンプレ**: `src/pages/destinations/[id].astro` (getStaticPaths)

---

## 完了済み作業（時系列・主要のみ）

### データ整備
- 1218 → 1502 → 1483 → 1469 → 1453 → 1478 → 1741 → 1464 → 1380（重複統合・低品質削除を経て現状）
- 都道府県47件全網羅、北海道220件・他県20-50件
- niche_系288件（ローカルニッチ目的地）追加・285件残存
- gen_系（自動生成）: 山岳系全削除済み、温泉・観光255件残存

### 品質
- description全件4点品質化（Sonnet 4.6）
- spotsテンプレ文1010件リライト
- spots補完495件追加
- 名前シンプル化（「・」「（」削除）204+29件
- prefecture修正・破損destination削除
- 重複destination削除（玉藻公園・伏見稲荷大社・oita-city等）
- 施設系destination→hubのspots統合（28件＋56件削除）

### 画像
- Wikipedia/Openverse/Pixabay/Unsplash hybrid取得
- destination画像 100% → 96.7% (汎用重複45件をimages=[]に意図的変更)
- spot画像取得（Pixabay 1380件）
- 汎用重複画像問題: Pixabay page指定・英語クエリ・Commons・Openverseで段階的に解消
- 孤児画像フォルダ374件一掃

### UI/UX
- ヒーロー画像サイズ調整（モバイル45vh/PC55vh）
- 出発地select 全60都市常時表示
- ACCESS TIME出発地・JRリンク
- JR予約 → Yahoo!乗換案内
- 宿セクション三段（現地/hub/県庁所在地）保証
- 楽天レンタカーアフィリリンク追加
- 近隣destinationカード・グラデフォールバック画像
- SNSシェア（X・LINE）+ OGPメタ
- 沖縄発着は飛行機案内表示

### コード修正
- [object Object] 根本修正（src判定パス: フォルダ形式/旧形式/外部URL）
- 出発地と同じ都市を結果から除外
- カードの所要時間表記をtimeStrあれば表示
- HUB CITY表示が自身と一致時は非表示
- ICカード関連削除（reasonChips・description文・badge）
- 楽天URL `/place/` → `/yado/` 一括差替
- 宿リンク404を `/yado/{prefSlug}/` 形式で全件健全化

---

## 残タスク・未解決問題

### 残課題
- **画像なし45件**: 汎用重複を排除した結果、画像なし状態（個別取得が必要）
- **spots画像重複**: 113グループ・716件が3+件重複（修正中／本タスクで対応中）
- **niche_系の品質**: 一部のdestinationは観光地として価値が低い可能性（前回227件削除候補→225件救済・gen_56件削除）

### 改善余地
- description自体は質高いが、article.json (lead/sections/modelCourse) が無いdestinationが大半
- spots imageUrl が外部URL（Wikipedia等）のものをローカル保存に統一可
- 沖縄離島の細かい島（来間島・伊是名島など）の取材情報不足
- 動的レコメンド（出発地・日数・テーマベース）の精度

---

## 主要スクリプト一覧 (`scripts/`)

| カテゴリ | スクリプト |
|---|---|
| 品質QA | `qa.js` |
| ビルド前処理 | `generateRedirects.js` |
| API description | `improveWithClaudeAPI.js`, `rewriteWithSonnet.js`, `finalRewrite10.js`, `rewriteSpotsTemplates.js` |
| 画像取得 | `pixabayFetchAll.js`, `fetchSpotImages.js`, `refetchPageRetry.js`, `refetchSpotDups.js`, `aggressiveImageFetch.js` |
| データ管理 | `createCityHubs.js`, `createMore15Hubs.js`, `mergeFacilitiesToHubs.js`, `mergeGenOnsenSightToHubs.js`, `auditNicheAccuracy.js`, `qualityAuditAll.js`, `auditFacilityOnly.js` |
| 評価 | `evaluateNicheKeep.js`, `relooseAudit.js`, `relooseFacility.js`, `simplifyNames.js` |
| 検証 | `playwrightFullReview3.mjs`, `playwrightImageReview.mjs`, `verifyHotelLinkContent.mjs`, `hotelLinkCheckOnly.mjs`, `inspectKyoto.mjs` |

---

## デプロイフロー

```sh
cd ~/MORI-LAB/projects/dokoiko-site
npm run build
rm -rf ../dokoiko/destinations ../dokoiko/images ../dokoiko/_astro ../dokoiko/hub
cp -r dist/destinations ../dokoiko/destinations
cp -r public/images ../dokoiko/images
cp dist/index.html ../dokoiko/index.html
cp -r dist/_astro ../dokoiko/_astro
cp -r dist/hub ../dokoiko/hub
mkdir -p ../dokoiko/data && cp dist/data/destinations.json ../dokoiko/data/destinations.json
cp dist/sitemap.xml ../dokoiko/sitemap.xml
node scripts/generateRedirects.js
cp -r dist/destinations/. ../dokoiko/destinations/
git -C ~/MORI-LAB/projects/dokoiko add -A
git -C ~/MORI-LAB/projects/dokoiko commit -m "msg"
git -C ~/MORI-LAB/projects/dokoiko push origin main
```

⚠️ `cp -r dist/destinations ../dokoiko/destinations` を**2度実行するとディレクトリ二重化**するため、2度目は `cp -r dist/destinations/. ../dokoiko/destinations/` を使うこと。

---

## API・外部サービス

- **Anthropic Claude API** (`.env` ANTHROPIC_API_KEY)
  - `claude-haiku-4-5-20251001` (description補完)
  - `claude-sonnet-4-6` (高品質リライト・精査)
- **Pixabay** (`.env` PIXABAY_KEY: ハードコード in scripts)
- **Unsplash** (`.env` UNSPLASH_ACCESS_KEY)
- **Openverse, Wikimedia Commons, Wikipedia REST**: キー不要
- **Yahoo!乗換案内**: deeplink (`transit.yahoo.co.jp/search/result?from=&to=`)
- **楽天トラベル**: アフィリエイトリンク `/yado/{prefSlug}/`
- **じゃらん**: ValueCommerce 経由 `/kankou/prf{NN}/`
- **楽天レンタカー**: アフィリエイトリンク
