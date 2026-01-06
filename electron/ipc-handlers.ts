import { ipcMain } from "electron";
import {
  saveCredential,
  getCredential,
  deleteCredential,
  listCredentials,
  hasCredential,
} from "./keychain";
import {
  getConfig,
  setConfig,
  getAllConfig,
  setAllConfig,
  deleteConfig,
  hasConfig,
  resetConfig,
  getConfigPath,
} from "./config-manager";
import type { AppConfig } from "./config-manager";

/**
 * IPC Channel names for keychain operations
 */
export const KeychainChannels = {
  SAVE: "keychain:save",
  GET: "keychain:get",
  DELETE: "keychain:delete",
  LIST: "keychain:list",
  HAS: "keychain:has",
} as const;

/**
 * IPC Channel names for config operations
 */
export const ConfigChannels = {
  GET: "config:get",
  SET: "config:set",
  GET_ALL: "config:get-all",
  SET_ALL: "config:set-all",
  DELETE: "config:delete",
  HAS: "config:has",
  RESET: "config:reset",
  GET_PATH: "config:get-path",
} as const;

/**
 * Register all IPC handlers for the application
 * Should be called once during app initialization
 */
export function registerIpcHandlers(): void {
  registerKeychainHandlers();
  registerConfigHandlers();
}

/**
 * Register keychain-related IPC handlers
 */
function registerKeychainHandlers(): void {
  ipcMain.handle(
    KeychainChannels.SAVE,
    async (_event, account: string, password: string) => {
      if (typeof account !== "string" || typeof password !== "string") {
        return {
          success: false,
          error: { code: "INVALID_INPUT", message: "Invalid input types" },
        };
      }
      return saveCredential(account, password);
    }
  );

  ipcMain.handle(KeychainChannels.GET, async (_event, account: string) => {
    if (typeof account !== "string") {
      return {
        success: false,
        error: { code: "INVALID_INPUT", message: "Account must be a string" },
      };
    }
    return getCredential(account);
  });

  ipcMain.handle(KeychainChannels.DELETE, async (_event, account: string) => {
    if (typeof account !== "string") {
      return {
        success: false,
        error: { code: "INVALID_INPUT", message: "Account must be a string" },
      };
    }
    return deleteCredential(account);
  });

  ipcMain.handle(KeychainChannels.LIST, async () => {
    return listCredentials();
  });

  ipcMain.handle(KeychainChannels.HAS, async (_event, account: string) => {
    if (typeof account !== "string") {
      return {
        success: false,
        error: { code: "INVALID_INPUT", message: "Account must be a string" },
      };
    }
    return hasCredential(account);
  });
}

/**
 * Register config-related IPC handlers
 */
function registerConfigHandlers(): void {
  ipcMain.handle(ConfigChannels.GET, (_event, key: string) => {
    if (typeof key !== "string") {
      throw new Error("Key must be a string");
    }
    return getConfig(key);
  });

  ipcMain.handle(ConfigChannels.SET, (_event, key: string, value: unknown) => {
    if (typeof key !== "string") {
      throw new Error("Key must be a string");
    }
    setConfig(key, value);
    return true;
  });

  ipcMain.handle(ConfigChannels.GET_ALL, () => {
    return getAllConfig();
  });

  ipcMain.handle(ConfigChannels.SET_ALL, (_event, config: Partial<AppConfig>) => {
    if (typeof config !== "object" || config === null) {
      throw new Error("Config must be an object");
    }
    setAllConfig(config);
    return true;
  });

  ipcMain.handle(ConfigChannels.DELETE, (_event, key: keyof AppConfig) => {
    if (typeof key !== "string") {
      throw new Error("Key must be a string");
    }
    deleteConfig(key);
    return true;
  });

  ipcMain.handle(ConfigChannels.HAS, (_event, key: string) => {
    if (typeof key !== "string") {
      throw new Error("Key must be a string");
    }
    return hasConfig(key);
  });

  ipcMain.handle(ConfigChannels.RESET, () => {
    resetConfig();
    return true;
  });

  ipcMain.handle(ConfigChannels.GET_PATH, () => {
    return getConfigPath();
  });
}

/**
 * Unregister all IPC handlers
 * Useful for cleanup or testing
 */
export function unregisterIpcHandlers(): void {
  Object.values(KeychainChannels).forEach((channel) => {
    ipcMain.removeHandler(channel);
  });
  Object.values(ConfigChannels).forEach((channel) => {
    ipcMain.removeHandler(channel);
  });
}
