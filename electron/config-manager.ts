import Store from "electron-store";
import type { AppConfig, LLMProviderId } from "../shared/types";
import { LLM_PROVIDERS, getAllAgentRoles, getAllProviderIds } from "../shared/llm-providers";

const defaults: AppConfig = {
  theme: "system",
  language: "en",
  llmProviders: {
    anthropic: { enabled: false, model: "claude-sonnet-4-20250514" },
    openai: { enabled: false, model: "gpt-4o" },
    google: { enabled: false, model: "gemini-2.5-pro" },
    perplexity: { enabled: false, model: "sonar" },
    openrouter: { enabled: false, model: "anthropic/claude-sonnet-4.5" },
  },
  defaultProvider: null,
  modelRoles: {
    orchestrator: { providerId: null, model: null },
    extraction: { providerId: null, model: null },
    editing: { providerId: null, model: null },
    captioning: { providerId: null, model: null },
    scheduling: { providerId: null, model: null },
  },
  exportSettings: {
    defaultPath: "",
    format: "json",
  },
  windowBounds: {
    width: 1200,
    height: 800,
  },
};

const store = new Store<AppConfig>({
  name: "trae-extractor-config",
  defaults,
  clearInvalidConfig: true,
});

/**
 * Validate a configuration value for a given key
 * @param key - The configuration key
 * @param value - The value to validate
 * @throws Error if validation fails
 */
export function validateConfigValue(key: string, value: unknown): void {
  // Handle dot notation keys
  if (key === "theme") {
    if (value !== "light" && value !== "dark" && value !== "system") {
      throw new Error(`Invalid theme value: ${value}`);
    }
  } else if (key === "language") {
    if (typeof value !== "string" || value.length === 0) {
      throw new Error("Language must be a non-empty string");
    }
  } else if (key === "windowBounds") {
    if (
      typeof value !== "object" ||
      value === null ||
      typeof (value as any).width !== "number" ||
      typeof (value as any).height !== "number"
    ) {
      throw new Error("Invalid windowBounds object");
    }
  } else if (key === "exportSettings") {
    if (typeof value !== "object" || value === null) {
      throw new Error("exportSettings must be an object");
    }
    const settings = value as { defaultPath?: unknown; format?: unknown };
    if (settings.defaultPath !== undefined) {
      validateConfigValue("exportSettings.defaultPath", settings.defaultPath);
    }
    if (settings.format !== undefined) {
      validateConfigValue("exportSettings.format", settings.format);
    }
  } else if (key === "exportSettings.defaultPath") {
    if (typeof value !== "string") {
      throw new Error("exportSettings.defaultPath must be a string");
    }
  } else if (key === "exportSettings.format") {
    if (value !== "json" && value !== "csv" && value !== "markdown") {
      throw new Error(`Invalid export format: ${value}`);
    }
  } else if (key === "llmProviders") {
    if (typeof value !== "object" || value === null) {
      throw new Error("llmProviders must be an object");
    }
    const providers = value as Record<string, { enabled?: unknown; model?: unknown }>;
    const validProviders = getAllProviderIds();
    for (const providerId of Object.keys(providers)) {
      if (!validProviders.includes(providerId as LLMProviderId)) {
        throw new Error(`Invalid provider in llmProviders: ${providerId}`);
      }
      const settings = providers[providerId];
      if (settings?.enabled !== undefined) {
        validateConfigValue(`llmProviders.${providerId}.enabled`, settings.enabled);
      }
      if (settings?.model !== undefined) {
        validateConfigValue(`llmProviders.${providerId}.model`, settings.model);
      }
    }
  } else if (key.startsWith("llmProviders.")) {
    // Basic validation for LLM providers
    if (key.endsWith(".enabled")) {
      if (typeof value !== "boolean") {
        throw new Error(`${key} must be a boolean`);
      }
    } else if (key.endsWith(".model")) {
      if (typeof value !== "string") {
        throw new Error(`${key} must be a string`);
      }
      const match = key.match(/^llmProviders\.([^.]+)\.model$/);
      if (match) {
        const providerId = match[1];
        const provider = LLM_PROVIDERS[providerId as keyof typeof LLM_PROVIDERS];
        if (!provider) {
          throw new Error(`Invalid provider in llmProviders: ${providerId}`);
        }
        if (!provider.models.some((model) => model.id === value)) {
          throw new Error(`Invalid model "${value}" for provider "${providerId}"`);
        }
      }
    }
  } else if (key === "modelRoles") {
    if (typeof value !== "object" || value === null) {
      throw new Error("modelRoles must be an object");
    }
    const roles = value as Record<string, { providerId?: unknown; model?: unknown }>;
    const validRoles = getAllAgentRoles();
    for (const roleKey of Object.keys(roles)) {
      if (!validRoles.includes(roleKey as (typeof validRoles)[number])) {
        throw new Error(`Invalid role in modelRoles: ${roleKey}`);
      }
    }
    for (const role of validRoles) {
      const roleConfig = roles[role];
      if (roleConfig === undefined) continue;
      if (typeof roleConfig !== "object" || roleConfig === null) {
        throw new Error(`modelRoles.${role} must be an object`);
      }
      const providerId = roleConfig.providerId ?? null;
      const model = roleConfig.model ?? null;
      if ((providerId === null) !== (model === null)) {
        throw new Error(`modelRoles.${role} must include providerId and model together`);
      }
      if (providerId !== null) {
        if (typeof providerId !== "string" || !getAllProviderIds().includes(providerId as LLMProviderId)) {
          throw new Error(`modelRoles.${role}.providerId is invalid`);
        }
        if (typeof model !== "string") {
          throw new Error(`modelRoles.${role}.model must be a string`);
        }
        const provider = LLM_PROVIDERS[providerId as keyof typeof LLM_PROVIDERS];
        if (provider && !provider.models.some((providerModel) => providerModel.id === model)) {
          throw new Error(`Invalid model "${model}" for provider "${providerId}"`);
        }
      }
    }
  } else if (key === "defaultProvider") {
    if (
      value !== null &&
      value !== "anthropic" &&
      value !== "openai" &&
      value !== "google" &&
      value !== "perplexity" &&
      value !== "openrouter"
    ) {
      throw new Error(`Invalid defaultProvider: ${value}`);
    }
  }
}

