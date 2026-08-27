import { useState } from "react";
import type { FormEvent } from "react";

interface InputAreaProps {
  onSubmit: (text: string) => void;
  disabled: boolean;
  llmEnabled: boolean;
  onLlmEnabledChange: (enabled: boolean) => void;
}

export function InputArea({ onSubmit, disabled, llmEnabled, onLlmEnabledChange }: InputAreaProps) {
  const [text, setText] = useState("");

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (text.trim() === "" || disabled) return;
    onSubmit(text);
    setText("");
  };

  return (
    <form className="input-area" onSubmit={handleSubmit}>
      <textarea
        className="input-area__textarea"
        placeholder="マスキングしたいテキストを貼り付けてください…"
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={5}
      />
      <div className="input-area__controls">
        <label className="input-area__llm-toggle">
          <input
            type="checkbox"
            checked={llmEnabled}
            onChange={(e) => onLlmEnabledChange(e.target.checked)}
          />
          実験的機能: LLM補助判定を有効にする（曖昧な検出のみ対象・要ローカルモデル）
        </label>
        <button type="submit" className="input-area__submit" disabled={disabled || text.trim() === ""}>
          マスキング実行
        </button>
      </div>
    </form>
  );
}
