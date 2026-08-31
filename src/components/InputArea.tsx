import { useRef, useState } from "react";
import type { ChangeEvent, FormEvent, KeyboardEvent } from "react";
import type { EntityCategory } from "../lib/detectors/types";
import { SendIcon } from "./icons";
import { MaskingOptionsPopover } from "./MaskingOptionsPopover";

interface InputAreaProps {
  onSubmit: (text: string) => void;
  disabled: boolean;
  enabledCategories: Set<EntityCategory>;
  onEnabledCategoriesChange: (categories: Set<EntityCategory>) => void;
  mappingEnabled: boolean;
  onMappingEnabledChange: (enabled: boolean) => void;
  llmEnabled: boolean;
  onLlmEnabledChange: (enabled: boolean) => void;
}

const MAX_TEXTAREA_HEIGHT_PX = 160;

export function InputArea({
  onSubmit,
  disabled,
  enabledCategories,
  onEnabledCategoriesChange,
  mappingEnabled,
  onMappingEnabledChange,
  llmEnabled,
  onLlmEnabledChange,
}: InputAreaProps) {
  const [text, setText] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const submit = () => {
    if (text.trim() === "" || disabled) return;
    onSubmit(text);
    setText("");
    const textarea = textareaRef.current;
    if (textarea) textarea.style.height = "auto";
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    submit();
  };

  /** Enter sends the message; Shift+Enter inserts a newline (chat-app convention). */
  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  const handleChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    setText(e.target.value);
    const textarea = e.target;
    textarea.style.height = "auto";
    textarea.style.height = `${Math.min(textarea.scrollHeight, MAX_TEXTAREA_HEIGHT_PX)}px`;
  };

  return (
    <form className="input-area" onSubmit={handleSubmit}>
      <div className="input-area__pill">
        <textarea
          ref={textareaRef}
          className="input-area__textarea"
          placeholder="メッセージを入力…"
          value={text}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          rows={1}
        />
        <button
          type="submit"
          className="input-area__send"
          disabled={disabled || text.trim() === ""}
          title="マスキング実行"
        >
          <SendIcon />
        </button>
      </div>
      <MaskingOptionsPopover
        enabledCategories={enabledCategories}
        onEnabledCategoriesChange={onEnabledCategoriesChange}
        mappingEnabled={mappingEnabled}
        onMappingEnabledChange={onMappingEnabledChange}
        llmEnabled={llmEnabled}
        onLlmEnabledChange={onLlmEnabledChange}
      />
    </form>
  );
}
