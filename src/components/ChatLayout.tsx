import { useEffect, useRef, useState } from "react";
import { ChatHeader } from "./ChatHeader";
import { ChatIcon } from "./icons";
import { HistoryView } from "./HistoryView";
import { InputArea } from "./InputArea";
import { InputBubble } from "./InputBubble";
import { ResultBubble } from "./ResultBubble";
import { SettingsView } from "./SettingsView";
import { Sidebar, type AppView } from "./Sidebar";
import { usePiiMasking } from "../hooks/usePiiMasking";
import { useOfflineStatus } from "../hooks/useOfflineStatus";
import { filterVisibleSpans, maskText } from "../lib/mask";
import { resolveOverlaps } from "../lib/detectors/merge";
import { CATEGORY_LABEL_JA, type EntityCategory, type Span } from "../lib/detectors/types";

const ALL_CATEGORIES = new Set(Object.keys(CATEGORY_LABEL_JA) as EntityCategory[]);

const VIEW_TITLE: Record<AppView, string> = {
  chat: "Chat",
  history: "履歴",
  settings: "マスキング設定",
};

export interface Turn {
  id: number;
  input: string;
  spans: Span[] | null;
  error: string | null;
}

export function ChatLayout() {
  const [activeView, setActiveView] = useState<AppView>("chat");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(max-width: 720px)").matches,
  );
  const [llmEnabled, setLlmEnabled] = useState(false);
  const [mappingEnabled, setMappingEnabled] = useState(false);
  const [enabledCategories, setEnabledCategories] = useState<Set<EntityCategory>>(ALL_CATEGORIES);
  const { process, isProcessing, nerStatus, nerError } = usePiiMasking({ llmEnabled });
  const offline = useOfflineStatus();
  const [turns, setTurns] = useState<Turn[]>([]);
  const [nextId, setNextId] = useState(0);
  const [scrollToTurnId, setScrollToTurnId] = useState<number | null>(null);
  const turnRefs = useRef(new Map<number, HTMLDivElement>());

  useEffect(() => {
    if (activeView !== "chat" || scrollToTurnId === null) return;
    turnRefs.current.get(scrollToTurnId)?.scrollIntoView({ behavior: "smooth", block: "center" });
    setScrollToTurnId(null);
  }, [activeView, scrollToTurnId]);

  const handleSubmit = async (text: string) => {
    const id = nextId;
    setNextId((n) => n + 1);
    setTurns((prev) => [...prev, { id, input: text, spans: null, error: null }]);

    try {
      const spans = await process(text);
      setTurns((prev) => prev.map((t) => (t.id === id ? { ...t, spans } : t)));
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setTurns((prev) => prev.map((t) => (t.id === id ? { ...t, error: message } : t)));
    }
  };

  /** Applies a revert or recategorize edit from ResultBubble (never introduces new overlaps). */
  const handleSpansChange = (turnId: number, spans: Span[]) => {
    setTurns((prev) => prev.map((t) => (t.id === turnId ? { ...t, spans } : t)));
  };

  /** Adds a user-selected span from InputBubble, letting it win over any span it overlaps. */
  const handleAddSpan = (turnId: number, start: number, end: number, category: EntityCategory) => {
    setTurns((prev) =>
      prev.map((t) => {
        if (t.id !== turnId || !t.spans) return t;
        const newSpan: Span = { start, end, category, source: "manual", confidence: 1 };
        return { ...t, spans: resolveOverlaps([...t.spans, newSpan]) };
      }),
    );
  };

  const handleSelectTurn = (turnId: number) => {
    setScrollToTurnId(turnId);
    setActiveView("chat");
  };

  /** Copies the full session transcript (masked) so it can be pasted elsewhere. */
  const handleShare = async () => {
    const transcript = turns
      .filter((t) => t.spans)
      .map((t) => {
        const { visibleSpans } = filterVisibleSpans(t.spans!, enabledCategories);
        const { maskedText } = maskText(t.input, visibleSpans, { useMapping: mappingEnabled });
        return maskedText;
      })
      .join("\n\n");
    try {
      await navigator.clipboard.writeText(transcript);
    } catch (err) {
      console.error("clipboard write failed", err);
    }
  };

  return (
    <div className="app-shell">
      <Sidebar
        activeView={activeView}
        onViewChange={setActiveView}
        collapsed={sidebarCollapsed}
        onToggleCollapsed={() => setSidebarCollapsed((c) => !c)}
      />

      <div className="app-shell__main">
        <ChatHeader
          title={VIEW_TITLE[activeView]}
          onOpenHistory={() => setActiveView("history")}
          onOpenSettings={() => setActiveView("settings")}
          onShare={handleShare}
          shareDisabled={turns.every((t) => !t.spans)}
        />

        {activeView === "chat" && (
          <>
            <div className="chat-layout__messages">
              {turns.length === 0 && (
                <p className="chat-layout__empty">
                  テキストを入力すると、メールアドレス・電話番号・氏名・住所などの個人情報を検出し、
                  種別ラベルに置き換えて表示します（生成AIによる文章生成は行いません）。
                </p>
              )}
              {turns.map((turn) => (
                <div
                  key={turn.id}
                  className="chat-layout__turn"
                  ref={(el) => {
                    if (el) turnRefs.current.set(turn.id, el);
                    else turnRefs.current.delete(turn.id);
                  }}
                >
                  <InputBubble
                    text={turn.input}
                    onAddSpan={(start, end, category) => handleAddSpan(turn.id, start, end, category)}
                  />
                  <div className="assistant-row">
                    <span className="assistant-row__avatar" aria-hidden="true">
                      <ChatIcon />
                    </span>
                    <div className="assistant-row__bubbles">
                      {turn.error && <div className="bubble bubble--error">エラー: {turn.error}</div>}
                      {!turn.spans && !turn.error && (
                        <div className="bubble bubble--pending">検出処理中…</div>
                      )}
                      {turn.spans && (
                        <>
                          <div className="bubble bubble--status">マスキングが完了しました。</div>
                          <ResultBubble
                            text={turn.input}
                            spans={turn.spans}
                            mappingEnabled={mappingEnabled}
                            enabledCategories={enabledCategories}
                            onSpansChange={(spans) => handleSpansChange(turn.id, spans)}
                          />
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <InputArea
              onSubmit={handleSubmit}
              disabled={isProcessing}
              enabledCategories={enabledCategories}
              onEnabledCategoriesChange={setEnabledCategories}
              mappingEnabled={mappingEnabled}
              onMappingEnabledChange={setMappingEnabled}
              llmEnabled={llmEnabled}
              onLlmEnabledChange={setLlmEnabled}
            />
          </>
        )}

        {activeView === "history" && (
          <div className="app-shell__body">
            <HistoryView turns={turns} onSelectTurn={handleSelectTurn} />
          </div>
        )}

        {activeView === "settings" && (
          <div className="app-shell__body">
            <SettingsView
              nerStatus={nerStatus}
              nerError={nerError}
              offline={offline}
              enabledCategories={enabledCategories}
              onEnabledCategoriesChange={setEnabledCategories}
              llmEnabled={llmEnabled}
              onLlmEnabledChange={setLlmEnabled}
              mappingEnabled={mappingEnabled}
              onMappingEnabledChange={setMappingEnabled}
            />
          </div>
        )}
      </div>
    </div>
  );
}
