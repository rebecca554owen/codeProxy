import type {
  ApiCallRequest,
  ApiCallResult,
  ProviderModel,
  ProviderSimpleConfig,
} from "@/lib/http/types";
import { getApiCallErrorMessage } from "@/lib/http/apis";
import {
  keyValueEntriesToRecord,
  recordToKeyValueEntries,
  type KeyValueEntry,
} from "@/modules/providers/KeyValueInputList";
import {
  mergeKeyStatBuckets,
  type KeyStatBucket,
  type StatusBarData,
} from "@/modules/providers/provider-usage";
import {
  commitModelEntries,
  excludedModelsFromText,
  excludedModelsToText,
  hasDisableAllModelsRule,
  maskApiKey,
  normalizeOpenAIBaseUrl,
  stripDisableAllModelsRule,
  withDisableAllModelsRule,
} from "@/modules/providers/providers-helpers";
import { createEmptyModelEntry, type ModelEntryDraft } from "@/modules/providers/ModelInputList";

export type GroupedProviderType = "gemini" | "claude" | "codex";

export type GroupedProviderKeyEntry = {
  id: string;
  apiKey: string;
  proxyUrl: string;
  proxyId: string;
  enabled: boolean;
  headersEntries: KeyValueEntry[];
  testStatus: "idle" | "loading" | "success" | "error";
  testMessage: string;
};

export type GroupedProviderDraft = {
  name: string;
  baseUrl: string;
  prefix: string;
  priorityText: string;
  headersEntries: KeyValueEntry[];
  modelEntries: ModelEntryDraft[];
  excludedModelsText: string;
  testModel: string;
  skipAnthropicProcessing: boolean;
  keyEntries: GroupedProviderKeyEntry[];
};

export type GroupedProviderGroup = {
  id: string;
  provider: GroupedProviderType;
  name: string;
  baseUrl: string;
  prefix: string;
  priority?: number;
  headers?: Record<string, string>;
  models?: ProviderModel[];
  excludedModels?: string[];
  skipAnthropicProcessing?: boolean;
  hasSharedFieldConflict: boolean;
  enabled: boolean;
  enabledCount: number;
  disabledCount: number;
  items: ProviderSimpleConfig[];
  indexes: number[];
};

type ConnectivityInput = {
  provider: GroupedProviderType;
  baseUrl: string;
  testModel: string;
  providerHeaders?: Record<string, string>;
  keyHeaders?: Record<string, string>;
  apiKey: string;
};

const uid = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;

const normalizeName = (value: string | undefined) => String(value ?? "").trim();

const normalizeBaseUrl = (value: string | undefined) =>
  String(value ?? "")
    .trim()
    .replace(/\/+$/g, "");

const normalizeGroupIdentity = (provider: GroupedProviderType, name: string, baseUrl: string) =>
  `${provider}:${name.trim().toLowerCase()}::${normalizeBaseUrl(baseUrl).toLowerCase()}`;

const normalizeHeaderRecord = (headers?: Record<string, string>) => {
  const folded = new Map<string, string>();
  for (const [rawKey, rawValue] of Object.entries(headers ?? {})) {
    const key = rawKey.trim().toLowerCase();
    const value = String(rawValue ?? "").trim();
    if (!key || !value) continue;
    folded.set(key, value);
  }
  return Array.from(folded.entries()).sort(([left], [right]) => left.localeCompare(right));
};

const normalizeModelsForSignature = (models?: ProviderModel[]) =>
  (models ?? [])
    .map((model) => ({
      name: String(model.name ?? "").trim(),
      alias: String(model.alias ?? "").trim(),
      priority: coercePriority(model.priority) ?? null,
      testModel: String(model.testModel ?? "").trim(),
    }))
    .filter((model) => model.name)
    .sort((left, right) => {
      const byName = left.name.toLowerCase().localeCompare(right.name.toLowerCase());
      if (byName !== 0) return byName;
      const byAlias = left.alias.toLowerCase().localeCompare(right.alias.toLowerCase());
      if (byAlias !== 0) return byAlias;
      const byPriority = (left.priority ?? 0) - (right.priority ?? 0);
      if (byPriority !== 0) return byPriority;
      return left.testModel.toLowerCase().localeCompare(right.testModel.toLowerCase());
    });

const normalizeExcludedModelsForSignature = (models?: string[]) =>
  Array.from(
    new Set(
      (models ?? [])
        .map((model) => String(model ?? "").trim())
        .filter(Boolean)
        .map((model) => model.toLowerCase()),
    ),
  ).sort((left, right) => left.localeCompare(right));

