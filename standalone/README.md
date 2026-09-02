# 個人情報マスキングツール(スタンドアロン / 単一HTML版)

`src/`(既存のPWA版)にあるルールベース検出・NER検出ロジックをそのまま再利用しつつ、
ビルド後の成果物が **`dist/standalone.html` 1ファイルだけ** になる版です。
サーバーもインストールも不要で、このファイルを開くだけで動作します。

## ビルド

```bash
npm install
npm run build:standalone
```

`dist/standalone.html`(約15MB)が生成されます。

## 使い方

`dist/standalone.html` をブラウザで開いてください。

- **メールアドレス・電話番号・マイナンバー・郵便番号・クレジットカード番号**は
  正規表現ベースの検出で、常にこの端末内だけで完結します(ネットワーク不要)。
- **氏名・住所・組織名**はAI(NER)モデルによる検出で、**初回利用時のみ**
  Hugging Face Hub から量子化済みモデル(`tsmatz/xlm-roberta-ner-japanese`、
  約265MB)をダウンロードします。ダウンロードしたモデルはブラウザの
  HTTPキャッシュ(Cache Storage)に保存されるため、2回目以降はネットワーク
  接続なしで動作します。
- `file://` で直接開いても動作しますが、ブラウザによっては `fetch`/Cache Storage
  の挙動が制限される場合があるため、うまく動かない場合はローカルサーバー経由
  (例: `npx serve dist` や `python3 -m http.server` を `dist/` で実行し、
  `http://localhost:...../standalone.html` を開く)を試してください。

## アーキテクチャ

PWA版(`src/`, `docs/CACHING_STRATEGY.md` 参照)とは配布形態が異なります。

| | PWA版 | スタンドアロン版 |
|---|---|---|
| 配布物 | ビルド済み複数ファイル + Service Worker | `standalone.html` 1ファイル |
| UI | React | Vanilla TypeScript(DOM API直接操作) |
| NERモデルの取得元 | 同一オリジンの静的アセット(`public/models/`) | Hugging Face Hub(初回のみ) |
| onnxruntime-web wasmランタイム | 同一オリジンの静的アセット | **ビルド時にHTMLへ直接埋め込み**(実行時のネットワーク取得なし) |
| オフライン保証の仕組み | Service Workerの明示キャッシュ | ブラウザの標準Cache Storage(transformers.jsが内部で使用) |

wasmランタイム(onnxruntime-web、約11MB)は動かないと話にならない核となる部分なので
ビルド時にbase64化してJSバンドルへ直接埋め込み、実行時は一切ネットワークへ
アクセスしません。NERモデル本体(約265MB)だけは、単一HTMLに埋め込むにはあまりに
大きすぎる(埋め込むとファイルが370MB超になる)ため、初回のみリモート取得という
設計にしています。

`src/lib/detectors/ner/pipeline.ts` の `configureNerPipeline()` が、この
「モデル取得元をどこにするか」の差し替えポイントです。PWA版は何も呼ばず
デフォルト(同一オリジンのみ)のまま、スタンドアロン版は
`standalone/src/worker.ts` から `allowRemoteModels: true` 等を指定して呼び出します。

## 制限事項

- 検出ロジック(正規表現層・NER集約ロジック・マスキング処理)はPWA版と共通の
  `src/lib/` をそのまま再利用しています。UI(カテゴリフィルタ、修正・再分類、
  履歴、LLM補助層など)はPWA版の一部機能のみを実装したミニマム版です。
- モバイル回線での初回ダウンロード負荷はPWA版と同様の課題を抱えています
  (`docs/CACHING_STRATEGY.md` の既知の制限事項を参照)。
