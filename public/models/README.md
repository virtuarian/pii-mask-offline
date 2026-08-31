# モデルアセット配置ディレクトリ

このディレクトリはビルド時に静的アセットとして同梱するモデルファイルの配置場所です。
バイナリ本体（`*.onnx`, `*.gguf` 等）はリポジトリにコミットしません（`.gitignore` 参照）。
初回セットアップ時に以下の手順で生成してください。

## NER モデル (`ner-ja/`, 必須)

```
pip install -r ../../scripts/requirements.txt
python ../../scripts/convert_ner_model.py --model tsmatz/xlm-roberta-ner-japanese --output ner-ja
python ../../scripts/eval_ner_model.py --model-dir ner-ja
```

生成後のレイアウト:

```
ner-ja/
  config.json
  tokenizer.json
  tokenizer_config.json
  special_tokens_map.json
  onnx/model_quantized.onnx
```

詳細・モデル選定理由は `docs/MODEL_SELECTION.md` を参照してください。
huggingface.co へのネットワークアクセスが必要です（本アプリの実行時には不要、変換作業時のみ）。

## LLM モデル (`llm-ja/`, 任意・実験的機能)

Layer 3（LLM補助層）を有効化する場合のみ、量子化済み GGUF ファイルを
`llm-ja/model.gguf` に配置してください（例: Qwen2.5-0.5B-Instruct Q4_K_M）。
デフォルトでは Layer 3 は無効化されており、このファイルが無くてもアプリは
正常に動作します。
