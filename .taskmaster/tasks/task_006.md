# Task ID: 6

**Title:** osxphotos Sandboxed Process + Agent Extraction Integration

**Status:** pending

**Dependencies:** 4 ✓, 20

**Priority:** high

**Description:** Implementare stack estrazione foto sicuro: processo Python isolato (sandboxed) per osxphotos, bridge IPC Electron, supervisione lifecycle lato main process e integrazione Cagent agent 'extraction'. Comunica con FastAPI sidecar via Unix socket (JSON-RPC 2.0). Include auto-grouping temporale: se gap > 6min tra asset → crea nuova folder "momento".

**Details:**

Super Task (unificazione ex-task 6 + 15). Architettura a 5 layer:

┌─────────────────────────────────────────────────────────────┐
│  LAYER 1 – INFRA SANDBOXED  (python/sandboxed/)            │
│  ├─ server.py           # Unix socket JSON-RPC 2.0 server  │
│  ├─ jsonrpc_handler.py  # Dispatcher metodi                │
│  ├─ network_lock.py     # monkey-patch socket per blocco   │
│  └─ path_whitelist.py   # Validazione ~/Exports only       │
└─────────────────────────────────────────────────────────────┘
         ↕ Unix Socket (/tmp/trae-osxphotos.sock)
┌─────────────────────────────────────────────────────────────┐
│  LAYER 2 – LOGICA ESTRAZIONE                               │
│  python/sandboxed/
│  ├─ photos_service.py   # Wrapper osxphotos                │
│  │   (list_albums, get_photos, export_photo, get_metadata)  │
│  └─ temporal_grouping.py # Auto-grouping 6min gap logic    │
└─────────────────────────────────────────────────────────────┘
         ↕ IPC Bridge (Electron ↔ Python)
┌─────────────────────────────────────────────────────────────┐
│  LAYER 3 – ELECTRON SUPERVISOR                             │
│  electron/osxphotos-supervisor.ts                          │
│  ├─ Lifecycle processo (spawn, kill, restart)              │
│  ├─ Circuit Breaker (stop dopo 3 crash in 5 min)          │
│  ├─ IPC Bridge: channels osxphotos:*                      │
│  └─ Integrazione con SidecarManager esistente             │
│      (electron/sidecar-manager.ts pattern di riferimento)  │
└─────────────────────────────────────────────────────────────┘
         ↕ Agent Tool
┌─────────────────────────────────────────────────────────────┐
│  LAYER 4 – AGENT INTEGRATION                               │
│  python/tools/osxphotos_tool.py                            │
│  ├─ Client Unix socket verso sandboxed process             │
│  ├─ Metodi: list_albums, extract_photos, extract_by_date   │
│  └─ Registrazione in python/team.yaml → agente extraction  │
└─────────────────────────────────────────────────────────────┘
         ↕ UI
┌─────────────────────────────────────────────────────────────┐
│  LAYER 5 – UI                                              │
│  src/routes/extract/+page.svelte                           │
│  ├─ Tab: Upload (esistente) | Photos Library (NUOVO)      │
│  ├─ Album browser tree view                               │
│  ├─ Date picker per estrazione giornaliera                │
│  ├─ Toggle "Auto-group per momenti" (default ON)          │
│  ├─ Preview griglia foto                                  │
│  └─ SSE progress bar durante estrazione                   │
└─────────────────────────────────────────────────────────────┘

FILE ESISTENTI DA MODIFICARE/ESTENDERE:
- electron/sidecar-manager.ts → pattern di riferimento per supervisor (Circuit Breaker, health check, exponential backoff già implementati)
- electron/ipc-handlers.ts → aggiungere registerOsxphotosHandlers()
- electron/preload.ts → aggiungere osxphotosApi nel desktopApi
- shared/ipc-channels.ts → aggiungere OsxphotosChannels
- src/app.d.ts → estendere ElectronAPI con sezione osxphotos
- python/main.py → aggiungere proxy endpoint /agent/extract che forwarda a Unix socket
- src/routes/extract/+page.svelte → ristrutturare con tabs Upload/Photos Library

FILE NUOVI DA CREARE:
- python/sandboxed/server.py
- python/sandboxed/jsonrpc_handler.py
- python/sandboxed/network_lock.py
- python/sandboxed/path_whitelist.py
- python/sandboxed/photos_service.py
- python/sandboxed/temporal_grouping.py
- python/sandboxed/requirements.txt (osxphotos>=0.68.0)
- python/tools/osxphotos_tool.py
- electron/osxphotos-supervisor.ts

SICUREZZA:
- monkey-patch socket.socket per impedire connessioni di rete dal processo sandboxed
- Read-only su Photos Library
- Write SOLO su whitelist: ~/Exports/, ~/Documents/TraeExports/
- Path validation: reject '..', symlinks non risolti, null bytes (pattern da ipc-handlers.ts:42-72)
- Circuit Breaker: max 3 restart in 5 min (pattern da sidecar-manager.ts:337-346)

**Test Strategy:**

