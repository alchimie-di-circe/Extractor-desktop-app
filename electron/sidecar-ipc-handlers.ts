/**
 * IPC Handlers for Sidecar and Osxphotos Management
 *
 * Exposes sidecar and osxphotos lifecycle control to renderer process
 */

import { EventEmitter } from 'node:events';
import { existsSync } from 'node:fs';
import { createConnection, type Socket } from 'node:net';
import { homedir } from 'node:os';
import path from 'node:path';
import type { Readable } from 'node:stream';
import { type ChildProcess, spawn } from 'child_process';
import { app, BrowserWindow, ipcMain } from 'electron';
import { OsxphotosChannels, SidecarReloadChannels } from '../shared/ipc-channels';
import { sidecarManager } from './sidecar-manager';
import { sidecarReloadManager } from './sidecar-reload';

// ============================================================================
// Osxphotos Supervisor - Manages sandboxed osxphotos process lifecycle
// ============================================================================

interface JsonRpcRequest {
	jsonrpc: '2.0';
	method: string;
	params?: Record<string, unknown> | unknown[];
	id?: string | number | null;
}

interface JsonRpcResponse {
	jsonrpc: '2.0';
	id?: string | number | null;
	result?: unknown;
	error?: {
		code: number;
		message: string;
		data?: unknown;
	};
}

interface OsxphotosEvent {
	type:
		| 'started'
		| 'stopped'
		| 'healthy'
		| 'unhealthy'
		| 'restarting'
		| 'circuit-breaker-open'
		| 'error';
	message: string;
	timestamp: number;
}

interface HealthCheckConfig {
	interval: number;
	timeout: number;
	maxRetries: number;
	maxCrashes: number;
	crashWindowMs: number;
	backoffMultiplier: number;
	maxBackoff: number;
}

export class OsxphotosSupervisor extends EventEmitter {
	private process: ChildProcess | null = null;
	private socketPath: string = path.join(
		app.getPath('temp'),
		`trae-osxphotos-${process.platform === 'win32' ? process.pid : (process.getuid?.() ?? process.pid)}.sock`,
	);
	private socket: Socket | null = null;
	private healthCheckTimer: NodeJS.Timer | null = null;
	private crashTimestamps: number[] = [];
	private failureCount: number = 0;
	private currentBackoff: number = 1000;
	private lastHealthyTime: number = 0;
	private isShuttingDown: boolean = false;
	private isAppQuitting: boolean = false;
	private jsonRpcId: number = 0;
	private pendingRequests = new Map<
		number | string,
		{ resolve: Function; reject: Function; timeout: NodeJS.Timeout }
	>();

	private config: HealthCheckConfig = {
		interval: 5000,
		timeout: 2000,
		maxRetries: 3,
		maxCrashes: 3,
		crashWindowMs: 5 * 60 * 1000,
		backoffMultiplier: 2.0,
		maxBackoff: 60000,
	};

	constructor(customConfig?: Partial<HealthCheckConfig>) {
		super();
		if (customConfig) {
			this.config = { ...this.config, ...customConfig };
		}
		this.setupAppHooks();
	}

	async start(): Promise<void> {
		if (this.process && !this.isProcessDead()) {
			return;
		}

		try {
			const pythonPath = this.getPythonPath();
			const pythonDir = path.join(app.getAppPath(), 'python');

			console.log(`[Osxphotos] Starting osxphotos server`);

			// Security: Filter environment variables passed to sandboxed child process
			// Only pass essential variables, blocking API keys and sensitive credentials
			const safeEnv: Record<string, string> = {};
			const allowedVars = ['PATH', 'HOME', 'USER', 'LANG'];
			for (const key of allowedVars) {
				if (process.env[key]) {
					safeEnv[key] = process.env[key];
				}
			}

			this.process = spawn(pythonPath, ['sandboxed/server.py'], {
				cwd: pythonDir,
				env: {
					...safeEnv,
					LOG_LEVEL: 'INFO',
					PYTHONUNBUFFERED: '1',
				},
				stdio: ['ignore', 'pipe', 'pipe'],
			});

			this.setupProcessHandlers();
			this.emitToRenderers({
				type: 'started',
				message: 'Osxphotos process started',
				timestamp: Date.now(),
			});
			this.failureCount = 0;
			this.lastHealthyTime = Date.now();

			await new Promise((resolve) => setTimeout(resolve, 500));
			this.startHealthCheck();
		} catch (error) {
			const errorMsg = error instanceof Error ? error.message : String(error);
			console.error(`[Osxphotos] Failed to start: ${errorMsg}`);
			this.emitToRenderers({
				type: 'error',
				message: `Start failed: ${errorMsg}`,
				timestamp: Date.now(),
			});
			throw error;
		}
	}

