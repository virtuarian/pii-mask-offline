import { ChatIcon, GearIcon, HistoryIcon, MenuIcon } from "./icons";

export type AppView = "chat" | "history" | "settings";

interface SidebarProps {
  activeView: AppView;
  onViewChange: (view: AppView) => void;
  collapsed: boolean;
  onToggleCollapsed: () => void;
}

/** Collapsed state hides everything but the toggle button itself -- not an icon rail. */
export function Sidebar({ activeView, onViewChange, collapsed, onToggleCollapsed }: SidebarProps) {
  if (collapsed) {
    return (
      <aside className="sidebar sidebar--collapsed">
        <button
          type="button"
          className="sidebar__toggle"
          onClick={onToggleCollapsed}
          title="サイドバーを開く"
        >
          <MenuIcon />
        </button>
      </aside>
    );
  }

  return (
    <aside className="sidebar">
      <div className="sidebar__brand">
        <span className="sidebar__logo">PII</span>
        <span className="sidebar__title">PII マスキング AI</span>
        <button
          type="button"
          className="sidebar__toggle"
          onClick={onToggleCollapsed}
          title="サイドバーを閉じる"
        >
          <MenuIcon />
        </button>
      </div>

      <nav className="sidebar__nav">
        <button
          type="button"
          className={`sidebar__nav-item${activeView === "history" ? " sidebar__nav-item--active" : ""}`}
          onClick={() => onViewChange("history")}
        >
          <HistoryIcon />
          <span>履歴</span>
        </button>

        <div className="sidebar__divider" />

        <button
          type="button"
          className={`sidebar__nav-item${activeView === "chat" ? " sidebar__nav-item--active" : ""}`}
          onClick={() => onViewChange("chat")}
        >
          <ChatIcon />
          <span>AIチャット</span>
        </button>

        <button
          type="button"
          className={`sidebar__nav-item${activeView === "settings" ? " sidebar__nav-item--active" : ""}`}
          onClick={() => onViewChange("settings")}
        >
          <GearIcon />
          <span>マスキング設定</span>
        </button>
      </nav>
    </aside>
  );
}
