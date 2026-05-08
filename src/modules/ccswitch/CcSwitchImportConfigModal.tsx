import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import iconClaude from "@/assets/icons/claude.svg";
import iconCodex from "@/assets/icons/codex.svg";
import iconGemini from "@/assets/icons/gemini.svg";
import { Button } from "@/modules/ui/Button";
import { TextInput } from "@/modules/ui/Input";
import { Modal } from "@/modules/ui/Modal";
import { SearchableCheckboxMultiSelect } from "@/modules/ui/SearchableCheckboxMultiSelect";
import { SearchableSelect, type SearchableSelectOption } from "@/modules/ui/SearchableSelect";
import { Select } from "@/modules/ui/Select";
import { Tabs, TabsList, TabsTrigger } from "@/modules/ui/Tabs";
import {
  CC_SWITCH_CLIENTS,
  getCcSwitchClientConfig,
  type CcSwitchClientType,
} from "@/modules/ccswitch/ccswitchImport";
import {
  CC_SWITCH_CLAUDE_AUTH_FIELDS,
  DEFAULT_CC_SWITCH_IMPORT_SETTINGS,
  normalizeCcSwitchClaudeAuthField,
  type CcSwitchClaudeAuthField,
} from "@/modules/ccswitch/ccswitchImportSettings";
import type { CcSwitchImportConfigListItem } from "@/modules/ccswitch/ccswitchImportConfigList";

const iconByType: Record<CcSwitchClientType, string> = {
  claude: iconClaude,
  codex: iconCodex,
  gemini: iconGemini,
};

const modelOptionsByClient: Record<CcSwitchClientType, string[]> = {
  claude: ["claude-sonnet-4-5", "claude-opus-4-1", "claude-3-7-sonnet-latest"],
  codex: ["gpt-5.5", "gpt-5.3-codex", "gpt-5-codex", "gpt-4.1"],
  gemini: ["gemini-2.5-pro", "gemini-2.5-flash", "gemini-2.0-flash"],
};

const labelClassName =
  "text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-white/45";
const controlClassName =
  "h-10 rounded-xl border border-slate-200/80 bg-white px-3 text-sm text-slate-900 shadow-none hover:border-slate-300 hover:bg-white focus-visible:ring-2 focus-visible:ring-slate-900/10 dark:border-neutral-800 dark:bg-neutral-900 dark:text-white dark:hover:border-neutral-700 dark:focus-visible:ring-white/15";
const fieldClassName = "space-y-1.5";

type ConfigDraft = CcSwitchImportConfigListItem;

function buildModelOptions(clientType: CcSwitchClientType): SearchableSelectOption[] {
  return modelOptionsByClient[clientType].map((model) => ({
    value: model,
    label: model,
    searchText: model,
  }));
}

function defaultProviderName(clientType: CcSwitchClientType) {
  return `CliProxy ${getCcSwitchClientConfig(clientType).fallbackLabel}`;
}

