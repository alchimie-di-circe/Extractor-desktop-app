/**
 * IPC Handlers for Sidecar Management
 *
 * Exposes sidecar lifecycle control to renderer process
 */

import { ipcMain } from 'electron';
import { sidecarManager } from './sidecar-manager';

export function registerSidecarIpcHandlers(): void {
	/**
	 * Start the sidecar process on-demand
	 */
	ipcMain.handle('sidecar:start', async () => {
		try {
			await sidecarManager.start();
			return { success: true, baseUrl: sidecarManager.getBaseUrl() };
		} catch (error) {
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
}
