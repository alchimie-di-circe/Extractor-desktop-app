// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces

import type { KeychainResult, AppConfig } from "../shared/types";

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
		get: <K extends keyof AppConfig>(key: K) => Promise<AppConfig[K] | undefined>;
		set: (key: keyof AppConfig, value: AppConfig[keyof AppConfig]) => Promise<void>;
		getAll: () => Promise<AppConfig>;
		setAll: (config: Partial<AppConfig>) => Promise<void>;
		delete: (key: keyof AppConfig) => Promise<void>;
		has: (key: keyof AppConfig) => Promise<boolean>;
		reset: () => Promise<void>;
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
