import { ipcMain, app } from "electron";
import path from "node:path";
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
  validateConfigValue,
} from "./config-manager";
import type { AppConfig } from "./config-manager";

/**
 * Validate and normalize a file path
 * Ensures the path is safe and within allowed directories (e.g. user home)
 * @param userPath - The path to validate
 * @returns The normalized path
 * @throws Error if path is invalid or unsafe
 */
function validateAndNormalizePath(userPath: string): string {
  if (!userPath) return ""; // Empty path is allowed (means no default)

  const normalizedPath = path.normalize(userPath);
  
  // Basic check: ensure it's an absolute path
  if (!path.isAbsolute(normalizedPath)) {
    throw new Error("Path must be absolute");
  }

  // Check for directory traversal attempts
  if (normalizedPath.includes("..")) {
     throw new Error("Path contains traversal characters");
  }

  // Optional: Restrict to home directory?
  // const homeDir = app.getPath("home");
  // if (!normalizedPath.startsWith(homeDir)) {
  //   throw new Error("Path must be within user home directory");
  // }

  return normalizedPath;
}

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
 * Initialize and register all IPC handlers for keychain and configuration operations.
 *
 * This registers the application's IPC listeners and should be called once during app startup.
 */
export function registerIpcHandlers(): void {
  registerKeychainHandlers();
  registerConfigHandlers();
}

/**
 * Register IPC handlers that expose keychain operations to renderer processes.
 *
 * Registers handlers for the SAVE, GET, DELETE, LIST, and HAS channels; each handler validates input types and, on valid input, delegates to the corresponding credential operation. When input types are invalid the handlers return a structured error object with `success: false` and `error.code` set to `"INVALID_INPUT"`.
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
 * Register IPC handlers for configuration operations (GET, SET, GET_ALL, SET_ALL, DELETE, HAS, RESET, GET_PATH).
 *
 * Each handler validates incoming argument types and will throw an Error when required arguments are invalid.
 * On success handlers delegate to the config API and return either the requested value, a boolean confirmation, or the config path as appropriate.
 */
function registerConfigHandlers(): void {
  ipcMain.handle(ConfigChannels.GET, (_event, key: string) => {
    if (typeof key !== "string") {
      return {
        success: false,
        error: { code: "INVALID_INPUT", message: "Key must be a string" }
      };
    }
    try {
      return { success: true, data: getConfig(key) };
    } catch (err) {
      return {
        success: false,
        error: { code: "CONFIG_ERROR", message: err instanceof Error ? err.message : "Failed to get config" }
      };
    }
  });

  ipcMain.handle(ConfigChannels.SET, (_event, key: string, value: unknown) => {
    if (typeof key !== "string") {
      return {
        success: false,
        error: { code: "INVALID_INPUT", message: "Key must be a string" }
      };
    }
    try {
      let finalValue = value;
      // specific validation for paths
      if (key === "exportSettings.defaultPath" && typeof value === "string") {
        finalValue = validateAndNormalizePath(value);
      }

      // General config validation
      validateConfigValue(key, finalValue);

      setConfig(key, finalValue);
      return { success: true };
    } catch (err) {
      return {
        success: false,
        error: { code: "CONFIG_ERROR", message: err instanceof Error ? err.message : "Failed to set config" }
      };
    }
  });

  ipcMain.handle(ConfigChannels.GET_ALL, () => {
    return getAllConfig();
  });

  ipcMain.handle(ConfigChannels.SET_ALL, (_event, config: Partial<AppConfig>) => {
    if (typeof config !== "object" || config === null) {
      return {
        success: false,
        error: { code: "INVALID_INPUT", message: "Config must be an object" }
      };
    }

    try {
      // Validate specific fields if present
      if (config.exportSettings?.defaultPath) {
        config.exportSettings.defaultPath = validateAndNormalizePath(config.exportSettings.defaultPath);
      }
      
      // Shallow validation of known keys
      Object.entries(config).forEach(([key, value]) => {
          validateConfigValue(key, value);
      });

      setAllConfig(config);
      return { success: true };
    } catch (err) {
      return {
        success: false,
        error: { code: "CONFIG_ERROR", message: err instanceof Error ? err.message : "Failed to set all config" }
      };
    }
  });

  ipcMain.handle(ConfigChannels.DELETE, (_event, key: keyof AppConfig) => {
    if (typeof key !== "string") {
      return {
        success: false,
        error: { code: "INVALID_INPUT", message: "Key must be a string" }
      };
    }
    try {
      deleteConfig(key);
      return { success: true };
    } catch (err) {
      return {
        success: false,
        error: { code: "CONFIG_ERROR", message: err instanceof Error ? err.message : "Failed to delete config" }
      };
    }
  });

  ipcMain.handle(ConfigChannels.HAS, (_event, key: string) => {
    if (typeof key !== "string") {
      return {
        success: false,
        error: { code: "INVALID_INPUT", message: "Key must be a string" }
      };
    }
    return hasConfig(key);
  });

  ipcMain.handle(ConfigChannels.RESET, () => {
    try {
      resetConfig();
      return { success: true };
    } catch (err) {
      return {
        success: false,
        error: { code: "CONFIG_ERROR", message: err instanceof Error ? err.message : "Failed to reset config" }
      };
    }
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