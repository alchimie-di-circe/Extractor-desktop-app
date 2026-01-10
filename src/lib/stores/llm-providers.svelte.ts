/**
 * LLM Providers Store - Svelte 5 Runes
 *
 * Manages global state for LLM provider configuration including:
 * - Provider connection statuses
 * - API key validation states
 * - Model role assignments per Cagent (orchestrator, extraction, editing, captioning, scheduling)
 * 
 * Reference: .taskmaster/docs/cagent-team.md
 */

import type {
  LLMProviderId,
  LLMConnectionStatus,
  AgentRole,
  ModelRoleConfig,
} from "../../../shared/types";
import {
  LLM_PROVIDERS,
  getAllProviderIds,
  getRecommendedModel,
  getAllAgentRoles,
  DEFAULT_AGENT_MODELS,
} from "../../../shared/llm-providers";

// Browser check for localStorage access
const isBrowser = typeof window !== "undefined";

// ============================================
// State
// ============================================

interface ProviderState {
  hasApiKey: boolean;
  connectionStatus: LLMConnectionStatus;
  selectedModel: string | null;
  lastTestedAt: Date | null;
  errorMessage: string | null;
}

type ProvidersState = Record<LLMProviderId, ProviderState>;

// Initialize state for all providers
function createInitialState(): ProvidersState {
  const state: Partial<ProvidersState> = {};
  for (const providerId of getAllProviderIds()) {
    state[providerId] = {
      hasApiKey: false,
      connectionStatus: "idle",
      selectedModel: getRecommendedModel(providerId),
      lastTestedAt: null,
      errorMessage: null,
    };
  }
  return state as ProvidersState;
}

// Create initial model roles config - all null by default
function createInitialModelRoles(): ModelRoleConfig {
  return {
    orchestrator: { providerId: null, model: null },
    extraction: { providerId: null, model: null },
    editing: { providerId: null, model: null },
    captioning: { providerId: null, model: null },
    scheduling: { providerId: null, model: null },
  };
}

// Reactive state using Svelte 5 runes
let providersState = $state<ProvidersState>(createInitialState());

let modelRoles = $state<ModelRoleConfig>(createInitialModelRoles());

let isLoading = $state<boolean>(false);
let isInitialized = $state<boolean>(false);

// ============================================
// Derived State
// ============================================

// Derived: Get list of configured providers (have API key and successful connection)
const configuredProviders = $derived(
  getAllProviderIds().filter(
    (id) =>
      providersState[id].hasApiKey &&
      providersState[id].connectionStatus === "success"
  )
);

// Derived: Check if orchestrator has a valid provider configured
const hasValidOrchestratorProvider = $derived.by(() => {
  const orchestrator = modelRoles?.orchestrator;
  if (!orchestrator?.providerId) return false;
  return providersState[orchestrator.providerId]?.connectionStatus === "success";
});

// Derived: Get providers with API keys (even if not tested yet)
const providersWithApiKeys = $derived(
  getAllProviderIds().filter((id) => providersState[id]?.hasApiKey)
);

// Derived: Count of configured agent roles
const configuredAgentCount = $derived.by(() => {
  return getAllAgentRoles().filter((role) => modelRoles?.[role]?.providerId !== null).length;
});

// ============================================
// Actions
// ============================================

/**
 * Initialize store from storage/keychain
 * Should be called on app startup
 */
