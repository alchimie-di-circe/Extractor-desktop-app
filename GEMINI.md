# Gemini CLI Agent Instructions for Extractor Desktop App

This file is your primary directive when working on this repository. It integrates the project's specific workflows (TaskMaster, Svelte MCP, DevServer MCP) with the new Quality Assurance standards (CodeRabbit CLI, GitHub CLI).

## 🧠 Core Philosophy
You are an expert full-stack engineer building a **local-first, privacy-focused Electron application**.
- **Architecture:** `AGENTS.md` is your bible. Strict separation between Renderer (UI only) and Main (Logic/IO).
- **Orchestration:** You DO NOT improvise tasks. You follow `.taskmaster/tasks/tasks.json`.
- **Quality:** You DO NOT push code without passing the **Quality Gate** (CodeRabbit + Checks).

---

## 🛠️ Toolchain & Shortcuts

### 1. Orchestration (Task Master)
Always check the current status before acting.
- **Next Task:** `task-master next`
- **Update Status:** `task-master set-status --id=<ID> --status=<STATUS>` (pending, in-progress, done)
- **Log Progress:** `task-master update-subtask --id=<ID> --prompt="<NOTES>"`

### 2. Svelte & UI (Svelte MCP)
**MANDATORY** before writing any Svelte component.
- **Reference:** `/.taskmaster/docs/shadcn-svelte.md` (List of available components).
- **Consult Docs:** `list-sections` -> `get-documentation`
- **Validate Code:** `svelte-autofixer` (Run this on your generated code *before* saving it).
- **Rule:** Use Svelte 5 Runes (`$state`, `$derived`, `$effect`). No legacy syntax.

### 3. shadcn-svelte CLI
- **Reference:** `/.taskmaster/docs/shadcn-svelte.md`
- **Add Component:** `npx shadcn-svelte@latest add <component-name>`
- **Location:** Components live in `src/lib/components/ui/`

### 4. Monitoring (DevServer MCP)
Keep the dev server running (`pnpm run dev` preferred; see `/docs/ELECTRON_FORGE_SETUP_FIX.md`) and monitor it.
- **Check Health:** `get_dev_server_status`
- **Debug Errors:** `get_file_errors` (If you break the build, fix it immediately).

---

## 📦 Electron Forge CLI
**Reference:** `/.taskmaster/docs/electron-forge.md` (CLI) and `/docs/ELECTRON_FORGE_SETUP_FIX.md` (macOS dev workaround)
- **Dev:** `pnpm run dev` (recommended on macOS) or `pnpm run start`
- **Package:** `pnpm run package` (Create executable)
- **Make:** `pnpm run make` (Create installer/DMG)
- **Publish:** `pnpm run publish` (Upload to GitHub Releases)

---

## 🔧 GitHub CLI (gh)
**Reference:** `/.taskmaster/docs/github-cli.md`
- **Auth:** `gh auth status`
- **Create PR:** `gh pr create --title "<title>" --body "<body>"`
- **Review PR:** `gh pr view <PR_URL_OR_NUMBER>`

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
**Before** asking the user to push or merge, audit your own work using the CodeRabbit CLI. This replaces the need to wait for the bot on GitHub.

1.  **Run Review:**
    ```bash
    coderabbit review --plain
    ```
    *(Or `--base <branch>` if targeting a specific feature branch)*

2.  **Analyze & Fix:**
    *   Read the output.
    *   If CodeRabbit finds bugs, security issues (e.g., path traversal), or smells: **FIX THEM**.
    *   Repeat until the review is clean.

### Phase 3: PR & Post-Push (GitHub CLI)
Reference: `/.taskmaster/docs/github-cli.md`
If you are handling a PR or checking feedback after a push:

1.  **Retrieve Bot Comments:**
    Use this command to fetch *only* actionable feedback from AI bots, filtering out noise.
    ```bash
    gh pr view <PR_URL_OR_NUMBER> --json comments --jq '{
      comments: .comments | map(select(.author.login == "coderabbitai" or .author.login == "qodo-code-review" or .author.login == "greptile-apps") | {bot: .author.login, body: .body, created: .createdAt})
    }'
    ```

2.  **Address Feedback:**
    *   Implement the requested fixes.
    *   Push changes.
    *   Repeat the check to ensure no new issues were flagged.

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
- `/.taskmaster/` - PRD, Tasks, Reports.
- `/electron/` - Main Process (Logic, IPC, Keychain).
- `/src/` - Renderer Process (Svelte, UI, Stores).
- `/python/` - AI Sidecar (Agents, RAG, FastAPI).
- `/shared/` - Shared Types & Constants.

---

*Verified by Gemini. Last Updated: 2026-01-07.*
