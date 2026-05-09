import { describe, expect, it } from "vitest";
import {
  buildGroupedProviderDraft,
  buildProviderConfigsFromDraft,
  groupProviderConfigs,
  remapKeyEntryStatuses,
  toggleGroupedConfigsEnabled,
} from "@/modules/providers/grouped-provider-utils";
import type { ProviderSimpleConfig } from "@/lib/http/types";

describe("grouped-provider-utils", () => {
  it("groups by name and baseUrl while marking shared-field conflicts", () => {
    const groups = groupProviderConfigs("codex", [
      {
        name: "Main",
        baseUrl: "https://api.example.com/v1",
        prefix: "a",
        apiKey: "sk-a",
      },
      {
        name: "Main",
        baseUrl: "https://api.example.com/v1/",
        prefix: "b",
        apiKey: "sk-b",
        models: [{ name: "gpt-4.1-mini" }],
      },
      {
        name: "Main",
        baseUrl: "https://api.other.com/v1",
        prefix: "a",
        apiKey: "sk-c",
      },
    ] satisfies ProviderSimpleConfig[]);

    expect(groups).toHaveLength(2);
    expect(groups[0]?.items).toHaveLength(2);
    expect(groups[0]?.enabledCount).toBe(2);
    expect(groups[0]?.disabledCount).toBe(0);
    expect(groups[0]?.hasSharedFieldConflict).toBe(true);
    expect(groups[1]?.items).toHaveLength(1);
    expect(groups[1]?.enabledCount).toBe(1);
    expect(groups[1]?.hasSharedFieldConflict).toBe(false);
  });

  it("builds configs by copying current shared fields to every key entry", () => {
    const group = groupProviderConfigs("claude", [
      {
        name: "Claude Main",
        baseUrl: "https://api.anthropic.com",
        prefix: "team-a",
        priority: 9,
        apiKey: "sk-one",
      },
      {
        name: "Claude Main",
        baseUrl: "https://api.anthropic.com",
        prefix: "team-a",
        priority: 9,
        apiKey: "sk-two",
      },
    ])[0];

    const draft = buildGroupedProviderDraft("claude", group);
    draft.prefix = "team-b";
    draft.priorityText = "11";
    draft.keyEntries[0].proxyId = "hk";
    draft.keyEntries[1].proxyUrl = "http://127.0.0.1:7890";
    draft.keyEntries[1].enabled = false;

    const result = buildProviderConfigsFromDraft("claude", draft);
    expect(result.error).toBeUndefined();
    expect(result.configs).toEqual([
      expect.objectContaining({
        name: "Claude Main",
        baseUrl: "https://api.anthropic.com",
        prefix: "team-b",
        priority: 11,
        apiKey: "sk-one",
        proxyId: "hk",
      }),
      expect.objectContaining({
        name: "Claude Main",
        baseUrl: "https://api.anthropic.com",
        prefix: "team-b",
        priority: 11,
        apiKey: "sk-two",
        proxyUrl: "http://127.0.0.1:7890",
        excludedModels: ["*"],
      }),
    ]);
  });

  it("remaps test status by key signature", () => {
    const previous = [
      {
        id: "1",
        apiKey: "sk-one",
        proxyUrl: "",
        proxyId: "",
        enabled: true,
        headersEntries: [],
        testStatus: "success" as const,
        testMessage: "ok",
      },
      {
        id: "2",
        apiKey: "sk-two",
        proxyUrl: "",
        proxyId: "",
        enabled: true,
        headersEntries: [],
        testStatus: "error" as const,
        testMessage: "bad",
      },
    ];

    const next = remapKeyEntryStatuses(previous, [
      {
        id: "n2",
        apiKey: "sk-two",
        proxyUrl: "",
        proxyId: "",
        enabled: true,
        headersEntries: [],
        testStatus: "idle",
        testMessage: "",
      },
      {
        id: "n1",
        apiKey: "sk-one",
        proxyUrl: "",
        proxyId: "",
        enabled: true,
        headersEntries: [],
        testStatus: "idle",
        testMessage: "",
      },
    ]);

    expect(next[0]?.testStatus).toBe("error");
    expect(next[0]?.testMessage).toBe("bad");
    expect(next[1]?.testStatus).toBe("success");
    expect(next[1]?.testMessage).toBe("ok");
  });

  it("toggles grouped enabled state by applying disable-all rule per key", () => {
    const group = groupProviderConfigs("gemini", [
      {
        name: "Gemini Main",
        baseUrl: "https://generativelanguage.googleapis.com",
        apiKey: "sk-a",
        excludedModels: ["gemini-2.5-pro"],
      },
      {
        name: "Gemini Main",
        baseUrl: "https://generativelanguage.googleapis.com",
        apiKey: "sk-b",
        excludedModels: ["*", "gemini-2.5-pro"],
      },
    ])[0];

    const disabled = toggleGroupedConfigsEnabled(
      [
        {
          name: "Gemini Main",
          baseUrl: "https://generativelanguage.googleapis.com",
          apiKey: "sk-a",
          excludedModels: ["gemini-2.5-pro"],
        },
        {
          name: "Gemini Main",
          baseUrl: "https://generativelanguage.googleapis.com",
          apiKey: "sk-b",
          excludedModels: ["*", "gemini-2.5-pro"],
        },
      ] satisfies ProviderSimpleConfig[],
      group,
      false,
    );
    expect(disabled[0]?.excludedModels).toContain("*");
    expect(disabled[1]?.excludedModels).toEqual(expect.arrayContaining(["*"]));

    const enabled = toggleGroupedConfigsEnabled(disabled, group, true);
    expect(enabled[0]?.excludedModels).not.toContain("*");
    expect(enabled[1]?.excludedModels).not.toContain("*");
  });
});
