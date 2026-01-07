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