async function initFromStorage(): Promise<void> {
  if (!isBrowser || isInitialized || isLoading) return;

  isLoading = true;

  try {
    // Check which providers have API keys stored (using LLM-specific API)
    const keyChecks = getAllProviderIds().map(async (providerId) => {
      const hasKey = await window.electronAPI.llm.hasApiKey(providerId);
      if (hasKey.success && hasKey.data) {
        providersState[providerId].hasApiKey = true;
      }
    });

    // Load model roles from config (using LLM-specific API)
    const rolesPromise = window.electronAPI.llm.getModelRoles();

    await Promise.all([...keyChecks, rolesPromise]);

    const rolesResult = await rolesPromise;
    if (rolesResult.success && rolesResult.data) {
      // Merge with defaults to handle migration from old format
      const loadedRoles = rolesResult.data;
      const defaultRoles = createInitialModelRoles();
      
      // Only use loaded roles if they have the new agent keys
      if ('orchestrator' in loadedRoles) {
        modelRoles = {
          orchestrator: loadedRoles.orchestrator ?? defaultRoles.orchestrator,
          extraction: loadedRoles.extraction ?? defaultRoles.extraction,
          editing: loadedRoles.editing ?? defaultRoles.editing,
          captioning: loadedRoles.captioning ?? defaultRoles.captioning,
          scheduling: loadedRoles.scheduling ?? defaultRoles.scheduling,
        };
      }
      // If old format (main/fallback/research), keep defaults
    }

    isInitialized = true;
  } catch (error) {
    console.error("Failed to initialize LLM providers store:", error);
  } finally {
    isLoading = false;
  }
}

/**
 * Update connection status for a provider
 */
function setConnectionStatus(
  providerId: LLMProviderId,
  status: LLMConnectionStatus,
  errorMessage?: string
): void {
  providersState[providerId].connectionStatus = status;
  providersState[providerId].errorMessage = errorMessage ?? null;
  if (status === "success" || status === "error") {
    providersState[providerId].lastTestedAt = new Date();
  }
}

/**
 * Update selected model for a provider
 */
function setSelectedModel(providerId: LLMProviderId, modelId: string): void {
  providersState[providerId].selectedModel = modelId;
}

/**
 * Mark provider as having an API key
 */
function setHasApiKey(providerId: LLMProviderId, hasKey: boolean): void {
  providersState[providerId].hasApiKey = hasKey;
  if (!hasKey) {
    // Reset status when key is removed
    providersState[providerId].connectionStatus = "idle";
    providersState[providerId].errorMessage = null;
  }
}

/**
 * Set model for a specific agent role
 */
async function setModelRole(
  role: AgentRole,
  providerId: LLMProviderId | null,
  model: string | null
): Promise<void> {
  modelRoles[role] = { providerId, model };

  // Persist to config using LLM-specific API
  if (isBrowser) {
    try {
      const result = await window.electronAPI.llm.setModelRole(role, providerId, model);
      if (!result.success) {
        console.error("Failed to save model role:", result.error?.message);
      }
    } catch (error) {
      console.error("Failed to save model roles:", error);
    }
  }
}

/**
 * Auto-configure all agent roles with recommended models for a given provider
 */
async function autoConfigureAgentRoles(providerId: LLMProviderId): Promise<void> {
  const defaults = DEFAULT_AGENT_MODELS[providerId];
  for (const role of getAllAgentRoles()) {
    await setModelRole(role, providerId, defaults[role]);
  }
}

/**
 * Get provider info with current state
 */
function getProviderWithState(providerId: LLMProviderId) {
  return {
    ...LLM_PROVIDERS[providerId],
    state: providersState[providerId],
  };
}

/**
 * Reset all state (for testing or logout)
 */
function reset(): void {
  providersState = createInitialState();
  modelRoles = createInitialModelRoles();
  isInitialized = false;
}

// ============================================
// Exported Store Object
// ============================================

export const llmProviders = {
  // Reactive getters
  get providers() {
    return providersState;
  },
  get modelRoles() {
    return modelRoles;
  },
  get isLoading() {
    return isLoading;
  },
  get isInitialized() {
    return isInitialized;
  },
  get configuredProviders() {
    return configuredProviders;
  },
  get hasValidOrchestratorProvider() {
    return hasValidOrchestratorProvider;
  },
  get providersWithApiKeys() {
    return providersWithApiKeys;
  },
  get configuredAgentCount() {
    return configuredAgentCount;
  },

  // Actions
  initFromStorage,
  setConnectionStatus,
  setSelectedModel,
  setHasApiKey,
  setModelRole,
  autoConfigureAgentRoles,
  getProviderWithState,
  reset,
};

// Re-export provider data for convenience
export { LLM_PROVIDERS, getAllProviderIds, getRecommendedModel, getAllAgentRoles, DEFAULT_AGENT_MODELS };
