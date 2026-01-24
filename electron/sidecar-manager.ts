/**
 * SidecarManager - Manages Python FastAPI sidecar lifecycle
 *
 * Responsibilities:
 * - Spawn Python uvicorn process on-demand
 * - Monitor health with polling and auto-restart
 * - Graceful shutdown with SIGTERM/SIGKILL escalation
 * - Emit events for UI feedback
 */

import { EventEmitter } from 'node:events';
import path from 'node:path';
import type { Readable } from 'node:stream';
import { type ChildProcess, spawn } from 'child_process';
import { app, BrowserWindow, ipcMain } from 'electron';

interface HealthCheckConfig {
	interval: number; // ms between health checks
	timeout: number; // ms for health check request timeout
	maxRetries: number; // failed checks before restart
	maxRestarts: number; // max restart attempts before circuit breaker
	backoffMultiplier: number; // exponential backoff multiplier
	maxBackoff: number; // ms max backoff time
	healthyThreshold: number; // ms of healthy status to reset retry counter
}

interface SidecarEvent {
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

export class SidecarManager extends EventEmitter {
	private process: ChildProcess | null = null;
	private port: number = 8765;
	private readonly host: string = '127.0.0.1';
	private healthCheckTimer: NodeJS.Timer | null = null;
	private restartCount: number = 0;
	private failureCount: number = 0;
	private currentBackoff: number = 1000;
	private lastHealthyTime: number = 0;
	private isShuttingDown: boolean = false;

	private readonly config: HealthCheckConfig = {
		interval: 5000,
		timeout: 2000,
		maxRetries: 3,
		maxRestarts: 5,
		backoffMultiplier: 2.0,
		maxBackoff: 60000,
		healthyThreshold: 60000,
	};

	constructor(customConfig?: Partial<HealthCheckConfig>) {
		super();
		if (customConfig) {
			this.config = { ...this.config, ...customConfig };
		}
		this.setupAppHooks();
	}

	/**
	 * Start the sidecar process (on-demand)
	 */
	async start(): Promise<void> {
		if (this.process && !this.isProcessDead()) {
			return; // Already running
		}

		try {
			const pythonPath = this.getPythonPath();
			const pythonDir = path.join(app.getAppPath(), 'python');

			console.log(`[SidecarManager] Starting sidecar: ${pythonPath} -m uvicorn main:app`);

			this.process = spawn(
				pythonPath,
				['-m', 'uvicorn', 'main:app', '--host', this.host, '--port', String(this.port)],
				{
					cwd: pythonDir,
					env: {
						...process.env,
						LOG_LEVEL: 'INFO',
					},
					stdio: ['ignore', 'pipe', 'pipe'],
				},
			);

			this.setupProcessHandlers();
			this.emitToRenderers({
				type: 'started',
				message: 'Sidecar process started',
				timestamp: Date.now(),
			} as SidecarEvent);
			this.restartCount = 0;
			this.currentBackoff = 1000;
			this.failureCount = 0;
			this.lastHealthyTime = Date.now();

			// Start health checks
			this.startHealthCheck();
		} catch (error) {
			const errorMsg = error instanceof Error ? error.message : String(error);
			console.error(`[SidecarManager] Failed to start sidecar: ${errorMsg}`);
			this.emitToRenderers({
				type: 'error',
				message: `Start failed: ${errorMsg}`,
				timestamp: Date.now(),
			} as SidecarEvent);
			throw error;
		}
	}

	/**
	 * Stop the sidecar process gracefully
	 */
	async stop(): Promise<void> {
		this.isShuttingDown = true;
		this.stopHealthCheck();

		if (!this.process) {
			return;
		}

		try {
			// Try graceful shutdown via API
			try {
				await this.notifyShutdown();
			} catch {
				// API unreachable, proceed to signal
			}

			// Wait for process to exit
			await this.waitForExit(5000);

			// If still alive, send SIGTERM
			if (this.process && !this.isProcessDead()) {
				console.log('[SidecarManager] Sending SIGTERM');
				this.process.kill('SIGTERM');
				await this.waitForExit(2000);
			}

			// If still alive, send SIGKILL
			if (this.process && !this.isProcessDead()) {
				console.log('[SidecarManager] Sending SIGKILL');
				this.process.kill('SIGKILL');
			}
		} catch (error) {
			console.error('[SidecarManager] Error during shutdown:', error);
		} finally {
			this.process = null;
			this.isShuttingDown = false;
			this.emitToRenderers({
				type: 'stopped',
				message: 'Sidecar stopped',
				timestamp: Date.now(),
			} as SidecarEvent);
		}
	}

	/**
	 * Ensure sidecar is running, start if needed
	 */
	async ensureRunning(): Promise<void> {
		if (!this.isRunning()) {
			await this.start();
		}
	}

	/**
	 * Check if sidecar is running
	 */
	isRunning(): boolean {
		return this.process !== null && !this.isProcessDead();
	}

	/**
	 * Get base URL for sidecar API
	 */
	getBaseUrl(): string {
		return `http://${this.host}:${this.port}`;
	}

	/**
	 * Get current sidecar status
	 */
	getStatus(): {
		running: boolean;
		port: number;
		restartCount: number;
		failureCount: number;
		circuitBreakerOpen: boolean;
	} {
		return {
			running: this.isRunning(),
			port: this.port,
			restartCount: this.restartCount,
			failureCount: this.failureCount,
			circuitBreakerOpen: this.restartCount >= this.config.maxRestarts,
		};
	}

