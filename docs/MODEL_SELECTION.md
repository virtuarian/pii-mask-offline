# モデル選定理由と精度検証

## NER層（Layer 2）

### 選定モデル

**候補**: 日本語専用の `tohoku-nlp/bert-base-japanese-v3` ファインチューン系NERモデル
（例: `knosing/japanese_ner_model`。学習データは Stockmark 社の
`ner-wikipedia-dataset`〈人名・法人名・政治的組織名・その他の組織名・地名・施設名・製品名・イベント名〉）。

### 選定理由（多言語モデルとの比較）

| | 日本語専用 BERT-base | 多言語 XLM-RoBERTa-base |
|---|---|---|
| パラメータ数 | 約110M | 約270M |
| 量子化後サイズ目安 | 数十MB（int8） | 100MB超（int8） |
| 対応言語 | 日本語特化 | 100言語超（汎用） |
| モバイル初回DL負荷 | 低 | 高 |

本ツールはオフラインPWAとしてモバイル実機での利用を想定しており、初回ダウンロード時間と
Cache Storage容量への配慮を最優先事項とした。日本語のみを対象とする本ツールの用途では、
多言語モデルの汎用性は不要な一方でサイズのデメリットが直接効いてくるため、
日本語専用の軽量モデルを採用する（ユーザーとの合意事項）。

### 量子化

`scripts/convert_ner_model.py` が `optimum-cli export onnx` でONNXへ変換した後、
`onnxruntime.quantization.quantize_dynamic`（`QInt8`）で動的量子化する。
Transformers.js 側は `dtype: "q8"` を指定しており、これは規約上
`onnx/model_quantized.onnx` というファイル名を要求する（
`@huggingface/transformers` の `DEFAULT_DTYPE_SUFFIX_MAPPING` 参照）。
変換スクリプトはこのファイル名で出力するよう実装されている。

### ラベルマッピング

`src/lib/detectors/ner/labelMap.ts` が生モデルラベルを3カテゴリ（氏名/住所/組織名）へ変換する。
Stockmark方式の日本語ラベル（人名・法人名・政治的組織名・その他の組織名・地名・施設名）と
CoNLL方式の英語ラベル（PER/ORG/LOC等）の両方に対応しているが、
**実際に選定したチェックポイントの `config.json` の `id2label` を必ず確認し、
必要であれば `labelMap.ts` のマップを調整すること**
（`convert_ner_model.py` 実行後にコンソールへ確認コマンドを出力する）。

### 精度検証について（重要な制約事項）

`scripts/eval_ner_model.py` に、日本語PII（人名・住所・組織名）を含む
合成サンプル文15件の正解ラベル付きセットを同梱し、変換済みONNXモデルに対して
完全一致スパンでの適合率/再現率/F1を算出できるようにした。

**本セッションの開発サンドボックスは組織のegressポリシーにより `huggingface.co` への
アクセスがブロックされており（プロキシの状態エンドポイントで確認済み、
`connect_rejected: gateway answered 403 to CONNECT`）、実際のモデルダウンロード・
ONNX変換・量子化・精度検証を本セッション内で実行することができなかった。**
そのためこのドキュメントには実測の精度数値を記載していない
（実測していない数値を記載しないことを優先した）。

huggingface.co へアクセス可能な環境で以下を実行し、実測結果をこのファイルに追記すること:

```bash
pip install -r scripts/requirements.txt
python scripts/convert_ner_model.py --model knosing/japanese_ner_model --output public/models/ner-ja
python scripts/eval_ner_model.py --model-dir public/models/ner-ja
```

## LLM補助層（Layer 3, 実験的機能）

タスク合意により、本ビルドでは Layer 1（正規表現）・Layer 2（NER）を完全実装し、
Layer 3 は **デフォルト無効のプラガブルな scaffold** として提供する
（モバイルSafariにおけるWASM SIMD LLM推論の安定性リスクと、
数百MB級モデルの初回ダウンロード負荷を踏まえた判断）。

- インターフェース: `src/lib/detectors/llm/resolver.ts`
- デフォルト実装: `NoopLlmResolver`（常にNER結果をそのまま採用）
- オプトイン実装: `WllamaResolver`（`@wllama/wllama` 経由でGGUFモデルをロードし、
  NERが「曖昧」と判定した候補のみに対して分類名を1つ選ばせる）

有効化する場合の推奨モデル候補: `Qwen2.5-0.5B-Instruct` の Q4_K_M 量子化GGUF
（0.5B級、日本語対応、WASM上での実行速度とサイズのバランスが良い）。
`public/models/llm-ja/model.gguf` に配置しても、`vite.config.ts` の
`injectManifest.globPatterns` は `models/ner-ja/**/*` のみを対象としているため
**Service Workerの事前キャッシュには含まれない**（意図的な設計。Layer 3は
オプトイン機能であり、有効化しないユーザーに数百MBの追加ダウンロードを
強制しないため）。Layer 3 を有効化したユーザーは、初回利用時にネットワーク経由で
`model.gguf` を取得する（ブラウザの通常のHTTPキャッシュには乗るが、
Service Workerによる明示的なオフライン保証の対象外である点に注意）。
恒久的にプリキャッシュしたい場合は `globPatterns` に `models/llm-ja/**/*` を追加すること。
