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
import { testLLMConnection } from "./llm-connector";
import { KeychainChannels, ConfigChannels, SystemChannels, LLMChannels } from "../shared/ipc-channels";
import type { AppConfig, LLMProviderId, ModelRoleConfig } from "../shared/types";
import { getAllProviderIds } from "../shared/llm-providers";

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
 * Register all IPC handlers by calling keychain, config, system, and LLM handlers.
 */
export function registerIpcHandlers(): void {
  registerKeychainHandlers();
  registerConfigHandlers();
  registerSystemHandlers();
  registerLLMHandlers();
}

/**
 * Register IPC handlers for system operations (GET_PLATFORM).
 */
export function registerSystemHandlers(): void {
  ipcMain.handle(SystemChannels.GET_PLATFORM, () => process.platform);
}

/**
 * Helper to get keychain account name for LLM provider
 */
function getLLMKeychainAccount(providerId: LLMProviderId): string {
  return `llm-provider:${providerId}`;
}

/**
 * Validate that a provider ID is valid
 */
function isValidProviderId(providerId: unknown): providerId is LLMProviderId {
  const validIds = getAllProviderIds();
  return typeof providerId === "string" && validIds.includes(providerId as LLMProviderId);
}

/**
 * Register IPC handlers for LLM provider operations.
 *
 * Handlers for testing connections, managing API keys via keychain,
 * and managing model role assignments.
 */
export function registerLLMHandlers(): void {
  // Test connection to an LLM provider
  ipcMain.handle(
    LLMChannels.TEST_CONNECTION,
    async (_event, providerId: LLMProviderId, apiKey: string, model: string) => {
      if (!isValidProviderId(providerId)) {
        return {
          success: false,
          error: { code: "INVALID_INPUT", message: "Invalid provider ID" },
        };
      }
      if (typeof model !== "string" || !model) {
        return {
          success: false,
          error: { code: "INVALID_INPUT", message: "Model is required" },
        };
      }

      // If no API key provided, try to get from keychain
      let keyToUse = apiKey;
      if (!keyToUse) {
        const keychainResult = await getCredential(getLLMKeychainAccount(providerId));
        if (!keychainResult.success || !keychainResult.data) {
          return {
            success: false,
            error: { code: "INVALID_INPUT", message: "No API key provided or stored" },
          };
        }
        keyToUse = keychainResult.data;
      }

      return testLLMConnection(providerId, keyToUse, model);
    }
  );

  // Save API key to keychain
  ipcMain.handle(
    LLMChannels.SAVE_API_KEY,
    async (_event, providerId: LLMProviderId, apiKey: string) => {
      if (!isValidProviderId(providerId)) {
        return {
          success: false,
          error: { code: "INVALID_INPUT", message: "Invalid provider ID" },
        };
      }
      if (typeof apiKey !== "string" || !apiKey) {
        return {
          success: false,
          error: { code: "INVALID_INPUT", message: "API key is required" },
        };
      }

      return saveCredential(getLLMKeychainAccount(providerId), apiKey);
    }
  );

  // Get API key from keychain (for internal use - returns masked key for UI)
  ipcMain.handle(
    LLMChannels.GET_API_KEY,
    async (_event, providerId: LLMProviderId) => {
      if (!isValidProviderId(providerId)) {
        return {
          success: false,
          error: { code: "INVALID_INPUT", message: "Invalid provider ID" },
        };
      }

      const result = await getCredential(getLLMKeychainAccount(providerId));
      if (!result.success || !result.data) {
        return result;
      }

      // Return masked key for security - only show last 4 chars
      const masked =
        result.data.length > 4
          ? "•".repeat(result.data.length - 4) + result.data.slice(-4)
          : "•".repeat(result.data.length);

      return { success: true, data: masked };
    }
  );

  // Delete API key from keychain
  ipcMain.handle(
    LLMChannels.DELETE_API_KEY,
    async (_event, providerId: LLMProviderId) => {
      if (!isValidProviderId(providerId)) {
        return {
          success: false,
          error: { code: "INVALID_INPUT", message: "Invalid provider ID" },
        };
      }

      return deleteCredential(getLLMKeychainAccount(providerId));
    }
  );

  // Check if API key exists in keychain
  ipcMain.handle(
    LLMChannels.HAS_API_KEY,
    async (_event, providerId: LLMProviderId) => {
      if (!isValidProviderId(providerId)) {
        return {
          success: false,
          error: { code: "INVALID_INPUT", message: "Invalid provider ID" },
        };
      }

      return hasCredential(getLLMKeychainAccount(providerId));
    }
  );

  // Set model role assignment (stored in config)
  // Cagent roles: orchestrator, extraction, editing, captioning, scheduling
  // Reference: .taskmaster/docs/cagent-team.md
  ipcMain.handle(
    LLMChannels.SET_MODEL_ROLE,
    async (
      _event,
      role: string,
      providerId: LLMProviderId | null,
      model: string | null
    ) => {
      const validRoles = ["orchestrator", "extraction", "editing", "captioning", "scheduling"];
      if (!validRoles.includes(role)) {
        return {
          success: false,
          error: { code: "INVALID_INPUT", message: "Invalid role" },
        };
      }

      if (providerId !== null && !isValidProviderId(providerId)) {
        return {
          success: false,
          error: { code: "INVALID_INPUT", message: "Invalid provider ID" },
        };
      }

      try {
        // Get current roles
        const currentRoles = (getConfig("modelRoles") as ModelRoleConfig) || {
          orchestrator: { providerId: null, model: null },
          extraction: { providerId: null, model: null },
          editing: { providerId: null, model: null },
          captioning: { providerId: null, model: null },
          scheduling: { providerId: null, model: null },
        };

        // Update the specific role
        currentRoles[role as keyof ModelRoleConfig] = { providerId, model };

        // Save back to config
        setConfig("modelRoles", currentRoles);

        return { success: true };
      } catch (err) {
        return {
          success: false,
          error: {
            code: "CONFIG_ERROR",
            message: err instanceof Error ? err.message : "Failed to set model role",
          },
        };
      }
    }
  );

  // Get all model role assignments
  ipcMain.handle(LLMChannels.GET_MODEL_ROLES, () => {
    try {
      const roles = getConfig("modelRoles") as ModelRoleConfig | undefined;
      return {
        success: true,
        data: roles || {
          orchestrator: { providerId: null, model: null },
          extraction: { providerId: null, model: null },
          editing: { providerId: null, model: null },
          captioning: { providerId: null, model: null },
          scheduling: { providerId: null, model: null },
        },
      };
    } catch (err) {
      return {
        success: false,
        error: {
          code: "CONFIG_ERROR",
          message: err instanceof Error ? err.message : "Failed to get model roles",
        },
      };
    }
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
  Object.values(SystemChannels).forEach((channel) => {
    ipcMain.removeHandler(channel);
  });
  Object.values(LLMChannels).forEach((channel) => {
    ipcMain.removeHandler(channel);
  });
}