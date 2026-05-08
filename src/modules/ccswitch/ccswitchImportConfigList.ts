import {
  getCcSwitchClientConfig,
  type CcSwitchClientType,
} from "@/modules/ccswitch/ccswitchImport";
import {
  CC_SWITCH_IMPORT_SETTINGS_STORAGE_KEY,
  DEFAULT_CC_SWITCH_IMPORT_SETTINGS,
  normalizeCcSwitchClaudeAuthField,
  normalizeCcSwitchEndpointPath,
  normalizeCcSwitchImportSettings,
  type CcSwitchClaudeAuthField,
} from "@/modules/ccswitch/ccswitchImportSettings";

export const CC_SWITCH_IMPORT_CONFIG_LIST_STORAGE_KEY = "ccswitch.importConfigList.v1";

export interface CcSwitchImportConfigListItem {
  id: string;
  clientType: CcSwitchClientType;
  providerName: string;
  note: string;
  defaultModel: string;
  allowedChannelGroups: string[];
  endpointPath: string;
  usageAutoInterval: number;
  apiKeyField?: CcSwitchClaudeAuthField;
}

interface CcSwitchImportConfigListPayload {
  version: 1;
  configs: CcSwitchImportConfigListItem[];
}

const CLIENT_TYPES: CcSwitchClientType[] = ["claude", "codex", "gemini"];

const defaultProviderName = (clientType: CcSwitchClientType) =>
  `CliProxy ${getCcSwitchClientConfig(clientType).fallbackLabel}`;

const normalizeChannelGroups = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const items: string[] = [];

  value.forEach((entry) => {
    const normalized = String(entry ?? "")
      .trim()
      .toLowerCase();
    if (!normalized || seen.has(normalized)) return;
    seen.add(normalized);
    items.push(normalized);
  });

  return items;
};

const normalizeUsageAutoInterval = (value: unknown, fallback: number) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.round(parsed);
};