	/**
	 * Emit event to all renderer windows
	 */
	private emitToRenderers(event: SidecarEvent): void {
		BrowserWindow.getAllWindows().forEach((window) => {
			window.webContents.send('sidecar:event', event);
		});
	}

	// Private methods

	private setupAppHooks(): void {
		app.on('before-quit', async () => {
			console.log('[SidecarManager] App before-quit hook');
			await this.stop();
		});

		process.on('SIGINT', async () => {
			console.log('[SidecarManager] SIGINT received');
			await this.stop();
		});

		process.on('SIGTERM', async () => {
			console.log('[SidecarManager] SIGTERM received');
			await this.stop();
		});
	}

	private setupProcessHandlers(): void {
		if (!this.process) return;

		const stdout = this.process.stdout as Readable;
		const stderr = this.process.stderr as Readable;

		stdout.on('data', (data) => {
			console.log(`[Sidecar stdout] ${data}`);
		});

		stderr.on('data', (data) => {
			console.error(`[Sidecar stderr] ${data}`);
		});

		this.process.on('exit', (code) => {
			console.warn(`[SidecarManager] Sidecar process exited with code ${code}`);
			if (!this.isShuttingDown) {
				this.handleUnexpectedExit();
			}
		});

		this.process.on('error', (error) => {
			console.error(`[SidecarManager] Process error: ${error.message}`);
			this.emitToRenderers({
				type: 'error',
				message: `Process error: ${error.message}`,
				timestamp: Date.now(),
			} as SidecarEvent);
		});
	}

	private startHealthCheck(): void {
		this.stopHealthCheck();

		this.healthCheckTimer = setInterval(() => {
			this.performHealthCheck().catch((error) => {
				console.error('[SidecarManager] Health check error:', error);
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
			const controller = new AbortController();
			const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

			const response = await fetch(`${this.getBaseUrl()}/health`, {
				signal: controller.signal,
			});

			clearTimeout(timeoutId);

			if (response.ok) {
				this.handleHealthy();
			} else {
				this.handleUnhealthy();
			}
		} catch (error) {
			this.handleUnhealthy();
		}
	}

	private handleHealthy(): void {
		this.failureCount = 0;
		this.lastHealthyTime = Date.now();
		this.emitToRenderers({
			type: 'healthy',
			message: 'Sidecar is healthy',
			timestamp: Date.now(),
		} as SidecarEvent);
	}

	private handleUnhealthy(): void {
		this.failureCount++;
		this.emitToRenderers({
			type: 'unhealthy',
			message: `Sidecar unhealthy (${this.failureCount}/${this.config.maxRetries})`,
			timestamp: Date.now(),
		} as SidecarEvent);

		if (this.failureCount >= this.config.maxRetries) {
			this.handleHealthCheckFailure();
		}
	}

	private async handleHealthCheckFailure(): Promise<void> {
		this.failureCount = 0;

		if (this.restartCount >= this.config.maxRestarts) {
			console.error('[SidecarManager] Circuit breaker open - max restarts exceeded');
			this.emitToRenderers({
				type: 'circuit-breaker-open',
				message: 'Circuit breaker open - max restarts exceeded',
				timestamp: Date.now(),
			} as SidecarEvent);
			this.stopHealthCheck();
			return;
		}

		this.restartCount++;
		this.emitToRenderers({
			type: 'restarting',
			message: `Restarting sidecar (attempt ${this.restartCount}/${this.config.maxRestarts})`,
			timestamp: Date.now(),
		} as SidecarEvent);

		await this.restart();

		// Apply exponential backoff
		this.currentBackoff = Math.min(
			this.currentBackoff * this.config.backoffMultiplier,
			this.config.maxBackoff,
		);
	}

	private async handleUnexpectedExit(): Promise<void> {
		console.warn('[SidecarManager] Sidecar crashed unexpectedly');
		this.process = null;

		if (this.restartCount < this.config.maxRestarts) {
			this.restartCount++;
			setTimeout(() => {
				this.start().catch((error) => {
					console.error('[SidecarManager] Failed to restart after crash:', error);
				});
			}, this.currentBackoff);
		}
	}

	private async restart(): Promise<void> {
		await this.stop();
		await new Promise((resolve) => setTimeout(resolve, this.currentBackoff));
		await this.start();
	}

	private async notifyShutdown(): Promise<void> {
		const controller = new AbortController();
		const timeoutId = setTimeout(() => controller.abort(), 2000);

		try {
			const response = await fetch(`${this.getBaseUrl()}/shutdown`, {
				method: 'POST',
				signal: controller.signal,
			});
			clearTimeout(timeoutId);
			return;
		} catch (error) {
			clearTimeout(timeoutId);
			throw error;
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
		if (app.isPackaged) {
			// Production: use bundled Python executable
			const sidecarPath = path.join(process.resourcesPath, 'sidecar', 'cagent-sidecar');
			return sidecarPath;
		} else {
			// Development: use system Python
			return process.platform === 'win32' ? 'python' : 'python3';
		}
	}
}

// Export singleton instance
export const sidecarManager = new SidecarManager();
