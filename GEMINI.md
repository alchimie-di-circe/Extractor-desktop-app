# Gemini CLI Agent Instructions for Extractor Desktop App

This file is your primary directive when working on this repository. It integrates the project's specific workflows (TaskMaster, Svelte MCP, DevServer MCP, Jules) with the new Quality Assurance standards.

## 🧠 Core Philosophy
You are an expert full-stack engineer building a **local-first, privacy-focused Electron application**.
- **Architecture:** `AGENTS.md` is your bible. Strict separation between Renderer (UI only) and Main (Logic/IO).
- **Orchestration:** You DO NOT improvise tasks. You follow `.taskmaster/tasks/tasks.json`.
- **Quality:** You DO NOT push code without passing the **Quality Gate** (CodeRabbit + Checks).
- **SPA Mode (CRITICAL):** This app is an Electron app using SvelteKit. **SSR (Server-Side Rendering) is DISABLED**.
    - Never write code that assumes `window` or `document` are globally available during initialization without a check.
    - Use `if (typeof window !== 'undefined')` or `if (browser)` blocks in `.ts` files.
    - Avoid barrel files (`index.ts`) inside component directories if they cause circular dependencies.

---

## 📚 Documentation Hub

Before asking or searching blindly, check these specialized docs in `.taskmaster/docs/`:

| Topic | File | Description |
|-------|------|-------------|
| **Agents & AI** | `.taskmaster/docs/cagent-team.md` | Roles (Orchestrator, Extraction, etc.), Models, A2A Protocol. |
| **Architecture** | `AGENTS.md` | IPC rules, State management, File structure, Security. |
| **Workflow** | `CLAUDE.md` | TaskMaster commands, TDD cycles, Branching rules. |
| **UI Components** | `.taskmaster/docs/shadcn-svelte.md` | List of available components and how to add them. |
| **Building/Packaging** | `.taskmaster/docs/electron-forge.md` | Packaging for macOS/Windows, Signing, Publishing. |
| **GitHub Workflow** | `.taskmaster/docs/github-cli.md` | Using `gh` CLI for PRs and reviews. |

---

## 🛠️ Toolchain & Shortcuts

### 1. Orchestration (Task Master)
Always check the current status before acting.
- **Next Task:** `task-master next`
- **Update Status:** `task-master set-status --id=<ID> --status=<STATUS>` (pending, in-progress, done)
- **Log Progress:** `task-master update-subtask --id=<ID> --prompt="<NOTES>"`

### 2. Heavy Lifting (Jules)
For complex, multi-file refactors, large test suites, or dependency upgrades, delegate to Jules.
- **Command:** `ask_jules` (or `/jules` in chat)
- **Use Case:** "Add unit tests for all UI components", "Refactor the IPC handler structure".
- **Workflow:** Jules runs in the cloud and opens a PR. You review it.

### 3. Svelte & UI (Svelte MCP)
**MANDATORY** before writing any Svelte component.
- **Consult Docs:** `list-sections` -> `get-documentation`
- **Validate Code:** `svelte-autofixer` (Run this on your generated code *before* saving it).
- **Rule:** Use Svelte 5 Runes (`$state`, `$derived`, `$effect`). No legacy syntax.
- **Rule:** **NO SSR**. `export const ssr = false;` in `+layout.ts`.

### 4. Monitoring (DevServer MCP)
Keep the dev server running and monitor it.
- **Start Monitor:** `tsx ~/MCP-SERVERS/devserver/devserver-mcp/src/server.ts --port 9338 --monitor "pnpm run dev"`
- **Check Health:** `get_dev_server_status`
- **Debug Errors:** `get_file_errors` (If you break the build, fix it immediately).

---

## 🛡️ The "Quality Gate" Workflow (MANDATORY)

You must follow this cycle for every significant change.

### Phase 1: Local Development & Verification
1.  **Implement** the feature/fix following `AGENTS.md` architecture rules.
2.  **Verify** locally:
    *   `pnpm run check` (TypeScript/Svelte checks) - **MUST PASS**.
    *   `get_dev_server_status` (Runtime errors) - **MUST BE ZERO**.
    *   `pnpm run test:unit` (if applicable).

### Phase 2: Pre-Commit Review (CodeRabbit CLI)
**Before** asking the user to push or merge, audit your own work using the CodeRabbit CLI.

1.  **Run Review:** `coderabbit review --plain`
2.  **Analyze & Fix:** If CodeRabbit finds bugs or smells, **FIX THEM**.

### Phase 3: PR & Post-Push (GitHub CLI)
If you are handling a PR or checking feedback after a push:
1.  **Retrieve Bot Comments:** Use `gh pr view ...` (see `CLAUDE.md` or `.taskmaster/docs/github-cli.md` for the exact command).
2.  **Address Feedback:** Implement fixes, push, and repeat.

---

## 🏗️ Architecture Rules (Quick Ref)

- **IPC:**
    - Channels MUST be defined in `shared/ipc-channels.ts`.
    - Handlers in `electron/ipc-handlers.ts`.
    - Preload in `electron/preload.ts` (Import types from `shared/types.ts`).
    - **Security:** Validate ALL inputs in handlers. Use `validateAndNormalizePath` for file paths.
- **State:**
    - Use `electron-store` for user config (Main process).
    - Use `keytar` for secrets (Main process only).
    - Use Svelte 5 Stores (`.svelte.ts`) for UI state.
- **UI:**
    - Shadcn-svelte components in `src/lib/components/ui`.
    - No direct Node.js access in Svelte components.

---

## 📂 Project Structure Map
- `/.taskmaster/` - PRD, Tasks, Reports, **Docs**.
- `/electron/` - Main Process (Logic, IPC, Keychain).
- `/src/` - Renderer Process (Svelte, UI, Stores).
- `/python/` - AI Sidecar (Agents, RAG, FastAPI).
- `/shared/` - Shared Types & Constants.

---

*Verified by Gemini. Last Updated: 2026-01-23.*