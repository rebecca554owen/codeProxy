// @vitest-environment jsdom

import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { ProvidersPage } from "@/modules/providers/ProvidersPage";
import { ThemeProvider } from "@/modules/ui/ThemeProvider";
import { ToastProvider } from "@/modules/ui/ToastProvider";

function getMocks() {
  const store = globalThis as typeof globalThis & {
    __providersPageOpenAiMocks__?: {
      getGeminiKeys: ReturnType<typeof vi.fn>;
      getClaudeConfigs: ReturnType<typeof vi.fn>;
      getCodexConfigs: ReturnType<typeof vi.fn>;
      getVertexConfigs: ReturnType<typeof vi.fn>;
      getOpenAIProviders: ReturnType<typeof vi.fn>;
      saveCodexConfigs: ReturnType<typeof vi.fn>;
      saveOpenAIProviders: ReturnType<typeof vi.fn>;
      getEntityStats: ReturnType<typeof vi.fn>;
      getEntityBlockStats: ReturnType<typeof vi.fn>;
      apiKeyEntriesList: ReturnType<typeof vi.fn>;
      channelGroupsList: ReturnType<typeof vi.fn>;
      proxiesList: ReturnType<typeof vi.fn>;
      getModelConfigs: ReturnType<typeof vi.fn>;
      apiCallRequest: ReturnType<typeof vi.fn>;
      getAmpcode: ReturnType<typeof vi.fn>;
      getAmpModelMappings: ReturnType<typeof vi.fn>;
    };
  };
  if (!store.__providersPageOpenAiMocks__) {
    store.__providersPageOpenAiMocks__ = {
      getGeminiKeys: vi.fn(async (): Promise<any[]> => []),
      getClaudeConfigs: vi.fn(async (): Promise<any[]> => []),
      getCodexConfigs: vi.fn(async (): Promise<any[]> => []),
      getVertexConfigs: vi.fn(async (): Promise<any[]> => []),
      getOpenAIProviders: vi.fn(async (): Promise<any[]> => []),
      saveCodexConfigs: vi.fn(async (_configs: unknown[]) => ({})),
      saveOpenAIProviders: vi.fn(async (_configs: unknown[]) => ({})),
      getEntityStats: vi.fn(async () => ({ source: [] })),
      getEntityBlockStats: vi.fn(async () => ({
        block_config: { window_start_ms: 0, duration_ms: 600000, block_count: 20 },
        by_source: [],
        by_auth_index: [],
      })),
      apiKeyEntriesList: vi.fn(async () => []),
      channelGroupsList: vi.fn(async () => []),
      proxiesList: vi.fn(async (): Promise<any[]> => []),
      getModelConfigs: vi.fn(async (): Promise<any[]> => []),
      apiCallRequest: vi.fn(async () => ({
        statusCode: 200,
        header: {},
        bodyText: "",
        body: {},
      })),
      getAmpcode: vi.fn(async () => ({})),
      getAmpModelMappings: vi.fn(async () => []),
    };
  }
  return store.__providersPageOpenAiMocks__;
}

const mocks = getMocks();

function getProviderCard(name: string): HTMLElement {
  const title = screen.getByText(name);
  const card = title.closest("div.group");
  if (!card) {
    throw new Error(`Provider card not found for ${name}`);
  }
  return card as HTMLElement;
}

vi.mock("@/lib/http/apis", () => ({
  providersApi: {
    getGeminiKeys: getMocks().getGeminiKeys,
    getClaudeConfigs: getMocks().getClaudeConfigs,
    getCodexConfigs: getMocks().getCodexConfigs,
    getVertexConfigs: getMocks().getVertexConfigs,
    getOpenAIProviders: getMocks().getOpenAIProviders,
    saveCodexConfigs: getMocks().saveCodexConfigs,
    saveOpenAIProviders: getMocks().saveOpenAIProviders,
  },
  usageApi: {
    getEntityStats: getMocks().getEntityStats,
    getEntityBlockStats: getMocks().getEntityBlockStats,
  },
  modelsApi: {
    getModelConfigs: getMocks().getModelConfigs,
  },
  apiCallApi: {
    request: getMocks().apiCallRequest,
  },
  ampcodeApi: {
    getAmpcode: getMocks().getAmpcode,
    getModelMappings: getMocks().getAmpModelMappings,
  },
  getApiCallErrorMessage: (result: { bodyText?: string; statusCode?: number }) =>
    result.bodyText || `HTTP ${result.statusCode ?? 0}`,
}));

