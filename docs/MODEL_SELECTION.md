# モデル選定理由と精度検証

## NER層（Layer 2）

### 選定モデル

**採用**: `tsmatz/xlm-roberta-ner-japanese`（`xlm-roberta-base` のファインチューン。
学習データは Stockmark 社の `ner-wikipedia-dataset` を英語タグ
〈PER・ORG・ORG-P・ORG-O・LOC・INS・PRD・EVT〉に置き換えたもの）。

**却下した候補とその理由（重要な制約事項）**: 当初は日本語専用の
`tohoku-nlp/bert-base-japanese-v3` ファインチューン系（例: `knosing/japanese_ner_model`）を
第一候補としていたが、実際に `scripts/convert_ner_model.py` で変換・検証した結果、
**このトークナイザーは Transformers.js では原理的に動作しないことが判明した**:

- `tohoku-nlp/bert-base-japanese-v3` は MeCab（`fugashi`/`unidic-lite`）による
  単語分割を前提とした `BertJapaneseTokenizer` を使用する。
- このトークナイザークラスには HuggingFace が提供する "fast" (Rust/WASM) 実装が
  存在せず、`tokenizer.json` を生成できない。
- `@huggingface/transformers`（本プロジェクトが使用するブラウザ側ランタイム）は
  `tokenizer.json` を前提としたトークナイザーしか読み込めず、MeCab相当の実装も
  持たないため、このモデル系統はブラウザで一切動作しない。

さらに `knosing/japanese_ner_model` 自体はHub上にトークナイザーファイルを
一切同梱しておらず（モデルカードに `tohoku-nlp/bert-base-japanese-v3` を
別途使うよう明記されているのみ）、変換スクリプトも当初この前提を欠いていたため
二重に変換が壊れていた（`scripts/convert_ner_model.py` の `--tokenizer` 引数として
修正済み）。

### 選定理由（多言語モデルとの比較・サイズの妥協について）

| | 日本語専用 BERT-base（不採用） | 採用: 多言語 XLM-RoBERTa-base |
|---|---|---|
| パラメータ数 | 約110M | 約270M |
| 量子化後サイズ（実測） | ―（動作不可のため未計測） | **278.2 MB**（fp32: 1110.1 MB） |
| 対応言語 | 日本語特化 | 100言語超（汎用） |
| Transformers.js互換 | **不可**（fast tokenizer非対応） | 可（SentencePiece, `tokenizer.json`同梱） |

本ツールはオフラインPWAとしてモバイル実機での利用を想定しており、当初は初回ダウンロード
時間とCache Storage容量への配慮から「数十MB」規模の日本語専用モデルを最優先としていたが、
上記の理由でその方針は技術的に実現不可能と判明した。現時点で確認できている
Transformers.js互換の日本語NERモデルは本モデルのみであり、278MBという量子化後サイズは
当初目標を大きく超過するが、**動作するモデルを優先し採用する**（ユーザーとの合意事項）。
より小さい代替（SentencePieceベースの日本語専用モデル等）が見つかった場合は
差し替えを検討すること。

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
CoNLL方式の英語ラベル（PER/ORG/ORG-P/ORG-O/LOC/INS等）の両方に対応している。
採用モデル `tsmatz/xlm-roberta-ner-japanese` の `id2label` は
`{0: O, 1: PER, 2: ORG, 3: ORG-P, 4: ORG-O, 5: LOC, 6: INS, 7: PRD, 8: EVT}` で、
PRD（製品名）・EVT（イベント名）はPIIカテゴリ対象外として無視、
ORG/ORG-P/ORG-Oは組織名、LOC/INSは住所へマッピング済み（`CONLL_STYLE_MAP`）。
**新しいチェックポイントに差し替える場合は `config.json` の `id2label` を必ず確認し、
必要であれば `labelMap.ts`（および `scripts/eval_ner_model.py` 内のミラー）のマップを
調整すること**（`convert_ner_model.py` 実行後にコンソールへ確認コマンドを出力する）。

### 精度検証（実測済み）

`scripts/eval_ner_model.py` に、日本語PII（人名・住所・組織名）を含む
合成サンプル文15件の正解ラベル付きセットを同梱し、変換済みONNXモデルに対して
完全一致スパンでの適合率/再現率/F1を算出する。

以下のコマンドで実測した結果（2026-08-31、`tsmatz/xlm-roberta-ner-japanese` を
`onnxruntime.quantization.quantize_dynamic`（`QInt8`）で量子化したモデル）:

```bash
pip install -r scripts/requirements.txt
python scripts/convert_ner_model.py --model tsmatz/xlm-roberta-ner-japanese --output public/models/ner-ja
python scripts/eval_ner_model.py --model-dir public/models/ner-ja
```

```
=== 全体 (overall) ===
precision=0.60 recall=0.71 f1=0.65 (n=17)

=== カテゴリ別 (per category) ===
PERSON         precision=0.86 recall=0.86 f1=0.86 (n=7)
ADDRESS        precision=0.33 recall=0.50 f1=0.40 (n=6)
ORGANIZATION   precision=0.75 recall=0.75 f1=0.75 (n=4)
```

このスコアはあくまで15文の合成サンプルによるスモークテストであり、統計的に有意な
ベンチマークではない（`eval_ner_model.py` 冒頭のdocstring参照）。ADDRESS（住所）の
F1が特に低く、量子化やラベルマッピングの回帰検知には使えるが、実運用の精度は
より大規模な評価セットで別途検証すること。

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
