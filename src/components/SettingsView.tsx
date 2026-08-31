import type { NerModelStatus } from "../hooks/useNerModel";
import type { OfflineStatus } from "../hooks/useOfflineStatus";
import type { EntityCategory } from "../lib/detectors/types";
import { CategoryFilter } from "./CategoryFilter";
import { StatusBar } from "./StatusBar";

interface SettingsViewProps {
  nerStatus: NerModelStatus;
  nerError: string | null;
  offline: OfflineStatus;
  enabledCategories: Set<EntityCategory>;
  onEnabledCategoriesChange: (categories: Set<EntityCategory>) => void;
  llmEnabled: boolean;
  onLlmEnabledChange: (enabled: boolean) => void;
  mappingEnabled: boolean;
  onMappingEnabledChange: (enabled: boolean) => void;
}

export function SettingsView({
  nerStatus,
  nerError,
  offline,
  enabledCategories,
  onEnabledCategoriesChange,
  llmEnabled,
  onLlmEnabledChange,
  mappingEnabled,
  onMappingEnabledChange,
}: SettingsViewProps) {
  return (
    <div className="settings-view">
      <section className="settings-view__section">
        <h3>モデルの状態</h3>
        <StatusBar nerStatus={nerStatus} nerError={nerError} offline={offline} />
      </section>

      <section className="settings-view__section">
        <h3>検出する種類</h3>
        <CategoryFilter enabledCategories={enabledCategories} onChange={onEnabledCategoriesChange} />
      </section>

      <section className="settings-view__section">
        <h3>オプション</h3>
        <label className="settings-view__toggle">
          <input
            type="checkbox"
            checked={llmEnabled}
            onChange={(e) => onLlmEnabledChange(e.target.checked)}
          />
          実験的機能: LLM補助判定を有効にする（曖昧な検出のみ対象・要ローカルモデル）
        </label>
        <label className="settings-view__toggle">
          <input
            type="checkbox"
            checked={mappingEnabled}
            onChange={(e) => onMappingEnabledChange(e.target.checked)}
          />
          マッピング表を作成する（同じ値は連番付きラベルに統一し、対応表をコピー可能にする）
        </label>
      </section>
    </div>
  );
}
