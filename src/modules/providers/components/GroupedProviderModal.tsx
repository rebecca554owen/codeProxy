import { useEffect, useMemo, useState, type Dispatch, type SetStateAction } from "react";
import { useTranslation } from "react-i18next";
import { AlertCircle, CheckCircle2, Play, Plus, RefreshCw, Settings2, Trash2 } from "lucide-react";
import { apiCallApi } from "@/lib/http/apis";
import type { ProxyPoolEntry } from "@/lib/http/apis/proxies";
import type { ProviderSimpleConfig } from "@/lib/http/types";
import { Button } from "@/modules/ui/Button";
import { Modal } from "@/modules/ui/Modal";
import { TextInput } from "@/modules/ui/Input";
import { ToggleSwitch } from "@/modules/ui/ToggleSwitch";
import { Select } from "@/modules/ui/Select";
import { KeyValueInputList } from "@/modules/providers/KeyValueInputList";
import { ModelInputList } from "@/modules/providers/ModelInputList";
import { ProviderStatusBar } from "@/modules/providers/ProviderStatusBar";
import { ProxyPoolSelect } from "@/modules/proxies/ProxyPoolSelect";
import {
  buildProviderConfigsFromDraft,
  remapKeyEntryStatuses,
  resolveGroupTestModel,
  runGroupedProviderConnectivityTest,
  type GroupedProviderDraft,
  type GroupedProviderGroup,
  type GroupedProviderKeyEntry,
  type GroupedProviderType,
} from "@/modules/providers/grouped-provider-utils";
import type { KeyStatBucket, StatusBarData } from "@/modules/providers/provider-usage";
import { useToast } from "@/modules/ui/ToastProvider";

function KeyHeadersModal({
  open,
  entry,
  onClose,
  onChange,
}: {
  open: boolean;
  entry: GroupedProviderKeyEntry | null;
  onClose: () => void;
  onChange: (next: GroupedProviderKeyEntry) => void;
}) {
  const { t } = useTranslation();
  if (!entry) return null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t("providers.key_headers_modal_title")}
      description={t("providers.key_headers_modal_desc")}
      maxWidth="max-w-2xl"
      footer={
        <Button variant="primary" size="sm" onClick={onClose}>
          {t("providers.done")}
        </Button>
      }
    >
      <div className="space-y-4">
        <div className="rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-2 text-xs font-mono text-slate-600 dark:border-neutral-800 dark:bg-neutral-900 dark:text-white/60">
          {entry.apiKey.trim() || t("providers.empty_key_entry")}
        </div>
        <KeyValueInputList
          title={t("providers.key_headers")}
          entries={entry.headersEntries}
          onChange={(headersEntries) => onChange({ ...entry, headersEntries })}
          keyPlaceholder={t("providers.header_name_placeholder")}
          valuePlaceholder={t("providers.header_value_placeholder")}
        />
      </div>
    </Modal>
  );
}

