#!/usr/bin/env python3
"""
Converts a Hugging Face token-classification checkpoint into the ONNX layout
Transformers.js expects for a same-origin, statically-bundled local model
(see docs/MODEL_SELECTION.md and src/lib/detectors/ner/pipeline.ts).

Requires network access to huggingface.co, which this repo's own dev
sandbox does NOT have (its egress policy blocks that host) -- run this on a
machine that does, then commit or otherwise ship the resulting
public/models/ner-ja/ directory.

Usage:
    pip install -r scripts/requirements.txt
    python scripts/convert_ner_model.py \
        --model tsmatz/xlm-roberta-ner-japanese \
        --output public/models/ner-ja

Note: the checkpoint's tokenizer must have a "fast" (tokenizer.json) form --
Transformers.js can't load anything else, and can't run tokenizers requiring
external morphological analyzers like MeCab (rules out tohoku-nlp/bert-base-
japanese-* fine-tunes; see docs/MODEL_SELECTION.md for how this was found).
Some checkpoints also don't ship their own tokenizer files on the Hub at all
(e.g. knosing/japanese_ner_model) -- check the model card for the base
tokenizer to pass via --tokenizer. If omitted, --tokenizer defaults to --model.

Output layout (what Transformers.js's env.localModelPath="/models/" expects):
    <output>/config.json
    <output>/tokenizer.json
    <output>/tokenizer_config.json
    <output>/special_tokens_map.json
    <output>/onnx/model_quantized.onnx   <- dtype:"q8" in pipeline.ts maps to this filename
"""
import argparse
import shutil
import tempfile
from pathlib import Path


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--model", required=True, help="HF Hub model id, e.g. tsmatz/xlm-roberta-ner-japanese")
    parser.add_argument(
        "--tokenizer",
        default=None,
        help="HF Hub tokenizer id, if different from --model (check the model card). Defaults to --model.",
    )
    parser.add_argument("--output", required=True, help="Output directory, e.g. public/models/ner-ja")
    args = parser.parse_args()

    output_dir = Path(args.output)
    output_dir.mkdir(parents=True, exist_ok=True)
    (output_dir / "onnx").mkdir(exist_ok=True)

    with tempfile.TemporaryDirectory() as tmp:
        tmp_path = Path(tmp)
        export_with_optimum(args.model, tmp_path)
        quantize(tmp_path / "model.onnx", output_dir / "onnx" / "model_quantized.onnx")
        save_tokenizer(args.tokenizer or args.model, tmp_path)
        copy_tokenizer_and_config(tmp_path, output_dir)

    print(f"\nDone. Verify the label set matches src/lib/detectors/ner/labelMap.ts:")
    print(f"  python -c \"import json; print(json.load(open('{output_dir}/config.json'))['id2label'])\"")
    print(f"Then validate accuracy with: python scripts/eval_ner_model.py --model-dir {output_dir}")


def export_with_optimum(model_id: str, tmp_path: Path) -> None:
    # optimum-cli handles the PyTorch -> ONNX graph export, including the
    # token-classification head and correct input/output signatures.
    import subprocess

    subprocess.run(
        [
            "optimum-cli", "export", "onnx",
            "--model", model_id,
            "--task", "token-classification",
            str(tmp_path),
        ],
        check=True,
    )


def quantize(fp32_path: Path, quantized_path: Path) -> None:
    from onnxruntime.quantization import QuantType, quantize_dynamic

    quantize_dynamic(
        model_input=str(fp32_path),
        model_output=str(quantized_path),
        weight_type=QuantType.QInt8,
    )
    print(f"fp32:      {fp32_path.stat().st_size / 1e6:.1f} MB")
    print(f"quantized: {quantized_path.stat().st_size / 1e6:.1f} MB")


def save_tokenizer(tokenizer_id: str, tmp_path: Path) -> None:
    # optimum-cli's own preprocessor-saving step swallows tokenizer load
    # errors, so some fine-tuned checkpoints silently end up with no
    # tokenizer files at all. Load and save it explicitly instead.
    from transformers import AutoTokenizer

    AutoTokenizer.from_pretrained(tokenizer_id).save_pretrained(tmp_path)


def copy_tokenizer_and_config(tmp_path: Path, output_dir: Path) -> None:
    for name in [
        "config.json",
        "tokenizer.json",
        "tokenizer_config.json",
        "special_tokens_map.json",
        "vocab.txt",
    ]:
        src = tmp_path / name
        if src.exists():
            shutil.copy(src, output_dir / name)


if __name__ == "__main__":
    main()
