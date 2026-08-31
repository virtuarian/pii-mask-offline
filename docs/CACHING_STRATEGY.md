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

### ONNX Runtime Web wasm のサイズ最適化

`@huggingface/transformers` は既定で `onnxruntime-web` のフルビルド
（WebGPU/JSEPサポート込み、wasmバイナリ約21.6MB）を読み込む。本アプリは
WebGPUを使わず常に `wasm` 実行プロバイダのみを使うため、`vite.config.ts` の
`resolve.alias` で `onnxruntime-web` → `onnxruntime-web/wasm`
（wasm専用ビルド、約11.1MB）へ差し替え、初回必須ダウンロードを約半減させている。

この wasm-only ビルドは wasm バイナリのURLを実行時に動的組み立てするため、
Vite/Rollupが静的解析でアセットとして検出できない。そのため
`vite.config.ts` が `node_modules/onnxruntime-web/dist/` から
`public/ort/ort-wasm-simd-threaded.wasm` へ自動同期し（`npm install` 後の
初回 `vite`/`vite build` 実行時に同期される。バイナリ自体はリポジトリに
コミットしない、`.gitignore` 参照）、`src/lib/detectors/ner/pipeline.ts` が
`env.backends.onnx.wasm.wasmPaths = "/ort/"` を明示設定してこの
同一オリジンパスから読み込ませている。

分離した理由: アプリのUIだけを更新した場合に `APP_CACHE_VERSION` のみ上げれば済み、
数十MBのモデル再ダウンロードを毎回のリリースで強制しないため。逆にモデルを
差し替えた場合は `MODEL_CACHE_VERSION` のみを上げる。

Layer 3（LLM補助層）のアセット（`@wllama/wllama` の wasm、GGUFモデル）は
**意図的にどちらのキャッシュにも含めない**。`vite.config.ts` の
`injectManifest.globPatterns` / `globIgnores` で除外しており、
理由と挙動の詳細は `docs/MODEL_SELECTION.md` の「LLM補助層」節を参照。

## バージョニングと残留キャッシュの防止

`install` イベントでプリキャッシュマニフェスト（`self.__WB_MANIFEST`、
ビルド時に `vite-plugin-pwa` が実ファイル一覧へ置換）のうち、app-shell分のみを
`cache.addAll` で即座にキャッシュする。**NERモデル（`models/`配下）は意図的に
`install` 時の一括ダウンロード対象から外している**: NERパイプライン
（`useNerModel` のマウント時処理）がページ読み込み直後に同じファイルへ
自力でアクセスするため、`install` 側でも同時に`addAll`すると同一の
巨大ファイル（量子化ONNXモデル約278MB）への同時ダウンロードが競合し、
実際に`vite preview`環境で "Failed to fetch" という形で初回読み込みが
不安定に失敗する事象を確認した。代わりに`fetch`ハンドラ側でモデル
アセットのレスポンスをキャッシュに書き込むことで、NERパイプライン自身の
1回のリクエストだけでモデルがキャッシュされ、二重ダウンロードを避けつつ
初回訪問後は完全にオフラインキャッシュ済みの状態になる（詳細は
`service-worker.ts` の `install`/`fetch` ハンドラのコメント参照）。

`activate` イベントで `caches.keys()` を列挙し、
`CURRENT_CACHE_NAMES`（現行の `app-shell-v{N}` / `model-assets-v{N}`）に
含まれないキャッシュを**すべて削除**する。これにより、`APP_CACHE_VERSION` や
`MODEL_CACHE_VERSION` を上げるたびに旧バージョンのキャッシュが確実に破棄され、
ストレージに残留しない。

## フェッチ戦略

`fetch` イベントでは Cache First（キャッシュにあればそれを返し、無ければ
ネットワークへフォールバック）。ネットワークから取得したレスポンスが
モデルアセット（`models/`配下）の場合は、返す前に `model-assets` キャッシュへ
書き込む（上記の通り、これが実質的なモデルの初回キャッシュ経路）。
ネットワークにも到達できず、かつナビゲーションリクエスト（ページ遷移）で
ある場合は、キャッシュ済みの `index.html` を返す（オフライン時もSPAとして
起動できるようにするため）。

## オフライン動作の要件との対応

- **初回起動のみネットワーク許可**: `install` 時にapp-shellを、初回のNER利用時
  （＝ページ読み込み直後、上記の理由で `install` とは別経路）にNERモデルを
  それぞれキャッシュする。以降の起動では `fetch` ハンドラがすべてのリクエストを
  キャッシュから解決するため、ネットワーク通信は発生しない（Layer 3を
  有効化しない限り）。
- **`env.allowRemoteModels = false` 相当の設定**: NERモデルは
  `public/models/ner-ja/` に同一オリジンの静的アセットとして同梱し、
  `src/lib/detectors/ner/pipeline.ts` で `env.allowRemoteModels = false` /
  `env.localModelPath = "/models/"` を明示的に設定している。
  Hugging Face Hub 等の外部CDNへのランタイムアクセスは発生しない。
- **CSP `connect-src 'self'`**: `index.html` の `Content-Security-Policy`
  メタタグで `connect-src 'self'` を設定している。モデルが同一オリジンの
  静的アセットであるため、これは字義通り満たされる（グレーゾーンのCDN許可が不要）。
- **CSP `script-src 'wasm-unsafe-eval'` / `worker-src 'blob:'`**: NER層
  （onnxruntime-web）とLLM補助層（`@wllama/wllama`）のいずれもWebAssemblyを
  実行時にコンパイルするため、`'wasm-unsafe-eval'` が無いと Chrome が
  `WebAssembly.instantiate()` 自体をブロックする（`script-src 'self'` のみでは
  実際に動作しないことを確認済み）。`wllama` は内部で `blob:` URLから
  Workerを生成するため `worker-src`/`child-src` にも `blob:` が必要。
  いずれも WASM実行またはWorker生成のみを許可する狭いスコープの緩和であり、
  `'unsafe-eval'`（任意のJS `eval`/`Function` 実行）を許可するものではない。

## 既知の制限事項

- **iOS Safari実機での検証は本開発サンドボックス内では実施できていない**。
  Service Workerのキャッシュ容量上限やバックグラウンドでの
  Cache Storage自動退避（ストレージ逼迫時）はOS/ブラウザのバージョンに
  強く依存するため、実機での動作確認を別途行うこと（要件にも明記されている通り）。
- 初回キャッシュ総量は、ONNX Runtime Web の wasm バイナリ単体で約11MB
  （wasm-only ビルドへの最適化後。上記「ONNX Runtime Web wasm のサイズ最適化」参照）、
  NERモデル（`tsmatz/xlm-roberta-ner-japanese` を量子化、実測278.2MB。
  選定理由は `docs/MODEL_SELECTION.md` 参照）を加えると実測約300MBとなる。
  当初目標としていた「数十MB」規模には収まっていない点に注意
  （`docs/MODEL_SELECTION.md` の該当節に経緯を記載）。モバイル回線での
  初回体験について、UI側で進捗表示（`StatusBar` の「モデル準備中…」表示）を
  行っているが、より詳細なダウンロード進捗バーは今後の改善余地として残っている。
