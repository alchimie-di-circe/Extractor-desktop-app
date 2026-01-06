// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces

/**
 * Keychain operation result
 */
interface KeychainResult<T> {
	success: boolean;
	data?: T;
	error?: {
		code: "INVALID_INPUT" | "KEYCHAIN_ERROR" | "NOT_FOUND";
		message: string;
	};
}

/**
 * Application configuration schema
 */
interface AppConfig {
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

/**
 * Electron API exposed via contextBridge
 */
interface ElectronAPI {
	keychain: {
		save: (account: string, password: string) => Promise<KeychainResult<void>>;
		get: (account: string) => Promise<KeychainResult<string>>;
		delete: (account: string) => Promise<KeychainResult<boolean>>;
		list: () => Promise<KeychainResult<Array<{ account: string }>>>;
		has: (account: string) => Promise<KeychainResult<boolean>>;
	};
	config: {
		get: <T = unknown>(key: string) => Promise<T>;
		set: (key: string, value: unknown) => Promise<boolean>;
		getAll: () => Promise<AppConfig>;
		setAll: (config: Partial<AppConfig>) => Promise<boolean>;
		delete: (key: keyof AppConfig) => Promise<boolean>;
		has: (key: string) => Promise<boolean>;
		reset: () => Promise<boolean>;
		getPath: () => Promise<string>;
	};
	platform: NodeJS.Platform;
}

declare global {
	namespace App {
		// interface Error {}
		// interface Locals {}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}

	interface Window {
		electronAPI: ElectronAPI;
	}
}

export {};