export function GroupedProviderModal({
  open,
  provider,
  group,
  draft,
  setDraft,
  close,
  save,
  proxyPoolEntries,
  getKeyStats,
  getKeyStatusBar,
}: {
  open: boolean;
  provider: GroupedProviderType;
  group: GroupedProviderGroup | null;
  draft: GroupedProviderDraft;
  setDraft: Dispatch<SetStateAction<GroupedProviderDraft>>;
  close: () => void;
  save: (configs: ProviderSimpleConfig[]) => Promise<void>;
  proxyPoolEntries: ProxyPoolEntry[];
  getKeyStats: (entry: GroupedProviderKeyEntry) => KeyStatBucket;
  getKeyStatusBar: (entry: GroupedProviderKeyEntry) => StatusBarData;
}) {
  const { t } = useTranslation();
  const { notify } = useToast();
  const [saving, setSaving] = useState(false);
  const [detailKeyIndex, setDetailKeyIndex] = useState<number | null>(null);
  const [summaryStatus, setSummaryStatus] = useState<"idle" | "loading" | "success" | "error">(
    "idle",
  );
  const [summaryMessage, setSummaryMessage] = useState("");

  const providerLabel =
    provider === "gemini" ? "Gemini" : provider === "claude" ? "Claude" : "Codex";
  const testKey = provider === "codex" ? "openai" : provider;

  const modalTitle = group
    ? t("providers.edit_config", { type: providerLabel })
    : t("providers.add_config", { type: providerLabel });

  const detailEntry = detailKeyIndex === null ? null : (draft.keyEntries[detailKeyIndex] ?? null);
  const showProxyUrlInput = provider !== "gemini";
  const testModelOptions = useMemo(() => {
    const seen = new Set<string>();
    return draft.modelEntries.reduce<Array<{ value: string; label: string }>>((acc, entry) => {
      const name = entry.name.trim();
      if (!name || seen.has(name)) return acc;
      seen.add(name);
      const alias = entry.alias.trim();
      acc.push({ value: name, label: alias && alias !== name ? `${name} (${alias})` : name });
      return acc;
    }, []);
  }, [draft.modelEntries]);

  useEffect(() => {
    if (!open) return;
    setDetailKeyIndex(null);
    setSummaryStatus("idle");
    setSummaryMessage("");
  }, [open, provider, group?.id]);

  const updateKeyEntries = (nextKeyEntries: GroupedProviderKeyEntry[]) => {
    setDraft((prev) => ({
      ...prev,
      keyEntries: remapKeyEntryStatuses(prev.keyEntries, nextKeyEntries),
    }));
  };

  const canRunAnyTest = useMemo(
    () =>
      draft.keyEntries.some((entry) => entry.apiKey.trim()) &&
      Boolean(resolveGroupTestModel(draft)),
    [draft],
  );

  const runSingleTest = async (index: number): Promise<{ ok: boolean; message: string }> => {
    const testModel = resolveGroupTestModel(draft);
    if (!testModel) {
      const message = t(`ai_providers.${testKey}_test_model_required`);
      setSummaryStatus("error");
      setSummaryMessage(message);
      notify({ type: "error", message });
      return { ok: false, message };
    }
    const target = draft.keyEntries[index];
    if (!target?.apiKey.trim()) return { ok: false, message: "" };

    setDraft((prev) => ({
      ...prev,
      keyEntries: prev.keyEntries.map((entry, currentIndex) =>
        currentIndex === index ? { ...entry, testStatus: "loading", testMessage: "" } : entry,
      ),
    }));

    try {
      await runGroupedProviderConnectivityTest(
        {
          provider,
          baseUrl: draft.baseUrl,
          testModel,
          providerHeaders: Object.fromEntries(
            (draft.headersEntries ?? [])
              .map((entry) => [entry.key.trim(), entry.value.trim()] as const)
              .filter(([key, value]) => key && value),
          ),
          keyHeaders: Object.fromEntries(
            (target.headersEntries ?? [])
              .map((entry) => [entry.key.trim(), entry.value.trim()] as const)
              .filter(([key, value]) => key && value),
          ),
          apiKey: target.apiKey,
        },
        apiCallApi.request,
      );
      setDraft((prev) => ({
        ...prev,
        keyEntries: prev.keyEntries.map((entry, currentIndex) =>
          currentIndex === index
            ? {
                ...entry,
                testStatus: "success",
                testMessage: t(`ai_providers.${testKey}_test_success`),
              }
            : entry,
        ),
      }));
      setSummaryStatus("success");
      setSummaryMessage(t(`ai_providers.${testKey}_test_success`));
      return { ok: true, message: t(`ai_providers.${testKey}_test_success`) };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : t(`ai_providers.${testKey}_test_failed`);
      setDraft((prev) => ({
        ...prev,
        keyEntries: prev.keyEntries.map((entry, currentIndex) =>
          currentIndex === index ? { ...entry, testStatus: "error", testMessage: message } : entry,
        ),
      }));
      setSummaryStatus("error");
      setSummaryMessage(message);
      return { ok: false, message };
    }
  };

  const runAllTests = async () => {
    const validIndexes = draft.keyEntries
      .map((entry, index) => (entry.apiKey.trim() ? index : -1))
      .filter((index) => index >= 0);
    if (validIndexes.length === 0) {
      return;
    }
    setSummaryStatus("loading");
    setSummaryMessage(t(`ai_providers.${testKey}_test_running`));
    let success = 0;
    let failed = 0;
    for (const index of validIndexes) {
      const result = await runSingleTest(index);
      if (result.ok) success += 1;
      else if (result.message) failed += 1;
    }
    if (failed === 0) {
      setSummaryStatus("success");
      setSummaryMessage(t("ai_providers.openai_test_all_success", { count: success }));
      return;
    }
    if (success === 0) {
      setSummaryStatus("error");
      setSummaryMessage(t("ai_providers.openai_test_all_failed", { count: failed }));
      return;
    }
    setSummaryStatus("error");
    setSummaryMessage(t("ai_providers.openai_test_all_partial", { success, failed }));
  };

  const handleSave = async () => {
    const result = buildProviderConfigsFromDraft(provider, draft);
    if (result.error || !result.configs) {
      notify({
        type: "error",
        message: result.error?.includes(".")
          ? result.error
          : t(result.error ?? "providers.save_failed"),
      });
      return;
    }
    setSaving(true);
    try {
      await save(result.configs);
      close();
    } finally {
      setSaving(false);
    }
  };

  const footer = (
    <>
      <Button variant="secondary" size="sm" onClick={close} disabled={saving}>
        {t("providers.cancel")}
      </Button>
      <Button variant="primary" size="sm" onClick={() => void handleSave()} disabled={saving}>
        {saving ? <RefreshCw size={14} className="animate-spin" /> : null}
        {t("providers.save")}
      </Button>
    </>
  );

  return (
    <>
      <Modal
        open={open}
        onClose={close}
        title={modalTitle}
        description={t("providers.grouped_modal_desc", { provider: providerLabel })}
        maxWidth="max-w-[96rem]"
        bodyHeightClassName="max-h-[82vh]"
        footer={footer}
      >
        <div className="space-y-5">
          {group?.hasSharedFieldConflict ? (
            <section className="rounded-2xl border border-amber-300 bg-amber-50/90 px-4 py-3 text-sm text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-100">
              <div className="flex items-start gap-2">
                <AlertCircle size={16} className="mt-0.5 shrink-0" />
                <div>
                  <p className="font-semibold">{t("providers.group_conflict_title")}</p>
                  <p className="mt-1 text-xs text-amber-800/90 dark:text-amber-100/80">
                    {t("providers.group_conflict_desc")}
                  </p>
                </div>
              </div>
            </section>
          ) : null}

          <section className="grid gap-3 md:grid-cols-2">
            <div className="space-y-2">
              <p className="text-xs font-semibold text-slate-700 dark:text-white/75">
                {t("providers.channel_name_label")}
              </p>
              <TextInput
                value={draft.name}
                onChange={(event) => {
                  const value = event.currentTarget.value;
                  setDraft((prev) => ({ ...prev, name: value }));
                }}
                placeholder={t("providers.channel_placeholder")}
              />
            </div>
            <div className="space-y-2">
              <p className="text-xs font-semibold text-slate-700 dark:text-white/75">
                {t("providers.base_url")}
              </p>
              <TextInput
                value={draft.baseUrl}
                onChange={(event) => {
                  const value = event.currentTarget.value;
                  setDraft((prev) => ({ ...prev, baseUrl: value }));
                }}
                placeholder={
                  provider === "claude"
                    ? t("providers.claude_base_url_placeholder")
                    : t("providers.base_url_placeholder")
                }
              />
            </div>
            <div className="space-y-2">
              <p className="text-xs font-semibold text-slate-700 dark:text-white/75">
                {t("providers.prefix_label")}
              </p>
              <TextInput
                value={draft.prefix}
                onChange={(event) => {
                  const value = event.currentTarget.value;
                  setDraft((prev) => ({ ...prev, prefix: value }));
                }}
                placeholder={t("providers.prefix_placeholder")}
              />
            </div>
            <div className="space-y-2">
              <p className="text-xs font-semibold text-slate-700 dark:text-white/75">
                {t("providers.priority_label")}
              </p>
              <TextInput
                value={draft.priorityText}
                inputMode="numeric"
                onChange={(event) => {
                  const value = event.currentTarget.value;
                  setDraft((prev) => ({ ...prev, priorityText: value }));
                }}
                placeholder={t("providers.priority_placeholder")}
              />
            </div>
          </section>

          <section className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50/70 p-4 dark:border-neutral-800 dark:bg-neutral-900/70">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-sm font-semibold text-slate-900 dark:text-white">
                  {t("providers.api_key_entries")}
                </p>
                <p className="mt-1 text-xs text-slate-500 dark:text-white/55">
                  {t("providers.grouped_keys_hint")}
                </p>
                {!showProxyUrlInput ? (
                  <p className="mt-1 text-xs text-slate-500 dark:text-white/55">
                    {t("providers.grouped_proxy_pool_only_hint")}
                  </p>
                ) : null}
              </div>
              <Button
                variant="secondary"
                size="sm"
                onClick={() =>
                  updateKeyEntries([
                    ...draft.keyEntries,
                    {
                      id: `group-key-${Date.now()}`,
                      apiKey: "",
                      proxyUrl: "",
                      proxyId: "",
                      enabled: true,
                      headersEntries: [],
                      testStatus: "idle",
                      testMessage: "",
                    },
                  ])
                }
              >
                <Plus size={14} />
                {t("providers.add")}
              </Button>
            </div>

            <div className="space-y-3">
              {draft.keyEntries.map((entry, index) => (
                <div
                  key={entry.id}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-3 dark:border-neutral-800 dark:bg-neutral-950/70"
                >
                  <div className="grid gap-3 border-b border-slate-100 pb-3 dark:border-neutral-800 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_auto]">
                    <div>
                      <p className="text-xs font-semibold text-slate-700 dark:text-white/75">
                        {t("providers.key_number", { num: index + 1 })}
                      </p>
                      <div className="mt-2 flex items-center gap-3">
                        <div className="min-w-0 flex-1">
                          <ProviderStatusBar
                            data={getKeyStatusBar(entry)}
                            compact
                            className="mt-0"
                          />
                        </div>
                        <div className="flex shrink-0 flex-wrap gap-1 text-[11px]">
                          <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-emerald-700 dark:text-emerald-200">
                            {t("providers.success_stats", { count: getKeyStats(entry).success })}
                          </span>
                          <span className="rounded-full bg-rose-500/10 px-2 py-0.5 text-rose-700 dark:text-rose-200">
                            {t("providers.failed_stats", { count: getKeyStats(entry).failure })}
                          </span>
                          <span
                            className={[
                              "rounded-full px-2 py-0.5 font-medium",
                              entry.enabled
                                ? "bg-slate-900/5 text-slate-700 dark:bg-white/10 dark:text-white/70"
                                : "bg-slate-900/10 text-slate-900 dark:bg-white/15 dark:text-white",
                            ].join(" ")}
                          >
                            {entry.enabled ? t("providers.enabled") : t("providers.disabled")}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => setDetailKeyIndex(index)}
                        title={t("providers.key_headers")}
                      >
                        <Settings2 size={14} />
                        {t("providers.headers_optional")}
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => void runSingleTest(index)}
                        disabled={!entry.apiKey.trim() || !resolveGroupTestModel(draft)}
                        title={t(`ai_providers.${testKey}_test_action`)}
                      >
                        <Play size={14} />
                        {t("providers.test_single")}
                      </Button>
                      <div className="min-w-[132px]">
                        <ToggleSwitch
                          checked={entry.enabled}
                          onCheckedChange={(enabled) =>
                            updateKeyEntries(
                              draft.keyEntries.map((item, currentIndex) =>
                                currentIndex === index ? { ...item, enabled } : item,
                              ),
                            )
                          }
                          label={t("providers.enable")}
                          description={t(
                            entry.enabled
                              ? "providers.enable_toggle_desc_on"
                              : "providers.enable_toggle_desc_off",
                          )}
                        />
                      </div>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() =>
                          updateKeyEntries(
                            draft.keyEntries.filter((_, currentIndex) => currentIndex !== index),
                          )
                        }
                        disabled={draft.keyEntries.length <= 1}
                      >
                        <Trash2 size={14} />
                        {t("providers.delete")}
                      </Button>
                    </div>
                  </div>

                  <div
                    className={[
                      "mt-3 grid gap-3",
                      showProxyUrlInput
                        ? "lg:grid-cols-[minmax(280px,1.05fr)_minmax(240px,0.95fr)_minmax(360px,1.6fr)]"
                        : "lg:grid-cols-[minmax(280px,1.2fr)_minmax(320px,1fr)]",
                    ].join(" ")}
                  >
                    <div className="space-y-2">
                      <p className="text-xs font-semibold text-slate-700 dark:text-white/75">
                        {t("providers.api_key")}
                      </p>
                      <TextInput
                        value={entry.apiKey}
                        onChange={(event) => {
                          const value = event.currentTarget.value;
                          updateKeyEntries(
                            draft.keyEntries.map((item, currentIndex) =>
                              currentIndex === index ? { ...item, apiKey: value } : item,
                            ),
                          );
                        }}
                        placeholder={t("providers.paste_key")}
                      />
                    </div>

                    <div className="space-y-2">
                      <ProxyPoolSelect
                        value={entry.proxyId}
                        entries={proxyPoolEntries}
                        onChange={(value) =>
                          updateKeyEntries(
                            draft.keyEntries.map((item, currentIndex) =>
                              currentIndex === index ? { ...item, proxyId: value } : item,
                            ),
                          )
                        }
                        label={t("providers.proxy_pool_label")}
                        hint={t("providers.proxy_pool_hint")}
                      />
                    </div>

                    {showProxyUrlInput ? (
                      <div className="space-y-2">
                        <p className="text-xs font-semibold text-slate-700 dark:text-white/75">
                          {t("providers.proxy_url_optional")}
                        </p>
                        <TextInput
                          value={entry.proxyUrl}
                          onChange={(event) => {
                            const value = event.currentTarget.value;
                            updateKeyEntries(
                              draft.keyEntries.map((item, currentIndex) =>
                                currentIndex === index ? { ...item, proxyUrl: value } : item,
                              ),
                            );
                          }}
                          placeholder={t("providers.proxy_url_placeholder")}
                          className="font-mono"
                        />
                      </div>
                    ) : null}
                  </div>

                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                    {entry.testStatus === "success" ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-emerald-700 dark:text-emerald-200">
                        <CheckCircle2 size={12} />
                        {entry.testMessage || t(`ai_providers.${testKey}_test_success`)}
                      </span>
                    ) : null}
                    {entry.testStatus === "error" ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/10 px-2 py-0.5 text-rose-700 dark:text-rose-200">
                        <AlertCircle size={12} />
                        {entry.testMessage || t(`ai_providers.${testKey}_test_failed`)}
                      </span>
                    ) : null}
                    {entry.headersEntries.length > 0 ? (
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-600 dark:bg-neutral-800 dark:text-white/65">
                        {t("providers.key_headers_count", { count: entry.headersEntries.length })}
                      </span>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="grid gap-4 xl:grid-cols-2">
            <div className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50/70 p-4 dark:border-neutral-800 dark:bg-neutral-900/70">
              <KeyValueInputList
                title={t("providers.provider_headers")}
                entries={draft.headersEntries}
                onChange={(headersEntries) => setDraft((prev) => ({ ...prev, headersEntries }))}
                keyPlaceholder={t("providers.header_name_placeholder")}
                valuePlaceholder={t("providers.header_value_placeholder")}
              />

              {provider === "claude" ? (
                <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3 py-3 dark:border-neutral-800 dark:bg-neutral-950/70">
                  <div>
                    <p className="text-sm font-semibold text-slate-900 dark:text-white">
                      {t("providers.anthropic_processing_label")}
                    </p>
                    <p className="mt-1 text-xs text-slate-500 dark:text-white/55">
                      {t("providers.anthropic_processing_hint")}
                    </p>
                  </div>
                  <ToggleSwitch
                    checked={!draft.skipAnthropicProcessing}
                    onCheckedChange={(checked) =>
                      setDraft((prev) => ({ ...prev, skipAnthropicProcessing: !checked }))
                    }
                  />
                </div>
              ) : null}
            </div>

            <div className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50/70 p-4 dark:border-neutral-800 dark:bg-neutral-900/70">
              <ModelInputList
                title={t("providers.models_optional")}
                entries={draft.modelEntries}
                onChange={(modelEntries) => setDraft((prev) => ({ ...prev, modelEntries }))}
                showPriority
                showTestModel
              />

              <div className="space-y-2">
                <p className="text-xs font-semibold text-slate-700 dark:text-white/75">
                  {t("providers.test_model_label")}
                </p>
                <Select
                  value={draft.testModel}
                  onChange={(value) => setDraft((prev) => ({ ...prev, testModel: value }))}
                  options={testModelOptions}
                  placeholder={t("providers.test_model_placeholder")}
                  aria-label={t("providers.test_model_label")}
                  disabled={testModelOptions.length === 0}
                />
              </div>

              <div className="space-y-2">
                <p className="text-xs font-semibold text-slate-700 dark:text-white/75">
                  {t("providers.excluded_models_label")}
                </p>
                <textarea
                  value={draft.excludedModelsText}
                  onChange={(event) => {
                    const value = event.currentTarget.value;
                    setDraft((prev) => ({ ...prev, excludedModelsText: value }));
                  }}
                  rows={4}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-slate-300 dark:border-neutral-800 dark:bg-neutral-950 dark:text-white"
                  placeholder={t("providers.excluded_placeholder")}
                />
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 dark:border-neutral-800 dark:bg-neutral-900/70">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-slate-900 dark:text-white">
                  {t(`ai_providers.${testKey}_test_title`)}
                </p>
                <p className="mt-1 text-xs text-slate-500 dark:text-white/55">
                  {t(`ai_providers.${testKey}_test_hint`)}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => void runAllTests()}
                  disabled={!canRunAnyTest}
                >
                  <RefreshCw size={14} />
                  {t("ai_providers.openai_test_all_action")}
                </Button>
                {summaryStatus === "success" ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:text-emerald-200">
                    <CheckCircle2 size={12} />
                    {summaryMessage}
                  </span>
                ) : null}
                {summaryStatus === "error" ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/10 px-2 py-0.5 text-xs font-medium text-rose-700 dark:text-rose-200">
                    <AlertCircle size={12} />
                    {summaryMessage}
                  </span>
                ) : null}
              </div>
            </div>
          </section>
        </div>
      </Modal>

      <KeyHeadersModal
        open={detailEntry !== null}
        entry={detailEntry}
        onClose={() => setDetailKeyIndex(null)}
        onChange={(nextEntry) =>
          updateKeyEntries(
            draft.keyEntries.map((item, index) => (index === detailKeyIndex ? nextEntry : item)),
          )
        }
      />
    </>
  );
}