const buildSharedFieldSignature = (
  provider: GroupedProviderType,
  item: Pick<
    ProviderSimpleConfig,
    "prefix" | "priority" | "headers" | "models" | "excludedModels" | "skipAnthropicProcessing"
  >,
) =>
  JSON.stringify({
    provider,
    prefix: String(item.prefix ?? "").trim(),
    priority: coercePriority(item.priority) ?? null,
    headers: normalizeHeaderRecord(item.headers),
    models: normalizeModelsForSignature(item.models),
    excludedModels: normalizeExcludedModelsForSignature(item.excludedModels),
    skipAnthropicProcessing: provider === "claude" ? Boolean(item.skipAnthropicProcessing) : null,
  });

const mergeHeaders = (...records: Array<Record<string, string> | undefined>) => {
  const result: Record<string, string> = {};
  for (const record of records) {
    if (!record) continue;
    for (const [rawKey, rawValue] of Object.entries(record)) {
      const key = rawKey.trim();
      const value = String(rawValue ?? "").trim();
      if (!key || !value) continue;
      const existingKey = Object.keys(result).find(
        (currentKey) => currentKey.toLowerCase() === key.toLowerCase(),
      );
      if (existingKey) {
        delete result[existingKey];
      }
      result[key] = value;
    }
  }
  return result;
};

const coercePriority = (value: unknown): number | undefined => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
};

const buildKeySignature = (entry: {
  apiKey?: string;
  proxyUrl?: string;
  proxyId?: string;
  headersEntries?: KeyValueEntry[];
  headers?: Record<string, string>;
}) =>
  [
    String(entry.apiKey ?? "").trim(),
    String(entry.proxyUrl ?? "").trim(),
    String(entry.proxyId ?? "").trim(),
    JSON.stringify(
      keyValueEntriesToRecord(entry.headersEntries ?? []) ?? entry.headers ?? {},
      Object.keys(
        keyValueEntriesToRecord(entry.headersEntries ?? []) ?? entry.headers ?? {},
      ).sort(),
    ),
  ].join("||");

const createEmptyKeyEntry = (): GroupedProviderKeyEntry => ({
  id: uid("group-key"),
  apiKey: "",
  proxyUrl: "",
  proxyId: "",
  enabled: true,
  headersEntries: [],
  testStatus: "idle",
  testMessage: "",
});

const getDefaultBaseUrl = (provider: GroupedProviderType, input: string) => {
  const normalized = normalizeBaseUrl(input);
  if (normalized) return normalized;
  if (provider === "gemini") return "https://generativelanguage.googleapis.com";
  if (provider === "claude") return "https://api.anthropic.com";
  return "";
};

export const mergeStatusBars = (bars: StatusBarData[]): StatusBarData => {
  if (bars.length === 0) {
    return {
      blocks: Array.from({ length: 20 }, () => "idle" as const),
      blockDetails: Array.from({ length: 20 }, () => ({
        success: 0,
        failure: 0,
        rate: -1,
        startTime: 0,
        endTime: 0,
      })),
      successRate: 100,
      totalSuccess: 0,
      totalFailure: 0,
    };
  }

  const blockCount = Math.max(...bars.map((bar) => bar.blocks.length), 20);
  const blocks = Array.from({ length: blockCount }, (_, index) => {
    const states = bars
      .map((bar) => bar.blocks[index] ?? "idle")
      .filter((state) => state !== "idle");
    if (states.length === 0) return "idle" as const;
    if (states.includes("mixed")) return "mixed" as const;
    if (states.includes("success") && states.includes("failure")) return "mixed" as const;
    return states[0] as StatusBarData["blocks"][number];
  });

  const totalSuccess = bars.reduce((sum, bar) => sum + bar.totalSuccess, 0);
  const totalFailure = bars.reduce((sum, bar) => sum + bar.totalFailure, 0);
  const total = totalSuccess + totalFailure;
  const blockDetails = Array.from({ length: blockCount }, (_, index) => {
    const source = bars
      .map((bar) => bar.blockDetails?.[index])
      .filter(Boolean) as StatusBarData["blockDetails"];
    const success = source.reduce((sum, detail) => sum + detail.success, 0);
    const failure = source.reduce((sum, detail) => sum + detail.failure, 0);
    const rateTotal = success + failure;
    const firstDetail = source[0];
    return {
      success,
      failure,
      rate: rateTotal > 0 ? success / rateTotal : -1,
      startTime: firstDetail?.startTime ?? 0,
      endTime: firstDetail?.endTime ?? 0,
    };
  });
  return {
    blocks,
    blockDetails,
    totalSuccess,
    totalFailure,
    successRate: total > 0 ? (totalSuccess / total) * 100 : 100,
  };
};