## Unit Tests

1. Test `list_albums` con mock osxphotos.PhotosDB
2. Test PermissionError handling per Full Disk Access
3. Test `export_photo` con mock photo objects e EXIF preservation
4. Test validazione destination path (no path traversal) in path_whitelist.py
5. Test network_lock.py blocca connessioni socket
6. Test temporal_grouping.py: gap > 6min crea nuova folder
7. Test temporal_grouping.py: asset nello stesso momento restano nella stessa folder
8. Test osxphotos_tool.py client socket con mock server

## Integration Tests

1. Test JSON-RPC round-trip: client → Unix socket → server → response
2. Test Circuit Breaker in osxphotos-supervisor.ts (simulare 3 crash)
3. Test IPC Bridge: renderer → preload → main → supervisor → sandboxed process
4. Test che il tool osxphotos sia registrato in team.yaml e visibile dall'agente extraction
5. Test proxy endpoint /agent/extract in python/main.py

## UI Tests

1. Test rendering tabs Upload/Photos Library in src/routes/extract/+page.svelte
2. Test toggle Auto-group attivo/disattivo
3. Test album browser tree view con mock data
4. Test SSE progress bar durante estrazione simulata
5. Test selezione multipla in griglia foto

## Subtasks

### 6.1. INFRA SANDBOXED: Unix Socket Server + JSON-RPC + Security Lock

**Status:** pending  
**Dependencies:** None  

Creare python/sandboxed/ con Unix socket JSON-RPC 2.0 server, dispatcher metodi, monkey-patch socket per blocco rete e path whitelist per ~/Exports.

**Details:**

Creare la directory python/sandboxed/ e i seguenti file:

1. **server.py**: Unix socket server JSON-RPC 2.0 su /tmp/trae-osxphotos.sock
   - Accettare connessioni su socket Unix
   - Leggere richieste JSON-RPC, delegare a jsonrpc_handler.py
   - Gestire graceful shutdown (SIGTERM/SIGINT)
   - Logging strutturato

2. **jsonrpc_handler.py**: Dispatcher metodi JSON-RPC
   - Registrare metodi: list_albums, get_photos, export_photo, extract_by_date, get_metadata
   - Validare parametri con Pydantic
   - Gestire errori JSON-RPC standard (method not found, invalid params, internal error)

3. **network_lock.py**: Monkey-patch socket al boot del processo
   - Sovrascrivere socket.socket.__init__ per bloccare AF_INET / AF_INET6
   - Permettere solo AF_UNIX
   - Importare prima di qualsiasi altro modulo

4. **path_whitelist.py**: Validazione percorsi di output
   - Whitelist: ~/Exports/, ~/Documents/TraeExports/
   - Reject: '..', null bytes, symlink non risolti
   - Pattern da ipc-handlers.ts:42-72 (validateAndNormalizePath)

5. **requirements.txt**: osxphotos>=0.68.0

Riferimento architettura: il sidecar FastAPI esiste già in python/main.py con pattern simile per health check e SSE streaming.

### 6.2. LOGICA ESTRAZIONE: PhotosService + Temporal Grouping

**Status:** pending  
**Dependencies:** 6.1  

Implementare photos_service.py (wrapper osxphotos con list_albums, get_photos, export_photo, get_metadata) e temporal_grouping.py (auto-grouping 6min gap logic).

**Details:**

Creare in python/sandboxed/:

1. **photos_service.py**: Wrapper su osxphotos library
   - `list_albums()` → lista album con count, date range
   - `get_photos(album_uuid)` → lista foto con thumbnail, metadata base
   - `export_photo(uuid, dest_path)` → export singola foto con EXIF preservato
   - `extract_by_date(date, auto_group=True)` → export tutte le foto di un giorno
   - `get_metadata(uuid)` → metadata completo (EXIF, faces, labels, location)
   - Gestire PermissionError per Full Disk Access mancante
   - Usare osxphotos.PhotosDB() per accesso alla libreria

2. **temporal_grouping.py**: Logica auto-grouping
   - Input: lista asset con timestamp, directory di destinazione
   - Ordinare asset per timestamp
   - Se gap > 6 minuti tra asset consecutivi → nuova folder 'momento_N'
   - Output: ~/Exports/YYYY-MM-DD/momento_1/, momento_2/, etc.
   - Usare path_whitelist.py per validare tutte le directory di output

3. Integrare photos_service con jsonrpc_handler.py registrando i metodi

NOTA: usare osxphotos come library Python, NON come CLI subprocess.

### 6.3. ELECTRON SUPERVISOR: osxphotos-supervisor.ts + IPC Bridge

**Status:** pending  
**Dependencies:** 6.1  

Creare electron/osxphotos-supervisor.ts per lifecycle management del processo sandboxed, Circuit Breaker, e IPC bridge con canali osxphotos:*.

**Details:**

