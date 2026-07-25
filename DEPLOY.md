# デプロイ手順（本番＝ tabidokoiko.com に一本化）

## 構成（2リポ）
- **mori-bear/dokoiko-site**（このリポ）= ソース（Astro）。canonical データは `src/data/destinations.json`。
- **mori-bear/dokoiko** = 本番の配信リポジトリ。GitHub Pages（main ブランチ直下）＋ `CNAME=tabidokoiko.com`。
  → **本番は必ずこの dokoiko リポ経由**。

## ★ 正しいデプロイ経路（これに一本化）
1. このリポ（dokoiko-site）でソースを編集する。
2. ビルド： `npm run build` → `dist/` が生成される（`astro.config.mjs` の `site: 'https://tabidokoiko.com'`）。
3. `dist/` の中身を **dokoiko リポの作業ツリーへ反映**する（`CNAME` と dokoiko 固有の `scripts/` は消さない）。
4. dokoiko リポで `git add -A && git commit && git push`。→ GitHub Pages が tabidokoiko.com を更新。
5. **反映確認（必須）**： dokoiko リポで `node scripts/verifyDeploy.mjs` を実行し、
   主要ページが「最新ビルドで反映済み」になっていることを実測確認してから「デプロイ完了」を報告する。

## ⚠️ 使用しない経路（無効化済み）
- `dokoiko-site/.github/workflows/deploy.yml` は **無効化**（`deploy.yml.disabled` にリネーム）。
  - これは mori-bear/dokoiko-site の GitHub Pages（`https://mori-bear.github.io/dokoiko-site/`）へ出す設定で、
    **誤ったデプロイ先**だった：
    - CNAME が無いため tabidokoiko.com ではなく `/dokoiko-site/` 配下に出る
    - `site: tabidokoiko.com` ビルドのためアセット参照が `/_astro/...`（ルート絶対）になり、
      `/dokoiko-site/` 配信ではアセットが 404 になって表示が壊れる
    - canonical が tabidokoiko.com を指す**重複コンテンツ**になり SEO 的にも有害
  - 復活させないこと。GitHub リポ設定側でも dokoiko-site の Pages は無効にしておくのが望ましい。

## 反映確認スクリプト
`dokoiko/scripts/verifyDeploy.mjs`
- tabidokoiko.com の主要5ページ（トップ / 目的地2 / ハブ / 一覧）を実際に fetch。
- HTTP 200・canonical が tabidokoiko.com・`/dokoiko-site/` 混入なし を確認。
- Astro の内容ハッシュ付きアセット（`_astro/*.css,*.js`）の集合が **ローカルの dokoiko 成果物と一致**するかで
  「最新ビルドが反映済みか」を判定（不一致なら未反映/伝播待ち）。
- 失敗時は exit code 1。