	async startFresh(): Promise<void> {
		this.crashTimestamps = [];
		this.currentBackoff = 1000;
		await this.start();
	}

	async stop(): Promise<void> {
		this.isShuttingDown = true;
		this.stopHealthCheck();
		this.closeSocket();

		if (!this.process) {
			return;
		}

		try {
			if (this.process && !this.isProcessDead()) {
				console.log('[Osxphotos] Sending SIGTERM');
				this.process.kill('SIGTERM');
				await this.waitForExit(2000);
			}

			if (this.process && !this.isProcessDead()) {
				console.log('[Osxphotos] Sending SIGKILL');
				this.process.kill('SIGKILL');
			}
		} catch (error) {
			console.error('[Osxphotos] Error during shutdown:', error);
		} finally {
			// Reject and clear pending requests so callers aren't left hanging
			for (const { reject, timeout } of this.pendingRequests.values()) {
				clearTimeout(timeout);
				reject(new Error('Osxphotos process stopped'));
			}
			this.pendingRequests.clear();

			this.process = null;
			// Don't reset isShuttingDown if app is quitting (prevents restart during quit)
			if (!this.isAppQuitting) {
				this.isShuttingDown = false;
			}
			this.emitToRenderers({
				type: 'stopped',
				message: 'Osxphotos stopped',
				timestamp: Date.now(),
			});
		}
	}

	async ensureRunning(): Promise<void> {
		if (!this.isRunning()) {
			await this.start();
		}
	}

	isRunning(): boolean {
		return this.process !== null && !this.isProcessDead();
	}

	getSocketPath(): string {
		return this.socketPath;
	}

	async sendJsonRpc<T = unknown>(
		method: string,
		params: Record<string, unknown> | unknown[] = {},
		timeoutMs?: number,
	): Promise<T> {
		if (!this.isRunning() || this.isShuttingDown) {
			throw new Error('Osxphotos is not running');
		}

		// Use custom timeout if provided, otherwise default to 30 seconds
		// Health checks use config.timeout (2s), long-running ops use higher values
		const requestTimeout = timeoutMs ?? 30_000;

		const id = ++this.jsonRpcId;
		const request: JsonRpcRequest = {
			jsonrpc: '2.0',
			method,
			params,
			id,
		};

		return new Promise<T>((resolve, reject) => {
			const timeout = setTimeout(() => {
				this.pendingRequests.delete(id);
				reject(new Error(`JSON-RPC request timeout for ${method}`));
			}, requestTimeout);

			this.pendingRequests.set(id, { resolve, reject, timeout });

			(async () => {
				try {
					await this.sendRequest(request);
				} catch (error) {
					this.pendingRequests.delete(id);
					clearTimeout(timeout);
					reject(error);
				}
			})();
		});
	}

	getStatus(): {
		running: boolean;
		socketPath: string;
		failureCount: number;
		recentCrashes: number;
		circuitBreakerOpen: boolean;
	} {
		const now = Date.now();
		const recentCrashes = this.crashTimestamps.filter(
			(ts) => now - ts < this.config.crashWindowMs,
		).length;

		return {
			running: this.isRunning(),
			socketPath: this.socketPath,
			failureCount: this.failureCount,
			recentCrashes,
			circuitBreakerOpen: recentCrashes >= this.config.maxCrashes,
		};
	}

	private emitToRenderers(event: OsxphotosEvent): void {
		BrowserWindow.getAllWindows().forEach((window) => {
			window.webContents.send('osxphotos:event', event);
		});
	}

	private setupAppHooks(): void {
		app.on('before-quit', async () => {
			console.log('[Osxphotos] App before-quit hook');
			this.isAppQuitting = true;
			await this.stop().catch((e) => {
				console.error('[Osxphotos] Error during app quit:', e);
			});
		});

		process.once('SIGINT', async () => {
			console.log('[Osxphotos] SIGINT received');
			await this.stop().catch((e) => {
				console.error('[Osxphotos] Error handling SIGINT:', e);
			});
		});

		process.once('SIGTERM', async () => {
			console.log('[Osxphotos] SIGTERM received');
			await this.stop().catch((e) => {
				console.error('[Osxphotos] Error handling SIGTERM:', e);
			});
		});
	}