export const groupProviderConfigs = (
  provider: GroupedProviderType,
  items: ProviderSimpleConfig[],
): GroupedProviderGroup[] => {
  const groups = new Map<string, GroupedProviderGroup>();
  items.forEach((item, index) => {
    const name = normalizeName(item.name);
    const baseUrl = normalizeBaseUrl(item.baseUrl);
    const id = normalizeGroupIdentity(provider, name, baseUrl);
    const sharedFieldSignature = buildSharedFieldSignature(provider, item);
    const enabled = !hasDisableAllModelsRule(item.excludedModels);
    const existing = groups.get(id);
    if (existing) {
      const firstItem = existing.items[0];
      existing.items.push(item);
      existing.indexes.push(index);
      existing.enabledCount += enabled ? 1 : 0;
      existing.disabledCount += enabled ? 0 : 1;
      existing.enabled = existing.enabledCount > 0;
      if (existing.hasSharedFieldConflict === false && firstItem) {
        const currentSignature = buildSharedFieldSignature(provider, firstItem);
        existing.hasSharedFieldConflict = currentSignature !== sharedFieldSignature;
      }
      return;
    }

    groups.set(id, {
      id,
      provider,
      name,
      baseUrl,
      prefix: String(item.prefix ?? "").trim(),
      priority: coercePriority(item.priority),
      headers: item.headers,
      models: item.models,
      excludedModels: item.excludedModels,
      skipAnthropicProcessing: item.skipAnthropicProcessing,
      hasSharedFieldConflict: false,
      enabled,
      enabledCount: enabled ? 1 : 0,
      disabledCount: enabled ? 0 : 1,
      items: [item],
      indexes: [index],
    });
  });

  return Array.from(groups.values()).sort((left, right) => left.indexes[0] - right.indexes[0]);
};

export const buildGroupedProviderDraft = (
  provider: GroupedProviderType,
  group?: GroupedProviderGroup | null,
): GroupedProviderDraft => {
  if (!group) {
    return {
      name: "",
      baseUrl: "",
      prefix: "",
      priorityText: "",
      headersEntries: [],
      modelEntries: [createEmptyModelEntry()],
      excludedModelsText: "",
      testModel: "",
      skipAnthropicProcessing: false,
      keyEntries: [createEmptyKeyEntry()],
    };
  }

  return {
    name: group.name,
    baseUrl: group.baseUrl,
    prefix: group.prefix,
    priorityText: group.priority !== undefined ? String(group.priority) : "",
    headersEntries: recordToKeyValueEntries(group.headers),
    modelEntries:
      Array.isArray(group.models) && group.models.length > 0
        ? group.models.map((model) => ({
            id: uid("model"),
            name: model.name ?? "",
            alias: model.alias ?? "",
            priorityText: model.priority !== undefined ? String(model.priority) : "",
            testModel: model.testModel ?? "",
          }))
        : [createEmptyModelEntry()],
    excludedModelsText: excludedModelsToText(stripDisableAllModelsRule(group.excludedModels)),
    testModel: group.models?.[0]?.testModel ?? group.models?.[0]?.name ?? "",
    skipAnthropicProcessing: Boolean(group.skipAnthropicProcessing),
    keyEntries:
      group.items.length > 0
        ? group.items.map((item) => ({
            id: uid("group-key"),
            apiKey: item.apiKey ?? "",
            proxyUrl: item.proxyUrl ?? "",
            proxyId: item.proxyId ?? "",
            enabled: !hasDisableAllModelsRule(item.excludedModels),
            headersEntries: recordToKeyValueEntries(item.headers),
            testStatus: "idle",
            testMessage: "",
          }))
        : [createEmptyKeyEntry()],
  };
};

export const remapKeyEntryStatuses = (
  previousEntries: GroupedProviderKeyEntry[],
  nextEntries: GroupedProviderKeyEntry[],
): GroupedProviderKeyEntry[] => {
  const previousBySignature = new Map(
    previousEntries.map((entry) => [buildKeySignature(entry), entry]),
  );
  return nextEntries.map((entry) => {
    const previous = previousBySignature.get(buildKeySignature(entry));
    if (!previous) {
      return {
        ...entry,
        testStatus: "idle",
        testMessage: "",
      };
    }
    return {
      ...entry,
      testStatus: previous.testStatus,
      testMessage: previous.testMessage,
    };
  });
};

