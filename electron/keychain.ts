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
 * Stores a secret password in the system keychain under the given account.
 *
 * @param account - Identifier for the credential (e.g., "anthropic-api-key")
 * @param password - Secret value to store
 * @returns A KeychainResult: `success: true` when stored; otherwise `success: false` with `error.code` `"INVALID_INPUT"` if inputs are missing or `"KEYCHAIN_ERROR"` if the keychain operation fails (error message provided in `error.message`)
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
 * Retrieve the stored password for an account from the system keychain.
 *
 * @param account - The account identifier whose credential to retrieve
 * @returns On success, `data` contains the password string; on failure, `error` contains a `KeychainError` describing the problem
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
 * Delete a credential from the system keychain.
 *
 * @param account - The account identifier whose credential should be removed
 * @returns `true` if a credential was deleted, `false` if no credential existed for the account
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
 * List all accounts stored for this service.
 *
 * @returns A result whose `data` is an array of objects each containing an `account` string when successful; otherwise `error` describes the failure.
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
 * Determine whether a credential exists for the specified account.
 *
 * @param account - The account identifier to check
 * @returns `true` if a credential exists for `account`, `false` otherwise. On failure the result's `error` field will be set (e.g., `INVALID_INPUT` for a missing account or `KEYCHAIN_ERROR` for keychain access failures).
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