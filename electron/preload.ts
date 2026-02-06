import { contextBridge, ipcRenderer } from 'electron';
import {
	CagentChannels,
	ConfigChannels,
	KeychainChannels,
	LLMChannels,
	OsxphotosChannels,
	SidecarReloadChannels,
	SystemChannels,
} from '../shared/ipc-channels';
import type {
	AppConfig,
	KeychainResult,
	LLMConnectionResult,
	LLMProviderId,
	ModelRoleConfig,
} from '../shared/types';

/**
 * Keychain API exposed to renderer
 */
const keychainApi = {
	save: (account: string, password: string): Promise<KeychainResult<void>> =>
		ipcRenderer.invoke(KeychainChannels.SAVE, account, password),

	get: (account: string): Promise<KeychainResult<string>> =>
		ipcRenderer.invoke(KeychainChannels.GET, account),

	delete: (account: string): Promise<KeychainResult<boolean>> =>
		ipcRenderer.invoke(KeychainChannels.DELETE, account),

	list: (): Promise<KeychainResult<Array<{ account: string }>>> =>
		ipcRenderer.invoke(KeychainChannels.LIST),

	has: (account: string): Promise<KeychainResult<boolean>> =>
		ipcRenderer.invoke(KeychainChannels.HAS, account),
};

/**
 * Config API exposed to renderer
 */
type IpcOk<T> = { success: true; data: T };
type IpcOkVoid = { success: true };
type IpcErr = { success: false; error: { code: string; message: string } };
type IpcResult<T> = IpcOk<T> | IpcErr;

const configApi = {
	get: <T = unknown>(key: string): Promise<IpcResult<T>> =>
		ipcRenderer.invoke(ConfigChannels.GET, key),

	set: (key: string, value: unknown): Promise<IpcOkVoid | IpcErr> =>
		ipcRenderer.invoke(ConfigChannels.SET, key, value),

	getAll: (): Promise<AppConfig> => ipcRenderer.invoke(ConfigChannels.GET_ALL),

	setAll: (config: Partial<AppConfig>): Promise<IpcOkVoid | IpcErr> =>
		ipcRenderer.invoke(ConfigChannels.SET_ALL, config),

	delete: (key: keyof AppConfig): Promise<IpcOkVoid | IpcErr> =>
		ipcRenderer.invoke(ConfigChannels.DELETE, key),

	has: (key: string): Promise<boolean> => ipcRenderer.invoke(ConfigChannels.HAS, key),

	reset: (): Promise<IpcOkVoid | IpcErr> => ipcRenderer.invoke(ConfigChannels.RESET),

	getPath: (): Promise<string> => ipcRenderer.invoke(ConfigChannels.GET_PATH),
};

/**
 * LLM Provider API exposed to renderer
 */
const llmApi = {
	testConnection: (
		providerId: LLMProviderId,
		apiKey: string,
		model: string,
	): Promise<LLMConnectionResult> =>
		ipcRenderer.invoke(LLMChannels.TEST_CONNECTION, providerId, apiKey, model),

	saveApiKey: (providerId: LLMProviderId, apiKey: string): Promise<IpcOkVoid | IpcErr> =>
		ipcRenderer.invoke(LLMChannels.SAVE_API_KEY, providerId, apiKey),

	getApiKey: (providerId: LLMProviderId): Promise<IpcResult<string>> =>
		ipcRenderer.invoke(LLMChannels.GET_API_KEY, providerId),

	deleteApiKey: (providerId: LLMProviderId): Promise<IpcResult<boolean>> =>
		ipcRenderer.invoke(LLMChannels.DELETE_API_KEY, providerId),

	hasApiKey: (providerId: LLMProviderId): Promise<KeychainResult<boolean>> =>
		ipcRenderer.invoke(LLMChannels.HAS_API_KEY, providerId),

	getProviderStatus: (
		providerId: LLMProviderId,
	): Promise<IpcResult<{ providerId: LLMProviderId; hasApiKey: boolean }>> =>
		ipcRenderer.invoke(LLMChannels.GET_PROVIDER_STATUS, providerId),

	setModelRole: (
		role: string,
		providerId: LLMProviderId | null,
		model: string | null,
	): Promise<IpcOkVoid | IpcErr> =>
		ipcRenderer.invoke(LLMChannels.SET_MODEL_ROLE, role, providerId, model),

	getModelRoles: (): Promise<IpcResult<ModelRoleConfig>> =>
		ipcRenderer.invoke(LLMChannels.GET_MODEL_ROLES),
};

