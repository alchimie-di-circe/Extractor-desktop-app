/**
 * Sidecar Hot-Reload Manager
 *
 * Monitors python/team.yaml for changes and triggers sidecar reload.
 * Implements graceful shutdown, debouncing, and error handling.
 */

import { EventEmitter } from 'node:events';
import path from 'node:path';
import { type FSWatcher, watch as fsWatch } from 'chokidar';
import { app, BrowserWindow } from 'electron';
import { sidecarManager } from './sidecar-manager';

interface ReloadEvent {
	type: 'reload-started' | 'reload-completed' | 'reload-failed' | 'watch-error';
	timestamp: number;
	message: string;
	yamlMtime?: number;
	error?: string;
}

interface ReloadStatus {
	isWatching: boolean;
	lastReload: number | null;
	lastYamlMtime: number | null;
	reloadCount: number;
	isReloading: boolean;
	sidecarPid: number | null;
}

export class SidecarReloadManager extends EventEmitter {
	private watcher: FSWatcher | null = null;
	private teamYamlPath: string = '';
	private debounceTimer: NodeJS.Timeout | null = null;
	private debounceDelay: number = 500; // ms - debounce file changes
	private lastReloadTime: number = 0;
	private lastYamlMtime: number | null = null;
	private reloadCount: number = 0;
	private isReloading: boolean = false;
	private readonly gracefulShutdownTimeout: number = 3000; // ms
	private readonly minReloadInterval: number = 2000; // ms - prevent rapid successive reloads

	constructor() {
		super();
		this.setupAppHooks();
	}

	/**
	 * Start watching team.yaml for changes
	 */
	startWatching(): void {
		if (this.watcher) {
			console.log('[SidecarReloadManager] Watcher already started');
			return;
		}

		try {
			this.teamYamlPath = path.join(app.getAppPath(), 'python', 'team.yaml');
			console.log(`[SidecarReloadManager] Starting watch on ${this.teamYamlPath}`);

			this.watcher = fsWatch(this.teamYamlPath, {
				// Chokidar options
				ignored: /(^|[/\\])\../, // Ignore dotfiles
				persistent: true,
				awaitWriteFinish: {
					stabilityThreshold: 100, // Wait 100ms for write to stabilize
					pollInterval: 100,
				},
				ignoreInitial: true, // Don't trigger on startup
				usePolling: false, // Use fs native watchers
				alwaysStat: true, // Always stat files to get mtime
			});

			this.watcher.on('change', (_path, stats) => {
				this.handleFileChange(stats?.mtimeMs);
			});

			this.watcher.on('error', (error) => {
				this.handleWatchError(error);
			});

			console.log('[SidecarReloadManager] Watch started successfully');
		} catch (error) {
			const errorMsg = error instanceof Error ? error.message : String(error);
			console.error(`[SidecarReloadManager] Failed to start watch: ${errorMsg}`);
			this.emitEvent({
				type: 'watch-error',
				message: `Failed to start file watcher: ${errorMsg}`,
				timestamp: Date.now(),
				error: errorMsg,
			});
		}
	}

	/**
	 * Stop watching team.yaml
	 */
	async stopWatching(): Promise<void> {
		if (!this.watcher) {
			return;
		}

		try {
			// Clear any pending debounce
			if (this.debounceTimer) {
				clearTimeout(this.debounceTimer);
				this.debounceTimer = null;
			}

			await this.watcher.close();
			this.watcher = null;
			console.log('[SidecarReloadManager] Watch stopped');
		} catch (error) {
			console.error('[SidecarReloadManager] Error stopping watch:', error);
		}
	}

	/**
	 * Force reload sidecar (manual trigger from UI)
	 */
	async forceReload(): Promise<boolean> {
		console.log('[SidecarReloadManager] Force reload triggered');
		return this.reloadSidecar('manual-trigger');
	}

	/**
	 * Get current reload status
	 */
	getStatus(): ReloadStatus {
		return {
			isWatching: this.watcher !== null,
			lastReload: this.lastReloadTime > 0 ? this.lastReloadTime : null,
			lastYamlMtime: this.lastYamlMtime,
			reloadCount: this.reloadCount,
			isReloading: this.isReloading,
			sidecarPid: sidecarManager.isRunning()
				? ((sidecarManager as any).process?.pid ?? null)
				: null,
		};
	}

