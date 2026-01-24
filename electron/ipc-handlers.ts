import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { app, ipcMain } from 'electron';
import {
	CagentChannels,
	ConfigChannels,
	KeychainChannels,
	LLMChannels,
	SystemChannels,
} from '../shared/ipc-channels';
import { getAllProviderIds, LLM_PROVIDERS } from '../shared/llm-providers';
import type { AppConfig, LLMProviderId, ModelRoleConfig } from '../shared/types';
import { generateCagentYaml } from '../src/lib/services/cagent-generator';
import { logAuditEvent } from './audit-log';
import {
	deleteConfig,
	getAllConfig,
	getConfig,
	getConfigPath,
	hasConfig,
	resetConfig,
	setAllConfig,
	setConfig,
	validateConfigValue,
} from './config-manager';
import {
	deleteCredential,
	getCredential,
	hasCredential,
	listCredentials,
	saveCredential,
} from './keychain';
import { testLLMConnection } from './llm-connector';

/**
 * Validate and normalize a file path
 * Ensures the path is safe and within allowed directories (e.g. user home)
 * @param userPath - The path to validate
 * @returns The normalized path
 * @throws Error if path is invalid or unsafe
 */
function validateAndNormalizePath(userPath: string): string {
	if (!userPath) return ''; // Empty path is allowed (means no default)

	// CRITICAL: Check for traversal sequences BEFORE normalization
	if (userPath.includes('..') || userPath.split(/[\\/]/).some((segment) => segment === '..')) {
		throw new Error('Path contains invalid traversal sequences (..)');
	}

	if (userPath.includes('\0')) {
		throw new Error('Path contains invalid characters');
	}

	const resolvedPath = path.resolve(userPath);

	// Basic check: ensure it's an absolute path
	if (!path.isAbsolute(resolvedPath)) {
		throw new Error('Path must be absolute');
	}

	const homeDir = app.getPath('home');
	const homeDirWithSep = homeDir.endsWith(path.sep) ? homeDir : `${homeDir}${path.sep}`;
	const resolvedWithSep = resolvedPath.endsWith(path.sep)
		? resolvedPath
		: `${resolvedPath}${path.sep}`;

	if (resolvedWithSep !== homeDirWithSep && !resolvedWithSep.startsWith(homeDirWithSep)) {
		throw new Error('Path must be within user home directory');
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
	ipcMain.handle(KeychainChannels.SAVE, async (_event, account: string, password: string) => {
		if (typeof account !== 'string' || typeof password !== 'string') {
			return {
				success: false,
				error: { code: 'INVALID_INPUT', message: 'Invalid input types' },
			};
		}
		return saveCredential(account, password);
	});

	ipcMain.handle(KeychainChannels.GET, async (_event, account: string) => {
		if (typeof account !== 'string') {
			return {
				success: false,
				error: { code: 'INVALID_INPUT', message: 'Account must be a string' },
			};
		}
		return getCredential(account);
	});

	ipcMain.handle(KeychainChannels.DELETE, async (_event, account: string) => {
		if (typeof account !== 'string') {
			return {
				success: false,
				error: { code: 'INVALID_INPUT', message: 'Account must be a string' },
			};
		}
		return deleteCredential(account);
	});

	ipcMain.handle(KeychainChannels.LIST, async () => {
		return listCredentials();
	});

	ipcMain.handle(KeychainChannels.HAS, async (_event, account: string) => {
		if (typeof account !== 'string') {
			return {
				success: false,
				error: { code: 'INVALID_INPUT', message: 'Account must be a string' },
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
		if (typeof key !== 'string') {
			return {
				success: false,
				error: { code: 'INVALID_INPUT', message: 'Key must be a string' },
			};
		}
		try {
			return { success: true, data: getConfig(key) };
		} catch (err) {
			return {
				success: false,
				error: {
					code: 'CONFIG_ERROR',
					message: err instanceof Error ? err.message : 'Failed to get config',
				},
			};
		}
	});

	ipcMain.handle(ConfigChannels.SET, (_event, key: string, value: unknown) => {
		if (typeof key !== 'string') {
			return {
				success: false,
				error: { code: 'INVALID_INPUT', message: 'Key must be a string' },
			};
		}

		try {
			let finalValue = value;
			if (key === 'exportSettings.defaultPath' && typeof value === 'string') {
				finalValue = validateAndNormalizePath(value);
			}

			validateConfigValue(key, finalValue);
			setConfig(key, finalValue);

			return { success: true };
		} catch (err) {
			return {
				success: false,
				error: {
					code: 'CONFIG_ERROR',
					message: err instanceof Error ? err.message : 'Failed to set config',
				},
			};
		}
	});

	ipcMain.handle(ConfigChannels.GET_ALL, () => {
		return getAllConfig();
	});

	ipcMain.handle(ConfigChannels.SET_ALL, (_event, config: Partial<AppConfig>) => {
		if (typeof config !== 'object' || config === null) {
			return {
				success: false,
				error: { code: 'INVALID_INPUT', message: 'Config must be an object' },
			};
		}

		try {
			if (config.theme !== undefined) {
				validateConfigValue('theme', config.theme);
			}

			if (config.language !== undefined) {
				validateConfigValue('language', config.language);
			}

			if (config.defaultProvider !== undefined) {
				validateConfigValue('defaultProvider', config.defaultProvider);
			}

			if (config.windowBounds !== undefined) {
				validateConfigValue('windowBounds', config.windowBounds);
			}

			if (config.exportSettings?.defaultPath !== undefined) {
				config.exportSettings.defaultPath = validateAndNormalizePath(
					config.exportSettings.defaultPath,
				);
				validateConfigValue('exportSettings.defaultPath', config.exportSettings.defaultPath);
			}

			if (config.exportSettings?.format !== undefined) {
				validateConfigValue('exportSettings.format', config.exportSettings.format);
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
			if (config.modelRoles !== undefined) {
				validateConfigValue('modelRoles', config.modelRoles);
			}

			setAllConfig(config);
			return { success: true };
		} catch (err) {
			return {
				success: false,
				error: {
					code: 'CONFIG_ERROR',
					message: err instanceof Error ? err.message : 'Failed to set all config',
				},
			};
		}
	});

	ipcMain.handle(ConfigChannels.DELETE, (_event, key: keyof AppConfig) => {
		if (typeof key !== 'string') {
			return {
				success: false,
				error: { code: 'INVALID_INPUT', message: 'Key must be a string' },
			};
		}
		try {
			const defaultConfig = getAllConfig();
			if (!Object.hasOwn(defaultConfig, key)) {
				return {
					success: false,
					error: { code: 'INVALID_INPUT', message: `Invalid config key to delete: ${key}` },
				};
			}
			deleteConfig(key);
			return { success: true };
		} catch (err) {
			return {
				success: false,
				error: {
					code: 'CONFIG_ERROR',
					message: err instanceof Error ? err.message : 'Failed to delete config',
				},
			};
		}
	});

	ipcMain.handle(ConfigChannels.HAS, (_event, key: string) => {
		if (typeof key !== 'string') {
			return {
				success: false,
				error: { code: 'INVALID_INPUT', message: 'Key must be a string' },
			};
		}
		try {
			return { success: true, data: hasConfig(key) };
		} catch (err) {
			return {
				success: false,
				error: {
					code: 'CONFIG_ERROR',
					message: err instanceof Error ? err.message : 'Failed to check config',
				},
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
				error: {
					code: 'CONFIG_ERROR',
					message: err instanceof Error ? err.message : 'Failed to reset config',
				},
			};
		}
	});

	ipcMain.handle(ConfigChannels.GET_PATH, () => {
		return getConfigPath();
	});
}

/**
 * Register IPC handlers for cagent YAML generation
 *
 * Generates team.yaml configuration with:
 * - Agent specifications
 * - MCP toolset configuration
 * - RAG knowledge base setup
 * - Directory creation and backup
 */
export function registerCagentHandlers(): void {
	ipcMain.handle(
		CagentChannels.GENERATE_YAML,
		async (
			_event,
			config: {
				agents?: Record<string, unknown>;
				enabledMcp?: string[];
				ragSources?: string[];
				autoCreateDirs?: boolean;
			},
		) => {
			try {
				// Validate input types
				if (!config || typeof config !== 'object') {
					return {
						success: false,
						error: { code: 'INVALID_INPUT', message: 'Config must be an object' },
					};
				}

				// Get app root directory
				const appPath = app.getAppPath();
				const pythonDir = path.join(appPath, 'python');

				// Prepare file operations wrapper
				const fileOps = {
					mkdir: (dirPath: string, options?: { recursive: boolean }) => mkdir(dirPath, options),
					writeFile: (filePath: string, data: string) => writeFile(filePath, data, 'utf-8'),
					readFile: (filePath: string) => readFile(filePath, 'utf-8'),
					access: (filePath: string) => access(filePath),
				};

				// Create directories if needed (default: true)
				const autoCreateDirs = config.autoCreateDirs !== false;
				const dirsCreated: string[] = [];

				if (autoCreateDirs) {
					const dirsToCreate = [
						path.join(pythonDir, 'prompts', 'orchestrator'),
						path.join(pythonDir, 'prompts', 'extraction'),
						path.join(pythonDir, 'prompts', 'editing'),
						path.join(pythonDir, 'prompts', 'captioning'),
						path.join(pythonDir, 'prompts', 'scheduling'),
						path.join(pythonDir, 'prompts', 'idea-validator'),
						path.join(pythonDir, 'knowledge', 'brand'),
						path.join(pythonDir, 'rag'),
						path.join(pythonDir, 'memory'),
					];

					for (const dir of dirsToCreate) {
						try {
							await fileOps.mkdir(dir, { recursive: true });
							// Record relative path for response
							const relativePath = path.relative(appPath, dir);
							dirsCreated.push(relativePath);
						} catch (err) {
							// Directory might already exist, continue
							if (err instanceof Error && !err.message.includes('EEXIST')) {
								console.warn(`Failed to create directory ${dir}:`, err);
							}
						}
					}
				}

				// Generate YAML using the cagent-generator service
				const yaml = generateCagentYaml({
					agents: config.agents || {},
					enabledMcp: config.enabledMcp || [],
					ragSources: config.ragSources || ['brand_guidelines', 'platform_specs', 'competitors'],
				});

				// Prepare file paths
				const teamYamlPath = path.join(pythonDir, 'team.yaml');

				// Check if team.yaml exists and create backup
				let backupPath: string | null = null;
				try {
					await fileOps.access(teamYamlPath);
					// File exists, create backup with timestamp
					const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
					backupPath = `${teamYamlPath}.backup-${timestamp}`;
					try {
						const existingContent = await fileOps.readFile(teamYamlPath);
						await fileOps.writeFile(backupPath, existingContent);
					} catch (backupErr) {
						console.warn('Failed to create backup:', backupErr);
						// Continue anyway - backup failure shouldn't block YAML write
					}
				} catch (err) {
					// File doesn't exist, no backup needed
				}

				// Write YAML file
				await fileOps.writeFile(teamYamlPath, yaml);

				// Log operation
				logAuditEvent({
					action: 'cagent.generateYaml',
					success: true,
					metadata: {
						dirsCreated: dirsCreated.length,
						backupCreated: backupPath ? true : false,
						mcpServers: (config.enabledMcp || []).length,
						ragSources: (config.ragSources || []).length,
					},
				});

				return {
					success: true,
					data: {
						yaml,
						filePath: 'python/team.yaml',
						dirsCreated,
						backupPath: backupPath ? path.relative(appPath, backupPath) : null,
					},
				};
			} catch (err) {
				const errorMessage = err instanceof Error ? err.message : 'Unknown error';
				logAuditEvent({
					action: 'cagent.generateYaml',
					success: false,
					errorCode: 'GENERATION_ERROR',
					metadata: {
						error: errorMessage,
					},
				});

				return {
					success: false,
					error: {
						code: 'GENERATION_ERROR',
						message: errorMessage,
					},
				};
			}
		},
	);
}

/**
 * Register all IPC handlers by calling keychain, config, system, LLM, and cagent handlers.
 */
export function registerIpcHandlers(): void {
	registerKeychainHandlers();
	registerConfigHandlers();
	registerSystemHandlers();
	registerLLMHandlers();
	registerCagentHandlers();
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
	return typeof providerId === 'string' && validIds.includes(providerId as LLMProviderId);
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
					error: { code: 'INVALID_INPUT', message: 'Invalid provider ID' },
				};
			}
			if (typeof model !== 'string' || !model) {
				return {
					success: false,
					error: { code: 'INVALID_INPUT', message: 'Model is required' },
				};
			}
			if (apiKey !== undefined && apiKey !== null && apiKey !== '' && typeof apiKey !== 'string') {
				return {
					success: false,
					error: { code: 'INVALID_INPUT', message: 'API key must be a string' },
				};
			}

			// If no API key provided, try to get from keychain
			let keyToUse = apiKey;
			if (!keyToUse) {
				const keychainResult = await getCredential(getLLMKeychainAccount(providerId));
				if (!keychainResult.success || !keychainResult.data) {
					return {
						success: false,
						error: { code: 'INVALID_INPUT', message: 'No API key provided or stored' },
					};
				}
				keyToUse = keychainResult.data;
			}

			return testLLMConnection(providerId, keyToUse, model);
		},
	);

	// Save API key to keychain
	ipcMain.handle(
		LLMChannels.SAVE_API_KEY,
		async (_event, providerId: LLMProviderId, apiKey: string) => {
			if (!isValidProviderId(providerId)) {
				logAuditEvent({
					action: 'llm.saveApiKey',
					providerId: typeof providerId === 'string' ? providerId : null,
					success: false,
					errorCode: 'INVALID_INPUT',
				});
				return {
					success: false,
					error: { code: 'INVALID_INPUT', message: 'Invalid provider ID' },
				};
			}
			if (typeof apiKey !== 'string' || !apiKey) {
				logAuditEvent({
					action: 'llm.saveApiKey',
					providerId,
					success: false,
					errorCode: 'INVALID_INPUT',
				});
				return {
					success: false,
					error: { code: 'INVALID_INPUT', message: 'API key is required' },
				};
			}

			const result = await saveCredential(getLLMKeychainAccount(providerId), apiKey);
			logAuditEvent({
				action: 'llm.saveApiKey',
				providerId,
				success: result.success === true,
				errorCode: result.success ? undefined : result.error?.code,
				metadata: {
					keySuffix: apiKey.slice(-4),
					keyLength: apiKey.length,
				},
			});
			return result;
		},
	);

	// Get API key from keychain (for internal use - returns masked key for UI)
	ipcMain.handle(LLMChannels.GET_API_KEY, async (_event, providerId: LLMProviderId) => {
		if (!isValidProviderId(providerId)) {
			return {
				success: false,
				error: { code: 'INVALID_INPUT', message: 'Invalid provider ID' },
			};
		}

		const result = await getCredential(getLLMKeychainAccount(providerId));
		if (!result.success || !result.data) {
			return result;
		}

		// Return masked key for security - only show last 4 chars
		const masked =
			result.data.length > 4
				? '•'.repeat(result.data.length - 4) + result.data.slice(-4)
				: '•'.repeat(result.data.length);

		return { success: true, data: masked };
	});

	// Delete API key from keychain
	ipcMain.handle(LLMChannels.DELETE_API_KEY, async (_event, providerId: LLMProviderId) => {
		if (!isValidProviderId(providerId)) {
			logAuditEvent({
				action: 'llm.deleteApiKey',
				providerId: typeof providerId === 'string' ? providerId : null,
				success: false,
				errorCode: 'INVALID_INPUT',
			});
			return {
				success: false,
				error: { code: 'INVALID_INPUT', message: 'Invalid provider ID' },
			};
		}

		const result = await deleteCredential(getLLMKeychainAccount(providerId));
		logAuditEvent({
			action: 'llm.deleteApiKey',
			providerId,
			success: result.success === true,
			errorCode: result.success ? undefined : result.error?.code,
			metadata: {
				deleted: result.success ? result.data === true : false,
			},
		});
		return result;
	});

	// Check if API key exists in keychain
	ipcMain.handle(LLMChannels.HAS_API_KEY, async (_event, providerId: LLMProviderId) => {
		if (!isValidProviderId(providerId)) {
			return {
				success: false,
				error: { code: 'INVALID_INPUT', message: 'Invalid provider ID' },
			};
		}

		return hasCredential(getLLMKeychainAccount(providerId));
	});

	// Set model role assignment (stored in config)
	// Cagent roles: orchestrator, extraction, editing, captioning, scheduling
	// Reference: .taskmaster/docs/cagent-team.md
	ipcMain.handle(
		LLMChannels.SET_MODEL_ROLE,
		async (_event, role: string, providerId: LLMProviderId | null, model: string | null) => {
			const validRoles = ['orchestrator', 'extraction', 'editing', 'captioning', 'scheduling'];
			if (!validRoles.includes(role)) {
				logAuditEvent({
					action: 'llm.setModelRole',
					role: typeof role === 'string' ? role : null,
					providerId: typeof providerId === 'string' ? providerId : null,
					model: typeof model === 'string' ? model : null,
					success: false,
					errorCode: 'INVALID_INPUT',
				});
				return {
					success: false,
					error: { code: 'INVALID_INPUT', message: 'Invalid role' },
				};
			}

			if (providerId !== null && !isValidProviderId(providerId)) {
				logAuditEvent({
					action: 'llm.setModelRole',
					role,
					providerId: typeof providerId === 'string' ? providerId : null,
					model: typeof model === 'string' ? model : null,
					success: false,
					errorCode: 'INVALID_INPUT',
				});
				return {
					success: false,
					error: { code: 'INVALID_INPUT', message: 'Invalid provider ID' },
				};
			}
			if ((providerId === null) !== (model === null)) {
				logAuditEvent({
					action: 'llm.setModelRole',
					role,
					providerId,
					model,
					success: false,
					errorCode: 'INVALID_INPUT',
				});
				return {
					success: false,
					error: {
						code: 'INVALID_INPUT',
						message: 'Provider and model must both be set or both be null',
					},
				};
			}
			if (providerId !== null && model !== null) {
				const provider = LLM_PROVIDERS[providerId];
				if (!provider.models.some((providerModel) => providerModel.id === model)) {
					logAuditEvent({
						action: 'llm.setModelRole',
						role,
						providerId,
						model,
						success: false,
						errorCode: 'INVALID_INPUT',
					});
					return {
						success: false,
						error: {
							code: 'INVALID_INPUT',
							message: `Model "${model}" not found for provider "${providerId}"`,
						},
					};
				}
			}

			try {
				// Get current roles
				const currentRoles = (getConfig('modelRoles') as ModelRoleConfig) || {
					orchestrator: { providerId: null, model: null },
					extraction: { providerId: null, model: null },
					editing: { providerId: null, model: null },
					captioning: { providerId: null, model: null },
					scheduling: { providerId: null, model: null },
				};

				// Update the specific role
				currentRoles[role as keyof ModelRoleConfig] = { providerId, model };

				// Save back to config
				setConfig('modelRoles', currentRoles);

				logAuditEvent({
					action: 'llm.setModelRole',
					role,
					providerId,
					model,
					success: true,
				});
				return { success: true };
			} catch (err) {
				logAuditEvent({
					action: 'llm.setModelRole',
					role,
					providerId,
					model,
					success: false,
					errorCode: 'CONFIG_ERROR',
				});
				return {
					success: false,
					error: {
						code: 'CONFIG_ERROR',
						message: err instanceof Error ? err.message : 'Failed to set model role',
					},
				};
			}
		},
	);

	// Get all model role assignments
	ipcMain.handle(LLMChannels.GET_MODEL_ROLES, () => {
		try {
			const roles = getConfig('modelRoles') as ModelRoleConfig | undefined;
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
					code: 'CONFIG_ERROR',
					message: err instanceof Error ? err.message : 'Failed to get model roles',
				},
			};
		}
	});

	ipcMain.handle(LLMChannels.GET_PROVIDER_STATUS, async (_event, providerId: LLMProviderId) => {
		if (!isValidProviderId(providerId)) {
			return {
				success: false,
				error: { code: 'INVALID_INPUT', message: 'Invalid provider ID' },
			};
		}

		try {
			const hasKey = await hasCredential(getLLMKeychainAccount(providerId));
			return {
				success: true,
				data: { providerId, hasApiKey: hasKey.success && hasKey.data === true },
			};
		} catch (err) {
			return {
				success: false,
				error: {
					code: 'PROVIDER_ERROR',
					message: err instanceof Error ? err.message : 'Failed',
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
	Object.values(CagentChannels).forEach((channel) => {
		ipcMain.removeHandler(channel);
	});
}