export const buildProviderConfigsFromDraft = (
  provider: GroupedProviderType,
  draft: GroupedProviderDraft,
): { configs?: ProviderSimpleConfig[]; error?: string } => {
  const name = draft.name.trim();
  if (!name) {
    return { error: "providers.channel_name_error" };
  }

  const priority = draft.priorityText.trim() === "" ? undefined : Number(draft.priorityText);
  if (priority !== undefined && !Number.isFinite(priority)) {
    return { error: "providers.priority_error" };
  }

  const headers = keyValueEntriesToRecord(draft.headersEntries);
  const excludedModels = excludedModelsFromText(draft.excludedModelsText);
  const modelCommit = commitModelEntries(draft.modelEntries);
  if (modelCommit.error) {
    return { error: modelCommit.error };
  }

  const seen = new Set<string>();
  const configs: ProviderSimpleConfig[] = [];
  for (const entry of draft.keyEntries) {
    const apiKey = entry.apiKey.trim();
    if (!apiKey) continue;
    const signature = buildKeySignature(entry);
    if (seen.has(signature)) continue;
    seen.add(signature);
    const keyHeaders = keyValueEntriesToRecord(entry.headersEntries);
    const mergedHeaders = mergeHeaders(headers, keyHeaders);
    const excludedModelsForEntry = entry.enabled
      ? stripDisableAllModelsRule(excludedModels)
      : withDisableAllModelsRule(excludedModels);
    configs.push({
      apiKey,
      name,
      ...(draft.baseUrl.trim() ? { baseUrl: draft.baseUrl.trim() } : {}),
      ...(draft.prefix.trim() ? { prefix: draft.prefix.trim() } : {}),
      ...(priority !== undefined ? { priority: Math.trunc(priority) } : {}),
      ...(modelCommit.models ? { models: modelCommit.models } : {}),
      ...(excludedModelsForEntry.length ? { excludedModels: excludedModelsForEntry } : {}),
      ...(entry.proxyUrl.trim() ? { proxyUrl: entry.proxyUrl.trim() } : {}),
      ...(entry.proxyId.trim() ? { proxyId: entry.proxyId.trim() } : {}),
      ...(Object.keys(mergedHeaders).length ? { headers: mergedHeaders } : {}),
      ...(provider === "claude" && draft.skipAnthropicProcessing
        ? { skipAnthropicProcessing: true }
        : {}),
    });
  }

  if (configs.length === 0) {
    return { error: "providers.key_entry_error" };
  }

  return { configs };
};

export const replaceGroupedConfigs = (
  items: ProviderSimpleConfig[],
  group: GroupedProviderGroup | null,
  replacements: ProviderSimpleConfig[],
): ProviderSimpleConfig[] => {
  if (!group) return [...items, ...replacements];
  const indexes = new Set(group.indexes);
  const result = items.filter((_, index) => !indexes.has(index));
  result.splice(group.indexes[0], 0, ...replacements);
  return result;
};

export const toggleGroupedConfigsEnabled = (
  items: ProviderSimpleConfig[],
  group: GroupedProviderGroup,
  enabled: boolean,
): ProviderSimpleConfig[] => {
  const indexes = new Set(group.indexes);
  return items.map((item, index) => {
    if (!indexes.has(index)) return item;
    const excludedModels = enabled
      ? stripDisableAllModelsRule(item.excludedModels)
      : withDisableAllModelsRule(item.excludedModels);
    const nextItem: ProviderSimpleConfig = { ...item, excludedModels };
    if (excludedModels.length === 0) {
      delete nextItem.excludedModels;
    }
    return nextItem;
  });
};

export const deleteGroupedConfigs = (
  items: ProviderSimpleConfig[],
  group: GroupedProviderGroup,
): ProviderSimpleConfig[] => {
  const indexes = new Set(group.indexes);
  return items.filter((_, index) => !indexes.has(index));
};

export const aggregateGroupStats = (
  group: GroupedProviderGroup,
  getStats: (item: ProviderSimpleConfig) => KeyStatBucket,
) =>
  group.items.reduce<KeyStatBucket>((acc, item) => mergeKeyStatBuckets(acc, getStats(item)), {
    success: 0,
    failure: 0,
  });

export const aggregateGroupStatusBar = (
  group: GroupedProviderGroup,
  getStatusBar: (item: ProviderSimpleConfig) => StatusBarData,
) => mergeStatusBars(group.items.map((item) => getStatusBar(item)));