	/**
	 * Private methods
	 */

	private handleFileChange(mtime?: number): void {
		// Ignore if we've reloaded recently (debounce)
		const timeSinceLastReload = Date.now() - this.lastReloadTime;
		if (timeSinceLastReload < this.minReloadInterval) {
			console.log('[SidecarReloadManager] Ignoring change - reload too recent');
			return;
		}

		// Debounce file changes
		if (this.debounceTimer) {
			clearTimeout(this.debounceTimer);
		}

		console.log(`[SidecarReloadManager] File change detected (mtime: ${mtime})`);

		this.debounceTimer = setTimeout(() => {
			this.reloadSidecar('file-change', mtime).catch((error) => {
				console.error('[SidecarReloadManager] Reload failed:', error);
			});
		}, this.debounceDelay);
	}

	private handleWatchError(error: Error): void {
		console.error('[SidecarReloadManager] Watch error:', error.message);
		this.emitEvent({
			type: 'watch-error',
			message: `File watch error: ${error.message}`,
			timestamp: Date.now(),
			error: error.message,
		});
	}

	private async reloadSidecar(reason: string, mtime?: number): Promise<boolean> {
		if (this.isReloading) {
			console.log('[SidecarReloadManager] Reload already in progress, ignoring');
			return false;
		}

		this.isReloading = true;
		this.lastYamlMtime = mtime ?? null;

		try {
			console.log(`[SidecarReloadManager] Starting reload (reason: ${reason})`);

			this.emitEvent({
				type: 'reload-started',
				message: `Reloading sidecar (${reason})`,
				timestamp: Date.now(),
				yamlMtime: mtime,
			});

			// 1. Stop current sidecar
			console.log('[SidecarReloadManager] Stopping current sidecar...');
			try {
				await this.gracefulStop();
			} catch (error) {
				console.warn('[SidecarReloadManager] Error during graceful stop:', error);
				// Continue anyway - we'll try to start a new one
			}

			// 2. Wait a moment before restarting
			await new Promise((resolve) => setTimeout(resolve, 500));

			// 3. Start new sidecar
			console.log('[SidecarReloadManager] Starting new sidecar...');
			await sidecarManager.start();

			this.reloadCount++;
			this.lastReloadTime = Date.now();

			console.log('[SidecarReloadManager] Reload completed successfully');
			this.emitEvent({
				type: 'reload-completed',
				message: `Sidecar reloaded successfully (${reason})`,
				timestamp: Date.now(),
				yamlMtime: mtime,
			});

			return true;
		} catch (error) {
			const errorMsg = error instanceof Error ? error.message : String(error);
			console.error('[SidecarReloadManager] Reload failed:', errorMsg);

			this.emitEvent({
				type: 'reload-failed',
				message: `Sidecar reload failed: ${errorMsg}`,
				timestamp: Date.now(),
				yamlMtime: mtime,
				error: errorMsg,
			});

			return false;
		} finally {
			this.isReloading = false;
		}
	}

	private async gracefulStop(): Promise<void> {
		if (!sidecarManager.isRunning()) {
			return;
		}

		try {
			// sidecarManager.stop() already handles graceful shutdown with timeouts and escalation.
			await sidecarManager.stop();
		} catch (error) {
			console.warn('[SidecarReloadManager] Error during sidecar stop:', error);
		}
	}

	private emitEvent(event: ReloadEvent): void {
		this.emit('reload-event', event);

		// Also emit to all renderer windows
		BrowserWindow.getAllWindows().forEach((window) => {
			window.webContents.send('sidecar:reload-event', event);
		});
	}

	private setupAppHooks(): void {
		app.on('before-quit', async () => {
			console.log('[SidecarReloadManager] App before-quit hook');
			await this.stopWatching();
		});
	}
}

// Export singleton instance
export const sidecarReloadManager = new SidecarReloadManager();