	private setupProcessHandlers(): void {
		if (!this.process) return;

		const stdout = this.process.stdout as Readable;
		const stderr = this.process.stderr as Readable;

		stdout.on('data', (data) => {
			console.log(`[Osxphotos stdout] ${data}`);
		});

		stderr.on('data', (data) => {
			console.error(`[Osxphotos stderr] ${data}`);
		});

		this.process.on('exit', (code) => {
			console.warn(`[Osxphotos] Process exited with code ${code}`);
			if (!this.isShuttingDown) {
				this.handleUnexpectedExit();
			}
		});

		this.process.on('error', (error) => {
			console.error(`[Osxphotos] Process error: ${error.message}`);
			this.emitToRenderers({
				type: 'error',
				message: `Process error: ${error.message}`,
				timestamp: Date.now(),
			});
		});
	}

	private startHealthCheck(): void {
		this.stopHealthCheck();

		this.healthCheckTimer = setInterval(() => {
			this.performHealthCheck().catch((error) => {
				console.error('[Osxphotos] Health check error:', error);
			});
		}, this.config.interval);
	}

	private stopHealthCheck(): void {
		if (this.healthCheckTimer) {
			clearInterval(this.healthCheckTimer);
			this.healthCheckTimer = null;
		}
	}

	private async performHealthCheck(): Promise<void> {
		if (!this.isRunning()) {
			return;
		}

		try {
			await this.sendJsonRpc('ping', {}, this.config.timeout);
			this.handleHealthy();
		} catch (error) {
			this.handleUnhealthy();
		}
	}

	private handleHealthy(): void {
		this.failureCount = 0;
		this.currentBackoff = 1000;
		this.lastHealthyTime = Date.now();
		this.emitToRenderers({
			type: 'healthy',
			message: 'Osxphotos is healthy',
			timestamp: Date.now(),
		});
	}

	private handleUnhealthy(): void {
		if (this.isShuttingDown) {
			return;
		}

		this.failureCount++;
		this.emitToRenderers({
			type: 'unhealthy',
			message: `Osxphotos unhealthy (${this.failureCount}/${this.config.maxRetries})`,
			timestamp: Date.now(),
		});

		if (this.failureCount >= this.config.maxRetries) {
			this.handleHealthCheckFailure().catch((error) => {
				console.error('[Osxphotos] Error handling health check failure:', error);
			});
		}
	}

	private async handleHealthCheckFailure(): Promise<void> {
		if (this.isShuttingDown) {
			return;
		}

		this.failureCount = 0;

		// Record this failure and prune stale timestamps
		this.crashTimestamps.push(Date.now());
		const now = Date.now();
		this.crashTimestamps = this.crashTimestamps.filter(
			(ts) => now - ts < this.config.crashWindowMs,
		);

		const recentCrashes = this.crashTimestamps.length;

		if (recentCrashes >= this.config.maxCrashes) {
			console.error('[Osxphotos] Circuit breaker open - max crashes in window exceeded');
			this.emitToRenderers({
				type: 'circuit-breaker-open',
				message: `Circuit breaker open - ${recentCrashes} crashes in ${this.config.crashWindowMs / 1000}s`,
				timestamp: Date.now(),
			});
			this.stopHealthCheck();
			return;
		}

		this.emitToRenderers({
			type: 'restarting',
			message: 'Restarting osxphotos...',
			timestamp: Date.now(),
		});

		await this.restart();

		this.currentBackoff = Math.min(
			this.currentBackoff * this.config.backoffMultiplier,
			this.config.maxBackoff,
		);
	}

	private async handleUnexpectedExit(): Promise<void> {
		console.warn('[Osxphotos] Process crashed unexpectedly');
		this.process = null;
		this.closeSocket();
		this.crashTimestamps.push(Date.now());

		const now = Date.now();
		this.crashTimestamps = this.crashTimestamps.filter(
			(ts) => now - ts < this.config.crashWindowMs,
		);

		if (this.crashTimestamps.length < this.config.maxCrashes) {
			setTimeout(() => {
				if (!this.isShuttingDown) {
					this.start().catch((error) => {
						console.error('[Osxphotos] Failed to restart after crash:', error);
					});
				}
			}, this.currentBackoff);

			this.currentBackoff = Math.min(
				this.currentBackoff * this.config.backoffMultiplier,
				this.config.maxBackoff,
			);
		}
	}

