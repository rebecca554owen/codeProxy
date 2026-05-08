import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, test, vi } from "vitest";
import i18n from "@/i18n";
import { CcSwitchImportSettingsPage } from "@/modules/ccswitch/CcSwitchImportSettingsPage";
import {
  CC_SWITCH_IMPORT_CONFIG_LIST_STORAGE_KEY,
  type CcSwitchImportConfigListItem,
} from "@/modules/ccswitch/ccswitchImportConfigList";
import { ThemeProvider } from "@/modules/ui/ThemeProvider";
import { ToastProvider } from "@/modules/ui/ToastProvider";

const listChannelGroups = vi.fn();

vi.mock("@/lib/http/apis/channel-groups", () => ({
  channelGroupsApi: {
    list: () => listChannelGroups(),
  },
}));

function renderPage() {
  return render(
    <ThemeProvider>
      <ToastProvider>
        <CcSwitchImportSettingsPage />
      </ToastProvider>
    </ThemeProvider>,
  );
}

function readStoredConfigs(): CcSwitchImportConfigListItem[] {
  const raw = window.localStorage.getItem(CC_SWITCH_IMPORT_CONFIG_LIST_STORAGE_KEY);
  expect(raw).toBeTruthy();
  return JSON.parse(raw!).configs as CcSwitchImportConfigListItem[];
}

describe("CcSwitchImportSettingsPage", () => {
  beforeEach(async () => {
    await i18n.changeLanguage("en");
    window.localStorage.clear();
    listChannelGroups.mockReset();
    listChannelGroups.mockResolvedValue([
      { name: "team-a", description: "Team A route" },
      { name: "team-b", description: "Team B route" },
    ]);
  });

  test("creates a new Claude Code config row and persists the config list", async () => {
    renderPage();
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: /new config/i }));

    const dialog = await screen.findByRole("dialog", { name: /new cc switch config/i });
    await user.click(within(dialog).getByRole("tab", { name: /claude code/i }));
    await user.type(within(dialog).getByLabelText(/provider name/i), "Relay Claude");
    await user.type(within(dialog).getByLabelText(/remark/i), "Team preset");

    await user.click(within(dialog).getByRole("combobox", { name: /default model/i }));
    await user.click(await screen.findByRole("option", { name: "claude-sonnet-4-5" }));

    await user.click(within(dialog).getByRole("combobox", { name: /allowed channel groups/i }));
    await user.type(screen.getByPlaceholderText(/search channel groups/i), "team");
    await user.click(screen.getByRole("option", { name: /team-a/i }));

    await user.click(within(dialog).getByRole("combobox", { name: /claude code auth field/i }));
    await user.click(await screen.findByRole("option", { name: "ANTHROPIC_AUTH_TOKEN" }));

    await user.click(within(dialog).getByRole("button", { name: /^save$/i }));

    await waitFor(() =>
      expect(readStoredConfigs()).toEqual([
        expect.objectContaining({
          clientType: "claude",
          providerName: "Relay Claude",
          note: "Team preset",
          defaultModel: "claude-sonnet-4-5",
          allowedChannelGroups: ["team-a"],
          apiKeyField: "ANTHROPIC_AUTH_TOKEN",
        }),
      ]),
    );

    expect(screen.getByText(/1 saved preset/i)).toBeInTheDocument();
  });

  test("renders legacy client defaults as migrated list rows", async () => {
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
          usageAutoInterval: 30,
        },
      }),
    );

    renderPage();

    expect(await screen.findByText("CliProxy Codex")).toBeInTheDocument();
    expect(screen.getByText("gpt-5.6")).toBeInTheDocument();
    expect(screen.getByText("/openai/v1")).toBeInTheDocument();
    expect(screen.getByText("ANTHROPIC_AUTH_TOKEN")).toBeInTheDocument();
  });

  test("deletes a saved config row and removes it from storage", async () => {
    window.localStorage.setItem(
      CC_SWITCH_IMPORT_CONFIG_LIST_STORAGE_KEY,
      JSON.stringify({
        version: 1,
        configs: [
          {
            id: "cfg-1",
            clientType: "codex",
            providerName: "Relay Codex",
            note: "Delete me",
            defaultModel: "gpt-5.5",
            allowedChannelGroups: ["team-a"],
            endpointPath: "/v1",
            usageAutoInterval: 30,
          },
        ],
      }),
    );

    renderPage();
    const user = userEvent.setup();

    expect(await screen.findByText("Relay Codex")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /delete config/i }));

    const dialog = await screen.findByRole("dialog", { name: /delete cc switch config/i });
    await user.click(within(dialog).getByRole("button", { name: /^delete$/i }));

    await waitFor(() => {
      expect(readStoredConfigs()).toEqual([]);
    });
  });
});