vi.mock("@/lib/http/apis/api-keys", () => ({
  apiKeyEntriesApi: {
    list: getMocks().apiKeyEntriesList,
  },
}));

vi.mock("@/lib/http/apis/channel-groups", () => ({
  channelGroupsApi: {
    list: getMocks().channelGroupsList,
  },
}));

vi.mock("@/lib/http/apis/proxies", () => ({
  proxiesApi: {
    list: getMocks().proxiesList,
  },
}));

describe("ProvidersPage openai tab", () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    mocks.getGeminiKeys.mockReset();
    mocks.getClaudeConfigs.mockReset();
    mocks.getCodexConfigs.mockReset();
    mocks.getVertexConfigs.mockReset();
    mocks.getOpenAIProviders.mockReset();
    mocks.saveCodexConfigs.mockReset();
    mocks.saveOpenAIProviders.mockReset();
    mocks.getEntityStats.mockReset();
    mocks.getEntityBlockStats.mockReset();
    mocks.apiKeyEntriesList.mockReset();
    mocks.channelGroupsList.mockReset();
    mocks.proxiesList.mockReset();
    mocks.getModelConfigs.mockReset();
    mocks.apiCallRequest.mockReset();
    mocks.getAmpcode.mockReset();
    mocks.getAmpModelMappings.mockReset();

    mocks.getGeminiKeys.mockImplementation(async () => []);
    mocks.getClaudeConfigs.mockImplementation(async () => []);
    mocks.getCodexConfigs.mockImplementation(async () => []);
    mocks.getVertexConfigs.mockImplementation(async () => []);
    mocks.saveCodexConfigs.mockImplementation(async () => ({}));
    mocks.saveOpenAIProviders.mockImplementation(async () => ({}));
    mocks.apiKeyEntriesList.mockImplementation(async () => []);
    mocks.channelGroupsList.mockImplementation(async () => []);
    mocks.getModelConfigs.mockImplementation(async () => []);
    mocks.apiCallRequest.mockImplementation(async () => ({
      statusCode: 200,
      header: {},
      bodyText: "",
      body: {},
    }));
    mocks.getAmpcode.mockImplementation(async () => ({}));
    mocks.getAmpModelMappings.mockImplementation(async () => []);
    mocks.proxiesList.mockImplementation(async () => [
      {
        id: "hk",
        name: "Hong Kong",
        url: "http://hk.example:7890",
        enabled: true,
      },
      {
        id: "jp",
        name: "Japan",
        url: "http://jp.example:7890",
        enabled: true,
      },
    ]);
    mocks.getEntityStats.mockImplementation(
      async () =>
        ({
          source: [
            {
              entity_name: "sk-openai-provider-1234567890",
              requests: 10,
              failed: 2,
            },
          ],
        }) as any,
    );
    mocks.getEntityBlockStats.mockImplementation(
      async () =>
        ({
          block_config: {
            window_start_ms: Date.now() - 20 * 10 * 60 * 1000,
            duration_ms: 10 * 60 * 1000,
            block_count: 20,
          },
          by_source: [
            {
              entity_name: "sk-openai-provider-1234567890",
              success: 8,
              failure: 2,
              blocks: Array.from({ length: 20 }, (_, index) =>
                index === 19 ? { success: 8, failure: 2 } : { success: 0, failure: 0 },
              ),
            },
          ],
          by_auth_index: [],
        }) as any,
    );
    mocks.getOpenAIProviders.mockImplementation(
      async () =>
        [
          {
            name: "OpenAI Main",
            baseUrl: "https://example.com/v1",
            prefix: "oa",
            testModel: "gpt-4.1",
            apiKeyEntries: [{ apiKey: "sk-openai-provider-1234567890", proxyUrl: "" }],
            models: [{ name: "gpt-4.1" }],
          },
        ] as any,
    );
  });

  test("renders openai provider card with masked key and aggregated status", async () => {
    render(
      <MemoryRouter initialEntries={["/ai-providers/openai"]}>
        <ThemeProvider>
          <ToastProvider>
            <Routes>
              <Route path="/ai-providers/*" element={<ProvidersPage />} />
            </Routes>
          </ToastProvider>
        </ThemeProvider>
      </MemoryRouter>,
    );

    expect(await screen.findByText("OpenAI Main")).toBeInTheDocument();
    expect(screen.getByText("prefix: oa")).toBeInTheDocument();
    expect(screen.getByText("baseUrl: https://example.com/v1")).toBeInTheDocument();
    expect(screen.getByText(/sk-ope\*\*\*7890/)).toBeInTheDocument();
    expect(screen.getAllByText("80.0%").length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText("testModel: gpt-4.1")).toBeInTheDocument();
  });

  test("saves selected proxy pool binding for provider keys", async () => {
    const user = userEvent.setup();
    mocks.getCodexConfigs.mockImplementation(
      async () =>
        [
          {
            name: "Codex Main",
            apiKey: "sk-codex-provider-1234567890",
            proxyId: "hk",
          },
        ] as any,
    );

    render(
      <MemoryRouter initialEntries={["/ai-providers"]}>
        <ThemeProvider>
          <ToastProvider>
            <Routes>
              <Route path="/ai-providers/*" element={<ProvidersPage />} />
            </Routes>
          </ToastProvider>
        </ThemeProvider>
      </MemoryRouter>,
    );

    await user.click(await screen.findByRole("tab", { name: /Codex/ }));
    expect(await screen.findByText("Codex Main")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Edit/ }));

    expect(await screen.findByText("Edit Codex configuration")).toBeInTheDocument();

    await user.click(screen.getByRole("combobox", { name: "Proxy pool binding" }));
    await user.click(await screen.findByRole("option", { name: /Japan/ }));
    await user.click(screen.getByRole("button", { name: /Save/ }));

    await waitFor(() => {
      expect(mocks.saveCodexConfigs).toHaveBeenCalledWith([
        expect.objectContaining({
          name: "Codex Main",
          apiKey: "sk-codex-provider-1234567890",
          proxyId: "jp",
        }),
      ]);
    });
  });

  test("toggles an OpenAI Compatible key entry without removing it", async () => {
    const user = userEvent.setup();
    const provider = {
      name: "OpenAI Main",
      baseUrl: "https://example.com/v1",
      apiKeyEntries: [
        { apiKey: "sk-openai-enabled-1234567890" },
        { apiKey: "sk-openai-disabled-1234567890", disabled: true },
      ],
      models: [{ name: "gpt-4.1" }],
    } as any;
    mocks.getOpenAIProviders.mockImplementation(async () => [provider] as any);

    render(
      <MemoryRouter initialEntries={["/ai-providers/openai"]}>
        <ThemeProvider>
          <ToastProvider>
            <Routes>
              <Route path="/ai-providers/*" element={<ProvidersPage />} />
            </Routes>
          </ToastProvider>
        </ThemeProvider>
      </MemoryRouter>,
    );

    expect(await screen.findByText("OpenAI Main")).toBeInTheDocument();
    const enabledSwitch = (
      await screen.findAllByRole("switch", { name: /Enable key entry 1/i })
    )[0];
    const disabledSwitch = (
      await screen.findAllByRole("switch", { name: /Enable key entry 2/i })
    )[0];
    expect(enabledSwitch).toHaveAttribute("aria-checked", "true");
    expect(disabledSwitch).toHaveAttribute("aria-checked", "false");

    await user.click(enabledSwitch);

    await waitFor(() => {
      expect(mocks.saveOpenAIProviders).toHaveBeenCalledWith([
        expect.objectContaining({
          name: "OpenAI Main",
          apiKeyEntries: [
            expect.objectContaining({
              apiKey: "sk-openai-enabled-1234567890",
              disabled: true,
            }),
            expect.objectContaining({
              apiKey: "sk-openai-disabled-1234567890",
              disabled: true,
            }),
          ],
        }),
      ]);
    });
  });

  test("shows provider toggle as disabled when all key entries are disabled and re-enables all keys", async () => {
    const user = userEvent.setup();
    mocks.getOpenAIProviders.mockImplementation(
      async () =>
        [
          {
            name: "OpenAI Main",
            baseUrl: "https://example.com/v1",
            apiKeyEntries: [
              { apiKey: "sk-openai-disabled-a-1234567890", disabled: true },
              { apiKey: "sk-openai-disabled-b-1234567890", disabled: true },
            ],
            models: [{ name: "gpt-4.1" }],
          },
        ] as any,
    );

    render(
      <MemoryRouter initialEntries={["/ai-providers/openai"]}>
        <ThemeProvider>
          <ToastProvider>
            <Routes>
              <Route path="/ai-providers/*" element={<ProvidersPage />} />
            </Routes>
          </ToastProvider>
        </ThemeProvider>
      </MemoryRouter>,
    );

    expect(await screen.findByText("OpenAI Main")).toBeInTheDocument();
    const providerSwitch = within(getProviderCard("OpenAI Main")).getByRole("switch", {
      name: /^Enable$/i,
    });
    expect(providerSwitch).toHaveAttribute("aria-checked", "false");

    await user.click(providerSwitch);

    await waitFor(() => {
      expect(mocks.saveOpenAIProviders).toHaveBeenCalledWith([
        expect.objectContaining({
          name: "OpenAI Main",
          apiKeyEntries: [
            expect.objectContaining({
              apiKey: "sk-openai-disabled-a-1234567890",
            }),
            expect.objectContaining({
              apiKey: "sk-openai-disabled-b-1234567890",
            }),
          ],
        }),
      ]);
    });

    const saved = mocks.saveOpenAIProviders.mock.calls.at(-1)?.[0] as any[];
    expect(saved?.[0]?.apiKeyEntries?.every((entry: any) => entry.disabled !== true)).toBe(true);
  });

  test("provider toggle disables all key entries when any key is enabled", async () => {
    const user = userEvent.setup();
    mocks.getOpenAIProviders.mockImplementation(
      async () =>
        [
          {
            name: "OpenAI Main",
            baseUrl: "https://example.com/v1",
            apiKeyEntries: [
              { apiKey: "sk-openai-enabled-a-1234567890" },
              { apiKey: "sk-openai-disabled-b-1234567890", disabled: true },
            ],
            models: [{ name: "gpt-4.1" }],
          },
        ] as any,
    );

    render(
      <MemoryRouter initialEntries={["/ai-providers/openai"]}>
        <ThemeProvider>
          <ToastProvider>
            <Routes>
              <Route path="/ai-providers/*" element={<ProvidersPage />} />
            </Routes>
          </ToastProvider>
        </ThemeProvider>
      </MemoryRouter>,
    );

    expect(await screen.findByText("OpenAI Main")).toBeInTheDocument();
    const providerSwitch = within(getProviderCard("OpenAI Main")).getByRole("switch", {
      name: /^Enable$/i,
    });
    expect(providerSwitch).toHaveAttribute("aria-checked", "true");

    await user.click(providerSwitch);

    const saved = await waitFor(() => {
      const call = mocks.saveOpenAIProviders.mock.calls.at(-1)?.[0] as any[] | undefined;
      expect(call).toBeTruthy();
      return call;
    });

    expect(saved?.[0]?.apiKeyEntries).toEqual([
      expect.objectContaining({
        apiKey: "sk-openai-enabled-a-1234567890",
        disabled: true,
      }),
      expect.objectContaining({
        apiKey: "sk-openai-disabled-b-1234567890",
        disabled: true,
      }),
    ]);
  });

  test("provider toggle re-enables a single disabled key entry", async () => {
    const user = userEvent.setup();
    mocks.getOpenAIProviders.mockImplementation(
      async () =>
        [
          {
            name: "OpenAI Solo",
            baseUrl: "https://example.com/v1",
            apiKeyEntries: [{ apiKey: "sk-openai-solo-1234567890", disabled: true }],
            models: [{ name: "gpt-4.1" }],
          },
        ] as any,
    );

    render(
      <MemoryRouter initialEntries={["/ai-providers/openai"]}>
        <ThemeProvider>
          <ToastProvider>
            <Routes>
              <Route path="/ai-providers/*" element={<ProvidersPage />} />
            </Routes>
          </ToastProvider>
        </ThemeProvider>
      </MemoryRouter>,
    );

    expect(await screen.findByText("OpenAI Solo")).toBeInTheDocument();
    const providerSwitch = within(getProviderCard("OpenAI Solo")).getByRole("switch", {
      name: /^Enable$/i,
    });
    expect(providerSwitch).toHaveAttribute("aria-checked", "false");

    await user.click(providerSwitch);

    const saved = await waitFor(() => {
      const call = mocks.saveOpenAIProviders.mock.calls.at(-1)?.[0] as any[] | undefined;
      expect(call).toBeTruthy();
      return call;
    });

    expect(saved?.[0]?.apiKeyEntries).toEqual([
      expect.objectContaining({
        apiKey: "sk-openai-solo-1234567890",
      }),
    ]);
    expect(saved?.[0]?.apiKeyEntries?.[0]?.disabled).not.toBe(true);
  });
});