1. **electron/osxphotos-supervisor.ts**: Modellato su sidecar-manager.ts (electron/sidecar-manager.ts)
   - Spawn processo Python: `python3 python/sandboxed/server.py`
   - Health check via JSON-RPC ping su Unix socket
   - Circuit Breaker: max 3 crash in 5 min → stop (pattern da sidecar-manager.ts:337-346)
   - Exponential backoff su restart (pattern da sidecar-manager.ts:358-361)
   - Graceful shutdown: SIGTERM → wait 2s → SIGKILL
   - Emettere eventi a renderer: 'osxphotos:event'
   - Export singleton: `export const osxphotosSupervisor = new OsxphotosSupervisor()`

2. **shared/ipc-channels.ts**: Aggiungere OsxphotosChannels
   ```typescript
   export const OsxphotosChannels = {
     START: 'osxphotos:start',
     STOP: 'osxphotos:stop',
     STATUS: 'osxphotos:status',
     LIST_ALBUMS: 'osxphotos:list-albums',
     EXTRACT: 'osxphotos:extract',
     EXTRACT_BY_DATE: 'osxphotos:extract-by-date',
     EVENT: 'osxphotos:event',
   } as const;
   ```

3. **electron/ipc-handlers.ts**: Aggiungere `registerOsxphotosHandlers()`
   - Handler per ogni canale OsxphotosChannels
   - Validazione input (pattern da registerKeychainHandlers)
   - Chiamare registerOsxphotosHandlers() dentro registerIpcHandlers()

4. **electron/preload.ts**: Aggiungere `osxphotosApi` nel desktopApi
   - listAlbums, extract, extractByDate, start, stop, status, onEvent

5. **src/app.d.ts**: Estendere ElectronAPI con sezione osxphotos

### 6.4. AGENT INTEGRATION: osxphotos_tool.py + team.yaml Update

**Status:** pending  
**Dependencies:** 6.1, 6.2  

Creare python/tools/osxphotos_tool.py come client Unix socket verso il processo sandboxed e aggiornare python/team.yaml per registrarlo nell'agente 'extraction'.

**Details:**

1. **python/tools/osxphotos_tool.py**: Client Cagent tool
   - Classe OsxphotosTool che implementa l'interfaccia tool Cagent
   - Connessione a Unix socket /tmp/trae-osxphotos.sock
   - Metodi esposti come tool actions:
     - `list_albums()` → JSON-RPC call a sandboxed server
     - `extract_photos(album_uuid, dest)` → forward con progress callback
     - `extract_by_date(date, auto_group)` → forward con streaming
     - `get_metadata(uuid)` → forward
   - Timeout configurabile per ogni call
   - Retry logic per connessione socket

2. **python/team.yaml** update:
   - Aggiungere il tool osxphotos nell'agente 'extraction'
   - NON usare MCP per osxphotos (è processo separato sandboxed)
   - L'agente extraction invoca il tool che a sua volta parla con il sandboxed process

3. **python/main.py**: Aggiungere proxy endpoint
   - POST /agent/extract → forward richiesta a Unix socket
   - GET /agent/extract/stream/{request_id} → SSE streaming progress
   - Riusare pattern SSE da agent_event_generator() esistente (python/main.py:116-152)
   - Validazione input + path whitelist enforcement lato API

NOTA: Dipende da Task 20 (Integrazione Runtime Cagent) per il runtime effettivo degli agenti.

### 6.5. UI: Extract Page con Tabs Upload/Photos Library + Album Browser

**Status:** pending  
**Dependencies:** 6.3  

Ristrutturare src/routes/extract/+page.svelte con sistema a tabs (Upload esistente | Photos Library nuovo), album browser tree view, date picker, toggle auto-group e SSE progress bar.

**Details:**

Modificare src/routes/extract/+page.svelte (attualmente ha solo upload area + placeholder cards).

1. **Tabs shadcn**: Upload (contenuto esistente) | Photos Library (nuovo)
   - Usare componente Tabs da shadcn-svelte (già installato in src/lib/components/ui/tabs/)
   - Tab Upload: mantenere Card upload + Extraction Options esistenti
   - Tab Photos Library: nuovo contenuto

2. **Photos Library tab**:
   - Album Browser: tree view con album gerarchici
     - Chiamare `window.electronAPI.osxphotos.listAlbums()` via IPC
     - Mostrare nome album, count foto, date range
   - Date Picker: componente per selezionare un giorno specifico
     - Usare shadcn-svelte date picker (installare se necessario)
   - Toggle "Auto-group per momenti temporali" (default ON)
     - Switch shadcn-svelte
   - Preview griglia foto (thumbnail grid)
     - Lazy loading con IntersectionObserver
   - Progress bar SSE durante estrazione
     - Connessione SSE a /agent/extract/stream/{id}
     - Mostrare percentuale, file corrente, tempo stimato

3. **States**: empty, loading, error, success
   - Empty: istruzioni per abilitare Full Disk Access
   - Loading: skeleton cards
   - Error: messaggio con retry
   - Success: link alla cartella di output

4. **Svelte 5 runes**: usare $state, $derived, $effect

Validare con svelte-autofixer MCP prima di finalizzare.
