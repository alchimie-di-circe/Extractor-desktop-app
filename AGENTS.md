# AGENTS.md

This file is the runbook for humans and AI agents working on this repo.
Keep it short, actionable, and aligned with the PRD + Task Master graph.

## Source of truth
- Product requirements: `/.taskmaster/docs/prd.md`
- Task graph: `/.taskmaster/tasks/tasks.json` (auto-managed)
- Task Master guide: `/.taskmaster/CLAUDE.md`

Do not edit `tasks.json` by hand. Use Task Master commands instead.

## Task Master workflow (daily)
```
task-master list
task-master next
task-master show <id>
task-master set-status --id=<id> --status=done
task-master update-subtask --id=<id> --prompt="notes..."
```

If a task needs changes, prefer:
```
task-master update-task --id=<id> --prompt="changes"
```

## Dev commands
- Install: `pnpm install`
- Dev app: `pnpm run start`
- Type check: `pnpm run check`
- Unit tests: `pnpm run test:unit`
- E2E tests: `pnpm run test:e2e`
- Build: `pnpm run package` / `pnpm run make`

## Architecture boundaries
- Renderer (Svelte) is UI only: no heavy I/O, no CPU-intensive work.
- Main process owns file I/O, keychain, and sidecar lifecycle.
- Python sidecar handles agent logic, RAG, and tool integrations.
- All renderer -> main calls go through `preload.ts` and IPC handlers.
- Do not access Node.js or Electron APIs directly in Svelte components.
- Keep IPC minimal and typed; update `src/app.d.ts` when exposing APIs.

## Cagent (Docker) usage
- Agents and orchestration are defined in Cagent YAML.
- Cagent does not require Docker to be running on the host.
- Cagent YAML is generated from UI settings; avoid hand-editing generated files.
- If a manual template is needed, place it under `python/` and document it here.

## Cagent YAML guidelines
- Keep YAML minimal and explicit; avoid duplication and implicit defaults.
- Prefer stable keys/ids for agents to keep diffs readable.
- Separate secrets from YAML (use keychain/env and inject at runtime).
- Avoid large prompts inline; reference prompt files if available.
- Use consistent ordering for sections (agents, toolsets, env, routes).
- Validate YAML output when changing schema (tests or sidecar startup check).

## Desktop UI rules (Electron + Svelte + shadcn-svelte)
- Use Svelte idiomatically: simple props + stores, avoid deep state nesting.
- Import only the shadcn-svelte components used in the current file.
- Keep components small and focused (view/panel + reusable subcomponents).
- Avoid unnecessary dependencies; check if Svelte + shadcn already cover it.
- Keep startup light: eager-load only main window; lazy-load heavy views/modals.
- Minimize heavy animations; prefer opacity/transform transitions.
- Renderer stays light; move I/O and CPU work to main or dedicated workers.
- Prefer a small IPC-backed API (e.g., `desktopApi.saveFile(...)`).
- Maintain clear layout hierarchy: shell + sidebar + content areas.
- Use shadcn components for buttons/forms/toasts/dialogs consistently.
- Always design empty, loading, and error states.

If a web UI is added later, create a separate "Web UI rules" section.

## Code structure conventions
- UI components: `src/lib/components/ui/` (shadcn) and `src/lib/components/custom/`.
- Services/IPC wrappers: `src/lib/services/`.
- Stores: `src/lib/stores/*.svelte.ts` (Svelte 5 runes).
- Electron main: `electron/` (main.ts, preload.ts, ipc-handlers.ts).
- Future sidecar: `python/` (FastAPI + agents).

## Security and privacy
- API keys only in OS keychain (never in renderer state or git).
- Validate all paths and inputs crossing IPC boundaries.
- Enforce export path whitelist and prevent path traversal.
- Keep osxphotos in a sandboxed, network-blocked process.

## When adding new IPC
- Add handler in `electron/ipc-handlers.ts`.
- Expose via `electron/preload.ts` with `contextBridge`.
- Update `src/app.d.ts` with the typed API surface.
- Add tests where practical (IPC integration or unit tests).

## Docs hygiene
- Update `README.md` if architecture, commands, or scope changes.
- Keep this file aligned with the PRD and task graph.