/**
 * Cagent API exposed to renderer
 */
const cagentApi = {
	generateYaml: (config: {
		agents?: Record<string, unknown>;
		enabledMcp?: string[];
		ragSources?: string[];
		autoCreateDirs?: boolean;
	}): Promise<
		| {
				success: true;
				data: { yaml: string; filePath: string; dirsCreated: string[]; backupPath: string | null };
		  }
		| { success: false; error: { code: string; message: string } }
	> => ipcRenderer.invoke(CagentChannels.GENERATE_YAML, config),
};

/**
 * Sidecar API exposed to renderer
 */
const sidecarApi = {
	start: (): Promise<{ success: boolean; baseUrl?: string; error?: string }> =>
		ipcRenderer.invoke('sidecar:start'),

	stop: (): Promise<{ success: boolean; error?: string }> => ipcRenderer.invoke('sidecar:stop'),

	ensureRunning: (): Promise<{ success: boolean; baseUrl?: string; error?: string }> =>
		ipcRenderer.invoke('sidecar:ensure-running'),

	status: (): Promise<{
		running: boolean;
		port: number;
		restartCount: number;
		failureCount: number;
		circuitBreakerOpen: boolean;
	}> => ipcRenderer.invoke('sidecar:status'),

	getBaseUrl: (): Promise<string> => ipcRenderer.invoke('sidecar:get-base-url'),

	isRunning: (): Promise<boolean> => ipcRenderer.invoke('sidecar:is-running'),

	getReloadStatus: (): Promise<{
		isWatching: boolean;
		lastReload: number | null;
		lastYamlMtime: number | null;
		reloadCount: number;
		isReloading: boolean;
		sidecarPid: number | null;
	}> => ipcRenderer.invoke(SidecarReloadChannels.STATUS),

	forceReload: (): Promise<{ success: boolean; error?: string }> =>
		ipcRenderer.invoke(SidecarReloadChannels.FORCE_RELOAD),

	onStatusChange: (callback: (event: Electron.IpcRendererEvent, status: string) => void) => {
		ipcRenderer.on('sidecar:event', callback);
		return () => ipcRenderer.off('sidecar:event', callback);
	},

	onSidecarReloadEvent: (
		callback: (event: {
			type: 'reload-started' | 'reload-completed' | 'reload-failed' | 'watch-error';
			timestamp: number;
			message: string;
			yamlMtime?: number;
			error?: string;
		}) => void,
	) => {
		ipcRenderer.on(SidecarReloadChannels.RELOAD_EVENT, (_event: Electron.IpcRendererEvent, data) =>
			callback(data),
		);
		return () => {
			ipcRenderer.off(
				SidecarReloadChannels.RELOAD_EVENT,
				(_event: Electron.IpcRendererEvent, data) => callback(data),
			);
		};
	},
};

/**
 * Osxphotos API exposed to renderer
 */
const osxphotosApi = {
	listAlbums: (): Promise<
		IpcResult<{ albums: Array<{ id: string; name: string; count: number }> }>
	> => ipcRenderer.invoke(OsxphotosChannels.LIST_ALBUMS),

	getPhotos: (
		albumId: string,
		limit?: number,
	): Promise<
		IpcResult<{
			album_id: string;
			photos: Array<{ id: string; filename: string; width: number; height: number }>;
		}>
	> => ipcRenderer.invoke(OsxphotosChannels.GET_PHOTOS, albumId, limit),

	exportPhoto: (
		photoId: string,
		exportPath: string,
	): Promise<IpcResult<{ success: boolean; path: string }>> =>
		ipcRenderer.invoke(OsxphotosChannels.EXPORT_PHOTO, photoId, exportPath),
};

/**
 * Desktop API - main interface exposed to renderer via contextBridge
 */
const desktopApi = {
	keychain: keychainApi,
	config: configApi,
	llm: llmApi,
	cagent: cagentApi,
	sidecar: sidecarApi,
	osxphotos: osxphotosApi,
	getPlatform: (): Promise<NodeJS.Platform> => ipcRenderer.invoke(SystemChannels.GET_PLATFORM),
};

// Expose the API to the renderer process
contextBridge.exposeInMainWorld('electronAPI', desktopApi);

// Type declaration for the exposed API
export type ElectronAPI = typeof desktopApi;
