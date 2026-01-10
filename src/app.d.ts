// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces

import type {
	KeychainResult,
	AppConfig,
	LLMProviderId,
	LLMConnectionResult,
	ModelRoleConfig,
} from "../shared/types";

/**
 * IPC Result types
 */
type IpcOk<T> = { success: true; data: T };
type IpcOkVoid = { success: true };
type IpcErr = { success: false; error: { code: string; message: string } };
type IpcResult<T> = IpcOk<T> | IpcErr;

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
		get: <T = unknown>(key: string) => Promise<IpcResult<T>>;
		set: (key: string, value: unknown) => Promise<IpcOkVoid | IpcErr>;
		getAll: () => Promise<AppConfig>;
		setAll: (config: Partial<AppConfig>) => Promise<IpcOkVoid | IpcErr>;
		delete: (key: keyof AppConfig) => Promise<IpcOkVoid | IpcErr>;
		has: (key: string) => Promise<boolean>;
		reset: () => Promise<IpcOkVoid | IpcErr>;
		getPath: () => Promise<string>;
	};
	llm: {
		testConnection: (
			providerId: LLMProviderId,
			apiKey: string,
			model: string
		) => Promise<LLMConnectionResult>;
		saveApiKey: (
			providerId: LLMProviderId,
			apiKey: string
		) => Promise<IpcOkVoid | IpcErr>;
		getApiKey: (providerId: LLMProviderId) => Promise<IpcResult<string>>;
		deleteApiKey: (providerId: LLMProviderId) => Promise<IpcResult<boolean>>;
		hasApiKey: (providerId: LLMProviderId) => Promise<KeychainResult<boolean>>;
		setModelRole: (
			role: string,
			providerId: LLMProviderId | null,
			model: string | null
		) => Promise<IpcOkVoid | IpcErr>;
		getModelRoles: () => Promise<IpcResult<ModelRoleConfig>>;
	};
	/**
	 * Get the current platform (async via IPC for sandbox compatibility)
	 */
	getPlatform: () => Promise<NodeJS.Platform>;
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
