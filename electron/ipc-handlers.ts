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
import { KeychainChannels, ConfigChannels, SystemChannels } from "../shared/ipc-channels";
import type { AppConfig } from "../shared/types";

/**
 * Validate and normalize a file path
 * Ensures the path is safe and within allowed directories (e.g. user home)
 * @param userPath - The path to validate
 * @returns The normalized path
 * @throws Error if path is invalid or unsafe
 */
function validateAndNormalizePath(userPath: string): string {
  if (!userPath) return ""; // Empty path is allowed (means no default)

  // CRITICAL: Check for traversal sequences BEFORE normalization
  if (userPath.includes("..") || userPath.split(/[\\/]/).some(segment => segment === "..")) {
    throw new Error("Path contains invalid traversal sequences (..)");
  }

  if (userPath.includes("\0")) {
    throw new Error("Path contains invalid characters");
  }

  const resolvedPath = path.resolve(userPath);

  // Basic check: ensure it's an absolute path
  if (!path.isAbsolute(resolvedPath)) {
    throw new Error("Path must be absolute");
  }

  const homeDir = app.getPath("home");
  const homeDirWithSep = homeDir.endsWith(path.sep) ? homeDir : `${homeDir}${path.sep}`;
  const resolvedWithSep = resolvedPath.endsWith(path.sep)
    ? resolvedPath
    : `${resolvedPath}${path.sep}`;

  if (
    resolvedWithSep !== homeDirWithSep &&
    !resolvedWithSep.startsWith(homeDirWithSep)
  ) {
    throw new Error("Path must be within user home directory");
  }

  return resolvedPath;
}

/**
 * Initialize and register all IPC handlers for keychain and configuration operations.
 */

/**
 * Register IPC handlers that expose keychain operations to renderer processes.
 *
 * Registers handlers for the SAVE, GET, DELETE, LIST, and HAS channels; each handler validates input types and, on valid input, delegates to the corresponding credential operation. When input types are invalid the handlers return a structured error object with `success: false` and `error.code` set to `"INVALID_INPUT"`.
 */
export function registerKeychainHandlers(): void {
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
export function registerConfigHandlers(): void {
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
      if (key === "exportSettings.defaultPath" && typeof value === "string") {
        finalValue = validateAndNormalizePath(value);
      }

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
      if (config.theme !== undefined) {
        validateConfigValue("theme", config.theme);
      }

      if (config.language !== undefined) {
        validateConfigValue("language", config.language);
      }

      if (config.defaultProvider !== undefined) {
        validateConfigValue("defaultProvider", config.defaultProvider);
      }

      if (config.windowBounds !== undefined) {
        validateConfigValue("windowBounds", config.windowBounds);
      }

      if (config.exportSettings?.defaultPath !== undefined) {
        config.exportSettings.defaultPath = validateAndNormalizePath(
          config.exportSettings.defaultPath
        );
        validateConfigValue(
          "exportSettings.defaultPath",
          config.exportSettings.defaultPath
        );
      }

      if (config.exportSettings?.format !== undefined) {
        validateConfigValue("exportSettings.format", config.exportSettings.format);
      }

      if (config.llmProviders) {
        Object.entries(config.llmProviders).forEach(([provider, settings]) => {
          if (settings?.enabled !== undefined) {
            validateConfigValue(`llmProviders.${provider}.enabled`, settings.enabled);
          }
          if (settings?.model !== undefined) {
            validateConfigValue(`llmProviders.${provider}.model`, settings.model);
          }
        });
      }

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
      const defaultConfig = getAllConfig();
      if (!Object.prototype.hasOwnProperty.call(defaultConfig, key)) {
        return {
          success: false,
          error: { code: "INVALID_INPUT", message: `Invalid config key to delete: ${key}` }
        };
      }
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
    try {
      return { success: true, data: hasConfig(key) };
    } catch (err) {
      return {
        success: false,
        error: { code: "CONFIG_ERROR", message: err instanceof Error ? err.message : "Failed to check config" }
      };
    }
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
 * Register all IPC handlers by calling both keychain, config, and system handlers.
 */
export function registerIpcHandlers(): void {
  registerKeychainHandlers();
  registerConfigHandlers();
  registerSystemHandlers();
}

/**
 * Register IPC handlers for system operations (GET_PLATFORM).
 */
export function registerSystemHandlers(): void {
  ipcMain.handle(SystemChannels.GET_PLATFORM, () => process.platform);
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
  Object.values(SystemChannels).forEach((channel) => {
    ipcMain.removeHandler(channel);
  });
}