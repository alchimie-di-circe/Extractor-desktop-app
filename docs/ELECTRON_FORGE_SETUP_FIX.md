# Electron Forge + SvelteKit Setup Issue Report

**Date:** 2025-01-06  
**Platform:** macOS (Darwin arm64)  
**Node:** v25.2.1  
**Package Manager:** pnpm 10.27.0

---

## Problem Summary

When running `pnpm run start` (which executes `electron-forge start`), the command would fail with exit code 1 without showing any meaningful error message:

```
> electron-svelte@0.0.1 start /Users/.../Trae_Extractor-app-v2
> electron-forge start

 ELIFECYCLE  Command failed with exit code 1.
```

## Root Cause Analysis

After extensive debugging, we discovered that:

1. **Electron and Electron Forge were installed correctly** ✅
2. **Vite compiled everything successfully** ✅
3. **The app launched but exited immediately** ❌

### The Actual Problem

When `electron-forge start` runs, it:
1. Starts the Vite dev server on port 5173
2. Builds the main process and preload scripts
3. Launches Electron pointing to `http://localhost:5173`

However, on this system, the entire process would exit immediately after "Launched Electron app", causing:
- The Vite dev server to shut down
- Electron to fail loading `http://localhost:5173` with `ERR_CONNECTION_REFUSED`
- The app window to appear blank/white

Debug logs showed:
```
✔ Launched Electron app. Type rs in terminal to restart main process.
handling process exit with: { cleanup: true }
cleaning vite watcher
cleaning http server
```

The exit happened so fast that Electron couldn't establish a connection to the Vite server.

### Why This Happened

The issue appears to be related to how `electron-forge` handles process signals and exit handlers in certain terminal/shell environments. The process would receive an exit signal prematurely, triggering cleanup before the app could stabilize.

## Solution

### Workaround: Separate Dev Script

Instead of relying on `electron-forge start`, we created a custom development script that:
1. Builds the main process manually
2. Starts Vite dev server as a background process
3. Waits for Vite to be ready
4. Launches Electron separately
5. Handles cleanup on Ctrl+C

### Files Added/Modified

#### 1. `scripts/dev.sh` (NEW)
A bash script that orchestrates the development environment:
- Builds main process and preload scripts
- Starts Vite dev server in background
- Waits for server readiness with polling
- Launches Electron
- Provides proper cleanup on exit

#### 2. `package.json` (MODIFIED)
Added new npm script:
```json
{
  "scripts": {
    "dev": "./scripts/dev.sh"
  }
}
```

#### 3. `electron/main.ts` (MODIFIED)
- Cleaned up excessive debug logging
- Added proper error handling for `uncaughtException` and `unhandledRejection`
- Added `did-fail-load` event handler for better error reporting

## How to Use

### Development (use this instead of `pnpm run start`)
```bash
pnpm run dev
# or
./scripts/dev.sh
```

### Production Build (unchanged)
```bash
pnpm run package
pnpm run make
```

## Verification

After implementing the fix:
1. Vite dev server starts and stays running on port 5173
2. Electron launches and successfully connects to Vite
3. SvelteKit app renders correctly in the Electron window
4. Hot Module Replacement (HMR) works as expected
5. Ctrl+C properly shuts down both Vite and Electron

## Technical Details

### Environment
- macOS Sonoma (arm64)
- Node.js v25.2.1
- pnpm 10.27.0
- Electron 36.8.3
- @electron-forge/cli 7.10.2
- @electron-forge/plugin-vite 7.10.2
- SvelteKit 2.16.3
- Vite 6.4.1
- Svelte 5.11.0

### Project Configuration
- `"type": "module"` in package.json (ES modules)
- `@sveltejs/adapter-static` for Electron compatibility
- Hash-based router (`router: { type: "hash" }`)
- Patched SvelteKit for Electron compatibility

## Notes

- The original `pnpm run start` command is preserved and may work on other systems
- The `pnpm run dev` script is the recommended way to run development on macOS
- This issue may be specific to certain shell/terminal configurations
- Future Electron Forge updates may resolve this issue

## Related Resources

- [SvelteKit + Electron Issue #11997](https://github.com/sveltejs/kit/issues/11997)
- [Electron Forge Vite Plugin Documentation](https://www.electronforge.io/config/plugins/vite)
- [electron-sveltekit-5 Template](https://github.com/itsgoofer/electron-sveltekit-5)