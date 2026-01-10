/**
 * LLM Configuration Service
 *
 * Wrapper service for LLM provider IPC operations.
 * Provides a clean API for the UI to interact with keychain and config.
 */

import type {
  LLMProviderId,
  LLMConnectionResult,
  ModelRole,
  ModelRoleConfig,
} from "../../../shared/types";

// Browser check
const isBrowser = typeof window !== "undefined";

/**
 * Result type for service operations
 */
export interface ServiceResult<T = void> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * Save provider API key to secure keychain
 */
export async function saveProviderCredentials(
  providerId: LLMProviderId,
  apiKey: string
): Promise<ServiceResult> {
  if (!isBrowser) {
    return { success: false, error: "Not in browser context" };
  }

  try {
    const result = await window.electronAPI.llm.saveApiKey(providerId, apiKey);
    if (result.success) {
      return { success: true };
    }
    return {
      success: false,
      error: result.error?.message ?? "Failed to save credentials",
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Load provider API key from keychain (returns masked key for display)
 */
export async function loadProviderCredentials(
  providerId: LLMProviderId
): Promise<ServiceResult<string>> {
  if (!isBrowser) {
    return { success: false, error: "Not in browser context" };
  }

  try {
    const result = await window.electronAPI.llm.getApiKey(providerId);
    if (result.success && result.data) {
      return { success: true, data: result.data };
    }
    return {
      success: false,
      error: result.success ? "No API key found" : (result.error?.message ?? "Failed to load credentials"),
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Delete provider API key from keychain
 */
export async function deleteProviderCredentials(
  providerId: LLMProviderId
): Promise<ServiceResult> {
  if (!isBrowser) {
    return { success: false, error: "Not in browser context" };
  }

  try {
    const result = await window.electronAPI.llm.deleteApiKey(providerId);
    if (result.success) {
      return { success: true };
    }
    return {
      success: false,
      error: result.error?.message ?? "Failed to delete credentials",
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Check if provider has stored credentials
 */
export async function hasProviderCredentials(
  providerId: LLMProviderId
): Promise<ServiceResult<boolean>> {
  if (!isBrowser) {
    return { success: false, error: "Not in browser context" };
  }

  try {
    const result = await window.electronAPI.llm.hasApiKey(providerId);
    if (result.success) {
      return { success: true, data: result.data ?? false };
    }
    return {
      success: false,
      error: result.error?.message ?? "Failed to check credentials",
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Test connection to a provider
 */
export async function testProviderConnection(
  providerId: LLMProviderId,
  apiKey: string,
  model: string
): Promise<LLMConnectionResult> {
  if (!isBrowser) {
    return {
      success: false,
      providerId,
      model,
      error: { code: "UNKNOWN", message: "Not in browser context" },
    };
  }

  try {
    return await window.electronAPI.llm.testConnection(providerId, apiKey, model);
  } catch (error) {
    return {
      success: false,
      providerId,
      model,
      error: {
        code: "NETWORK_ERROR",
        message: error instanceof Error ? error.message : "Unknown error",
      },
    };
  }
}

/**
 * Set model role assignment
 */
export async function setModelRole(
  role: ModelRole,
  providerId: LLMProviderId | null,
  model: string | null
): Promise<ServiceResult> {
  if (!isBrowser) {
    return { success: false, error: "Not in browser context" };
  }

  try {
    const result = await window.electronAPI.llm.setModelRole(role, providerId, model);
    if (result.success) {
      return { success: true };
    }
    return {
      success: false,
      error: result.error?.message ?? "Failed to set model role",
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Get all model role assignments
 */
export async function getModelRoles(): Promise<ServiceResult<ModelRoleConfig>> {
  if (!isBrowser) {
    return { success: false, error: "Not in browser context" };
  }

  try {
    const result = await window.electronAPI.llm.getModelRoles();
    if (result.success && result.data) {
      return { success: true, data: result.data };
    }
    return {
      success: false,
      error: result.success ? "No roles found" : (result.error?.message ?? "Failed to get model roles"),
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
