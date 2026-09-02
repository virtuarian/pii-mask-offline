import { detectByRules } from "../../src/lib/detectors/rules";
import { resolveOverlaps } from "../../src/lib/detectors/merge";
import { filterVisibleSpans, maskText } from "../../src/lib/mask";
import { CATEGORY_LABEL_JA, type EntityCategory, type Span } from "../../src/lib/detectors/types";
import type { NerWorkerRequest, NerWorkerResponse } from "./worker";

// build.mjs bundles standalone/src/worker.ts (which itself embeds the
// onnxruntime-web wasm runtime as blob: URLs) and injects its source text
// here so the worker can be spun up from a blob: URL with no separate file
// request -- the whole app is one HTML file.
declare const __WORKER_SOURCE__: string;

const ALL_CATEGORIES: EntityCategory[] = [
  "EMAIL",
  "PHONE",
  "CREDIT_CARD",
  "MY_NUMBER",
  "POSTAL_CODE",
  "PERSON",
  "ADDRESS",
  "ORGANIZATION",
];

function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Record<string, string> = {},
  children: Array<Node | string> = [],
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (key === "class") el.className = value;
    else el.setAttribute(key, value);
  }
  for (const child of children) {
    el.append(typeof child === "string" ? document.createTextNode(child) : child);
  }
  return el;
}

type NerStatus = "loading" | "ready" | "error";

/** Owns the NER Web Worker's lifecycle and exposes a request/response API over it. */
class NerWorkerClient {
  private worker: Worker;
  private pending = new Map<number, { resolve: (spans: Span[]) => void; reject: (err: Error) => void }>();
  private nextId = 0;
  status: NerStatus = "loading";
  errorMessage: string | null = null;
  onStatusChange: (() => void) | null = null;

  constructor() {
    const blob = new Blob([__WORKER_SOURCE__], { type: "text/javascript" });
    this.worker = new Worker(URL.createObjectURL(blob));
    this.worker.onmessage = (event: MessageEvent<NerWorkerResponse>) => {
      const msg = event.data;
      if (msg.type === "ready") {
        this.status = "ready";
        this.onStatusChange?.();
      } else if (msg.type === "result") {
        this.pending.get(msg.id)?.resolve(msg.detections);
        this.pending.delete(msg.id);
      } else if (msg.type === "error") {
        if (msg.id !== undefined) {
          this.pending.get(msg.id)?.reject(new Error(msg.message));
          this.pending.delete(msg.id);
        } else {
          this.status = "error";
          this.errorMessage = msg.message;
          this.onStatusChange?.();
        }
      }
    };
    this.worker.postMessage({ type: "preload" } satisfies NerWorkerRequest);
  }

  detect(text: string): Promise<Span[]> {
    return new Promise((resolve, reject) => {
      const id = this.nextId++;
      this.pending.set(id, { resolve, reject });
      this.worker.postMessage({ type: "detect", id, text } satisfies NerWorkerRequest);
    });
  }
}

