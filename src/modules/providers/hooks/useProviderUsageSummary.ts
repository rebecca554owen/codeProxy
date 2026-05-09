import { useCallback } from "react";
import type {
  EntityBlockConfig,
  EntityBlockSeries,
  OpenAIProvider,
  ProviderApiKeyEntry,
  ProviderSimpleConfig,
} from "@/lib/http/types";
import {
  buildCandidateUsageSourceIds,
  buildStatusBarDataFromEntityBlockSeries,
  buildStatusBarDataFromStats,
  type KeyStatBucket,
  type StatusBarData,
} from "@/modules/providers/provider-usage";
import { sumStatsByCandidates } from "@/modules/providers/providers-helpers";

export function useProviderUsageSummary({
  usageStatsBySource,
  usageBlockSeriesBySource,
  usageBlockConfig,
  maskApiKey,
}: {
  usageStatsBySource: Record<string, KeyStatBucket>;
  usageBlockSeriesBySource: Record<string, EntityBlockSeries>;
  usageBlockConfig: EntityBlockConfig | null;
  maskApiKey: (value: string) => string;
}) {
  const mergeStatusBars = useCallback((bars: StatusBarData[]): StatusBarData => {
    if (bars.length === 0) {
      return buildStatusBarDataFromStats({ success: 0, failure: 0 });
    }
    if (bars.length === 1) {
      return bars[0];
    }

    const blockCount = Math.max(...bars.map((bar) => bar.blockDetails.length), 20);
    const totalSuccess = bars.reduce((sum, bar) => sum + bar.totalSuccess, 0);
    const totalFailure = bars.reduce((sum, bar) => sum + bar.totalFailure, 0);
    const total = totalSuccess + totalFailure;

    const blockDetails = Array.from({ length: blockCount }, (_, index) => {
      const details = bars
        .map((bar) => bar.blockDetails[index])
        .filter(Boolean) as StatusBarData["blockDetails"];
      const success = details.reduce((sum, detail) => sum + detail.success, 0);
      const failure = details.reduce((sum, detail) => sum + detail.failure, 0);
      const blockTotal = success + failure;
      const first = details[0];
      return {
        success,
        failure,
        rate: blockTotal > 0 ? success / blockTotal : -1,
        startTime: first?.startTime ?? 0,
        endTime: first?.endTime ?? 0,
      };
    });

    return {
      blocks: blockDetails.map((detail) => {
        if (detail.success === 0 && detail.failure === 0) return "idle";
        if (detail.failure === 0) return "success";
        if (detail.success === 0) return "failure";
        return "mixed";
      }),
      blockDetails,
      successRate: total > 0 ? (totalSuccess / total) * 100 : 100,
      totalSuccess,
      totalFailure,
    };
  }, []);

  const getEmptyStatusBar = useCallback(
    () => buildStatusBarDataFromStats({ success: 0, failure: 0 }),
    [],
  );

  const getStatusBarByCandidates = useCallback(
    (candidates: string[]): StatusBarData => {
      const resolvedCandidates = Array.from(new Set(candidates.filter(Boolean)));
      const blockBars = resolvedCandidates
        .map((candidate) => usageBlockSeriesBySource[candidate])
        .filter(Boolean)
        .map((series) => buildStatusBarDataFromEntityBlockSeries(series, usageBlockConfig));
      if (blockBars.length > 0) {
        return mergeStatusBars(blockBars);
      }
      return buildStatusBarDataFromStats(
        sumStatsByCandidates(resolvedCandidates, usageStatsBySource),
      );
    },
    [mergeStatusBars, usageBlockConfig, usageBlockSeriesBySource, usageStatsBySource],
  );

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
    (config: ProviderSimpleConfig): StatusBarData => {
      const candidates = buildCandidateUsageSourceIds({
        apiKey: config.apiKey,
        prefix: config.prefix,
        masker: maskApiKey,
      });
      return getStatusBarByCandidates(candidates);
    },
    [getStatusBarByCandidates, maskApiKey],
  );

  const getOpenAIProviderStats = useCallback(
    (provider: OpenAIProvider): KeyStatBucket => {
      if (provider.disabled) {
        return { success: 0, failure: 0 };
      }
      const candidates = new Set<string>();
      (provider.apiKeyEntries || []).forEach((entry) => {
        if (entry.disabled) return;
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
    (provider: OpenAIProvider, entry: ProviderApiKeyEntry): KeyStatBucket => {
      if (provider.disabled || entry.disabled) {
        return { success: 0, failure: 0 };
      }
      const candidates = buildCandidateUsageSourceIds({
        apiKey: entry.apiKey,
        prefix: provider.prefix,
        masker: maskApiKey,
      });
      return sumStatsByCandidates(candidates, usageStatsBySource);
    },
    [maskApiKey, usageStatsBySource],
  );

  const getOpenAIProviderStatusBar = useCallback(
    (provider: OpenAIProvider): StatusBarData => {
      if (provider.disabled) {
        return getEmptyStatusBar();
      }
      const candidates = new Set<string>();
      (provider.apiKeyEntries || []).forEach((entry) => {
        if (entry.disabled) return;
        buildCandidateUsageSourceIds({
          apiKey: entry.apiKey,
          prefix: provider.prefix,
          masker: maskApiKey,
        }).forEach((candidate) => candidates.add(candidate));
      });
      return getStatusBarByCandidates(Array.from(candidates));
    },
    [getEmptyStatusBar, getStatusBarByCandidates, maskApiKey],
  );

  const getOpenAIKeyEntryStatusBar = useCallback(
    (provider: OpenAIProvider, entry: ProviderApiKeyEntry): StatusBarData => {
      if (provider.disabled || entry.disabled) {
        return getEmptyStatusBar();
      }
      const candidates = buildCandidateUsageSourceIds({
        apiKey: entry.apiKey,
        prefix: provider.prefix,
        masker: maskApiKey,
      });
      return getStatusBarByCandidates(candidates);
    },
    [getEmptyStatusBar, getStatusBarByCandidates, maskApiKey],
  );

  return {
    getSimpleStats,
    getSimpleStatusBar,
    getOpenAIProviderStats,
    getOpenAIKeyEntryStats,
    getOpenAIProviderStatusBar,
    getOpenAIKeyEntryStatusBar,
  };
}
