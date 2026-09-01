# モデルアセット配置ディレクトリ

このディレクトリはビルド時に静的アセットとして同梱するモデルファイルの配置場所です。

## NER モデル (`ner-ja/`, 必須)

`config.json` / `tokenizer.json` / `tokenizer_config.json` / `special_tokens_map.json`
はリポジトリにコミット済みです。`onnx/model_quantized.onnx`（約265MB）だけは
GitHub の1ファイル100MB上限を超えるためコミットせず、GitHub Releases の
[`ner-model-v1`](https://github.com/virtuarian/pii-mask-offline/releases/tag/ner-model-v1)
にアセットとして配置し、`npm run dev` / `npm run build` の実行前に
`scripts/fetch-ner-model.mjs` が自動でダウンロードします（`package.json` 参照）。
手動で取得する場合は `node scripts/fetch-ner-model.mjs` を直接実行してください。
2回目以降はチェックサム一致時にダウンロードをスキップします。

モデルを更新・再生成する場合は以下の手順で生成し直し、`docs/CACHING_STRATEGY.md` の
`MODEL_CACHE_VERSION` を上げた上で、新しい ONNX ファイルを新しい Release タグ
（例: `ner-model-v2`）としてアップロードし、`scripts/fetch-ner-model.mjs` の
`MODEL_URL` / `MODEL_SHA256` / `MODEL_SIZE` を更新してコミットしてください。

```
pip install -r ../../scripts/requirements.txt
python ../../scripts/convert_ner_model.py --model tsmatz/xlm-roberta-ner-japanese --output ner-ja
python ../../scripts/eval_ner_model.py --model-dir ner-ja
gh release create ner-model-v2 --title "..." --notes "..." ner-ja/onnx/model_quantized.onnx
```

生成後のレイアウト:

```
ner-ja/
  config.json
  tokenizer.json
  tokenizer_config.json
  special_tokens_map.json
  onnx/model_quantized.onnx   (コミットせず、GitHub Releases から取得)
```

詳細・モデル選定理由は `docs/MODEL_SELECTION.md` を参照してください。
huggingface.co へのネットワークアクセスが必要です（本アプリの実行時には不要、変換作業時のみ）。

## LLM モデル (`llm-ja/`, 任意・実験的機能)

Layer 3（LLM補助層）を有効化する場合のみ、量子化済み GGUF ファイルを
`llm-ja/model.gguf` に配置してください（例: Qwen2.5-0.5B-Instruct Q4_K_M）。
デフォルトでは Layer 3 は無効化されており、このファイルが無くてもアプリは
正常に動作します。
