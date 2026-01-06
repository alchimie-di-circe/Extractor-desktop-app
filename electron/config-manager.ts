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
 * Get a configuration value by key path
 * @param key - Dot notation path to the config value
 */
export function getConfig<K extends keyof AppConfig>(key: K): AppConfig[K];
export function getConfig<T = unknown>(key: string): T;
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
export function setConfig(key: string, value: unknown): void {
  store.set(key, value);
}

/**
 * Get the entire configuration object
 */
export function getAllConfig(): AppConfig {
  return store.store;
}

/**
 * Set multiple configuration values at once
 * @param config - Partial configuration object
 */
export function setAllConfig(config: Partial<AppConfig>): void {
  store.set(config);
}

/**
 * Delete a configuration key
 * @param key - The key to delete
 */
export function deleteConfig(key: keyof AppConfig): void {
  store.delete(key);
}

/**
 * Check if a configuration key exists
 * @param key - The key to check
 */
export function hasConfig(key: string): boolean {
  return store.has(key);
}

/**
 * Reset configuration to defaults
 */
export function resetConfig(): void {
  store.clear();
}

/**
 * Get the path to the configuration file
 */
export function getConfigPath(): string {
  return store.path;
}

/**
 * Subscribe to configuration changes
 * @param callback - Function to call when config changes
 * @returns Unsubscribe function
 */
export function onConfigChange(
  callback: (newValue: AppConfig, oldValue: AppConfig) => void
): () => void {
  return store.onDidAnyChange(callback);
}

/**
 * Subscribe to changes on a specific key
 * @param key - The key to watch
 * @param callback - Function to call when the key changes
 * @returns Unsubscribe function
 */
export function onConfigKeyChange<K extends keyof AppConfig>(
  key: K,
  callback: (newValue: AppConfig[K], oldValue: AppConfig[K]) => void
): () => void {
  return store.onDidChange(key, callback);
}