export function CcSwitchImportConfigModal({
  open,
  mode,
  value,
  channelGroupOptions,
  channelGroupsLoading,
  onClose,
  onSave,
}: {
  open: boolean;
  mode: "create" | "edit";
  value: ConfigDraft;
  channelGroupOptions: { value: string; label: string }[];
  channelGroupsLoading: boolean;
  onClose: () => void;
  onSave: (value: ConfigDraft) => void;
}) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState<ConfigDraft>(value);

  useEffect(() => {
    if (!open) return;
    setDraft(value);
  }, [open, value]);

  const authFieldOptions = useMemo(
    () =>
      CC_SWITCH_CLAUDE_AUTH_FIELDS.map((field) => ({
        value: field,
        label: t(
          field === "ANTHROPIC_AUTH_TOKEN"
            ? "ccswitch.auth_field_anthropic_auth_token"
            : "ccswitch.auth_field_anthropic_api_key",
        ),
      })),
    [t],
  );
  const modelOptions = useMemo(() => buildModelOptions(draft.clientType), [draft.clientType]);
  const client = getCcSwitchClientConfig(draft.clientType);
  const clientLabel = t(client.labelKey);
  const setClientType = (clientType: CcSwitchClientType) => {
    const defaults = DEFAULT_CC_SWITCH_IMPORT_SETTINGS[clientType];
    const fallbackModel = modelOptionsByClient[clientType][0] ?? "";
    setDraft((current) => ({
      ...current,
      clientType,
      endpointPath:
        current.clientType === clientType ? current.endpointPath : defaults.endpointPath,
      usageAutoInterval:
        current.clientType === clientType
          ? current.usageAutoInterval
          : defaults.usageAutoInterval,
      defaultModel:
        current.clientType === clientType
          ? current.defaultModel
          : defaults.defaultModel || fallbackModel,
      providerName:
        !current.providerName.trim() ||
        current.providerName.trim() === defaultProviderName(current.clientType)
          ? ""
          : current.providerName,
      apiKeyField:
        clientType === "claude"
          ? normalizeCcSwitchClaudeAuthField(current.apiKeyField ?? defaults.apiKeyField)
          : undefined,
    }));
  };

  const isSaveDisabled = !draft.providerName.trim() || !draft.defaultModel.trim();

  return (
    <Modal
      open={open}
      title={t(mode === "create" ? "ccswitch.config_modal_create" : "ccswitch.config_modal_edit")}
      description={t("ccswitch.config_modal_description")}
      maxWidth="max-w-3xl"
      bodyClassName="bg-slate-50/45 dark:bg-neutral-950/45"
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button variant="primary" onClick={() => onSave(draft)} disabled={isSaveDisabled}>
            {t("common.save")}
          </Button>
        </>
      }
    >
      <div className="space-y-3.5">
        <Tabs
          value={draft.clientType}
          onValueChange={(next) => setClientType(next as CcSwitchClientType)}
        >
          <TabsList
            aria-label={t("ccswitch.import_client_type")}
            className="sticky top-0 z-10 shadow-sm shadow-slate-900/5"
          >
            {CC_SWITCH_CLIENTS.map((item) => {
              const label = t(item.labelKey);
              return (
                <TabsTrigger key={item.type} value={item.type} aria-label={label}>
                  <img src={iconByType[item.type]} alt="" className="h-4 w-4" />
                  {label}
                </TabsTrigger>
              );
            })}
          </TabsList>
        </Tabs>

        <section className="min-h-[76px] rounded-2xl border border-slate-200/75 bg-white p-3.5 shadow-[0_1px_2px_rgb(15_23_42_/_0.035)] dark:border-neutral-800 dark:bg-neutral-950/70">
          {draft.clientType === "claude" ? (
            <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(220px,0.95fr)] sm:items-center">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200/75 bg-slate-50 dark:border-neutral-800 dark:bg-neutral-900">
                    <img src={iconByType.claude} alt="" className="h-5 w-5" />
                  </span>
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-slate-900 dark:text-white">
                      {clientLabel}
                    </div>
                    <div className="truncate text-xs text-slate-500 dark:text-white/55">
                      {t(client.descriptionKey)}
                    </div>
                  </div>
                </div>
              </div>
              <label className="block space-y-1.5">
                <span className={labelClassName}>
                  {t("ccswitch.settings_auth_field", { client: clientLabel })}
                </span>
                <Select
                  value={draft.apiKeyField ?? "ANTHROPIC_API_KEY"}
                  onChange={(next) =>
                    setDraft((current) => ({
                      ...current,
                      apiKeyField: normalizeCcSwitchClaudeAuthField(next) as CcSwitchClaudeAuthField,
                    }))
                  }
                  options={authFieldOptions}
                  aria-label={t("ccswitch.settings_auth_field", { client: clientLabel })}
                  className={controlClassName}
                />
              </label>
            </div>
          ) : (
            <div className="flex min-h-[54px] items-center gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-slate-200/75 bg-slate-50 dark:border-neutral-800 dark:bg-neutral-900">
                <img src={iconByType[draft.clientType]} alt="" className="h-6 w-6" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold text-slate-900 dark:text-white">
                  {clientLabel}
                </div>
                <div className="mt-0.5 text-xs leading-5 text-slate-500 dark:text-white/55">
                  {t(client.descriptionKey)}
                </div>
              </div>
            </div>
          )}
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(180px,0.62fr)]">
            <label className={fieldClassName}>
              <span className={labelClassName}>
                {t("ccswitch.settings_endpoint_path", { client: clientLabel })}
              </span>
              <TextInput
                value={draft.endpointPath}
                onChange={(event) => {
                  const nextValue = event.currentTarget.value;
                  setDraft((current) => ({ ...current, endpointPath: nextValue }));
                }}
                placeholder={t("ccswitch.settings_endpoint_path_placeholder")}
                aria-label={t("ccswitch.settings_endpoint_path", { client: clientLabel })}
                className={controlClassName}
              />
            </label>
            <label className={fieldClassName}>
              <span className={labelClassName}>
                {t("ccswitch.settings_usage_interval", { client: clientLabel })}
              </span>
              <TextInput
                type="number"
                min={1}
                inputMode="numeric"
                value={String(draft.usageAutoInterval)}
                onChange={(event) => {
                  const parsed = Number(event.currentTarget.value);
                  setDraft((current) => ({
                    ...current,
                    usageAutoInterval: Number.isFinite(parsed) ? parsed : current.usageAutoInterval,
                  }));
                }}
                placeholder="30"
                aria-label={t("ccswitch.settings_usage_interval", { client: clientLabel })}
                className={controlClassName}
              />
            </label>
          </div>
        </section>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(220px,0.9fr)]">
          <label className={fieldClassName}>
            <span className={labelClassName}>{t("ccswitch.import_provider_name")}</span>
            <TextInput
              value={draft.providerName}
              onChange={(event) => {
                const nextValue = event.currentTarget.value;
                setDraft((current) => ({ ...current, providerName: nextValue }));
              }}
              placeholder={t("ccswitch.import_provider_name_placeholder")}
              aria-label={t("ccswitch.import_provider_name")}
              className={controlClassName}
            />
          </label>

          <label className={fieldClassName}>
            <span className={labelClassName}>{t("ccswitch.config_remark")}</span>
            <TextInput
              value={draft.note}
              onChange={(event) => {
                const nextValue = event.currentTarget.value;
                setDraft((current) => ({ ...current, note: nextValue }));
              }}
              placeholder={t("ccswitch.config_remark_placeholder")}
              aria-label={t("ccswitch.config_remark")}
              className={controlClassName}
            />
          </label>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(260px,1fr)]">
          <label className={fieldClassName}>
            <span className={labelClassName}>
              {t("ccswitch.settings_default_model", { client: clientLabel })}
            </span>
            <SearchableSelect
              value={draft.defaultModel}
              onChange={(next) => setDraft((current) => ({ ...current, defaultModel: next }))}
              options={modelOptions}
              allowCreate
              createLabel={(value) => t("ccswitch.model_use_custom", { value })}
              placeholder={t("ccswitch.import_model_placeholder")}
              searchPlaceholder={t("ccswitch.config_model_search_placeholder")}
              aria-label={t("ccswitch.settings_default_model", { client: clientLabel })}
              className={controlClassName}
            />
          </label>

          <div className={fieldClassName}>
            <span className={labelClassName}>{t("ccswitch.config_allowed_channel_groups")}</span>
            <SearchableCheckboxMultiSelect
              value={draft.allowedChannelGroups}
              onChange={(next) =>
                setDraft((current) => ({ ...current, allowedChannelGroups: next }))
              }
              options={channelGroupOptions}
              placeholder={
                channelGroupsLoading
                  ? t("ccswitch.config_channel_groups_loading")
                  : t("ccswitch.config_channel_groups_placeholder")
              }
              searchPlaceholder={t("ccswitch.config_channel_groups_search_placeholder")}
              selectFilteredLabel={t("ccswitch.config_select_filtered_groups")}
              deselectFilteredLabel={t("ccswitch.config_deselect_filtered_groups")}
              selectedCountLabel={(count) => t("ccswitch.config_selected_groups_count", { count })}
              noResultsLabel={t("ccswitch.config_channel_groups_empty")}
              disabled={channelGroupsLoading}
              aria-label={t("ccswitch.config_allowed_channel_groups")}
              className={controlClassName}
            />
          </div>
        </div>
      </div>
    </Modal>
  );
}
