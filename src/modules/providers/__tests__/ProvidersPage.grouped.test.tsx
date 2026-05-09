import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { ProvidersPage } from "@/modules/providers/ProvidersPage";
import { ThemeProvider } from "@/modules/ui/ThemeProvider";
import { ToastProvider } from "@/modules/ui/ToastProvider";

const mocks = vi.hoisted(() => ({
  getGeminiKeys: vi.fn(async (): Promise<any[]> => []),
  getClaudeConfigs: vi.fn(async (): Promise<any[]> => []),
  getCodexConfigs: vi.fn(async (): Promise<any[]> => []),
  getVertexConfigs: vi.fn(async (): Promise<any[]> => []),
  getBedrockConfigs: vi.fn(async (): Promise<any[]> => []),
  getOpenCodeGoConfigs: vi.fn(async (): Promise<any[]> => []),
  getOpenAIProviders: vi.fn(async (): Promise<any[]> => []),
  saveCodexConfigs: vi.fn(async (_configs: unknown[]) => ({})),
  apiCallRequest: vi.fn(async () => ({ statusCode: 200, header: {}, bodyText: "", body: {} })),
  getEntityStats: vi.fn(async () => ({ source: [] })),
  apiKeyEntriesList: vi.fn(async () => []),
  channelGroupsList: vi.fn(async () => []),
  proxiesList: vi.fn(async (): Promise<any[]> => []),
  getModelConfigs: vi.fn(async (): Promise<any[]> => []),
  getAmpcode: vi.fn(async () => ({})),
  getAmpModelMappings: vi.fn(async () => []),
}));

vi.mock("@/lib/http/apis", () => ({
  providersApi: {
    getGeminiKeys: mocks.getGeminiKeys,
    getClaudeConfigs: mocks.getClaudeConfigs,
    getCodexConfigs: mocks.getCodexConfigs,
    getVertexConfigs: mocks.getVertexConfigs,
    getBedrockConfigs: mocks.getBedrockConfigs,
    getOpenCodeGoConfigs: mocks.getOpenCodeGoConfigs,
    getOpenAIProviders: mocks.getOpenAIProviders,
    saveCodexConfigs: mocks.saveCodexConfigs,
  },
  usageApi: {
    getEntityStats: mocks.getEntityStats,
  },
  apiCallApi: {
    request: mocks.apiCallRequest,
  },
  modelsApi: {
    getModelConfigs: mocks.getModelConfigs,
  },
  ampcodeApi: {
    getAmpcode: mocks.getAmpcode,
    getModelMappings: mocks.getAmpModelMappings,
  },
  getApiCallErrorMessage: (result: { bodyText?: string; statusCode?: number }) =>
    result.bodyText || `HTTP ${result.statusCode ?? 0}`,
}));

vi.mock("@/lib/http/apis/api-keys", () => ({
  apiKeyEntriesApi: {
    list: mocks.apiKeyEntriesList,
  },
}));

vi.mock("@/lib/http/apis/channel-groups", () => ({
  channelGroupsApi: {
    list: mocks.channelGroupsList,
  },
}));

vi.mock("@/lib/http/apis/proxies", () => ({
  proxiesApi: {
    list: mocks.proxiesList,
  },
}));

describe("ProvidersPage grouped provider modal", () => {
  beforeEach(() => {
    Object.values(mocks).forEach((mock) => mock.mockReset());
    mocks.getGeminiKeys.mockImplementation(async () => []);
    mocks.getClaudeConfigs.mockImplementation(async () => []);
    mocks.getCodexConfigs.mockImplementation(async () => [
      {
        name: "Shared Codex",
        baseUrl: "https://example.com/v1",
        prefix: "team-a",
        models: [{ name: "gpt-4.1-mini" }],
        apiKey: "sk-codex-alpha-123456",
      },
      {
        name: "Shared Codex",
        baseUrl: "https://example.com/v1/",
        prefix: "team-b",
        apiKey: "sk-codex-beta-654321",
      },
      {
        name: "Fallback Codex",
        baseUrl: "https://fallback.example.com/v1",
        prefix: "fallback",
        models: [{ name: "gpt-4.1-mini" }],
        apiKey: "sk-codex-gamma-111111",
      },
    ]);
    mocks.getVertexConfigs.mockImplementation(async () => []);
    mocks.getBedrockConfigs.mockImplementation(async () => []);
    mocks.getOpenCodeGoConfigs.mockImplementation(async () => []);
    mocks.getOpenAIProviders.mockImplementation(async () => []);
    mocks.saveCodexConfigs.mockImplementation(async () => ({}));
    mocks.apiCallRequest.mockImplementation(async () => ({
      statusCode: 200,
      header: {},
      bodyText: "",
      body: {},
    }));
    mocks.getEntityStats.mockImplementation(
      async () =>
        ({
          source: [
            {
              entity_name: "sk-codex-alpha-123456",
              requests: 10,
              failed: 2,
            },
            {
              entity_name: "sk-codex-beta-654321",
              requests: 4,
              failed: 1,
            },
          ],
        }) as any,
    );
    mocks.apiKeyEntriesList.mockImplementation(async () => []);
    mocks.channelGroupsList.mockImplementation(async () => []);
    mocks.proxiesList.mockImplementation(async () => [
      {
        id: "jp",
        name: "Japan",
        url: "http://jp.example:7890",
        enabled: true,
      },
    ]);
  });

  test("shows conflict hint, per-key health stats, and supports single/batch tests", async () => {
    const user = userEvent.setup();

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

    await user.click(await screen.findByRole("tab", { name: /Codex/i }));
    expect(await screen.findByText("Shared Codex")).toBeInTheDocument();
    await user.click(screen.getAllByRole("button", { name: /^Edit$/i })[0]!);

    const dialog = await screen.findByRole("dialog", { name: /Edit Codex configuration/i });

    expect(
      within(dialog).getByText("Shared settings differ inside this group"),
    ).toBeInTheDocument();
    expect(within(dialog).getByText("Success 8")).toBeInTheDocument();
    expect(within(dialog).getByText("Failed 2")).toBeInTheDocument();
    expect(within(dialog).getByText("Success 3")).toBeInTheDocument();
    expect(within(dialog).getByText("Failed 1")).toBeInTheDocument();

    const testButtons = within(dialog).getAllByRole("button", { name: /^Test$/ });
    await user.click(testButtons[0]!);

    await waitFor(() => {
      expect(mocks.apiCallRequest).toHaveBeenCalledTimes(1);
      expect(mocks.apiCallRequest).toHaveBeenLastCalledWith(
        expect.objectContaining({
          method: "POST",
          url: "https://example.com/v1/chat/completions",
        }),
      );
    });

    await user.click(within(dialog).getByRole("button", { name: /Test All Keys/i }));

    await waitFor(() => {
      expect(mocks.apiCallRequest).toHaveBeenCalledTimes(3);
    });

    expect(within(dialog).getByText("All 2 keys passed the test")).toBeInTheDocument();

    await user.click(within(dialog).getByLabelText("close"));

    const fallbackCard = screen.getByText("Fallback Codex").closest("div")?.parentElement;
    if (!fallbackCard) {
      throw new Error("Fallback Codex card not found");
    }
    await user.click(within(fallbackCard).getByRole("button", { name: /^Edit$/i }));
    const fallbackDialog = await screen.findByRole("dialog", { name: /Edit Codex configuration/i });
    expect(within(fallbackDialog).queryByText("All 2 keys passed the test")).not.toBeInTheDocument();
  });
});
