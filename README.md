# 個人情報マスキングツール（pii-mask-offline）

日本語テキストに含まれる個人情報（PII）を、ブラウザ内で完結してマスキングする
オフライン対応 PWA（Progressive Web App）です。テキストはネットワークに送信されず、
初回起動時にモデルアセットをキャッシュした後はオフラインでも動作します。

## 検出の仕組み（3層構成）

| Layer | 方式 | 対応カテゴリ | 状態 |
|---|---|---|---|
| 1. ルールベース | 正規表現（+ Luhnチェック等） | メールアドレス、電話番号、クレジットカード番号、マイナンバー、郵便番号 | 常時有効 |
| 2. NER | 日本語BERTベースの固有表現抽出（ONNX, 量子化） | 氏名、住所、組織名 | 常時有効 |
| 3. LLM補助（実験的） | 小型LLM（GGUF, wllama経由）による曖昧候補の再判定 | Layer 2の結果を補強 | デフォルト無効 |

各層の検出結果（`Span`）は `src/lib/detectors/merge.ts` の `resolveOverlaps` で
重複区間を解決し、`src/lib/mask.ts` がマスク済みテキストとハイライト用セグメントを構築します。
検出ソースの優先順位は `rule > ner > llm`（`src/lib/detectors/types.ts` の `SOURCE_PRIORITY`）。

Layer 3 はモバイルSafariでのWASM SIMD LLM推論の安定性リスクと、数百MB級モデルの
初回ダウンロード負荷を踏まえ、デフォルトでは `NoopLlmResolver`（何もしない実装）が
使われます。詳細は [`docs/MODEL_SELECTION.md`](docs/MODEL_SELECTION.md) を参照してください。

## セットアップ

```bash
npm install
```

### NERモデルの生成（初回セットアップ時に必須）

モデルのバイナリ本体はリポジトリにコミットされていないため、初回セットアップ時に
Python側で変換・生成する必要があります（huggingface.co へのネットワークアクセスが
必要ですが、アプリの実行時には不要です）。

```bash
pip install -r scripts/requirements.txt
python scripts/convert_ner_model.py --model knosing/japanese_ner_model --output public/models/ner-ja
python scripts/eval_ner_model.py --model-dir public/models/ner-ja
```

詳細は [`public/models/README.md`](public/models/README.md) を参照してください。

## 開発コマンド

```bash
npm run dev       # 開発サーバー起動
npm run build     # 型チェック + 本番ビルド
npm run preview   # ビルド成果物のプレビュー
npm run test      # テスト実行（vitest）
npm run lint      # 型チェックのみ
```

## アーキテクチャ概要

```
src/
  components/        UI（チャット風レイアウト、入力欄、結果表示、ステータスバー）
  hooks/              useNerModel / usePiiMasking / useOfflineStatus
  lib/
    detectors/
      rules/          正規表現ベースの検出器（メール、電話番号、カード番号など）
      ner/            ONNXモデルの読み込み・推論パイプライン、ラベルマッピング
      llm/             Layer 3 のプラガブルなresolverインターフェースと実装
      merge.ts        検出結果の重複解決
    mask.ts           マスク済みテキスト・セグメントの構築
  workers/            NER推論用の Web Worker
  sw/                 Service Worker本体とキャッシュ設定（injectManifest方式）
scripts/              モデル変換・精度検証・アイコン生成用のPythonスクリプト
public/models/        変換済みモデルアセットの配置先（gitignore対象）
docs/                 設計判断の詳細ドキュメント
```

## オフライン動作とキャッシュ戦略

Service Worker はアプリ本体（`app-shell-v{N}`）とNERモデル（`model-assets-v{N}`）を
別々のキャッシュに分離してプリキャッシュし、Cache First戦略でネットワーク接続なしに
動作します。バージョニング・キャッシュ退避の詳細は
[`docs/CACHING_STRATEGY.md`](docs/CACHING_STRATEGY.md) を参照してください。

## ドキュメント

- [`docs/MODEL_SELECTION.md`](docs/MODEL_SELECTION.md) — NER/LLMモデルの選定理由と精度検証手順
- [`docs/CACHING_STRATEGY.md`](docs/CACHING_STRATEGY.md) — Service Workerのキャッシュ設計
- [`public/models/README.md`](public/models/README.md) — モデルアセットの生成手順

## 既知の制限事項

- 開発サンドボックスの制約上、NERモデルの実測精度検証・iOS Safari実機での
  Service Worker動作確認はこのリポジトリ内では未実施です（詳細は各docsを参照）。
