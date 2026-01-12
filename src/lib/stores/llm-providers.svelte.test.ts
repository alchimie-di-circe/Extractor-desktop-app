import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AgentRoleConfig } from "../../../shared/types";
import { llmProviders } from "./llm-providers.svelte";

describe("llmProviders.setModelRole", () => {
  let setModelRoleMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    llmProviders.reset();
    setModelRoleMock = vi.fn().mockResolvedValue({
      success: false,
      error: { code: "CONFIG_ERROR", message: "Failed to save model role" },
    });

    Object.defineProperty(window, "electronAPI", {
      value: {
        llm: {
          setModelRole: setModelRoleMock,
        },
      },
      writable: true,
    });
  });

  it("rolls back state on IPC failure", async () => {
    const previousConfig: AgentRoleConfig = { providerId: "openai", model: "gpt-5.2" };
    llmProviders.modelRoles.orchestrator = previousConfig;

    await llmProviders.setModelRole(
      "orchestrator",
      "anthropic",
      "claude-opus-4-20250514"
    );

    expect(llmProviders.modelRoles.orchestrator).toEqual(previousConfig);
  });

  it("returns false when persistence fails", async () => {
    const result = await llmProviders.setModelRole(
      "orchestrator",
      "anthropic",
      "claude-opus-4-20250514"
    );

    expect(result).toBe(false);
  });
});