	private async restart(): Promise<void> {
		await this.stop();
		await new Promise((resolve) => setTimeout(resolve, this.currentBackoff));
		await this.start();
	}

	private async sendRequest(request: JsonRpcRequest): Promise<void> {
		try {
			if (!this.socket || !this.socket.writable) {
				this.socket = createConnection(this.socketPath);
				this.setupSocketHandlers();

				// Wait for connection to be established before writing
				await new Promise<void>((resolve, reject) => {
					const socket = this.socket!;

					const onConnect = () => {
						clearTimeout(timeout);
						cleanup();
						resolve();
					};

					const onError = (error: Error) => {
						clearTimeout(timeout);
						cleanup();
						reject(error);
					};

					const cleanup = () => {
						socket.removeListener('connect', onConnect);
						socket.removeListener('error', onError);
					};

					const timeout = setTimeout(() => {
						cleanup();
						this.closeSocket();
						reject(new Error('Socket connection timeout'));
					}, 5000);

					socket.once('connect', onConnect);
					socket.once('error', onError);
				});
			}

			const json = JSON.stringify(request);
			const length = Buffer.byteLength(json);
			const lengthBuffer = Buffer.alloc(4);
			lengthBuffer.writeUInt32BE(length, 0);

			const payload = Buffer.concat([lengthBuffer, Buffer.from(json)]);
			const wrote = this.socket.write(payload);
			if (!wrote) {
				await new Promise<void>((resolve, reject) => {
					const onDrain = () => {
						this.socket?.removeListener('close', onClose);
						resolve();
					};
					const onClose = () => {
						this.socket?.removeListener('drain', onDrain);
						reject(new Error('Socket closed before drain'));
					};
					this.socket!.once('drain', onDrain);
					this.socket!.once('close', onClose);
				});
			}
		} catch (error) {
			console.error('[Osxphotos] Error sending request:', error);
			this.closeSocket();
			throw error;
		}
	}

	private setupSocketHandlers(): void {
		if (!this.socket) return;

		const MAX_MESSAGE_SIZE = 1_048_576; // 1 MB
		let buffer = Buffer.alloc(0);
		let targetLength = 0;

		this.socket.on('data', (data) => {
			buffer = Buffer.concat([buffer, data]);

			while (buffer.length > 0) {
				if (targetLength === 0) {
					if (buffer.length < 4) {
						break;
					}
					targetLength = buffer.readUInt32BE(0);
					buffer = buffer.slice(4);

					if (targetLength <= 0 || targetLength > MAX_MESSAGE_SIZE) {
						console.error(
							`[Osxphotos] Invalid message length: ${targetLength} (max: ${MAX_MESSAGE_SIZE})`,
						);
						this.closeSocket();
						buffer = Buffer.alloc(0);
						targetLength = 0;
						return;
					}
				}

				if (buffer.length >= targetLength) {
					try {
						const messageJson = buffer.toString('utf-8', 0, targetLength);
						const response: JsonRpcResponse = JSON.parse(messageJson);
						this.handleJsonRpcResponse(response);
						buffer = buffer.slice(targetLength);
						targetLength = 0;
					} catch (error) {
						console.error('[Osxphotos] Error parsing JSON-RPC response:', error);
						this.closeSocket();
						buffer = Buffer.alloc(0);
						targetLength = 0;
						return;
					}
				} else {
					break;
				}
			}
		});

		this.socket.on('error', (error) => {
			console.error('[Osxphotos] Socket error:', error);
			const message = error instanceof Error ? error.message : String(error);
			this.rejectAllPendingRequests(new Error(`Socket error: ${message}`));
			this.closeSocket();
		});

		this.socket.on('close', () => {
			console.log('[Osxphotos] Socket closed');
			this.rejectAllPendingRequests(new Error('Socket closed'));
			this.closeSocket();
		});
	}

	private handleJsonRpcResponse(response: JsonRpcResponse): void {
		const id = response.id;
		if (id === null || id === undefined) {
			return;
		}

		const pending = this.pendingRequests.get(id);
		if (!pending) {
			console.warn('[Osxphotos] Unexpected response ID:', id);
			return;
		}

		this.pendingRequests.delete(id);
		clearTimeout(pending.timeout);

		if (response.error) {
			pending.reject(
				new Error(`JSON-RPC error (${response.error.code}): ${response.error.message}`),
			);
		} else {
			pending.resolve(response.result);
		}
	}

