# AGENTS.md

This file is the runbook for humans and AI agents working on this repo.
Keep it short, actionable, and aligned with the PRD + Task Master graph.

## Table of Contents
- [Source of truth](#source-of-truth)
- [Task Master workflow](#task-master-workflow-daily)
- [Dev commands](#dev-commands)
- [Architecture boundaries](#architecture-boundaries)
- [Svelte MCP (Documentation & Validation)](#svelte-mcp-documentation--validation)
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

## Svelte MCP (Documentation & Validation)

Svelte MCP è il server MCP ufficiale del team Svelte che fornisce accesso diretto alla documentazione Svelte 5 e SvelteKit, più validazione del codice in tempo reale.

### Perché usarlo
- **Evita sintassi obsoleta**: Gli LLM spesso generano Svelte 4 syntax o React patterns
- **Validazione automatica**: Il codice viene verificato prima di essere mostrato
- **Docs sempre aggiornate**: Accesso diretto a Svelte 5 runes, SvelteKit 2, etc.
- **Riduce iterazioni**: Da 3-4 fix per feature a 1-2

### Tools MCP disponibili

| Tool | Descrizione | Quando usarlo |
|------|-------------|---------------|
| `list-sections` | Lista tutte le sezioni docs con use-cases | **SEMPRE PRIMA** - per trovare docs rilevanti |
| `get-documentation` | Recupera documentazione completa per sezioni | Dopo list-sections, per ottenere dettagli |
| `svelte-autofixer` | Analizza codice Svelte e ritorna issues/suggerimenti | **SEMPRE** prima di fornire codice Svelte |
| `playground-link` | Genera link al Svelte Playground con il codice | Per demo/debug/condivisione |

### Workflow obbligatorio per codice Svelte

**REGOLA: Quando generi codice Svelte, DEVI seguire questo flusso:**

1. **Chiama `list-sections`** per trovare docs rilevanti al task
2. **Chiama `get-documentation`** per recuperare le sezioni trovate
3. **Genera il codice** basandoti sulla documentazione
4. **Chiama `svelte-autofixer`** per validare il codice generato
5. **Se ci sono errori**, correggi e ri-valida
6. **Solo dopo validazione**, mostra il codice all'utente

### Esempio di utilizzo corretto

```
# Task: Creare un form con validazione

1. list-sections → trova "forms", "form-validation", "$state"
2. get-documentation(["forms", "$state"]) → ottieni docs
3. Genera codice usando $state, non vecchio syntax
4. svelte-autofixer(code) → verifica errori
5. Se OK → mostra codice
   Se errori → correggi e torna a step 4
```

### Pattern Svelte 5 da usare (NON Svelte 4)

```svelte
<!-- ✅ CORRETTO: Svelte 5 runes -->
<script>
  let count = $state(0);
  let doubled = $derived(count * 2);
  
  function increment() {
    count++;
  }
</script>

<!-- ❌ SBAGLIATO: Svelte 4 syntax -->
<script>
  let count = 0;
  $: doubled = count * 2;
</script>
```

### Configurazione

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

**MCP non risponde:**
```bash
# Test manuale
npx -y @sveltejs/mcp

# Verifica versione
npx @sveltejs/mcp --version
```

**Alternativa remota** (se locale non funziona):
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

### Pre-PR Checklist con MCP Tools

Questo workflow integra Svelte MCP + DevServer MCP + Task Master per garantire qualità prima di ogni PR.

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

# Durante lo sviluppo, l'agent usa questi tools:
# - Svelte MCP: list-sections, get-documentation, svelte-autofixer
# - DevServer MCP: get_dev_server_status, get_file_errors
```

**Agent Behavior durante sviluppo:**
1. **Prima di scrivere codice Svelte**: Consulta docs via `list-sections` + `get-documentation`
2. **Dopo aver scritto codice**: Valida con `svelte-autofixer`
3. **Durante sviluppo**: Monitora errori in tempo reale via DevServer MCP
4. **Loggare progressi**: Usa `task-master update-subtask`

#### 3. Pre-PR Validation Checklist

Prima di creare una PR, l'agent DEVE verificare:

```bash
# 1. Codice Svelte validato
# Tool: svelte-autofixer → 0 issues

# 2. Zero errori dal dev server
# Tool: get_dev_server_status
# Expected: { "status": "healthy", "errorCount": 0 }

# 3. Type check passa
pnpm run check

# 4. Tests passano (se applicabili)
pnpm run test:unit

# 5. Build di verifica
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

| Fase | Task Master | Svelte MCP | DevServer MCP |
|------|-------------|------------|---------------|
| Start | `next` | - | - |
| Begin | `set-status in-progress` | `list-sections` | `suggest_monitoring_setup` |
| Develop | `update-subtask` | `get-documentation`, `svelte-autofixer` | `get_dev_server_status`, `get_file_errors` |
| Validate | - | `svelte-autofixer` (final) | `get_error_summary` |
| Complete | `set-status done` | `playground-link` (optional) | `get_dev_server_status` (final) |

### Best Practices

1. **Docs first** - Sempre consultare Svelte MCP prima di scrivere codice
2. **Validate always** - Mai fornire codice Svelte senza `svelte-autofixer`
3. **Monitor always** - Tieni `pnpm run start` attivo con DevServer MCP
4. **Fix immediately** - Correggi errori non appena rilevati
5. **Log progress** - Usa `update-subtask` per documentare decisioni
6. **Zero issues pre-PR** - Prerequisito assoluto per ogni PR

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
        "~/MCP-SERVERS/devserver/devserver-mcp/src/server.ts",
        "--monitor",
        "--port",
        "9338",
        "pnpm run start"
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
    }
  }
}
```

### DevServer MCP Config (`devserver-mcp.config.json`)

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
