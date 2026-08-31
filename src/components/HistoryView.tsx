import type { Turn } from "./ChatLayout";

interface HistoryViewProps {
  turns: Turn[];
  onSelectTurn: (turnId: number) => void;
}

function statusLabel(turn: Turn): { text: string; tone: "ok" | "warn" | "error" } {
  if (turn.error) return { text: "エラー", tone: "error" };
  if (!turn.spans) return { text: "処理中", tone: "warn" };
  return { text: "完了", tone: "ok" };
}

export function HistoryView({ turns, onSelectTurn }: HistoryViewProps) {
  if (turns.length === 0) {
    return <p className="history-view__empty">まだ履歴がありません。AIチャットでテキストを送信すると、ここに一覧表示されます。</p>;
  }

  return (
    <ul className="history-view">
      {turns
        .slice()
        .reverse()
        .map((turn) => {
          const status = statusLabel(turn);
          return (
            <li key={turn.id}>
              <button type="button" className="history-view__item" onClick={() => onSelectTurn(turn.id)}>
                <span className="history-view__item-text">{turn.input}</span>
                <span className={`history-view__item-status history-view__item-status--${status.tone}`}>
                  {status.text}
                </span>
              </button>
            </li>
          );
        })}
    </ul>
  );
}
