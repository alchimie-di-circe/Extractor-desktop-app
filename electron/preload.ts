import { contextBridge, ipcRenderer } from "electron";
import { KeychainChannels, ConfigChannels } from "./ipc-handlers";
import type { KeychainResult } from "./keychain";
import type { AppConfig } from "./config-manager";

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
const configApi = {
  get: <T = unknown>(key: string): Promise<T> =>
    ipcRenderer.invoke(ConfigChannels.GET, key),

  set: (key: string, value: unknown): Promise<boolean> =>
    ipcRenderer.invoke(ConfigChannels.SET, key, value),

  getAll: (): Promise<AppConfig> =>
    ipcRenderer.invoke(ConfigChannels.GET_ALL),

  setAll: (config: Partial<AppConfig>): Promise<boolean> =>
    ipcRenderer.invoke(ConfigChannels.SET_ALL, config),

  delete: (key: keyof AppConfig): Promise<boolean> =>
    ipcRenderer.invoke(ConfigChannels.DELETE, key),

  has: (key: string): Promise<boolean> =>
    ipcRenderer.invoke(ConfigChannels.HAS, key),

  reset: (): Promise<boolean> =>
    ipcRenderer.invoke(ConfigChannels.RESET),

  getPath: (): Promise<string> =>
    ipcRenderer.invoke(ConfigChannels.GET_PATH),
};

/**
 * Desktop API - main interface exposed to renderer via contextBridge
 */
const desktopApi = {
  keychain: keychainApi,
  config: configApi,
  platform: process.platform,
};

// Expose the API to the renderer process
contextBridge.exposeInMainWorld("electronAPI", desktopApi);

// Type declaration for the exposed API
export type ElectronAPI = typeof desktopApi;