const getConnectivityErrorMessage = (result: ApiCallResult) => getApiCallErrorMessage(result);

const buildOpenAIChatCompletionsEndpoint = (baseUrl: string) => {
  const normalized = normalizeOpenAIBaseUrl(baseUrl);
  if (!normalized) return "";
  if (/\/chat\/completions$/i.test(normalized)) return normalized;
  if (/\/v1$/i.test(normalized)) return `${normalized}/chat/completions`;
  return `${normalized}/v1/chat/completions`;
};

const buildClaudeMessagesEndpoint = (baseUrl: string) => {
  const normalized = normalizeBaseUrl(baseUrl) || "https://api.anthropic.com";
  if (/\/v1\/messages$/i.test(normalized)) return normalized;
  if (/\/v1$/i.test(normalized)) return `${normalized}/messages`;
  return `${normalized}/v1/messages`;
};

const buildGeminiGenerateContentEndpoint = (baseUrl: string, model: string) => {
  const normalizedBase = getDefaultBaseUrl("gemini", baseUrl);
  const normalizedModel = String(model ?? "")
    .trim()
    .replace(/^models\//i, "");
  if (!normalizedModel) return "";
  const root = normalizedBase.replace(/\/v1beta(?:\/.*)?$/i, "").replace(/\/+$/g, "");
  return `${root}/v1beta/models/${normalizedModel}:generateContent`;
};

const mergeConnectivityHeaders = (
  providerHeaders?: Record<string, string>,
  keyHeaders?: Record<string, string>,
) => mergeHeaders(providerHeaders, keyHeaders);

export const runGroupedProviderConnectivityTest = async (
  input: ConnectivityInput,
  request: (payload: ApiCallRequest) => Promise<ApiCallResult>,
): Promise<void> => {
  const apiKey = input.apiKey.trim();
  const headers = mergeConnectivityHeaders(input.providerHeaders, input.keyHeaders);

  if (input.provider === "claude") {
    const url = buildClaudeMessagesEndpoint(input.baseUrl);
    const resolvedHeaders = mergeHeaders(
      {
        "Content-Type": "application/json",
        "anthropic-version": "2023-06-01",
      },
      headers,
      apiKey ? { "x-api-key": apiKey } : undefined,
    );
    const result = await request({
      method: "POST",
      url,
      header: resolvedHeaders,
      data: JSON.stringify({
        model: input.testModel,
        max_tokens: 8,
        messages: [{ role: "user", content: "Hi" }],
      }),
    });
    if (result.statusCode < 200 || result.statusCode >= 300) {
      throw new Error(getConnectivityErrorMessage(result));
    }
    return;
  }

  if (input.provider === "gemini") {
    const url = buildGeminiGenerateContentEndpoint(input.baseUrl, input.testModel);
    const resolvedHeaders = mergeHeaders(
      { "Content-Type": "application/json" },
      headers,
      apiKey ? { "x-goog-api-key": apiKey } : undefined,
    );
    const result = await request({
      method: "POST",
      url,
      header: resolvedHeaders,
      data: JSON.stringify({
        contents: [{ parts: [{ text: "Hi" }] }],
        generationConfig: { maxOutputTokens: 8 },
      }),
    });
    if (result.statusCode < 200 || result.statusCode >= 300) {
      throw new Error(getConnectivityErrorMessage(result));
    }
    return;
  }

  const url = buildOpenAIChatCompletionsEndpoint(input.baseUrl);
  const resolvedHeaders = mergeHeaders(
    { "Content-Type": "application/json" },
    headers,
    apiKey ? { Authorization: `Bearer ${apiKey}` } : undefined,
  );
  const result = await request({
    method: "POST",
    url,
    header: resolvedHeaders,
    data: JSON.stringify({
      model: input.testModel,
      messages: [{ role: "user", content: "Hi" }],
      max_tokens: 8,
    }),
  });
  if (result.statusCode < 200 || result.statusCode >= 300) {
    throw new Error(getConnectivityErrorMessage(result));
  }
};

export const resolveGroupTestModel = (draft: GroupedProviderDraft) => {
  const explicit = draft.testModel.trim();
  if (explicit) return explicit;
  const modelEntry = draft.modelEntries.find((entry) => entry.name.trim());
  if (modelEntry) return modelEntry.name.trim();
  return "";
};

export const buildGroupedProviderAccessCandidates = (group: GroupedProviderGroup) =>
  group.items.map((item) => maskApiKey(item.apiKey));
