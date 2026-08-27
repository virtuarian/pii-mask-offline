import { useState } from "react";
import { InputArea } from "./InputArea";
import { ResultBubble } from "./ResultBubble";
import { StatusBar } from "./StatusBar";
import { usePiiMasking } from "../hooks/usePiiMasking";
import { useOfflineStatus } from "../hooks/useOfflineStatus";
import type { MaskResult } from "../lib/mask";

interface Turn {
  id: number;
  input: string;
  result: MaskResult | null;
  error: string | null;
}

export function ChatLayout() {
  const [llmEnabled, setLlmEnabled] = useState(false);
  const { process, isProcessing, nerStatus } = usePiiMasking({ llmEnabled });
  const offline = useOfflineStatus();
  const [turns, setTurns] = useState<Turn[]>([]);
  const [nextId, setNextId] = useState(0);

  const handleSubmit = async (text: string) => {
    const id = nextId;
    setNextId((n) => n + 1);
    setTurns((prev) => [...prev, { id, input: text, result: null, error: null }]);

    try {
      const result = await process(text);
      setTurns((prev) => prev.map((t) => (t.id === id ? { ...t, result } : t)));
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setTurns((prev) => prev.map((t) => (t.id === id ? { ...t, error: message } : t)));
    }
  };

  return (
    <div className="chat-layout">
      <header className="chat-layout__header">
        <h1>個人情報マスキングツール</h1>
        <StatusBar nerStatus={nerStatus} offline={offline} />
      </header>

      <div className="chat-layout__messages">
        {turns.length === 0 && (
          <p className="chat-layout__empty">
            テキストを入力すると、メールアドレス・電話番号・氏名・住所などの個人情報を検出し、
            種別ラベルに置き換えて表示します（生成AIによる文章生成は行いません）。
          </p>
        )}
        {turns.map((turn) => (
          <div key={turn.id} className="chat-layout__turn">
            <div className="bubble bubble--input">
              <div className="bubble__label">入力</div>
              <p className="bubble__text">{turn.input}</p>
            </div>
            {turn.error && <div className="bubble bubble--error">エラー: {turn.error}</div>}
            {turn.result && <ResultBubble segments={turn.result.segments} />}
            {!turn.result && !turn.error && <div className="bubble bubble--pending">検出処理中…</div>}
          </div>
        ))}
      </div>

      <InputArea
        onSubmit={handleSubmit}
        disabled={isProcessing}
        llmEnabled={llmEnabled}
        onLlmEnabledChange={setLlmEnabled}
      />
    </div>
  );
}