	private rejectAllPendingRequests(error: Error): void {
		for (const { reject, timeout } of this.pendingRequests.values()) {
			clearTimeout(timeout);
			reject(error);
		}
		this.pendingRequests.clear();
	}

	private closeSocket(): void {
		if (this.socket) {
			this.socket.destroy();
			this.socket = null;
		}
	}

	private async waitForExit(timeoutMs: number): Promise<boolean> {
		const startTime = Date.now();

		return new Promise((resolve) => {
			const checkInterval = setInterval(() => {
				if (this.isProcessDead() || Date.now() - startTime > timeoutMs) {
					clearInterval(checkInterval);
					resolve(this.isProcessDead());
				}
			}, 100);
		});
	}

	private isProcessDead(): boolean {
		return this.process === null || this.process.killed || this.process.exitCode !== null;
	}

	private getPythonPath(): string {
		const fallbackPython = process.platform === 'win32' ? 'python' : 'python3';

		if (!app.isPackaged) {
			return fallbackPython;
		}

		const bundledInterpreterCandidates = [
			path.join(process.resourcesPath, 'sidecar', 'python3'),
			path.join(process.resourcesPath, 'sidecar', 'python'),
			path.join(process.resourcesPath, 'sidecar', 'python.exe'),
		];

		const bundledPython = bundledInterpreterCandidates.find((candidate) => existsSync(candidate));
		if (bundledPython) {
			console.log(`[Osxphotos] Using bundled Python at ${bundledPython}`);
			return bundledPython;
		}

		console.warn(
			`[Osxphotos] Bundled Python interpreter not found in sidecar resources, falling back to ${fallbackPython}`,
		);
		return fallbackPython;
	}
}

export const osxphotosSupervisor = new OsxphotosSupervisor();

export function registerSidecarIpcHandlers(): void {
	/**
	 * Start the sidecar process on-demand
	 */
	ipcMain.handle('sidecar:start', async () => {
		try {
			await sidecarManager.start();
			return { success: true, baseUrl: sidecarManager.getBaseUrl() };
		} catch (error) {
			console.error('sidecar:start error:', error);
			const message = error instanceof Error ? error.message : String(error);
			return { success: false, error: message };
		}
	});

	/**
	 * Stop the sidecar process
	 */
	ipcMain.handle('sidecar:stop', async () => {
		try {
			await sidecarManager.stop();
			return { success: true };
		} catch (error) {
			console.error('sidecar:stop error:', error);
			const message = error instanceof Error ? error.message : String(error);
			return { success: false, error: message };
		}
	});

	/**
	 * Ensure sidecar is running (start if needed)
	 */
	ipcMain.handle('sidecar:ensure-running', async () => {
		try {
			await sidecarManager.ensureRunning();
			return { success: true, baseUrl: sidecarManager.getBaseUrl() };
		} catch (error) {
			console.error('sidecar:ensure-running error:', error);
			const message = error instanceof Error ? error.message : String(error);
			return { success: false, error: message };
		}
	});

	/**
	 * Get current sidecar status
	 */
	ipcMain.handle('sidecar:status', () => {
		return sidecarManager.getStatus();
	});

	/**
	 * Get sidecar base URL
	 */
	ipcMain.handle('sidecar:get-base-url', () => {
		return sidecarManager.getBaseUrl();
	});

	/**
	 * Check if sidecar is running
	 */
	ipcMain.handle('sidecar:is-running', () => {
		return sidecarManager.isRunning();
	});

	/**
	 * Get sidecar reload status
	 */
	ipcMain.handle(SidecarReloadChannels.STATUS, () => {
		return sidecarReloadManager.getStatus();
	});

	/**
	 * Force reload sidecar (manual trigger from UI)
	 */
	ipcMain.handle(SidecarReloadChannels.FORCE_RELOAD, async () => {
		try {
			const success = await sidecarReloadManager.forceReload();
			return { success };
		} catch (error) {
			console.error('sidecar:force-reload error:', error);
			const message = error instanceof Error ? error.message : String(error);
			return { success: false, error: message };
		}
	});
}

/**
 * Register IPC handlers for osxphotos supervisor
 */
