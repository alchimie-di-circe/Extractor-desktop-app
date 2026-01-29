# AGENTS.md

This file is the runbook for humans and AI agents working on this repo.
Keep it short, actionable, and aligned with the PRD + Task Master graph.

## Table of Contents
- [Source of truth](#source-of-truth)
- [Task Master workflow](#task-master-workflow-daily)
- [Dev commands](#dev-commands)
- [Electron Forge CLI](#electron-forge-cli)
- [shadcn-svelte CLI](#shadcn-svelte-cli)
- [GitHub CLI](#github-cli)
- [Architecture boundaries](#architecture-boundaries)
- [Svelte MCP (Documentation & Validation)](#svelte-mcp-documentation--validation)
- [DevServer MCP (Development Monitoring)](#devserver-mcp-development-monitoring)
- [Integrated Development Workflow](#integrated-development-workflow)
- [Testing & Monitoring Tools](#testing--monitoring-tools)
- [Cagent (Docker) usage](#cagent-docker-usage)
- [Desktop UI rules](#desktop-ui-rules-electron--svelte--shadcn-svelte)
- [Code structure conventions](#code-structure-conventions)
- [Security and privacy](#security-and-privacy)
- [When adding new IPC](#when-adding-new-ipc)
- [Docs hygiene](#docs-hygiene)

---

## Source of truth
- Product requirements: `/.taskmaster/docs/prd.md`
- Task graph: `/.taskmaster/tasks/tasks.json` (auto-managed)
- Task Master guide: `/.taskmaster/CLAUDE.md`

Do not edit `tasks.json` by hand. Use Task Master commands instead.

## Task Master workflow (daily)

### Essential Commands
```bash
task-master list                                    # See all tasks and status
task-master next                                    # Find next task to work on
task-master show <id>                              # Show task details
task-master set-status --id=<id> --status=done     # Mark task as complete
task-master update-subtask --id=<id> --prompt="notes..."
task-master update-task --id=<id> --prompt="changes"
```

**IMPORTANT: Status Sync Rule**
- Whenever you commit work for a task, **immediately** update its status in Task Master
- Do NOT rely on PRs or reviews to update status (Task Master is the source of truth)
- Use `.factory/commands/tm/` reference commands: `to-done.md`, `to-in-progress.md`, `to-review.md`
- Example workflow:
  ```bash
  # Start work
  git checkout -b task/<id>-short-desc
  task-master set-status --id=<id> --status=in-progress
  
  # After finishing and committing
  git commit -m "feat(task-<id>): ..."
  task-master set-status --id=<id> --status=done  # ← Do this immediately!
  ```

**CRITICAL: Update Both Files**
Task Master maintains **two sources** that must stay in sync:
1. **`/.taskmaster/tasks/tasks.json`** - Updated by `task-master set-status` command
2. **`/.taskmaster/tasks/task_XXX.md`** - Individual task files (NOT auto-updated)

When marking a task as done:
```bash
# Step 1: Update tasks.json via CLI
task-master set-status --id=<id> --status=done

# Step 2: Manually edit .taskmaster/tasks/task_<id>.md
# Change: **Status:** pending  →  **Status:** done
# Also update all subtask statuses (5.1, 5.2, etc.) to "done"

# Step 3: Commit both changes
git add .taskmaster/tasks/
git commit -m "chore: Mark Task <id> and subtasks as done"
```

**Note:** Task Master CLI has 40+ commands saved in `.factory/commands/tm/` for reference.

## Dev commands
- Install: `pnpm install`
- Dev app: `pnpm run dev` (preferred on macOS; see `/docs/ELECTRON_FORGE_SETUP_FIX.md`) or `pnpm run start`
- Type check: `pnpm run check`
- Unit tests: `pnpm run test:unit`
- E2E tests: `pnpm run test:e2e`
- Build: `pnpm run package` / `pnpm run make` (Ref: `/.taskmaster/docs/electron-forge.md`)
- Publish: `pnpm run publish` (Ref: `/.taskmaster/docs/electron-forge.md`)

## Electron Forge CLI
- **Reference:** `/.taskmaster/docs/electron-forge.md`
- Prefer `pnpm run dev` if `pnpm run start` exits early on macOS (workaround in `/docs/ELECTRON_FORGE_SETUP_FIX.md`).
- Use `pnpm run package` / `pnpm run make` / `pnpm run publish` for builds and releases.

## shadcn-svelte CLI
- **Reference:** `/.taskmaster/docs/shadcn-svelte.md`
- Install components with `npx shadcn-svelte@latest add <component-name>`.
- Components live in `src/lib/components/ui/`; keep imports minimal.

## GitHub CLI
- **Reference:** `/.taskmaster/docs/github-cli.md`
- Use `gh pr create` for PRs and `gh pr view` for review feedback.
- Authenticate with `gh auth status` before PR workflows.

## Architecture boundaries
- Renderer (Svelte) is UI only: no heavy I/O, no CPU-intensive work.
- Main process owns file I/O, keychain, and sidecar lifecycle.
- Python sidecar handles agent logic, RAG, and tool integrations.
- All renderer -> main calls go through `preload.ts` and IPC handlers.
- Do not access Node.js or Electron APIs directly in Svelte components.
- Keep IPC minimal and typed; update `src/app.d.ts` when exposing APIs.

---

## Svelte MCP (Documentation & Validation)

Svelte MCP is the official MCP server from the Svelte team, providing direct access to Svelte 5 and SvelteKit documentation, plus real-time code validation.

### Why use it
- **Avoid outdated syntax**: LLMs often generate Svelte 4 syntax or React patterns
- **Automatic validation**: Code is verified before being shown to users
- **Always up-to-date docs**: Direct access to Svelte 5 runes, SvelteKit 2, etc.
- **Reduce iterations**: From 3-4 fixes per feature to 1-2

### Available MCP Tools

| Tool | Description | When to use |
|------|-------------|-------------|
| `list-sections` | Lists all doc sections with use-cases | **ALWAYS FIRST** - to find relevant docs |
| `get-documentation` | Retrieves complete documentation for sections | After list-sections, to get details |
| `svelte-autofixer` | Analyzes Svelte code and returns issues/suggestions | **ALWAYS** before providing Svelte code |
| `playground-link` | Generates a link to Svelte Playground with the code | For demo/debug/sharing |

### Mandatory workflow for Svelte code

**RULE: When generating Svelte code, you MUST follow this flow:**

1. **Call `list-sections`** to find docs relevant to the task
2. **Call `get-documentation`** to retrieve the found sections
3. **Generate the code** based on the documentation
4. **Call `svelte-autofixer`** to validate the generated code
5. **If there are errors**, fix and re-validate
6. **Only after validation**, show the code to the user

### Correct usage example

```
# Task: Create a form with validation

1. list-sections -> find "forms", "form-validation", "$state"
2. get-documentation(["forms", "$state"]) -> get docs
3. Generate code using $state, not old syntax
4. svelte-autofixer(code) -> check for errors
5. If OK -> show code
   If errors -> fix and go back to step 4
```

### Svelte 5 patterns to use (NOT Svelte 4)

```svelte
<!-- CORRECT: Svelte 5 runes -->
<script>
  let count = $state(0);
  let doubled = $derived(count * 2);

  function increment() {
    count++;
  }
</script>

<!-- WRONG: Svelte 4 syntax -->
<script>
  let count = 0;
  $: doubled = count * 2;
</script>
```

### Configuration

**Zed IDE** (`.zed/settings.json`):
```json
{
  "context_servers": {
    "svelte": {
      "command": "npx",
      "args": ["-y", "@sveltejs/mcp"]
    }
  }
}
```

**Claude Code** (`.mcp.json`):
```json
{
  "mcpServers": {
    "svelte": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@sveltejs/mcp"]
    }
  }
}
```

### Troubleshooting

**MCP not responding:**
```bash
# Manual test
npx -y @sveltejs/mcp

# Check version
npx @sveltejs/mcp --version
```

**Remote alternative** (if local doesn't work):
```json
{
  "svelte": {
    "type": "http",
    "url": "https://mcp.svelte.dev/mcp"
  }
}
```

---

## DevServer MCP (Development Monitoring)

DevServer MCP monitors Vite/Electron dev server errors in real-time and notifies agents of TypeScript, Svelte, build, and runtime issues.

### How it works
- DevServer MCP connects to your IDE/agent via Model Context Protocol
- Monitors the output of `pnpm run dev` or `pnpm run start` in background
- Parses errors from Vite, TypeScript compiler, Svelte compiler, Electron
- Categorizes errors by severity (error, warning, info) and type (syntax, type, build, runtime)
- Notifies agents within 1-2 seconds of error occurrence

### Available MCP Tools

| Tool | Description | Typical use |
|------|-------------|-------------|
| `get_dev_server_status` | Server health status and current error count | Initial check, post-fix verification |
| `get_error_summary` | Errors grouped by type and severity | Quick overview of issues |
| `get_error_history` | Complete chronological error list with filters | Deep debugging |
| `get_file_errors` | File-specific errors with line and column | Targeted fixes on specific file |
| `suggest_monitoring_setup` | Configuration recommendations for the project | Initial setup |

### Setup for Zed IDE

Zed starts DevServer MCP automatically via `context_servers` configuration.

**Configuration** (`.zed/settings.json`):
```json
{
  "context_servers": {
    "devserver-mcp": {
      "command": "tsx",
      "args": [
        "/Users/alexandthemusic/MCP-SERVERS/devserver/devserver-mcp/src/server.ts",
        "--monitor",
        "--port",
        "9338",
        "pnpm run dev"
      ]
    }
  }
}
```

No manual setup required - Zed launches the server when the project opens.

### Setup for Claude Code (IMPORTANT)

**Claude Code cannot start long-running processes.** You must start DevServer MCP manually before Claude Code can use it.

**Step 1: Start DevServer MCP in a separate terminal:**
```bash
tsx ~/MCP-SERVERS/devserver/devserver-mcp/src/server.ts \
  --port 9338 --monitor "pnpm run dev"
```

**Step 2: Verify the server is running:**
- Check for output on `http://127.0.0.1:9338/sse`
- You should see SSE events when the dev server produces output

**Step 3: Claude Code connects via SSE:**
Configuration in `.mcp.json`:
```json
{
  "mcpServers": {
    "devserver-mcp": {
      "type": "sse",
      "url": "http://127.0.0.1:9338/sse"
    }
  }
}
```

**Alternative workflow (without MCP):**
If DevServer MCP is not running, Claude Code can:
- Run `pnpm run dev` in background and read stderr/stdout
- Use `pnpm run check` for explicit type checking
- Parse build output manually

### Installation & verification
- **Location**: DevServer MCP is installed in `~/MCP-SERVERS/devserver/devserver-mcp/`
- **Runtime**: Runs TypeScript sources directly with `tsx` (no build required)
- **Verify**: `tsx ~/MCP-SERVERS/devserver/devserver-mcp/src/server.ts --help`

### Troubleshooting

**DevServer MCP not connecting:**
```bash
# Restart Zed
pkill -9 Zed && open -a Zed

# Verify tsx is installed
which tsx  # should show path to tsx

# Manual server test
tsx ~/MCP-SERVERS/devserver/devserver-mcp/src/server.ts --help
```

**Verify MCP config in Zed:**
- `Cmd+,` -> search "context_servers"
- Check that `devserver-mcp` is present in configuration

**Debug logs:**
- DevServer MCP shows SSE output on `http://127.0.0.1:9338/sse`
- For custom port: use `--port 9339` in the command

**Port already in use:**
```bash
# Find process on port
lsof -i :9338

# Use alternative port
tsx ~/MCP-SERVERS/devserver/devserver-mcp/src/server.ts --port 9339 --monitor "pnpm run dev"
```

---

## Integrated Development Workflow

### Pre-PR Checklist with MCP Tools

This workflow integrates Svelte MCP + DevServer MCP + Task Master to ensure quality before every PR.

#### 1. Task Start (Branch Creation)

```bash
# Get next task
task-master next

# Create branch for the task
git checkout -b feature/task-<id>-<short-description>

# Mark task as in-progress
task-master set-status --id=<id> --status=in-progress
```

#### 2. Development with Active Monitoring

**For Zed IDE:** DevServer MCP starts automatically with your config.

**For Claude Code:** Start DevServer MCP manually first (see DevServer MCP section above).

```bash
# Start dev server
pnpm run dev

# During development, the agent uses these tools:
# - Svelte MCP: list-sections, get-documentation, svelte-autofixer
# - DevServer MCP: get_dev_server_status, get_file_errors
```

**Agent behavior during development:**
1. **Before writing Svelte code**: Consult docs via `list-sections` + `get-documentation`
2. **After writing code**: Validate with `svelte-autofixer`
3. **During development**: Monitor errors in real-time via DevServer MCP
4. **Log progress**: Use `task-master update-subtask`

#### 3. Pre-PR Validation Checklist

Before creating a PR, the agent MUST verify:

```bash
# 1. Svelte code validated
# Tool: svelte-autofixer -> 0 issues

# 2. Zero errors from dev server
# Tool: get_dev_server_status
# Expected: { "status": "healthy", "errorCount": 0 }

# 3. Type check passes
pnpm run check

# 4. Tests pass (if applicable)
pnpm run test:unit

# 5. Verification build
pnpm run package
```

#### 4. PR Creation

```bash
# Commit changes
git add .
git commit -m "feat(task-<id>): <description>

- Implementation details
- Validated via Svelte MCP: 0 issues
- Verified via DevServer MCP: 0 errors
- Type check: passed"

# Push and create PR
git push -u origin feature/task-<id>-<short-description>
gh pr create --title "Task <id>: <title>" --body "..."

# Mark task as done
task-master set-status --id=<id> --status=done
```

### Workflow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                    TASK-BASED DEV WORKFLOW                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐       │
│  │ task-master  │───▶│ Create Branch │───▶│ Start Dev    │       │
│  │    next      │    │ feature/...   │    │ pnpm run dev │       │
│  └──────────────┘    └──────────────┘    └──────────────┘       │
│                                                  │                │
│                                                  ▼                │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                 DEVELOPMENT LOOP                          │   │
│  │                                                           │   │
│  │  ┌─────────────┐  ┌────────────────┐  ┌──────────────┐   │   │
│  │  │ Svelte MCP  │  │  Code Changes  │  │ DevServer MCP│   │   │
│  │  │ (docs+valid)│◀▶│                │◀▶│ (monitoring) │   │   │
│  │  └─────────────┘  └────────────────┘  └──────────────┘   │   │
│  │        │                  │                   │           │   │
│  │        ▼                  ▼                   ▼           │   │
│  │  ┌─────────────┐  ┌────────────────┐  ┌──────────────┐   │   │
│  │  │ autofixer   │  │   Fix Issues   │◀─│Error Detected│   │   │
│  │  │  validate   │─▶│                │  │              │   │   │
│  │  └─────────────┘  └────────────────┘  └──────────────┘   │   │
│  │                                                           │   │
│  └──────────────────────────────────────────────────────────┘   │
│                              │                                   │
│                              ▼                                   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │              PRE-PR VALIDATION                            │   │
│  │  □ svelte-autofixer → 0 issues                           │   │
│  │  □ get_dev_server_status → 0 errors                      │   │
│  │  □ pnpm run check → passed                               │   │
│  │  □ pnpm run test:unit → passed                           │   │
│  └──────────────────────────────────────────────────────────┘   │
│                              │                                   │
│                              ▼                                   │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐       │
│  │    Commit    │───▶│  Create PR   │───▶│ task-master  │       │
│  │              │    │              │    │ set-status   │       │
│  └──────────────┘    └──────────────┘    │   done       │       │
│                                          └──────────────┘       │
└─────────────────────────────────────────────────────────────────┘
```

### Agent Commands Summary

| Phase | Task Master | Svelte MCP | DevServer MCP |
|-------|-------------|------------|---------------|
| Start | `next` | - | - |
| Begin | `set-status in-progress` | `list-sections` | `suggest_monitoring_setup` |
| Develop | `update-subtask` | `get-documentation`, `svelte-autofixer` | `get_dev_server_status`, `get_file_errors` |
| Validate | - | `svelte-autofixer` (final) | `get_error_summary` |
| Complete | `set-status done` | `playground-link` (optional) | `get_dev_server_status` (final) |

### Best Practices

1. **Docs first** - Always consult Svelte MCP before writing code
2. **Validate always** - Never provide Svelte code without `svelte-autofixer`
3. **Monitor always** - Keep `pnpm run dev` active with DevServer MCP
4. **Fix immediately** - Fix errors as soon as they are detected
5. **Log progress** - Use `update-subtask` to document decisions
6. **Zero issues pre-PR** - Absolute prerequisite for every PR

---

## Testing & Monitoring Tools

Questa sezione definisce i ruoli dei 5 strumenti di testing/monitoring per sviluppo locale e CI.

### Ruoli

| Tool | Ruolo | Fase |
|------|-------|------|
| **DevServer MCP** | Monitor errori dev server | Sempre attivo durante `pnpm dev` |
| **Wallaby MCP** | Unit/integration test watch | TDD, logica di dominio |
| **Agent Browser CLI** | E2E vibe coding esplorativo | Scoprire flussi rapidamente |
| **TestSprite MCP** | E2E stabile + AI validation | **Pre-PR (locale)** |
| **Chrome DevTools MCP** | Debug runtime + performance | **CI (non bloccante)** |

### Workflow Locale (Pre-PR)

1. `pnpm dev` con DevServer MCP attivo (errori build/runtime)
2. Wallaby MCP per unit test in watch mode
3. Agent Browser CLI per esplorare flussi E2E nuovi
4. **TestSprite MCP per validazione pre-PR:**
   ```bash
   # Via MCP tools o slash command /testsprite-e2e
   testsprite_bootstrap → generate_test_plan → execute
   ```

### Workflow CI (GitHub Actions)

1. Unit test: `pnpm test:unit`
2. E2E Playwright: `pnpm test:e2e`
3. Chrome DevTools MCP (opzionale, **non bloccante**):
   - Screenshot scenari chiave
   - Performance trace (LCP, layout shift)
   - Console errors collection

### Regola: Un solo browser E2E alla volta (locale)

Per evitare overload su Mac M2:
- ✅ Agent Browser CLI **oppure** TestSprite (non entrambi contemporaneamente)
- ✅ Chrome DevTools MCP solo quando serve debug visivo/performance

### Decision Matrix

| Scenario | Tool Primario | Complementare |
|----------|---------------|---------------|
| Fix errori build/dev | DevServer MCP | Wallaby |
| TDD logica/API | Wallaby MCP | - |
| Debug layout/CSS | Chrome DevTools MCP | DevServer MCP |
| Esplorare flussi E2E | Agent Browser CLI | TestSprite |
| Validazione pre-PR | TestSprite MCP | Agent Browser |
| CI performance check | Chrome DevTools MCP | Playwright |

---

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
- **Reference:** See `/.taskmaster/docs/shadcn-svelte.md` for component list and docs.
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
- Keep `/.taskmaster/docs/electron-forge.md`, `/.taskmaster/docs/shadcn-svelte.md`, and `/.taskmaster/docs/github-cli.md` in sync with workflow changes.
- Keep this file aligned with the PRD and task graph.

---

## Configuration Reference

### Complete Zed MCP Configuration (`.zed/settings.json`)

```json
{
  "context_servers": {
    "task-master-ai": {
      "command": "npx",
      "args": ["-y", "task-master-ai"],
      "env": {
        "TASK_MASTER_TOOLS": "all",
        "ANTHROPIC_API_KEY": "YOUR_KEY",
        "PERPLEXITY_API_KEY": "YOUR_KEY"
      }
    },
    "devserver-mcp": {
      "command": "tsx",
      "args": [
        "/Users/alexandthemusic/MCP-SERVERS/devserver/devserver-mcp/src/server.ts",
        "--monitor",
        "--port",
        "9338",
        "pnpm run dev"
      ]
    },
    "svelte": {
      "command": "npx",
      "args": ["-y", "@sveltejs/mcp"]
    }
  },
  "assistant": {
    "enabled": true,
    "version": "2"
  }
}
```

**Note:** Replace the DevServer MCP path with your actual installation path. The `~` shorthand may not be expanded in JSON.

### Complete Claude Code Configuration (`.mcp.json`)

```json
{
  "mcpServers": {
    "task-master-ai": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "task-master-ai"],
      "env": {
        "TASK_MASTER_TOOLS": "all",
        "ANTHROPIC_API_KEY": "YOUR_KEY",
        "PERPLEXITY_API_KEY": "YOUR_KEY"
      }
    },
    "svelte": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@sveltejs/mcp"]
    },
    "devserver-mcp": {
      "type": "sse",
      "url": "http://127.0.0.1:9338/sse"
    }
  }
}
```

**Note:** DevServer MCP requires manual startup before Claude Code can connect. See "Setup for Claude Code" in the DevServer MCP section.

### DevServer MCP Config (Optional)

DevServer MCP works with default patterns out of the box. A custom config file is **optional** and only needed if you want to add custom error patterns.

**If you need custom patterns**, create `devserver-mcp.config.json` in the project root. Check the DevServer MCP source code at `~/MCP-SERVERS/devserver/devserver-mcp/src/config/schema.ts` for the correct schema.

**Recommendation:** Use the default patterns. They already cover Vite, TypeScript, Svelte, and Electron errors.
