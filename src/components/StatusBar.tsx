import type { NerModelStatus } from "../hooks/useNerModel";
import type { OfflineStatus } from "../hooks/useOfflineStatus";

interface StatusBarProps {
  nerStatus: NerModelStatus;
  nerError: string | null;
  offline: OfflineStatus;
}

function describe(
  nerStatus: NerModelStatus,
  nerError: string | null,
  offline: OfflineStatus,
): { text: string; tone: "ok" | "warn" | "error" } {
  if (nerStatus === "error") {
    const detail = nerError ? `（詳細: ${nerError}）` : "";
    return { text: `NERモデルの読み込みに失敗しました${detail}。再読み込みしてください。`, tone: "error" };
  }
  if (nerStatus !== "ready") {
    return { text: "モデル準備中…（初回はダウンロードに時間がかかります）", tone: "warn" };
  }
  if (offline.readiness === "ready") {
    return { text: "モデル準備完了・オフライン利用可", tone: "ok" };
  }
  if (offline.readiness === "checking") {
    return { text: "キャッシュ状態を確認中…", tone: "warn" };
  }
  return { text: "モデル未キャッシュ（オフライン再訪には初回のネットワーク接続が必要です）", tone: "warn" };
}

export function StatusBar({ nerStatus, nerError, offline }: StatusBarProps) {
  const { text, tone } = describe(nerStatus, nerError, offline);
  return (
    <div className={`status-bar status-bar--${tone}`} role="status">
      <span className="status-bar__dot" aria-hidden="true" />
      <span>{text}</span>
      <span className="status-bar__net">{offline.online ? "🌐 オンライン" : "📴 オフライン"}</span>
    </div>
  );
}
