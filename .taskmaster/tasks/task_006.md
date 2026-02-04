# Task ID: 6

**Title:** osxphotos Sandboxed Process + Agent Extraction Integration

**Status:** pending

**Dependencies:** 20

**Priority:** high

**Description:** Implementare processo Python sandboxed che usa osxphotos CLI per accedere alla Apple Photos Library. Comunica con FastAPI sidecar via Unix socket (JSON-RPC 2.0). Include auto-grouping temporale: se gap > 6min tra asset → crea nuova folder "momento".

**Details:**

Architettura (da PRD):
┌─────────────────────────────────────────┐
│  FastAPI Sidecar                        │
│  └─ Proxy endpoint /agent/extract       │
└─────────────────────────────────────────┘
         ↓ Unix Socket (JSON-RPC 2.0)
┌─────────────────────────────────────────┐
│  Sandboxed osxphotos Process (isolato)  │
│  ├─ ExtractionAgent SOLO                │
│  ├─ osxphotos CLI invocation            │
│  └─ Auto-grouping temporale script      │
└─────────────────────────────────────────┘

1. Creare processo osxphotos sandboxed:
   python/tools/osxphotos_sandbox/
   ├── server.py              # Unix socket JSON-RPC 2.0 server
   ├── extraction_agent.py    # Logica extraction con osxphotos CLI
   ├── temporal_grouping.py   # Script auto-grouping temporale (6min gap)
   └── requirements.txt       # osxphotos>=0.68.0

2. JSON-RPC Methods:
   - list_albums() → lista album con count, date range
   - extract_photos(params) → export con EXIF preservato
   - extract_by_date(date, auto_group=True) → NEW: auto-grouping per momenti temporali
   - get_metadata(uuid) → metadata dettagliato

3. Auto-grouping temporale:
   - Quando auto_group=True e selezione per giorno (NON album):
     - Ordina asset per timestamp
     - Se gap > 6 minuti tra asset consecutivi → crea nuova folder "momento_N"
     - Export in: ~/Exports/YYYY-MM-DD/momento_1/, momento_2/, etc.
   - Beneficio: organizzazione automatica + riduce attesa utente

4. Sicurezza (da PRD):
   - NO accesso network
   - Read-only su Photos Library
   - Write SOLO su whitelist: ~/Exports/, ~/Documents/TraeExports/
   - Circuit breaker: max 3 restart in 5 min
   - Path validation: reject `..`, symlinks non risolti

5. FastAPI proxy endpoint:
   python/api/routes/extract.py
   - POST /agent/extract → forward a Unix socket
   - SSE streaming per progress real-time
   - Validazione input + path whitelist enforcement

6. Extraction agent integration (team.yaml):
   - agent 'extraction' già esiste in team.yaml
   - NO toolset MCP per osxphotos (è processo separato)
   - Invocazione via endpoint FastAPI /agent/extract

7. UI (src/routes/extract/+page.svelte):
   - Album browser tree view
   - Date picker per estrazione giornaliera
   - Toggle "Auto-group per momenti temporali" (default ON)
   - Preview griglia foto
   - Progress bar SSE durante estrazione

**Test Strategy:**

## Unit Tests

1. Test `list_albums` con mock PhotosDB
2. Test PermissionError handling per Full Disk Access
3. Test `extract_photos` con mock photo objects
4. Test validazione destination path (no path traversal)

## Integration Tests

1. Test che il tool sia registrato in Cagent
2. Test invocazione via agente extraction

## UI Tests

1. Test toggle Upload/Photos Library
2. Test rendering album browser

## Subtasks

### 6.1. Setup osxphotos Sandboxed Process + Unix Socket Server

**Status:** pending  
**Dependencies:** None  

Creare processo Python sandboxed in python/tools/osxphotos_sandbox/ con Unix socket JSON-RPC 2.0 server per comunicare con FastAPI sidecar.

**Details:**

1. Creare directory python/tools/osxphotos_sandbox/
2. Implementare server.py con Unix socket JSON-RPC 2.0
3. Definire JSON-RPC methods: list_albums, extract_photos, extract_by_date, get_metadata
4. Gestire permessi Full Disk Access con try/except appropriato
5. Implementare connection handling e graceful shutdown
6. Creare requirements.txt con dipendenza osxphotos>=0.68.0

### 6.2. Implementazione ExtractionAgent + Temporal Grouping Script

**Status:** pending  
**Dependencies:** 6.1  

Implementare logica extraction_agent.py con osxphotos CLI invocation e script temporal_grouping.py per auto-grouping (6min gap logic).

**Details:**

1. Creare extraction_agent.py in python/tools/osxphotos_sandbox/
2. Implementare invocazione osxphotos CLI per list_albums
3. Implementare export_photos con EXIF preservation
4. Creare temporal_grouping.py per logic 6min gap → nuova folder
5. Integrazione metadata extraction (date, faces, labels)
6. Test con foto reali da Photos Library locale

### 6.3. FastAPI Proxy Endpoint + SSE Streaming

**Status:** pending  
**Dependencies:** 6.2  

Implementare endpoint FastAPI /agent/extract che fa forward a Unix socket con SSE streaming per progress real-time.

**Details:**

1. Creare python/api/routes/extract.py
2. Implementare POST /agent/extract con validazione input
3. Connect a Unix socket con JSON-RPC 2.0
4. Implementare SSE streaming per progress updates
5. Validazione path whitelist: ~/Exports/, ~/Documents/TraeExports/
6. Error handling e timeout management