export function registerOsxphotosIpcHandlers(): void {
	/**
	 * List albums from Photos library
	 */
	ipcMain.handle(OsxphotosChannels.LIST_ALBUMS, async () => {
		try {
			await osxphotosSupervisor.ensureRunning();
			const result = await osxphotosSupervisor.sendJsonRpc<{
				albums: Array<{ id: string; name: string; count: number }>;
			}>('list_albums');
			return { success: true, data: result };
		} catch (error) {
			console.error('osxphotos:list-albums error:', error);
			const message = error instanceof Error ? error.message : String(error);
			return {
				success: false,
				error: { code: 'OSXPHOTOS_ERROR', message },
			};
		}
	});

	/**
	 * Get photos from specified album
	 */
	ipcMain.handle(OsxphotosChannels.GET_PHOTOS, async (_event, albumId: string, limit?: number) => {
		try {
			if (typeof albumId !== 'string' || !albumId) {
				return {
					success: false,
					error: { code: 'INVALID_INPUT', message: 'Album ID is required' },
				};
			}

			// Validate limit parameter when provided
			if (limit !== undefined && (typeof limit !== 'number' || limit <= 0)) {
				return {
					success: false,
					error: { code: 'INVALID_INPUT', message: 'Limit must be a positive number' },
				};
			}

			await osxphotosSupervisor.ensureRunning();
			const params = limit !== undefined ? { album_id: albumId, limit } : { album_id: albumId };
			const result = await osxphotosSupervisor.sendJsonRpc<{
				album_id: string;
				photos: Array<{ id: string; filename: string; width: number; height: number }>;
			}>('get_photos', params);
			return { success: true, data: result };
		} catch (error) {
			console.error('osxphotos:get-photos error:', error);
			const message = error instanceof Error ? error.message : String(error);
			return {
				success: false,
				error: { code: 'OSXPHOTOS_ERROR', message },
			};
		}
	});

	/**
	 * Export photo to specified path
	 */
	ipcMain.handle(
		OsxphotosChannels.EXPORT_PHOTO,
		async (_event, photoId: string, exportPath: string) => {
			try {
				if (typeof photoId !== 'string' || !photoId) {
					return {
						success: false,
						error: { code: 'INVALID_INPUT', message: 'Photo ID is required' },
					};
				}

				if (typeof exportPath !== 'string' || !exportPath) {
					return {
						success: false,
						error: { code: 'INVALID_INPUT', message: 'Export path is required' },
					};
				}

				// Validate export path (both sides validate - defense in depth)
				// Check for null bytes
				if (exportPath.includes('\0')) {
					return {
						success: false,
						error: { code: 'SECURITY_ERROR', message: 'Invalid export path' },
					};
				}

				const rawSegments = exportPath.split(/[/\\]+/);
				if (rawSegments.some((segment) => segment === '..')) {
					return {
						success: false,
						error: { code: 'SECURITY_ERROR', message: 'Invalid export path' },
					};
				}

				// SECURITY 1a: Path whitelist validation
				// Accept absolute paths but validate they are within allowed directories
				const homeDir = homedir();
				const allowedDirs = [
					path.join(homeDir, 'Exports'),
					path.join(homeDir, 'Documents', 'TraeExports'),
				];
				const normalizedPath = path.resolve(exportPath);
				const isAllowed = allowedDirs.some((dir) => {
					const rel = path.relative(dir, normalizedPath);
					return (
						rel === '' ||
						(!rel.startsWith('..' + path.sep) && rel !== '..' && !path.isAbsolute(rel))
					);
				});

				if (!isAllowed) {
					return {
						success: false,
						error: {
							code: 'SECURITY_ERROR',
							message: `Export path must be within ${allowedDirs.join(' or ')}`,
						},
					};
				}

				await osxphotosSupervisor.ensureRunning();
				// Use 60s timeout for export_photo as it may be I/O intensive
				const result = await osxphotosSupervisor.sendJsonRpc<{
					success: boolean;
					path: string;
				}>(
					'export_photo',
					{
						photo_id: photoId,
						export_path: normalizedPath,
					},
					60_000,
				);
				return { success: true, data: result };
			} catch (error) {
				console.error('osxphotos:export-photo error:', error);
				const message = error instanceof Error ? error.message : String(error);

				// Map error messages to user-friendly codes
				if (message.includes('permission') || message.includes('Permission')) {
					return {
						success: false,
						error: {
							code: 'PERMISSION_ERROR',
							message: 'Grant Full Disk Access in System Preferences > Security & Privacy',
						},
					};
				}

				return {
					success: false,
					error: { code: 'OSXPHOTOS_ERROR', message },
				};
			}
		},
	);
}
