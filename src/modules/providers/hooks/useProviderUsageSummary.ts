import { useCallback } from "react";
import type { OpenAIProvider, ProviderSimpleConfig } from "@/lib/http/types";
import {
  buildCandidateUsageSourceIds,
  buildStatusBarDataFromStats,
  type KeyStatBucket,
} from "@/modules/providers/provider-usage";
import { sumStatsByCandidates } from "@/modules/providers/providers-helpers";
type StatusBarData = import("@/modules/providers/provider-usage").StatusBarData;

export function useProviderUsageSummary({
  usageStatsBySource,
  maskApiKey,
}: {
  usageStatsBySource: Record<string, KeyStatBucket>;
  maskApiKey: (value: string) => string;
}) {
  const getSimpleStats = useCallback(
    (config: ProviderSimpleConfig): KeyStatBucket => {
      const candidates = buildCandidateUsageSourceIds({
        apiKey: config.apiKey,
        prefix: config.prefix,
        masker: maskApiKey,
      });
      return sumStatsByCandidates(candidates, usageStatsBySource);
    },
    [maskApiKey, usageStatsBySource],
  );

  const getSimpleStatusBar = useCallback(
    (config: ProviderSimpleConfig): StatusBarData =>
      buildStatusBarDataFromStats(getSimpleStats(config)),
    [getSimpleStats],
  );

  const getOpenAIProviderStats = useCallback(
    (provider: OpenAIProvider): KeyStatBucket => {
      const candidates = new Set<string>();
      (provider.apiKeyEntries || []).forEach((entry) => {
        buildCandidateUsageSourceIds({
          apiKey: entry.apiKey,
          prefix: provider.prefix,
          masker: maskApiKey,
        }).forEach((candidate) => candidates.add(candidate));
      });
      return sumStatsByCandidates(Array.from(candidates), usageStatsBySource);
    },
    [maskApiKey, usageStatsBySource],
  );

  const getOpenAIKeyEntryStats = useCallback(
    (entry: NonNullable<OpenAIProvider["apiKeyEntries"]>[number]): KeyStatBucket => {
      const candidates = buildCandidateUsageSourceIds({
        apiKey: entry.apiKey,
        masker: maskApiKey,
      });
      return sumStatsByCandidates(candidates, usageStatsBySource);
    },
    [maskApiKey, usageStatsBySource],
  );

  const getOpenAIProviderStatusBar = useCallback(
    (provider: OpenAIProvider): StatusBarData =>
      buildStatusBarDataFromStats(getOpenAIProviderStats(provider)),
    [getOpenAIProviderStats],
  );

  return {
    getSimpleStats,
    getSimpleStatusBar,
    getOpenAIProviderStats,
    getOpenAIKeyEntryStats,
    getOpenAIProviderStatusBar,
  };
}
