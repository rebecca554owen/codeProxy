import { beforeEach, describe, expect, test } from "vitest";
import {
  createCcSwitchImportConfig,
  readCcSwitchImportConfigList,
  writeCcSwitchImportConfigList,
} from "@/modules/ccswitch/ccswitchImportConfigList";
import { readCcSwitchImportSettings } from "@/modules/ccswitch/ccswitchImportSettings";

describe("ccswitchImportConfigList", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  test("migrates the legacy single-settings payload into a config list", () => {
    window.localStorage.setItem(
      "ccswitch.importSettings.v1",
      JSON.stringify({
        claude: {
          endpointPath: "",
          defaultModel: "claude-sonnet-4-5",
          usageAutoInterval: 30,
          apiKeyField: "ANTHROPIC_AUTH_TOKEN",
        },
        codex: {
          endpointPath: "/openai/v1",
          defaultModel: "gpt-5.6",
          usageAutoInterval: 45,
        },
        gemini: {
          endpointPath: "",
          defaultModel: "gemini-2.5-pro",
          usageAutoInterval: 60,
        },
      }),
    );

    const configs = readCcSwitchImportConfigList();

    expect(configs).toHaveLength(3);
    expect(configs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          clientType: "claude",
          providerName: "CliProxy Claude Code",
          defaultModel: "claude-sonnet-4-5",
          apiKeyField: "ANTHROPIC_AUTH_TOKEN",
        }),
        expect.objectContaining({
          clientType: "codex",
          providerName: "CliProxy Codex",
          defaultModel: "gpt-5.6",
          endpointPath: "/openai/v1",
          usageAutoInterval: 45,
        }),
        expect.objectContaining({
          clientType: "gemini",
          providerName: "CliProxy Gemini CLI",
          defaultModel: "gemini-2.5-pro",
          usageAutoInterval: 60,
        }),
      ]),
    );
  });

  test("normalizes and persists config list entries", () => {
    const created = createCcSwitchImportConfig({
      clientType: "codex",
      providerName: "  Relay Codex  ",
      note: "  Preferred route  ",
      defaultModel: "  gpt-5.5  ",
      endpointPath: "v1/",
      usageAutoInterval: 17.6,
      allowedChannelGroups: ["team-a", "TEAM-A", "team-b", ""],
    });

    const stored = writeCcSwitchImportConfigList([created]);

    expect(stored).toEqual([
      expect.objectContaining({
        clientType: "codex",
        providerName: "Relay Codex",
        note: "Preferred route",
        defaultModel: "gpt-5.5",
        endpointPath: "/v1",
        usageAutoInterval: 18,
        allowedChannelGroups: ["team-a", "team-b"],
      }),
    ]);

    expect(readCcSwitchImportSettings()).toMatchObject({
      codex: {
        defaultModel: "gpt-5.5",
        endpointPath: "/v1",
        usageAutoInterval: 18,
      },
    });
  });

  test("derives import settings from the config list when legacy settings are absent", () => {
    writeCcSwitchImportConfigList([
      createCcSwitchImportConfig({
        clientType: "claude",
        providerName: "Relay Claude",
        defaultModel: "claude-sonnet-4-5",
        endpointPath: "/anthropic",
        usageAutoInterval: 25,
        apiKeyField: "ANTHROPIC_AUTH_TOKEN",
      }),
    ]);
    window.localStorage.removeItem("ccswitch.importSettings.v1");

    expect(readCcSwitchImportSettings()).toMatchObject({
      claude: {
        defaultModel: "claude-sonnet-4-5",
        endpointPath: "/anthropic",
        usageAutoInterval: 25,
        apiKeyField: "ANTHROPIC_AUTH_TOKEN",
      },
    });
  });
});
