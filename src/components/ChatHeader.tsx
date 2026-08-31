import { BookmarkIcon, GearIcon, ShareIcon } from "./icons";

interface ChatHeaderProps {
  title: string;
  onOpenHistory: () => void;
  onOpenSettings: () => void;
  onShare: () => void;
  shareDisabled: boolean;
}

export function ChatHeader({ title, onOpenHistory, onOpenSettings, onShare, shareDisabled }: ChatHeaderProps) {
  return (
    <header className="chat-header">
      <h2 className="chat-header__title">{title}</h2>
      <div className="chat-header__actions">
        <button type="button" className="chat-header__icon-button" onClick={onOpenHistory} title="履歴を開く">
          <BookmarkIcon />
        </button>
        <button
          type="button"
          className="chat-header__icon-button"
          onClick={onShare}
          disabled={shareDisabled}
          title="会話をコピー"
        >
          <ShareIcon />
        </button>
        <button
          type="button"
          className="chat-header__icon-button"
          onClick={onOpenSettings}
          title="マスキング設定"
        >
          <GearIcon />
        </button>
      </div>
    </header>
  );
}
