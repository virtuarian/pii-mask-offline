#!/usr/bin/env node
/**
 * Fetches the quantized NER ONNX model from its GitHub Release asset into
 * public/models/ner-ja/onnx/, since the file (~265 MB) is too large for a
 * normal git push (GitHub's 100 MB per-file limit) and isn't tracked in the
 * repo (see public/models/README.md). The rest of ner-ja/ (config.json,
 * tokenizer.json, etc.) is small enough to be committed directly.
 *
 * Runs automatically before `dev`/`build` (see package.json). Skips the
 * download if a file already sitting at the destination already matches
 * MODEL_SHA256, so repeat runs (and CI caching) are cheap.
 */
import { createHash } from "node:crypto";
import { mkdir, rename, rm, stat } from "node:fs/promises";
import { createWriteStream, existsSync } from "node:fs";
import { pipeline } from "node:stream/promises";
import { fileURLToPath } from "node:url";

const MODEL_URL =
  "https://github.com/virtuarian/pii-mask-offline/releases/download/ner-model-v1/model_quantized.onnx";
const MODEL_SHA256 = "89756dd030b2c951beccfc1c739b11fa483a0ffe8b612e7352e032b9c1cc0fd5";
const MODEL_SIZE = 278233190;

const destPath = fileURLToPath(new URL("../public/models/ner-ja/onnx/model_quantized.onnx", import.meta.url));

async function sha256(path) {
  const hash = createHash("sha256");
  const { createReadStream } = await import("node:fs");
  await pipeline(createReadStream(path), hash);
  return hash.digest("hex");
}

async function isAlreadyValid() {
  if (!existsSync(destPath)) return false;
  const { size } = await stat(destPath);
  if (size !== MODEL_SIZE) return false;
  return (await sha256(destPath)) === MODEL_SHA256;
}

async function download() {
  await mkdir(new URL(".", `file://${destPath}`), { recursive: true });
  const tmpPath = `${destPath}.download`;
  const res = await fetch(MODEL_URL, { redirect: "follow" });
  if (!res.ok || !res.body) {
    throw new Error(`Failed to download NER model: HTTP ${res.status} ${res.statusText}`);
  }
  await pipeline(res.body, createWriteStream(tmpPath));
  const digest = await sha256(tmpPath);
  if (digest !== MODEL_SHA256) {
    await rm(tmpPath, { force: true });
    throw new Error(`Downloaded NER model checksum mismatch: expected ${MODEL_SHA256}, got ${digest}`);
  }
  await rename(tmpPath, destPath);
}

async function main() {
  if (await isAlreadyValid()) {
    console.log("NER model already present and verified, skipping download.");
    return;
  }
  console.log(`Downloading NER model (~265 MB) from ${MODEL_URL} ...`);
  await download();
  console.log(`NER model downloaded to ${destPath}`);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
