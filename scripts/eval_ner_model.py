#!/usr/bin/env python3
"""
Runs the converted+quantized ONNX NER model against a small hand-labeled set
of synthetic Japanese sentences containing PERSON/ADDRESS/ORGANIZATION
entities, and reports exact-span precision/recall/F1 per category.

This is a smoke-level sanity check, not a rigorous benchmark -- it exists to
catch label-mapping mistakes (see labelMap.ts) and gross regressions from
quantization, not to produce a publishable accuracy number.

Requires network access to huggingface.co only if --model-dir is omitted
(falls back to loading the original checkpoint by HF id for comparison).
When pointed at a local public/models/ner-ja/ directory produced by
convert_ner_model.py, it runs fully offline against the same ONNX file the
browser will use.

Usage:
    python scripts/eval_ner_model.py --model-dir public/models/ner-ja
"""
import argparse
import json
import re
from pathlib import Path

# (text, [(start, end, category), ...]) -- character offsets, category in
# {PERSON, ADDRESS, ORGANIZATION}. Kept in sync conceptually with
# src/lib/detectors/ner/labelMap.ts's target categories.
GOLD = [
    ("山田太郎です。よろしくお願いします。", [(0, 4, "PERSON")]),
    ("田中花子さんが会議に出席しました。", [(0, 4, "PERSON")]),
    ("東京都千代田区千代田1-1にお越しください。", [(0, 12, "ADDRESS")]),
    ("大阪府大阪市北区梅田に本社があります。", [(0, 10, "ADDRESS")]),
    ("株式会社サンプルにお問い合わせください。", [(0, 8, "ORGANIZATION")]),
    ("トヨタ自動車株式会社の株を購入した。", [(0, 10, "ORGANIZATION")]),
    ("佐藤健と鈴木一郎が同じチームです。", [(0, 3, "PERSON"), (4, 8, "PERSON")]),
    ("国立大学法人東京大学の研究室を訪問した。", [(0, 10, "ORGANIZATION")]),
    ("担当者は高橋美咲、勤務地は横浜市西区みなとみらいです。", [(4, 8, "PERSON"), (13, 21, "ADDRESS")]),
    ("北海道札幌市中央区に住んでいます。", [(0, 9, "ADDRESS")]),
    ("弊社の代表取締役は伊藤誠と申します。", [(9, 12, "PERSON")]),
    ("福岡県福岡市博多区博多駅前で待ち合わせましょう。", [(0, 13, "ADDRESS")]),
    ("楽天グループ株式会社と業務提携しました。", [(0, 10, "ORGANIZATION")]),
    ("渡辺さゆりです。本日はよろしくお願いいたします。", [(0, 3, "PERSON")]),
    ("名古屋市中村区名駅にオフィスを構えています。", [(0, 9, "ADDRESS")]),
]

CATEGORIES = ["PERSON", "ADDRESS", "ORGANIZATION"]

# Mirrors src/lib/detectors/ner/labelMap.ts -- keep these two in sync.
STOCKMARK_MAP = {
    "人名": "PERSON",
    "法人名": "ORGANIZATION",
    "政治的組織名": "ORGANIZATION",
    "その他の組織名": "ORGANIZATION",
    "地名": "ADDRESS",
    "施設名": "ADDRESS",
}
CONLL_STYLE_MAP = {"PER": "PERSON", "PERSON": "PERSON", "ORG": "ORGANIZATION", "LOC": "ADDRESS", "GPE": "ADDRESS"}


def map_label(raw_label: str):
    bare = re.sub(r"^[BI]-", "", raw_label)
    if bare in ("O", ""):
        return None
    return STOCKMARK_MAP.get(bare) or CONLL_STYLE_MAP.get(bare.upper())


def aggregate(tokens):
    """Mirrors aggregateEntities() in src/lib/detectors/ner/pipeline.ts."""
    groups = []
    for tok in tokens:
        bare = re.sub(r"^[BI]-", "", tok["entity"])
        if bare in ("O", ""):
            continue
        if groups and groups[-1]["label"] == bare and tok["start"] <= groups[-1]["end"]:
            groups[-1]["end"] = max(groups[-1]["end"], tok["end"])
            groups[-1]["score"] = min(groups[-1]["score"], tok["score"])
        else:
            groups.append({"label": bare, "start": tok["start"], "end": tok["end"], "score": tok["score"]})
    return groups


def run_inference_onnx(model_dir: Path, text: str):
    import numpy as np
    import onnxruntime as ort
    from transformers import AutoTokenizer

    tokenizer = AutoTokenizer.from_pretrained(model_dir)
    config = json.loads((model_dir / "config.json").read_text())
    id2label = config["id2label"]

    onnx_path = model_dir / "onnx" / "model_quantized.onnx"
    session = ort.InferenceSession(str(onnx_path))

    encoded = tokenizer(text, return_tensors="np", return_offsets_mapping=True)
    offsets = encoded.pop("offset_mapping")[0]
    ort_inputs = {k: v for k, v in encoded.items() if k in {i.name for i in session.get_inputs()}}
    logits = session.run(None, ort_inputs)[0][0]

    tokens = []
    for i, (start, end) in enumerate(offsets):
        if start == end:  # special tokens
            continue
        probs = softmax(logits[i])
        best = int(probs.argmax())
        tokens.append(
            {"entity": id2label[str(best)], "score": float(probs[best]), "start": int(start), "end": int(end)}
        )
    return tokens


def softmax(x):
    import numpy as np

    e = np.exp(x - np.max(x))
    return e / e.sum()


def score(predicted, gold):
    tp = len(predicted & gold)
    precision = tp / len(predicted) if predicted else 1.0
    recall = tp / len(gold) if gold else 1.0
    f1 = 2 * precision * recall / (precision + recall) if (precision + recall) else 0.0
    return precision, recall, f1


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--model-dir", required=True, help="Path to public/models/ner-ja")
    args = parser.parse_args()
    model_dir = Path(args.model_dir)

    all_pred, all_gold = set(), set()
    per_category_pred = {c: set() for c in CATEGORIES}
    per_category_gold = {c: set() for c in CATEGORIES}

    for sent_idx, (text, entities) in enumerate(GOLD):
        tokens = run_inference_onnx(model_dir, text)
        groups = aggregate(tokens)

        for g in groups:
            category = map_label(g["label"])
            if not category:
                continue
            key = (sent_idx, g["start"], g["end"], category)
            all_pred.add(key)
            per_category_pred[category].add(key)

        for start, end, category in entities:
            key = (sent_idx, start, end, category)
            all_gold.add(key)
            per_category_gold[category].add(key)

    print("=== 全体 (overall) ===")
    p, r, f1 = score(all_pred, all_gold)
    print(f"precision={p:.2f} recall={r:.2f} f1={f1:.2f} (n={len(all_gold)})")

    print("\n=== カテゴリ別 (per category) ===")
    for c in CATEGORIES:
        p, r, f1 = score(per_category_pred[c], per_category_gold[c])
        print(f"{c:14s} precision={p:.2f} recall={r:.2f} f1={f1:.2f} (n={len(per_category_gold[c])})")


if __name__ == "__main__":
    main()
