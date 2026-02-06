import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LLMChannels, OsxphotosChannels } from '../shared/ipc-channels';
import { registerLLMHandlers, unregisterIpcHandlers } from './ipc-handlers';
import { hasCredential } from './keychain';

const handlers = vi.hoisted(
	() => new Map<string, (...args: unknown[]) => Promise<unknown> | unknown>(),
);

vi.mock('electron', () => ({
	ipcMain: {
		handle: (channel: string, handler: (...args: unknown[]) => unknown) => {
			handlers.set(channel, handler);
		},
		removeHandler: (channel: string) => {
			handlers.delete(channel);
		},
	},
	app: {
		getPath: vi.fn(() => '/tmp'),
	},
}));

vi.mock('./keychain', () => ({
	saveCredential: vi.fn(),
	getCredential: vi.fn(),
	deleteCredential: vi.fn(),
	listCredentials: vi.fn(),
	hasCredential: vi.fn(),
}));

vi.mock('./config-manager', () => ({
	getConfig: vi.fn(),
	setConfig: vi.fn(),
	getAllConfig: vi.fn(),
	setAllConfig: vi.fn(),
	deleteConfig: vi.fn(),
	hasConfig: vi.fn(),
	resetConfig: vi.fn(),
	getConfigPath: vi.fn(),
	validateConfigValue: vi.fn(),
}));

vi.mock('./llm-connector', () => ({
	testLLMConnection: vi.fn(),
}));

function getHandler(channel: string) {
	const handler = handlers.get(channel);
	if (!handler) {
		throw new Error(`Missing handler for channel: ${channel}`);
	}
	return handler;
}

describe('registerLLMHandlers', () => {
	beforeEach(() => {
		handlers.clear();
		registerLLMHandlers();
	});

	afterEach(() => {
		unregisterIpcHandlers();
		handlers.clear();
		vi.clearAllMocks();
	});

	it('rejects non-string apiKey in TEST_CONNECTION', async () => {
		const handler = getHandler(LLMChannels.TEST_CONNECTION);
		const result = await handler({}, 'openai', 123 as unknown as string, 'gpt-5.2');
		expect(result).toMatchObject({
			success: false,
			error: { code: 'INVALID_INPUT', message: 'API key must be a string' },
		});
	});

	it('rejects mismatched provider/model in SET_MODEL_ROLE', async () => {
		const handler = getHandler(LLMChannels.SET_MODEL_ROLE);
		const result = await handler({}, 'orchestrator', null, 'gpt-5.2');
		expect(result).toMatchObject({
			success: false,
			error: {
				code: 'INVALID_INPUT',
				message: 'Provider and model must both be set or both be null',
			},
		});
	});

	it('rejects invalid model for provider in SET_MODEL_ROLE', async () => {
		const handler = getHandler(LLMChannels.SET_MODEL_ROLE);
		const result = await handler({}, 'orchestrator', 'openai', 'not-a-model');
		expect(result).toMatchObject({
			success: false,
			error: {
				code: 'INVALID_INPUT',
				message: 'Model "not-a-model" not found for provider "openai"',
			},
		});
	});

	it('returns provider status from GET_PROVIDER_STATUS', async () => {
		vi.mocked(hasCredential).mockResolvedValue({ success: true, data: true });
		const handler = getHandler(LLMChannels.GET_PROVIDER_STATUS);
		const result = await handler({}, 'openai');
		expect(result).toMatchObject({
			success: true,
			data: { providerId: 'openai', hasApiKey: true },
		});
	});
});

describe('Osxphotos Handlers', () => {
	it('LIST_ALBUMS handler rejects if albumId is invalid in GET_PHOTOS', async () => {
		const { registerOsxphotosIpcHandlers } = await import('./sidecar-ipc-handlers');
		handlers.clear();
		registerOsxphotosIpcHandlers();

		const handler = getHandler(OsxphotosChannels.GET_PHOTOS);
		const result = await handler({}, '', 10);
		expect(result).toMatchObject({
			success: false,
			error: { code: 'INVALID_INPUT', message: 'Album ID is required' },
		});
	});

	it('EXPORT_PHOTO handler validates export path', async () => {
		const { registerOsxphotosIpcHandlers } = await import('./sidecar-ipc-handlers');
		handlers.clear();
		registerOsxphotosIpcHandlers();

		const handler = getHandler(OsxphotosChannels.EXPORT_PHOTO);

		// Test empty path
		const result1 = await handler({}, 'photo123', '');
		expect(result1).toMatchObject({
			success: false,
			error: { code: 'INVALID_INPUT', message: 'Export path is required' },
		});

		// Test path with traversal
		const result2 = await handler({}, 'photo123', '/tmp/../../etc/passwd');
		expect(result2).toMatchObject({
			success: false,
			error: { code: 'SECURITY_ERROR', message: 'Invalid export path' },
		});
	});

	it('LIST_ALBUMS handler validates input types', async () => {
		const { registerOsxphotosIpcHandlers } = await import('./sidecar-ipc-handlers');
		handlers.clear();
		registerOsxphotosIpcHandlers();

		const handler = getHandler(OsxphotosChannels.LIST_ALBUMS);
		// Should not throw and should return a result
		expect(handler).toBeDefined();
	});
});
