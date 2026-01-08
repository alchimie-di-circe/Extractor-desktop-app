# Electron Forge CLI Reference

> Electron Forge CLI is the main tool to build, package, and publish Electron applications. This document serves as a quick reference for the CLI commands available in this project.

## Core Commands

### Start (Dev)
Launch the app in development mode.
```bash
pnpm run dev
# or
pnpm run start
# or
npx electron-forge start
```
**Options:**
- `--enable-logging`: Enable internal Electron logging.
- `--inspect-electron`: Enable main process debugging.

**Note:** On macOS, prefer `pnpm run dev` if `pnpm run start` exits early. See `/docs/ELECTRON_FORGE_SETUP_FIX.md`.

### Package
Package the application into a platform-specific executable bundle (not a distributable installer).
```bash
pnpm run package
# or
npx electron-forge package
```
**Options:**
- `--arch`: Target architecture (e.g., `x64`, `arm64`). Defaults to host.
- `--platform`: Target platform (e.g., `darwin`, `win32`, `linux`). Defaults to host.

### Make
Create distributable installers (DMG, Squirrel, DEB, etc.) based on the config.
```bash
pnpm run make
# or
npx electron-forge make
```
**Options:**
- `--arch`: Target architecture.
- `--platform`: Target platform.
- `--skip-package`: Skip the packaging step (use existing package).

### Publish
Package, make, and publish artifacts to configured targets (e.g., GitHub Releases).
```bash
pnpm run publish
# or
npx electron-forge publish
```
**Options:**
- `--dry-run`: Simulate publish without uploading.
- `--from-dry-run`: Publish artifacts from a previous dry run.

## Workflow Tips

### Cross-Platform Build
To build for specific architectures:
```bash
# Build for Intel and Apple Silicon Macs
pnpm run make -- --platform=darwin --arch=x64,arm64
```

### Debugging Build
If packaging fails, verify `node_modules` structure:
```bash
# pnpm specific check
# Ensure .npmrc has node-linker=hoisted
cat .npmrc
```

## Configuration
The behavior of these commands is controlled by `forge.config.ts` in the project root.
