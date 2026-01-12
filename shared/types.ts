export interface KeychainError {
  code: "INVALID_INPUT" | "KEYCHAIN_ERROR" | "NOT_FOUND";
  message: string;
}

export interface KeychainResult<T> {
  success: boolean;
  data?: T;
  error?: KeychainError;
}

export interface AppConfig {
  theme: "light" | "dark" | "system";
  language: string;
  llmProviders: {
    anthropic: { enabled: boolean; model: string };
    openai: { enabled: boolean; model: string };
    google: { enabled: boolean; model: string };
    perplexity: { enabled: boolean; model: string };
    openrouter: { enabled: boolean; model: string };
  };
  defaultProvider: LLMProviderId | null;
  modelRoles: ModelRoleConfig;
  exportSettings: {
    defaultPath: string;
    format: "json" | "csv" | "markdown";
  };
  windowBounds: {
    width: number;
    height: number;
    x?: number;
    y?: number;
  };
}

// ============================================
// LLM Provider Types
// ============================================

export type LLMProviderId = "anthropic" | "openai" | "google" | "perplexity" | "openrouter";

// Cagent roles - see .taskmaster/docs/cagent-team.md for details
export type AgentRole = "orchestrator" | "extraction" | "editing" | "captioning" | "scheduling";

export interface AgentRoleConfig {
  providerId: LLMProviderId | null;
  model: string | null;
}

export interface ModelRoleConfig {
  orchestrator: AgentRoleConfig;
  extraction: AgentRoleConfig;
  editing: AgentRoleConfig;
  captioning: AgentRoleConfig;
  scheduling: AgentRoleConfig;
}

// Legacy alias for compatibility
export type ModelRole = AgentRole;

export interface LLMProviderInfo {
  id: LLMProviderId;
  name: string;
  description: string;
  website: string;
  apiKeyPrefix: string;
  apiKeyPlaceholder: string;
  models: LLMModelInfo[];
}

export interface LLMModelInfo {
  id: string;
  name: string;
  description?: string;
  contextWindow?: number;
  recommended?: boolean;
}

export type LLMConnectionStatus = "idle" | "testing" | "success" | "error";

export interface LLMConnectionResult {
  success: boolean;
  providerId: LLMProviderId;
  model: string;
  latencyMs?: number;
  error?: {
    code: "INVALID_API_KEY" | "RATE_LIMIT" | "NETWORK_ERROR" | "MODEL_NOT_FOUND" | "UNKNOWN";
    message: string;
  };
}

export interface LLMError {
  code: "INVALID_INPUT" | "PROVIDER_ERROR" | "NETWORK_ERROR" | "TIMEOUT";
  message: string;
}

export interface LLMResult<T> {
  success: boolean;
  data?: T;
  error?: LLMError;
}