function mount(): void {
  const root = document.getElementById("app");
  if (!root) throw new Error("missing #app root");

  const statusBadge = h("span", { class: "status-badge status-loading" }, ["NERモデル準備中…"]);
  const header = h("header", { class: "app-header" }, [
    h("h1", {}, ["個人情報マスキングツール"]),
    h("p", { class: "app-subtitle" }, ["Wasm実行・単一HTMLファイル完結のオフライン版"]),
  ]);

  const note = h("p", { class: "app-note" }, [
    "このページ自体はネットワーク接続なしで動作します。氏名・住所・組織名を検出するAIモデル(約280MB)のみ、初回実行時にインターネットから取得してブラウザにキャッシュします。以降はオフラインで動作します。メールアドレス・電話番号・マイナンバー・郵便番号・クレジットカード番号はモデル不要でこの端末内だけで検出されます。",
  ]);

  const categoryToggles = h("div", { class: "category-toggles" });
  const enabledCategories = new Set<EntityCategory>(ALL_CATEGORIES);
  for (const category of ALL_CATEGORIES) {
    const checkbox = h("input", { type: "checkbox", id: `cat-${category}`, checked: "" }) as HTMLInputElement;
    checkbox.checked = true;
    checkbox.addEventListener("change", () => {
      if (checkbox.checked) enabledCategories.add(category);
      else enabledCategories.delete(category);
      rerender();
    });
    const label = h("label", { for: `cat-${category}`, class: `category-chip cat-${category}` }, [
      checkbox,
      CATEGORY_LABEL_JA[category],
    ]);
    categoryToggles.append(label);
  }

  const input = h("textarea", {
    id: "input",
    rows: "14",
    placeholder: "マスキングしたいテキストをここに貼り付けてください",
  }) as HTMLTextAreaElement;

  const maskBtn = h("button", { class: "btn btn-primary", type: "button" }, ["マスキング実行"]) as HTMLButtonElement;
  const copyBtn = h("button", { class: "btn btn-outline", type: "button", disabled: "" }, [
    "結果をコピー",
  ]) as HTMLButtonElement;
  copyBtn.disabled = true;

  const resultView = h("div", { class: "result-view", "aria-live": "polite" }, [
    h("p", { class: "result-placeholder" }, ["マスキング結果はここに表示されます"]),
  ]);

  const errorBanner = h("div", { class: "error-banner", hidden: "" });
  errorBanner.hidden = true;

  const inputPanel = h("section", { class: "panel" }, [
    h("label", { class: "panel-label", for: "input" }, ["入力テキスト"]),
    input,
    h("div", { class: "panel-actions" }, [maskBtn]),
  ]);

  const resultPanel = h("section", { class: "panel" }, [
    h("div", { class: "panel-label-row" }, [h("span", { class: "panel-label" }, ["マスキング結果"]), copyBtn]),
    resultView,
  ]);

  root.append(
    header,
    statusBadge,
    note,
    errorBanner,
    h("div", { class: "category-toggles-wrap" }, [
      h("span", { class: "panel-label" }, ["検出カテゴリ"]),
      categoryToggles,
    ]),
    h("div", { class: "panels" }, [inputPanel, resultPanel]),
  );

  const nerClient = new NerWorkerClient();
  function updateStatusBadge(): void {
    statusBadge.className = `status-badge status-${nerClient.status}`;
    if (nerClient.status === "loading") {
      statusBadge.textContent = "NERモデル準備中…(初回はダウンロードに数分かかる場合があります)";
    } else if (nerClient.status === "ready") {
      statusBadge.textContent = "AI検出(氏名・住所・組織名)が利用可能です";
    } else {
      statusBadge.textContent = "AI検出は利用できません(パターン検出のみで続行)";
      errorBanner.hidden = nerClient.errorMessage === null;
      errorBanner.textContent = nerClient.errorMessage
        ? `NERモデルの読み込みに失敗しました: ${nerClient.errorMessage}`
        : "";
    }
  }
  nerClient.onStatusChange = updateStatusBadge;
  updateStatusBadge();

  let lastText = "";
  let lastSpans: Span[] = [];
  let lastMaskedText = "";
  let hasResult = false;

  function rerender(): void {
    if (!hasResult) return;
    const { visibleSpans } = filterVisibleSpans(lastSpans, enabledCategories);
    const result = maskText(lastText, visibleSpans);
    lastMaskedText = result.maskedText;
    resultView.innerHTML = "";
    if (lastText === "") {
      resultView.append(h("p", { class: "result-placeholder" }, ["マスキング結果はここに表示されます"]));
      copyBtn.disabled = true;
      return;
    }
    for (const segment of result.segments) {
      if (segment.masked && segment.category) {
        resultView.append(h("span", { class: `mask-badge cat-${segment.category}` }, [segment.text]));
      } else {
        resultView.append(document.createTextNode(segment.text));
      }
    }
    copyBtn.disabled = false;
  }

  async function runMasking(): Promise<void> {
    const text = input.value;
    lastText = text;
    hasResult = true;
    if (text.trim() === "") {
      lastSpans = [];
      rerender();
      return;
    }

    maskBtn.disabled = true;
    maskBtn.textContent = "検出中…";
    try {
      const ruleSpans = detectByRules(text);
      let spans = ruleSpans;
      if (nerClient.status === "ready") {
        try {
          const nerSpans = await nerClient.detect(text);
          spans = resolveOverlaps([...ruleSpans, ...nerSpans]);
        } catch (err) {
          console.error("NER detection failed, falling back to rule-based results only:", err);
        }
      }
      lastSpans = spans;
      rerender();
    } finally {
      maskBtn.disabled = false;
      maskBtn.textContent = "マスキング実行";
    }
  }

  maskBtn.addEventListener("click", () => {
    void runMasking();
  });
  copyBtn.addEventListener("click", () => {
    void navigator.clipboard.writeText(lastMaskedText);
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", mount);
} else {
  mount();
}
