import keytar from "keytar";

const SERVICE_NAME = "TraeExtractor";

export interface KeychainError {
  code: "INVALID_INPUT" | "KEYCHAIN_ERROR" | "NOT_FOUND";
  message: string;
}

export interface KeychainResult<T> {
  success: boolean;
  data?: T;
  error?: KeychainError;
}

/**
 * Save a credential to the system keychain
 * @param account - The account identifier (e.g., "anthropic-api-key")
 * @param password - The secret value to store
 */
export async function saveCredential(
  account: string,
  password: string
): Promise<KeychainResult<void>> {
  if (!account || !password) {
    return {
      success: false,
      error: {
        code: "INVALID_INPUT",
        message: "Account and password are required",
      },
    };
  }

  try {
    await keytar.setPassword(SERVICE_NAME, account, password);
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: {
        code: "KEYCHAIN_ERROR",
        message: err instanceof Error ? err.message : "Failed to save credential",
      },
    };
  }
}

/**
 * Retrieve a credential from the system keychain
 * @param account - The account identifier
 */
export async function getCredential(
  account: string
): Promise<KeychainResult<string>> {
  if (!account) {
    return {
      success: false,
      error: {
        code: "INVALID_INPUT",
        message: "Account is required",
      },
    };
  }

  try {
    const password = await keytar.getPassword(SERVICE_NAME, account);
    if (password === null) {
      return {
        success: false,
        error: {
          code: "NOT_FOUND",
          message: `No credential found for account: ${account}`,
        },
      };
    }
    return { success: true, data: password };
  } catch (err) {
    return {
      success: false,
      error: {
        code: "KEYCHAIN_ERROR",
        message: err instanceof Error ? err.message : "Failed to retrieve credential",
      },
    };
  }
}

/**
 * Delete a credential from the system keychain
 * @param account - The account identifier
 */
export async function deleteCredential(
  account: string
): Promise<KeychainResult<boolean>> {
  if (!account) {
    return {
      success: false,
      error: {
        code: "INVALID_INPUT",
        message: "Account is required",
      },
    };
  }

  try {
    const deleted = await keytar.deletePassword(SERVICE_NAME, account);
    return { success: true, data: deleted };
  } catch (err) {
    return {
      success: false,
      error: {
        code: "KEYCHAIN_ERROR",
        message: err instanceof Error ? err.message : "Failed to delete credential",
      },
    };
  }
}

/**
 * List all accounts stored for this service
 */
export async function listCredentials(): Promise<
  KeychainResult<Array<{ account: string }>>
> {
  try {
    const credentials = await keytar.findCredentials(SERVICE_NAME);
    return {
      success: true,
      data: credentials.map((c) => ({ account: c.account })),
    };
  } catch (err) {
    return {
      success: false,
      error: {
        code: "KEYCHAIN_ERROR",
        message: err instanceof Error ? err.message : "Failed to list credentials",
      },
    };
  }
}

/**
 * Check if a credential exists for the given account
 * @param account - The account identifier
 */
export async function hasCredential(
  account: string
): Promise<KeychainResult<boolean>> {
  if (!account) {
    return {
      success: false,
      error: {
        code: "INVALID_INPUT",
        message: "Account is required",
      },
    };
  }

  try {
    const password = await keytar.getPassword(SERVICE_NAME, account);
    return { success: true, data: password !== null };
  } catch (err) {
    return {
      success: false,
      error: {
        code: "KEYCHAIN_ERROR",
        message: err instanceof Error ? err.message : "Failed to check credential",
      },
    };
  }
}
