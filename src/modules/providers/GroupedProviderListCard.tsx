import type { LucideIcon } from "lucide-react";
import { Plus, Settings2, Trash2 } from "lucide-react";
import type { ProviderSimpleConfig } from "@/lib/http/types";
import { Button } from "@/modules/ui/Button";
import { Card } from "@/modules/ui/Card";
import { EmptyState } from "@/modules/ui/EmptyState";
import { ToggleSwitch } from "@/modules/ui/ToggleSwitch";
import { ProviderStatusBar } from "@/modules/providers/ProviderStatusBar";
import type { ProviderAccessSummary } from "@/modules/providers/provider-access";
import type { GroupedProviderGroup } from "@/modules/providers/grouped-provider-utils";
import {
  aggregateGroupStats,
  aggregateGroupStatusBar,
} from "@/modules/providers/grouped-provider-utils";
import type { KeyStatBucket, StatusBarData } from "@/modules/providers/provider-usage";
import { useTranslation } from "react-i18next";

export function GroupedProviderListCard({
  icon: Icon,
  title,
  description,
  groups,
  onAdd,
  onEdit,
  onDelete,
  onToggleEnabled,
  getStats,
  getStatusBar,
  getAccessSummary,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  groups: GroupedProviderGroup[];
  onAdd: () => void;
  onEdit: (group: GroupedProviderGroup) => void;
  onDelete: (group: GroupedProviderGroup) => void;
  onToggleEnabled: (group: GroupedProviderGroup, enabled: boolean) => void;
  getStats: (item: ProviderSimpleConfig) => KeyStatBucket;
  getStatusBar: (item: ProviderSimpleConfig) => StatusBarData;
  getAccessSummary?: (group: GroupedProviderGroup) => ProviderAccessSummary | null;
}) {
  const { t } = useTranslation();

  return (
    <Card
      title={title}
      description={description}
      actions={
        <Button variant="primary" size="sm" onClick={onAdd}>
          <Plus size={14} />
          {t("providers.add_new")}
        </Button>
      }
    >
      {groups.length === 0 ? (
        <EmptyState title={t("providers.no_config")} description={t("providers.no_config_desc")} />
      ) : (
        <div className="space-y-3">
          {groups.map((group) => {
            const stats = aggregateGroupStats(group, getStats);
            const statusData = aggregateGroupStatusBar(group, getStatusBar);
            const accessSummary = getAccessSummary?.(group) ?? null;
            const accessTone =
              accessSummary === null || accessSummary.totalKeys === 0
                ? "border-slate-200 bg-slate-50 text-slate-600 dark:border-neutral-700 dark:bg-neutral-900 dark:text-white/65"
                : accessSummary.reachableKeys === 0
                  ? "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200"
                  : accessSummary.reachableKeys < accessSummary.totalKeys
                    ? "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100"
                    : "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-100";

            return (
              <div
                key={group.id}
                className="rounded-2xl border border-slate-200 bg-white/70 px-4 py-3 shadow-sm dark:border-neutral-800 dark:bg-neutral-950/60"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
                      <Icon size={16} className="text-slate-900 dark:text-white" />
                      <span className="truncate">{group.name || t("providers.unnamed_group")}</span>
                      <span className="rounded-full bg-slate-900/5 px-2 py-0.5 text-[11px] font-semibold text-slate-600 dark:bg-white/10 dark:text-white/70">
                        {t("providers.grouped_keys_count", { count: group.items.length })}
                      </span>
                      {group.priority !== undefined ? (
                        <span className="rounded-full bg-blue-500/10 px-2 py-0.5 text-[11px] font-semibold text-blue-700 dark:text-blue-200">
                          {t("providers.group_priority_badge", { value: group.priority })}
                        </span>
                      ) : null}
                    </p>

                    <div className="mt-1 space-y-1 text-xs text-slate-600 dark:text-white/65">
                      <p className="truncate font-mono">baseUrl: {group.baseUrl || "--"}</p>
                      <p className="truncate font-mono">prefix: {group.prefix || "--"}</p>
                      <p className="tabular-nums">
                        {t("providers.models_label")}: {group.models?.length ?? 0} ·{" "}
                        {t("providers.excluded_models_label")}: {group.excludedModels?.length ?? 0}{" "}
                        · {t("providers.headers_optional")}:{" "}
                        {Object.keys(group.headers || {}).length} ·{" "}
                        {t("providers.success_stats", { count: stats.success })} ·{" "}
                        {t("providers.failed_stats", { count: stats.failure })}
                      </p>
                    </div>

                    {accessSummary ? (
                      <div className="mt-2 flex flex-wrap gap-1.5 text-[11px]">
                        <span
                          className={`rounded-full border px-2 py-0.5 font-medium ${accessTone}`}
                        >
                          {accessSummary.totalKeys === 0
                            ? t("providers.access_no_keys")
                            : accessSummary.reachableKeys === 0
                              ? t("providers.access_none")
                              : accessSummary.reachableKeys < accessSummary.totalKeys
                                ? t("providers.access_limited", {
                                    reachable: accessSummary.reachableKeys,
                                    total: accessSummary.totalKeys,
                                  })
                                : t("providers.access_all", { total: accessSummary.totalKeys })}
                        </span>
                      </div>
                    ) : null}

                    <div className="mt-3 max-w-sm">
                      <ToggleSwitch
                        checked={group.enabled}
                        onCheckedChange={(enabled) => onToggleEnabled(group, enabled)}
                        label={t("providers.enable")}
                        description={t(
                          group.enabled
                            ? "providers.enable_toggle_desc_on"
                            : "providers.enable_toggle_desc_off",
                        )}
                      />
                    </div>

                    <ProviderStatusBar data={statusData} />
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <Button variant="secondary" size="sm" onClick={() => onEdit(group)}>
                      <Settings2 size={14} />
                      {t("providers.edit")}
                    </Button>
                    <Button variant="danger" size="sm" onClick={() => onDelete(group)}>
                      <Trash2 size={14} />
                      {t("providers.delete")}
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}
