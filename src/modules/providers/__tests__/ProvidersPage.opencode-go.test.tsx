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
  saveOpenCodeGoConfigs: vi.fn(async (_configs: unknown[]) => ({})),
  apiCallRequest: vi.fn(async () => ({ statusCode: 200, header: {}, bodyText: "", body: {} })),
  getEntityStats: vi.fn(async () => ({ source: [] })),
  apiKeyEntriesList: vi.fn(async () => []),
  channelGroupsList: vi.fn(async () => []),
  proxiesList: vi.fn(async (): Promise<any[]> => []),
  getModelConfigs: vi.fn(async (): Promise<any[]> => []),
  getAmpcode: vi.fn(async () => ({})),
  getAmpModelMappings: vi.fn(async () => []),
}));

const apiCallResponse = {
  statusCode: 200,
  header: {},
  bodyText: "",
  body: {
    object: "list",
    data: [
      { id: "deepseek-v4-flash", object: "model", owned_by: "opencode" },
      { id: "kimi-k2.6", object: "model", owned_by: "opencode" },
    ],
  },
};

vi.mock("@/lib/http/apis", () => ({
  providersApi: {
    getGeminiKeys: mocks.getGeminiKeys,
    getClaudeConfigs: mocks.getClaudeConfigs,
    getCodexConfigs: mocks.getCodexConfigs,
    getVertexConfigs: mocks.getVertexConfigs,
    getBedrockConfigs: mocks.getBedrockConfigs,
    getOpenCodeGoConfigs: mocks.getOpenCodeGoConfigs,
    getOpenAIProviders: mocks.getOpenAIProviders,
    saveOpenCodeGoConfigs: mocks.saveOpenCodeGoConfigs,
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

describe("ProvidersPage OpenCode Go tab", () => {
  beforeEach(() => {
    Object.values(mocks).forEach((mock) => mock.mockReset());
    mocks.getGeminiKeys.mockImplementation(async () => []);
    mocks.getClaudeConfigs.mockImplementation(async () => []);
    mocks.getCodexConfigs.mockImplementation(async () => []);
    mocks.getVertexConfigs.mockImplementation(async () => []);
    mocks.getBedrockConfigs.mockImplementation(async () => []);
    mocks.getOpenCodeGoConfigs.mockImplementation(async () => []);
    mocks.getOpenAIProviders.mockImplementation(async () => []);
    mocks.saveOpenCodeGoConfigs.mockImplementation(async () => ({}));
    mocks.apiCallRequest.mockImplementation(async () => apiCallResponse);
    mocks.getEntityStats.mockImplementation(async () => ({ source: [] }));
    mocks.apiKeyEntriesList.mockImplementation(async () => []);
    mocks.channelGroupsList.mockImplementation(async () => []);
    mocks.proxiesList.mockImplementation(async () => []);
  });

  test("opens OpenCode Go route and saves a key without requiring Base URL", async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={["/ai-providers/opencode-go/new"]}>
        <ThemeProvider>
          <ToastProvider>
            <Routes>
              <Route path="/ai-providers/*" element={<ProvidersPage />} />
            </Routes>
          </ToastProvider>
        </ThemeProvider>
      </MemoryRouter>,
    );

    expect(await screen.findByRole("tab", { name: /OpenCode Go/ })).toBeInTheDocument();
    const dialog = await screen.findByRole("dialog", { name: /Add OpenCode Go configuration/i });

    expect(within(dialog).queryByText("Base URL")).not.toBeInTheDocument();
    expect(within(dialog).queryByText("Models (optional)")).not.toBeInTheDocument();

    await user.type(within(dialog).getByPlaceholderText("e.g. Gemini Primary"), "OpenCode Go");
    await user.type(within(dialog).getByPlaceholderText(/Paste API Key/i), "sk-opencode-go");
    await user.click(within(dialog).getByRole("button", { name: /Save/ }));

    await waitFor(() => {
      expect(mocks.saveOpenCodeGoConfigs).toHaveBeenCalledWith([
        expect.objectContaining({
          name: "OpenCode Go",
          apiKey: "sk-opencode-go",
        }),
      ]);
    });
    expect(mocks.saveOpenCodeGoConfigs.mock.calls[0][0][0]).not.toHaveProperty("baseUrl");
  });

  test("keeps failed OpenCode Go saves out of the rendered provider list", async () => {
    const user = userEvent.setup();
    mocks.getOpenCodeGoConfigs.mockImplementation(async () => [
      {
        name: "Existing OpenCode Go",
        apiKey: "sk-existing-opencode-go",
      },
    ]);
    mocks.saveOpenCodeGoConfigs.mockRejectedValue(new Error("channel name already used"));

    render(
      <MemoryRouter initialEntries={["/ai-providers/opencode-go/new"]}>
        <ThemeProvider>
          <ToastProvider>
            <Routes>
              <Route path="/ai-providers/*" element={<ProvidersPage />} />
            </Routes>
          </ToastProvider>
        </ThemeProvider>
      </MemoryRouter>,
    );

    expect(await screen.findByText("Existing OpenCode Go")).toBeInTheDocument();
    const dialog = await screen.findByRole("dialog", { name: /Add OpenCode Go configuration/i });

    await user.type(within(dialog).getByPlaceholderText("e.g. Gemini Primary"), "New OpenCode Go");
    await user.type(within(dialog).getByPlaceholderText(/Paste API Key/i), "sk-new-opencode-go");
    await user.click(within(dialog).getByRole("button", { name: /Save/ }));

    await waitFor(() => {
      expect(mocks.saveOpenCodeGoConfigs).toHaveBeenCalledWith([
        expect.objectContaining({ name: "Existing OpenCode Go" }),
        expect.objectContaining({ name: "New OpenCode Go" }),
      ]);
    });
    expect(screen.queryByText("New OpenCode Go")).not.toBeInTheDocument();
    expect(
      screen.getByRole("dialog", { name: /Add OpenCode Go configuration/i }),
    ).toBeInTheDocument();
  });

  test("uses fixed tabs and saves OpenCode Go model exclusions from fetched models", async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={["/ai-providers/opencode-go/new"]}>
        <ThemeProvider>
          <ToastProvider>
            <Routes>
              <Route path="/ai-providers/*" element={<ProvidersPage />} />
            </Routes>
          </ToastProvider>
        </ThemeProvider>
      </MemoryRouter>,
    );

    const dialog = await screen.findByRole("dialog", { name: /Add OpenCode Go configuration/i });
    expect(within(dialog).getByRole("tab", { name: /Basic/i })).toBeInTheDocument();
    expect(within(dialog).getByRole("tab", { name: /Request/i })).toBeInTheDocument();
    expect(within(dialog).getByRole("tab", { name: /Models/i })).toBeInTheDocument();

    await user.click(within(dialog).getByRole("tab", { name: /Models/i }));

    await waitFor(() => {
      expect(mocks.apiCallRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          method: "GET",
          url: "https://opencode.ai/zen/go/v1/models",
        }),
      );
    });

    const deepseek = await within(dialog).findByRole("checkbox", { name: /deepseek-v4-flash/i });
    expect(deepseek).toBeChecked();
    await user.click(deepseek);

    await user.click(within(dialog).getByRole("tab", { name: /Basic/i }));
    await user.type(within(dialog).getByPlaceholderText("e.g. Gemini Primary"), "OpenCode Go");
    await user.type(within(dialog).getByPlaceholderText(/Paste API Key/i), "sk-opencode-go");
    await user.click(within(dialog).getByRole("button", { name: /Save/ }));

    await waitFor(() => {
      expect(mocks.saveOpenCodeGoConfigs).toHaveBeenCalledWith([
        expect.objectContaining({
          name: "OpenCode Go",
          apiKey: "sk-opencode-go",
          excludedModels: ["deepseek-v4-flash"],
        }),
      ]);
    });
    expect(mocks.saveOpenCodeGoConfigs.mock.calls[0][0][0]).not.toHaveProperty("models");
  });
});