const createConfigId = () => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `ccswitch-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
};

export function deriveCcSwitchImportSettingsFromConfigList(
  configs: readonly CcSwitchImportConfigListItem[],
) {
  return normalizeCcSwitchImportSettings({
    claude: {
      endpointPath:
        configs.find((item) => item.clientType === "claude")?.endpointPath ??
        DEFAULT_CC_SWITCH_IMPORT_SETTINGS.claude.endpointPath,
      defaultModel:
        configs.find((item) => item.clientType === "claude")?.defaultModel ??
        DEFAULT_CC_SWITCH_IMPORT_SETTINGS.claude.defaultModel,
      usageAutoInterval:
        configs.find((item) => item.clientType === "claude")?.usageAutoInterval ??
        DEFAULT_CC_SWITCH_IMPORT_SETTINGS.claude.usageAutoInterval,
      apiKeyField:
        configs.find((item) => item.clientType === "claude")?.apiKeyField ??
        DEFAULT_CC_SWITCH_IMPORT_SETTINGS.claude.apiKeyField,
    },
    codex: {
      endpointPath:
        configs.find((item) => item.clientType === "codex")?.endpointPath ??
        DEFAULT_CC_SWITCH_IMPORT_SETTINGS.codex.endpointPath,
      defaultModel:
        configs.find((item) => item.clientType === "codex")?.defaultModel ??
        DEFAULT_CC_SWITCH_IMPORT_SETTINGS.codex.defaultModel,
      usageAutoInterval:
        configs.find((item) => item.clientType === "codex")?.usageAutoInterval ??
        DEFAULT_CC_SWITCH_IMPORT_SETTINGS.codex.usageAutoInterval,
    },
    gemini: {
      endpointPath:
        configs.find((item) => item.clientType === "gemini")?.endpointPath ??
        DEFAULT_CC_SWITCH_IMPORT_SETTINGS.gemini.endpointPath,
      defaultModel:
        configs.find((item) => item.clientType === "gemini")?.defaultModel ??
        DEFAULT_CC_SWITCH_IMPORT_SETTINGS.gemini.defaultModel,
      usageAutoInterval:
        configs.find((item) => item.clientType === "gemini")?.usageAutoInterval ??
        DEFAULT_CC_SWITCH_IMPORT_SETTINGS.gemini.usageAutoInterval,
    },
  });
}

export function createCcSwitchImportConfig(
  input: Partial<CcSwitchImportConfigListItem> & Pick<CcSwitchImportConfigListItem, "clientType">,
): CcSwitchImportConfigListItem {
  const defaults = DEFAULT_CC_SWITCH_IMPORT_SETTINGS[input.clientType];

  return {
    id: String(input.id ?? "").trim() || createConfigId(),
    clientType: input.clientType,
    providerName: String(input.providerName ?? "").trim() || defaultProviderName(input.clientType),
    note: String(input.note ?? "").trim(),
    defaultModel:
      String(input.defaultModel ?? "").trim() || String(defaults.defaultModel ?? "").trim(),
    allowedChannelGroups: normalizeChannelGroups(input.allowedChannelGroups),
    endpointPath: normalizeCcSwitchEndpointPath(input.endpointPath ?? defaults.endpointPath),
    usageAutoInterval: normalizeUsageAutoInterval(
      input.usageAutoInterval,
      defaults.usageAutoInterval,
    ),
    ...(input.clientType === "claude"
      ? {
          apiKeyField: normalizeCcSwitchClaudeAuthField(
            input.apiKeyField ?? defaults.apiKeyField,
          ),
        }
      : {}),
  };
}

function normalizePayload(value: unknown): CcSwitchImportConfigListItem[] {
  if (!value || typeof value !== "object" || Array.isArray(value)) return [];
  const rawConfigs = (value as { configs?: unknown }).configs;
  if (!Array.isArray(rawConfigs)) return [];

  return rawConfigs
    .map((entry) => {
      if (!entry || typeof entry !== "object" || Array.isArray(entry)) return null;
      const item = entry as Partial<CcSwitchImportConfigListItem>;
      const clientType = item.clientType;
      if (!clientType || !CLIENT_TYPES.includes(clientType)) return null;
      return createCcSwitchImportConfig({
        ...item,
        clientType,
      });
    })
    .filter((item): item is CcSwitchImportConfigListItem => Boolean(item));
}

function migrateLegacySettings(): CcSwitchImportConfigListItem[] {
  if (typeof window === "undefined") return [];
  const raw = window.localStorage.getItem(CC_SWITCH_IMPORT_SETTINGS_STORAGE_KEY);
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const normalized = normalizeCcSwitchImportSettings(parsed);
    return CLIENT_TYPES.map((clientType) =>
      createCcSwitchImportConfig({
        clientType,
        providerName: defaultProviderName(clientType),
        defaultModel: normalized[clientType].defaultModel,
        endpointPath: normalized[clientType].endpointPath,
        usageAutoInterval: normalized[clientType].usageAutoInterval,
        ...(clientType === "claude"
          ? {
              apiKeyField: normalized.claude.apiKeyField,
            }
          : {}),
      }),
    );
  } catch {
    return [];
  }
}

export function readCcSwitchImportConfigList(): CcSwitchImportConfigListItem[] {
  try {
    if (typeof window === "undefined") return [];

    const raw = window.localStorage.getItem(CC_SWITCH_IMPORT_CONFIG_LIST_STORAGE_KEY);
    if (raw) {
      return normalizePayload(JSON.parse(raw));
    }

    const migrated = migrateLegacySettings();
    if (migrated.length > 0) {
      writeCcSwitchImportConfigList(migrated);
    }
    return migrated;
  } catch {
    return [];
  }
}

export function writeCcSwitchImportConfigList(
  configs: readonly CcSwitchImportConfigListItem[],
): CcSwitchImportConfigListItem[] {
  const normalized = configs.map((item) => createCcSwitchImportConfig(item));
  const payload: CcSwitchImportConfigListPayload = {
    version: 1,
    configs: normalized,
  };

  try {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(CC_SWITCH_IMPORT_CONFIG_LIST_STORAGE_KEY, JSON.stringify(payload));
      window.localStorage.setItem(
        CC_SWITCH_IMPORT_SETTINGS_STORAGE_KEY,
        JSON.stringify(deriveCcSwitchImportSettingsFromConfigList(normalized)),
      );
    }
  } catch {
    // ignore storage failures
  }

  return normalized;
}
