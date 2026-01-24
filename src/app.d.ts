// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces

import type {
	KeychainResult,
	AppConfig,
	LLMProviderId,
	LLMConnectionResult,
	ModelRoleConfig,
} from '../shared/types';

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
			model: string,
		) => Promise<LLMConnectionResult>;
		saveApiKey: (providerId: LLMProviderId, apiKey: string) => Promise<IpcOkVoid | IpcErr>;
		getApiKey: (providerId: LLMProviderId) => Promise<IpcResult<string>>;
		deleteApiKey: (providerId: LLMProviderId) => Promise<IpcResult<boolean>>;
		hasApiKey: (providerId: LLMProviderId) => Promise<KeychainResult<boolean>>;
		getProviderStatus: (
			providerId: LLMProviderId,
		) => Promise<IpcResult<{ providerId: LLMProviderId; hasApiKey: boolean }>>;
		setModelRole: (
			role: string,
			providerId: LLMProviderId | null,
			model: string | null,
		) => Promise<IpcOkVoid | IpcErr>;
		getModelRoles: () => Promise<IpcResult<ModelRoleConfig>>;
	};
	cagent: {
		/**
		 * Generate cagent team.yaml configuration
		 *
		 * @param config Configuration with agents, MCP tools, and RAG sources
		 * @returns Generated YAML, file path, created directories, and backup info
		 */
		generateYaml: (config: {
			agents?: Record<string, unknown>;
			enabledMcp?: string[];
			ragSources?: string[];
			autoCreateDirs?: boolean;
		}) => Promise<
			| IpcOk<{
					yaml: string;
					filePath: string;
					dirsCreated: string[];
					backupPath: string | null;
			  }>
			| IpcErr
		>;
	};
	sidecar: {
		start: () => Promise<{ success: boolean; baseUrl?: string; error?: string }>;
		stop: () => Promise<{ success: boolean; error?: string }>;
		ensureRunning: () => Promise<{ success: boolean; baseUrl?: string; error?: string }>;
		status: () => Promise<{
			running: boolean;
			port: number;
			restartCount: number;
			failureCount: number;
			circuitBreakerOpen: boolean;
		}>;
		getBaseUrl: () => Promise<string>;
		isRunning: () => Promise<boolean>;
		getReloadStatus: () => Promise<{
			isWatching: boolean;
			lastReload: number | null;
			lastYamlMtime: number | null;
			reloadCount: number;
			isReloading: boolean;
			sidecarPid: number | null;
		}>;
		forceReload: () => Promise<{ success: boolean; error?: string }>;
		onStatusChange: (
			callback: (event: Electron.IpcRendererEvent, status: string) => void,
		) => () => void;
		onSidecarReloadEvent: (
			callback: (event: {
				type: 'reload-started' | 'reload-completed' | 'reload-failed' | 'watch-error';
				timestamp: number;
				message: string;
				yamlMtime?: number;
				error?: string;
			}) => void,
		) => () => void;
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
