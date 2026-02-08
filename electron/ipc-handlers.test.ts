import { EventEmitter } from 'node:events';
import { homedir } from 'node:os';
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
		on: vi.fn(),
		getPath: vi.fn(() => '/tmp'),
	},
	BrowserWindow: {
		getAllWindows: vi.fn(() => []),
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
	it('GET_PHOTOS handler rejects if albumId is invalid', async () => {
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
		const { registerOsxphotosIpcHandlers, osxphotosSupervisor } = await import(
			'./sidecar-ipc-handlers'
		);
		handlers.clear();
		registerOsxphotosIpcHandlers();

		const handler = getHandler(OsxphotosChannels.EXPORT_PHOTO);
		const ensureRunningSpy = vi.spyOn(osxphotosSupervisor, 'ensureRunning').mockResolvedValue();

		// Test empty path
		const result1 = await handler({}, 'photo123', '');
		expect(result1).toMatchObject({
			success: false,
			error: { code: 'INVALID_INPUT', message: 'Export path is required' },
		});

		// Test path with traversal in raw input (would resolve inside whitelist)
		const result2 = await handler({}, 'photo123', `${homedir()}/Exports/../Exports/file.jpg`);
		expect(result2).toMatchObject({
			success: false,
			error: { code: 'SECURITY_ERROR' },
		});
		expect((result2 as { error?: { message?: string } }).error?.message).toContain(
			'Invalid export path',
		);
		expect(ensureRunningSpy).not.toHaveBeenCalled();
		ensureRunningSpy.mockRestore();
	});

	it('OsxphotosSupervisor rejects pending requests on socket error and close', async () => {
		const { osxphotosSupervisor } = await import('./sidecar-ipc-handlers');
		const supervisor = osxphotosSupervisor as unknown as {
			socket: EventEmitter | null;
			pendingRequests: Map<
				number | string,
				{ resolve: Function; reject: Function; timeout: NodeJS.Timeout }
			>;
			setupSocketHandlers: () => void;
		};

		class FakeSocket extends EventEmitter {
			writable = true;
			destroy = vi.fn();
		}

		const clearTimeoutSpy = vi.spyOn(global, 'clearTimeout');
		const fakeSocket = new FakeSocket();

		supervisor.socket = fakeSocket;
		supervisor.pendingRequests.clear();
		supervisor.setupSocketHandlers();

		const rejectOnError = vi.fn();
		supervisor.pendingRequests.set(1, {
			resolve: vi.fn(),
			reject: rejectOnError,
			timeout: setTimeout(() => {}, 10_000),
		});

		fakeSocket.emit('error', new Error('boom'));
		expect(rejectOnError).toHaveBeenCalledTimes(1);
		expect((rejectOnError.mock.calls[0][0] as Error).message).toContain('Socket error: boom');
		expect(supervisor.pendingRequests.size).toBe(0);

		const rejectOnClose = vi.fn();
		supervisor.pendingRequests.set(2, {
			resolve: vi.fn(),
			reject: rejectOnClose,
			timeout: setTimeout(() => {}, 10_000),
		});

		fakeSocket.emit('close');
		expect(rejectOnClose).toHaveBeenCalledTimes(1);
		expect((rejectOnClose.mock.calls[0][0] as Error).message).toContain('Socket closed');
		expect(supervisor.pendingRequests.size).toBe(0);
		expect(clearTimeoutSpy).toHaveBeenCalled();

		clearTimeoutSpy.mockRestore();
		supervisor.pendingRequests.clear();
		supervisor.socket = null;
	});

	it('LIST_ALBUMS handler returns albums on success', async () => {
		const { registerOsxphotosIpcHandlers, osxphotosSupervisor } = await import(
			'./sidecar-ipc-handlers'
		);
		handlers.clear();
		registerOsxphotosIpcHandlers();

		const supervisor = osxphotosSupervisor as unknown as {
			ensureRunning: () => Promise<void>;
			sendJsonRpc: <T>(method: string, params?: unknown) => Promise<T>;
		};
		const ensureRunningSpy = vi.spyOn(supervisor, 'ensureRunning').mockResolvedValue();
		const albumsPayload = {
			albums: [{ id: 'a1', name: 'Album 1', count: 5 }],
		};
		const sendJsonRpcSpy = vi
			.spyOn(supervisor, 'sendJsonRpc')
			.mockResolvedValue(albumsPayload as never);

		const handler = getHandler(OsxphotosChannels.LIST_ALBUMS);
		const result = await handler({});

		expect(ensureRunningSpy).toHaveBeenCalledTimes(1);
		expect(sendJsonRpcSpy).toHaveBeenCalledWith('list_albums');
		expect(result).toEqual({ success: true, data: albumsPayload });

		ensureRunningSpy.mockRestore();
		sendJsonRpcSpy.mockRestore();
	});

	it('OsxphotosSupervisor does not restart on health-check failure during shutdown', async () => {
		const { osxphotosSupervisor } = await import('./sidecar-ipc-handlers');
		const supervisor = osxphotosSupervisor as unknown as {
			isShuttingDown: boolean;
			handleHealthCheckFailure: () => Promise<void>;
			restart: () => Promise<void>;
		};

		const restartSpy = vi.spyOn(supervisor, 'restart').mockResolvedValue();
		supervisor.isShuttingDown = true;

		await supervisor.handleHealthCheckFailure();

		expect(restartSpy).not.toHaveBeenCalled();

		restartSpy.mockRestore();
		supervisor.isShuttingDown = false;
	});
});