/**
 * Get a configuration value by key path
 * @param key - Dot notation path to the config value
 */
export function getConfig<K extends keyof AppConfig>(key: K): AppConfig[K];
export function getConfig<T = unknown>(key: string): T;
/**
 * Retrieve a value from the persistent configuration by key.
 *
 * @param key - The configuration key to read
 * @returns The value stored for `key`, or `undefined` if the key does not exist
 */
export function getConfig(key: string): unknown {
  return store.get(key);
}

/**
 * Set a configuration value
 * @param key - Dot notation path to the config value
 * @param value - Value to set
 */
export function setConfig<K extends keyof AppConfig>(
  key: K,
  value: AppConfig[K]
): void;
export function setConfig(key: string, value: unknown): void;
/**
 * Store a value for the specified configuration key.
 *
 * @param key - The configuration key to set (may be a known AppConfig key or a dynamic string)
 * @param value - The value to persist for `key`
 */
export function setConfig(key: string, value: unknown): void {
  validateConfigValue(key, value);
  store.set(key, value);
}

/**
 * Retrieve the current in-memory application configuration.
 *
 * @returns The complete `AppConfig` object stored in the configuration store
 */
export function getAllConfig(): AppConfig {
  return store.store;
}

/**
 * Applies multiple configuration updates from a partial AppConfig, updating only the provided keys and leaving unspecified settings unchanged.
 *
 * @param config - Partial AppConfig whose specified properties will be written to the store
 */
export function setAllConfig(config: Partial<AppConfig>): void {
  Object.entries(config).forEach(([key, value]) => {
    validateConfigValue(key, value);
  });
  store.set(config);
}

/**
 * Removes the specified top-level configuration key from the store.
 *
 * @param key - The AppConfig property to remove
 */
export function deleteConfig(key: keyof AppConfig): void {
  store.delete(key);
}

/**
 * Determines whether the configuration contains the given key.
 *
 * @param key - The configuration key to check.
 * @returns `true` if the key exists in the store, `false` otherwise.
 */
export function hasConfig(key: string): boolean {
  return store.has(key);
}

/**
 * Clear all persisted configuration so the default settings are restored on next access.
 *
 * Subsequent reads will reflect the module's configured defaults.
 */
export function resetConfig(): void {
  store.clear();
}

/**
 * Get the filesystem path to the current configuration file.
 *
 * @returns The absolute filesystem path of the store's configuration file
 */
export function getConfigPath(): string {
  return store.path;
}

/**
 * Register a listener that is invoked whenever any configuration value changes.
 *
 * @param callback - Called with the new and previous full configuration objects when a change occurs
 * @returns A function that removes the registered listener
 */
export function onConfigChange(
  callback: (newValue: AppConfig, oldValue: AppConfig) => void
): () => void {
  return store.onDidAnyChange(callback);
}

/**
 * Watch changes to a specific configuration key.
 *
 * @param key - Configuration key to observe
 * @param callback - Called with the new and previous values when the key changes
 * @returns A function that removes the subscription when invoked
 */
export function onConfigKeyChange<K extends keyof AppConfig>(
  key: K,
  callback: (newValue: AppConfig[K], oldValue: AppConfig[K]) => void
): () => void {
  return store.onDidChange(key, callback);
}
