import Store from "electron-store";

/**
 * Application configuration schema
 */
export interface AppConfig {
  theme: "light" | "dark" | "system";
  language: string;
  llmProviders: {
    anthropic: { enabled: boolean; model: string };
    openai: { enabled: boolean; model: string };
    google: { enabled: boolean; model: string };
    perplexity: { enabled: boolean; model: string };
  };
  defaultProvider: "anthropic" | "openai" | "google" | "perplexity" | null;
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

const defaults: AppConfig = {
  theme: "system",
  language: "en",
  llmProviders: {
    anthropic: { enabled: false, model: "claude-sonnet-4-20250514" },
    openai: { enabled: false, model: "gpt-4o" },
    google: { enabled: false, model: "gemini-pro" },
    perplexity: { enabled: false, model: "llama-3.1-sonar-large-128k-online" },
  },
  defaultProvider: null,
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
  } else if (key === "exportSettings.defaultPath") {
    if (typeof value !== "string") {
      throw new Error("exportSettings.defaultPath must be a string");
    }
  } else if (key === "exportSettings.format") {
    if (value !== "json" && value !== "csv" && value !== "markdown") {
      throw new Error(`Invalid export format: ${value}`);
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
    }
  } else if (key === "defaultProvider") {
    if (
      value !== null &&
      value !== "anthropic" &&
      value !== "openai" &&
      value !== "google" &&
      value !== "perplexity"
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
