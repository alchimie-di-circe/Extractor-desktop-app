# Task ID: 7

**Title:** Integrazione Cloudinary MCP per Editing Agent

**Status:** pending

**Dependencies:** 5 ✓

**Priority:** medium

**Description:** Implementare l'agente di editing che utilizza i server MCP ufficiali di Cloudinary per trasformazioni media avanzate come background removal, upscale e auto-crop.

**Details:**

1. Configurare Cloudinary MCP in `.mcp.json`:
```json
{
  "mcpServers": {
    "cloudinary": {
      "command": "npx",
      "args": ["-y", "@cloudinary/mcp-server"],
      "env": {
        "CLOUDINARY_URL": "cloudinary://..."
      }
    }
  }
}
```
2. Creare `python/agents/editing_agent.py`:
```python
from cagent import Agent, Tool

class EditingAgent(Agent):
    tools = [
        Tool('cloudinary_upload', 'Carica media su Cloudinary'),
        Tool('cloudinary_transform', 'Applica trasformazioni'),
        Tool('cloudinary_remove_bg', 'Rimuovi sfondo'),
        Tool('cloudinary_upscale', 'Upscale immagine'),
    ]
    
    async def process_media(self, media_path: str, transformations: List[str]):
        # Esegui trasformazioni via MCP
        pass
```
3. Creare UI in `src/routes/edit/+page.svelte`:
   - Preview prima/dopo trasformazione
   - Pannello trasformazioni con preset
   - Slider per parametri (qualità, dimensioni)
   - Batch processing per multiple immagini
4. Implementare cache locale per preview
5. Gestione quota Cloudinary e fallback

**Test Strategy:**

Test con mock MCP server per Cloudinary. Test UI per selezione trasformazioni. Test batch processing con multiple immagini.

## Subtasks

### 7.1. Configurazione Cloudinary MCP Server in .mcp.json

**Status:** pending  
**Dependencies:** None  

Aggiungere la configurazione del server MCP Cloudinary al file .mcp.json esistente, includendo il comando npx per il package @cloudinary/mcp-server e le variabili ambiente necessarie per l'autenticazione.

**Details:**

1. Aprire il file `.mcp.json` esistente che già contiene la configurazione task-master-ai
2. Aggiungere una nuova entry `cloudinary` nell'oggetto `mcpServers`
3. Configurare il comando: `"command": "npx"` con args `["-y", "@cloudinary/mcp-server"]`
4. Aggiungere le variabili ambiente: `CLOUDINARY_URL` (formato cloudinary://API_KEY:API_SECRET@CLOUD_NAME), `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`
5. Creare file `.env.example` con placeholder per le credenziali Cloudinary
6. Documentare nel README come ottenere le credenziali dalla dashboard Cloudinary

### 7.2. Implementazione EditingAgent Python con wrapper MCP tools

**Status:** pending  
**Dependencies:** 7.1  

Creare l'agente Python per l'editing che incapsula le chiamate ai tool MCP di Cloudinary, gestendo upload, trasformazioni, background removal e upscale delle immagini.

**Details:**

1. Creare la directory `python/agents/` se non esiste
2. Creare `python/agents/editing_agent.py` con classe `EditingAgent`
3. Implementare metodi wrapper per tool MCP:
   - `upload_media(file_path: str) -> str` - Carica su Cloudinary e ritorna public_id
   - `apply_transform(public_id: str, transformations: dict) -> str` - Applica trasformazioni
   - `remove_background(public_id: str) -> str` - Rimuovi sfondo con AI
   - `upscale_image(public_id: str, scale: float) -> str` - Upscale con IA
   - `auto_crop(public_id: str, aspect_ratio: str) -> str` - Crop intelligente
4. Implementare gestione errori e retry logic per chiamate MCP
5. Creare types/models per input/output delle trasformazioni
6. Aggiungere logging per debug delle operazioni MCP

### 7.3. UI Edit Page con preview before/after e pannello trasformazioni

**Status:** pending  
**Dependencies:** 7.2  

Creare la pagina di editing in Svelte con visualizzazione side-by-side prima/dopo le trasformazioni, pannello per selezionare e configurare le trasformazioni disponibili.

**Details:**

1. Creare `src/routes/edit/+page.svelte` come pagina principale di editing
2. Implementare componente `BeforeAfterPreview.svelte`:
   - Layout split-view con slider trascinabile
   - Immagine originale a sinistra, trasformata a destra
   - Opzione toggle per view overlay
3. Creare `TransformationsPanel.svelte` con:
   - Lista preset trasformazioni (background removal, upscale 2x/4x, auto-crop)
   - Slider per parametri regolabili (qualità 1-100, dimensioni)
   - Pulsanti per applicare/annullare trasformazioni
4. Implementare store Svelte 5 `editing-state.svelte.ts` per:
   - Immagine corrente e cronologia trasformazioni
   - Stato loading per ogni operazione
   - Undo/redo stack
5. Integrare con EditingAgent tramite IPC per operazioni reali

### 7.4. Implementazione batch processing con progress tracking

**Status:** pending  
**Dependencies:** 7.3  

Estendere l'UI e l'agent per supportare l'elaborazione batch di multiple immagini con barra di progresso, gestione code e possibilità di annullamento.

**Details:**

1. Creare componente `BatchProcessor.svelte` con:
   - Drag-drop zone per upload multiplo
   - Lista immagini in coda con status individuale
   - Barra progresso globale e per-immagine
   - Pulsanti pausa/riprendi/annulla
2. Implementare `BatchQueue` class in EditingAgent:
   - Coda FIFO con priorità opzionale
   - Processamento parallelo configurabile (max concurrent)
   - Gestione errori senza bloccare la coda
   - Emit eventi per aggiornamento progress
3. Creare `batch-progress.svelte.ts` store per:
   - Tracking stato ogni immagine (pending/processing/done/error)
   - Percentuale completamento globale
   - Tempo stimato rimanente
4. Implementare IPC handlers per streaming progress updates
5. Salvare risultati batch in directory configurabile

### 7.5. Cache locale preview e gestione quota Cloudinary con fallback

**Status:** pending  
**Dependencies:** 7.4  

Implementare sistema di cache locale per le preview delle trasformazioni, monitoraggio quota Cloudinary e meccanismo di fallback per quando la quota è esaurita.

**Details:**

1. Creare `src/lib/services/preview-cache.ts`:
   - Cache LRU in memoria con limite configurabile
   - Persistenza su disco per preview già generate
   - Chiave cache basata su hash immagine + parametri trasformazione
   - TTL configurabile per invalidazione
2. Implementare `CloudinaryQuotaManager` in `quota-manager.ts`:
   - Polling periodico API Cloudinary per usage stats
   - Threshold warning (80%) e critical (95%)
   - Emit eventi per notifiche UI
3. Creare fallback chain:
   - Primario: Cloudinary cloud
   - Secondario: Processamento locale con Sharp (npm)
   - Notifica utente quando in modalità fallback
4. UI per visualizzare stato quota:
   - Badge nell'header con % utilizzo
   - Modal dettagli quota quando cliccato
5. Configurazione in settings per soglie e comportamento fallback
