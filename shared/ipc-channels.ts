/**
 * IPC Channel names for keychain operations
 */
export const KeychainChannels = {
	SAVE: 'keychain:save',
	GET: 'keychain:get',
	DELETE: 'keychain:delete',
	LIST: 'keychain:list',
	HAS: 'keychain:has',
} as const;

/**
 * IPC Channel names for config operations
 */
export const ConfigChannels = {
	GET: 'config:get',
	SET: 'config:set',
	GET_ALL: 'config:get-all',
	SET_ALL: 'config:set-all',
	DELETE: 'config:delete',
	HAS: 'config:has',
	RESET: 'config:reset',
	GET_PATH: 'config:get-path',
} as const;

/**
 * IPC Channel names for system operations
 */
export const SystemChannels = {
	GET_PLATFORM: 'system:get-platform',
} as const;

/**
 * IPC Channel names for LLM provider operations
 */
export const LLMChannels = {
	TEST_CONNECTION: 'llm:test-connection',
	GET_PROVIDER_STATUS: 'llm:get-provider-status',
	SAVE_API_KEY: 'llm:save-api-key',
	GET_API_KEY: 'llm:get-api-key',
	DELETE_API_KEY: 'llm:delete-api-key',
	HAS_API_KEY: 'llm:has-api-key',
	SET_MODEL_ROLE: 'llm:set-model-role',
	GET_MODEL_ROLES: 'llm:get-model-roles',
} as const;

/**
 * IPC Channel names for cagent YAML generation operations
 */
export const CagentChannels = {
	GENERATE_YAML: 'cagent:generate-yaml',
} as const;

/**
 * IPC Channel names for sidecar hot-reload operations
 */
export const SidecarReloadChannels = {
	STATUS: 'sidecar:reload-status',
	FORCE_RELOAD: 'sidecar:force-reload',
	RELOAD_EVENT: 'sidecar:reload-event', // Renderer listening for this
} as const;
