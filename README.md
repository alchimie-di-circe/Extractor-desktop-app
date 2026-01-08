# Extractor Desktop App (Trae Extractor)

Local-first AI command center for content creators. Extract photos from Apple Photos, edit with AI,
generate captions, and schedule posts without uploading personal media to external servers by default.

## Visione
- Automatizzare l'80% del workflow media con agenti AI e controllo umano nei punti critici.
- Mantenere la privacy: dati locali, API key in keychain, processi isolati.
- UI desktop reattiva e leggera con Svelte + shadcn-svelte.

## Stato e roadmap
La pianificazione e il tracking sono gestiti in `.taskmaster/`. Vedi:
- `/.taskmaster/docs/prd.md` per la visione completa.
- `/.taskmaster/tasks/tasks.json` per l'elenco aggiornato delle task.

Focus attuale (estratto dalle task principali):
- Base UI con shadcn-svelte + routing hash.
- IPC bridge sicuro + keychain.
- Configurazione multi-provider LLM.
- Sidecar Python (FastAPI) per agenti.
- Agenti: extraction (osxphotos), editing (Cloudinary MCP), captioning (RAG), scheduling (Postiz).
- A2UI widgets + timeline (Twick).

## Stack principale
- Electron 36 + Electron Forge (main/renderer separati, context isolation).
- SvelteKit 2 + Svelte 5 Runes.
- shadcn-svelte + TailwindCSS 4.
- Task Master AI per PRD e task graph.
- Python sidecar (FastAPI) per agenti e strumenti AI.
- Cagent by Docker per definizione agenti e orchestrazione via YAML (non richiede Docker attivo).

## Architettura (high level)
```
Renderer (Svelte UI)
  -> services (IPC client)
    -> Electron preload (contextBridge)
      -> Electron main (IPC handlers, keychain, sidecar manager)
        -> Python sidecar (FastAPI, agenti Cagent)
          -> osxphotos sandbox / MCP tools / Postiz API
```

Principi chiave:
- Renderer solo UI, niente I/O pesante o logica di business.
- Operazioni costose in main process o sidecar.
- IPC tipizzato e minimale.

## Struttura progetto (attuale + pianificata)
```
electron/                   # Electron main + preload
src/                        # SvelteKit renderer
  lib/components/ui/        # shadcn-svelte
  lib/components/custom/    # componenti app
  lib/services/             # wrapper IPC
  lib/stores/               # Svelte 5 runes
.taskmaster/                # PRD + task graph
python/                     # (planned) sidecar agenti FastAPI
```

## Sviluppo locale
Requisiti: Node.js + pnpm.

Installazione:
```
pnpm install
```

Dev server Electron:
```
pnpm run dev
```
> **Note:** On macOS, `pnpm run dev` is preferred over `pnpm run start` due to a process signal issue with electron-forge. See `/docs/ELECTRON_FORGE_SETUP_FIX.md` for details.

Check e test:
```
pnpm run check
pnpm run test:unit
pnpm run test:e2e
```

Build:
```
pnpm run package
pnpm run make
```

Note:
- Routing hash: usare `#/route` nei link.
- Il progetto usa patching di SvelteKit (vedi `package.json`).
- La configurazione agenti vive in YAML (Cagent) e viene generata da settings UI.

## Task Master (workflow rapido)
```
task-master list
task-master next
task-master show <id>
task-master set-status --id=<id> --status=done
```

## Cagent (Docker) - note rapide
- Gli agenti e l'orchestrazione sono definiti in YAML (Cagent).
- Non serve Docker attivo sulla macchina host per usare Cagent.
- I tool MCP possono comunque usare Docker MCP Gateway se disponibile.

## Contributing
Linee guida per sviluppo e AI agents in `AGENTS.md`.
