# Service Worker キャッシュ戦略

## 方式の選択: `injectManifest`（カスタムSW） vs `generateSW`

`vite-plugin-pwa` を `injectManifest` モードで使用している（`generateSW` の
自動生成ワークボックスルーティングではなく、`src/sw/service-worker.ts` を
自前で記述）。理由:

1. アプリ本体（JS/CSS/HTML/アイコン）とNERモデルアセットを**別々の名前付きキャッシュ**に
   分離し、どちらか一方だけを独立してバージョンアップ／破棄できるようにするため
   （`generateSW` の既定ルーティングは単一のプリキャッシュキャッシュを前提とする）。
2. オフライン時のフォールバック挙動（SPAナビゲーションを常にキャッシュ済み
   `index.html` へフォールバックする等）を明示的に制御するため。

## キャッシュの構成

`src/sw/cache-config.ts` に版数を定義している。

```ts
export const APP_CACHE_VERSION = "1";
export const MODEL_CACHE_VERSION = "1";
export const APP_SHELL_CACHE_NAME = `app-shell-v${APP_CACHE_VERSION}`;
export const MODEL_ASSETS_CACHE_NAME = `model-assets-v${MODEL_CACHE_VERSION}`;
```

- **`app-shell-v{N}`**: JS/CSS/HTML/アイコン/マニフェスト、および
  ONNX Runtime Web の wasm バイナリ（NER層の実行に必須のため、常時プリキャッシュ対象）。
- **`model-assets-v{N}`**: `public/models/ner-ja/` 配下（NERモデル本体・トークナイザ）。

分離した理由: アプリのUIだけを更新した場合に `APP_CACHE_VERSION` のみ上げれば済み、
数十MBのモデル再ダウンロードを毎回のリリースで強制しないため。逆にモデルを
差し替えた場合は `MODEL_CACHE_VERSION` のみを上げる。

Layer 3（LLM補助層）のアセット（`@wllama/wllama` の wasm、GGUFモデル）は
**意図的にどちらのキャッシュにも含めない**。`vite.config.ts` の
`injectManifest.globPatterns` / `globIgnores` で除外しており、
理由と挙動の詳細は `docs/MODEL_SELECTION.md` の「LLM補助層」節を参照。

## バージョニングと残留キャッシュの防止

`install` イベントでプリキャッシュマニフェスト（`self.__WB_MANIFEST`、
ビルド時に `vite-plugin-pwa` が実ファイル一覧へ置換）を2つのキャッシュへ振り分けて
`cache.addAll` する。`activate` イベントで `caches.keys()` を列挙し、
`CURRENT_CACHE_NAMES`（現行の `app-shell-v{N}` / `model-assets-v{N}`）に
含まれないキャッシュを**すべて削除**する。これにより、`APP_CACHE_VERSION` や
`MODEL_CACHE_VERSION` を上げるたびに旧バージョンのキャッシュが確実に破棄され、
ストレージに残留しない。

## フェッチ戦略

`fetch` イベントでは Cache First（キャッシュにあればそれを返し、無ければ
ネットワークへフォールバック）。ネットワークにも到達できず、かつ
ナビゲーションリクエスト（ページ遷移）である場合は、キャッシュ済みの
`index.html` を返す（オフライン時もSPAとして起動できるようにするため）。

## オフライン動作の要件との対応

- **初回起動のみネットワーク許可**: `install` 時に app-shell と NERモデルを
  一括ダウンロード・キャッシュする。以降の起動では `fetch` ハンドラが
  すべてのリクエストをキャッシュから解決するため、ネットワーク通信は発生しない
  （Layer 3を有効化しない限り）。
- **`env.allowRemoteModels = false` 相当の設定**: NERモデルは
  `public/models/ner-ja/` に同一オリジンの静的アセットとして同梱し、
  `src/lib/detectors/ner/pipeline.ts` で `env.allowRemoteModels = false` /
  `env.localModelPath = "/models/"` を明示的に設定している。
  Hugging Face Hub 等の外部CDNへのランタイムアクセスは発生しない。
- **CSP `connect-src 'self'`**: `index.html` の `Content-Security-Policy`
  メタタグで `connect-src 'self'` を設定している。モデルが同一オリジンの
  静的アセットであるため、これは字義通り満たされる（グレーゾーンのCDN許可が不要）。

## 既知の制限事項

- **iOS Safari実機での検証は本開発サンドボックス内では実施できていない**。
  Service Workerのキャッシュ容量上限やバックグラウンドでの
  Cache Storage自動退避（ストレージ逼迫時）はOS/ブラウザのバージョンに
  強く依存するため、実機での動作確認を別途行うこと（要件にも明記されている通り）。
- 初回プリキャッシュ総量は、ONNX Runtime Web の wasm バイナリ単体で約20MB、
  NERモデル（量子化後、未生成の場合は `public/models/README.md` の手順で生成）を
  加えると数十MB〜となる見込み。モバイル回線での初回体験について、
  UI側で進捗表示（`StatusBar` の「モデル準備中…」表示）を行っているが、
  より詳細なダウンロード進捗バーは今後の改善余地として残っている。
