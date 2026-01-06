# AGENTS.md

This file is the runbook for humans and AI agents working on this repo.
Keep it short, actionable, and aligned with the PRD + Task Master graph.

## Table of Contents
- [Source of truth](#source-of-truth)
- [Task Master workflow](#task-master-workflow-daily)
- [Dev commands](#dev-commands)
- [Architecture boundaries](#architecture-boundaries)
- [DevServer MCP (Development Monitoring)](#devserver-mcp-development-monitoring)
- [Integrated Development Workflow](#integrated-development-workflow)
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

---

## DevServer MCP (Development Monitoring)

DevServer MCP monitora in tempo reale gli errori del dev server Vite/Electron e notifica Zed Agent di problemi TypeScript, Svelte, build e runtime.

### Setup e verifica
- **Installazione**: DevServer MCP è installato globalmente in `~/MCP-SERVERS/devserver/devserver-mcp/`
- **Modalità**: Esegue sorgenti TypeScript direttamente con `tsx` (no build necessario)
- **Verifica locale**: `tsx ~/MCP-SERVERS/devserver/devserver-mcp/src/server.ts --help`
- **Config Zed**: `~/.config/zed/settings.json` oppure `.zed/settings.json` (project-level)

### Come funziona
- DevServer MCP si connette a Zed IDE tramite Model Context Protocol
- Monitora l'output del comando `pnpm run start` in background
- Parser errori da Vite, TypeScript compiler, Svelte compiler, Electron
- Categorizza errori per severità (error, warning, info) e tipo (syntax, type, build, runtime)
- Notifica Zed Agent entro 1-2 secondi dalla comparsa dell'errore

### Tools MCP disponibili per agent
Questi tools sono invocabili automaticamente da Zed Agent:

| Tool | Descrizione | Uso tipico |
|------|-------------|------------|
| `get_dev_server_status` | Stato di salute del server e conteggio errori correnti | Check iniziale, verifica post-fix |
| `get_error_summary` | Errori raggruppati per tipo e severità | Overview rapida dei problemi |
| `get_error_history` | Lista cronologica completa degli errori con filtri | Debug approfondito |
| `get_file_errors` | Errori specifici per file con linea e colonna | Fix mirati su file specifico |
| `suggest_monitoring_setup` | Raccomandazioni di configurazione per il progetto | Setup iniziale |

### Troubleshooting

**DevServer MCP non si connette:**
```bash
# Riavvia Zed
pkill -9 Zed && open -a Zed

# Verifica tsx è installato
which tsx  # deve mostrare path a tsx

# Test manuale del server
tsx ~/MCP-SERVERS/devserver/devserver-mcp/src/server.ts --help
```

**Verifica config MCP in Zed:**
- `⌘+,` → cerca "context_servers"
- Controlla che `devserver-mcp` sia presente nella configurazione

**Log di debug:**
- DevServer MCP mostra output SSE su `http://127.0.0.1:9338/sse`
- Per porta custom: usa `--port 9339` nel comando

**Porta già in uso:**
```bash
# Trova processo sulla porta
lsof -i :9338

# Usa porta alternativa
tsx ~/MCP-SERVERS/devserver/devserver-mcp/src/server.ts --port 9339 --monitor "pnpm run start"
```

---

## Integrated Development Workflow

### Pre-PR Checklist con DevServer MCP

Questo workflow integra DevServer MCP con Task Master per garantire qualità prima di ogni PR.

#### 1. Inizio Task (Branch Creation)

```bash
# Ottieni prossimo task
task-master next

# Crea branch per il task
git checkout -b feature/task-<id>-<short-description>

# Segna task come in-progress
task-master set-status --id=<id> --status=in-progress
```

#### 2. Development con Monitoring Attivo

```bash
# Avvia dev server (DevServer MCP monitora automaticamente)
pnpm run start

# Durante lo sviluppo, l'agent può usare questi tools:
# - get_dev_server_status → verifica stato generale
# - get_file_errors → errori sul file corrente
# - get_error_summary → overview problemi
```

**Agent Behavior durante sviluppo:**
- Monitorare errori in tempo reale via DevServer MCP
- Correggere errori TypeScript/Svelte prima di procedere
- Loggare progressi con `task-master update-subtask`

#### 3. Pre-PR Validation Checklist

Prima di creare una PR, l'agent DEVE verificare:

```bash
# 1. Zero errori dal dev server
# Tool: get_dev_server_status
# Expected: { "status": "healthy", "errorCount": 0 }

# 2. Type check passa
pnpm run check

# 3. Tests passano (se applicabili)
pnpm run test:unit

# 4. Build di verifica
pnpm run package
```

#### 4. PR Creation

```bash
# Commit changes
git add .
git commit -m "feat(task-<id>): <description>

- Implementation details
- Verified via DevServer MCP: 0 errors
- Type check: passed"

# Push e crea PR
git push -u origin feature/task-<id>-<short-description>
gh pr create --title "Task <id>: <title>" --body "..."

# Marca task come done
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
│  │    next      │    │ feature/...   │    │ pnpm start   │       │
│  └──────────────┘    └──────────────┘    └──────────────┘       │
│                                                  │                │
│                                                  ▼                │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                 DEVELOPMENT LOOP                          │   │
│  │  ┌────────────────┐    ┌────────────────┐                │   │
│  │  │ DevServer MCP  │◀──▶│  Code Changes  │                │   │
│  │  │ (monitoring)   │    │                │                │   │
│  │  └────────────────┘    └────────────────┘                │   │
│  │         │                      │                          │   │
│  │         ▼                      ▼                          │   │
│  │  ┌────────────────┐    ┌────────────────┐                │   │
│  │  │ Error Detected │───▶│   Fix Error    │──┐             │   │
│  │  └────────────────┘    └────────────────┘  │             │   │
│  │         ▲                                   │             │   │
│  │         └───────────────────────────────────┘             │   │
│  └──────────────────────────────────────────────────────────┘   │
│                              │                                   │
│                              ▼                                   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │              PRE-PR VALIDATION                            │   │
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

| Fase | Comando Task Master | Tool DevServer MCP |
|------|--------------------|--------------------|
| Start | `task-master next` | - |
| Begin | `set-status --status=in-progress` | `suggest_monitoring_setup` |
| Develop | `update-subtask --prompt="..."` | `get_dev_server_status`, `get_file_errors` |
| Validate | - | `get_error_summary` |
| Complete | `set-status --status=done` | `get_dev_server_status` (final check) |

### Best Practices

1. **Sempre monitorare** - Tieni `pnpm run start` attivo durante lo sviluppo
2. **Fix immediato** - Correggi errori non appena DevServer MCP li segnala
3. **Log progressi** - Usa `update-subtask` per documentare decisioni e fix
4. **Validate before PR** - Zero errori è prerequisito per ogni PR
5. **Commit atomici** - Un commit per ogni fix significativo, referenzia task ID

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

---

## Configuration Reference

### Zed MCP Configuration (`.zed/settings.json`)

La configurazione completa per entrambi gli MCP server:

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
        "~/MCP-SERVERS/devserver/devserver-mcp/src/server.ts",
        "--monitor",
        "pnpm run start"
      ]
    }
  },
  "assistant": {
    "enabled": true,
    "version": "2"
  }
}
```

### Project-specific Config File (optional)

Crea `devserver-mcp.config.json` nella root del progetto:

```json
{
  "processPatterns": ["pnpm run start", "pnpm run dev"],
  "historyLimit": 1000,
  "correlationWindow": 5000,
  "watchPaths": ["src", "electron"],
  "excludePaths": ["node_modules", ".svelte-kit", ".vite"],
  "patterns": [
    {
      "name": "electron-error",
      "pattern": "\\[Electron\\].*ERROR",
      "category": "runtime",
      "severity": "critical"
    },
    {
      "name": "svelte-warning",
      "pattern": "svelte.*warning",
      "category": "build",
      "severity": "warning"
    }
  ]
}
```
