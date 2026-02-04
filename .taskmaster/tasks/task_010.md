# Task ID: 10

**Title:** Integrazione Timeline Twick con A2UI Widgets

**Status:** pending

**Dependencies:** 1 ✓, 4 ✓, 9

**Priority:** medium

**Description:** Integrare il componente timeline Twick per visualizzazione scheduling e implementare il protocollo A2UI per generazione dinamica di widget UI dagli agenti.

**Details:**

1. Installare Twick: `npm install @twick/svelte`
2. Creare `src/routes/timeline/+page.svelte`:
```svelte
<script>
  import { Timeline, Event } from '@twick/svelte';
  import { scheduledPosts } from '$lib/stores/scheduling.svelte';
</script>
<Timeline>
  {#each $scheduledPosts as post}
    <Event date={post.scheduledAt} title={post.platform}>
      <AgentWidget type={post.widgetType} data={post.data} />
    </Event>
  {/each}
</Timeline>
```
3. Implementare `src/lib/components/agent-widgets/` sistema A2UI:
   - `WidgetRegistry.ts` - registro componenti dinamici
   - `AgentWidget.svelte` - renderer componente dinamico
   - Widget types: MediaPreview, CaptionEditor, ScheduleCard, AnalyticsChart
4. Protocollo A2UI in FastAPI:
```python
@app.post("/a2ui/generate")
async def generate_widget(request: Request):
    data = await request.json()
    widget_spec = agent.generate_ui(data['context'])
    return {"widget": widget_spec}
```
5. SSE streaming per aggiornamenti real-time dei widget
6. Drag-drop per riordinare eventi timeline
7. Integrazione con scheduling agent per date/orari

**Test Strategy:**

Test rendering timeline con mock data. Test drag-drop functionality. Test SSE updates per widget. Test integrazione A2UI con agenti.

## Subtasks

### 10.1. Installazione e Configurazione Twick con Verifica Compatibilità Svelte 5 Runes

**Status:** pending  
**Dependencies:** None  

Installare il pacchetto @twick/svelte e verificare la compatibilità con Svelte 5 runes. Creare wrapper se necessario per gestire eventuali incompatibilità con il nuovo sistema reattivo di Svelte 5.

**Details:**

1. Eseguire `npm install @twick/svelte` per installare il pacchetto
2. Verificare se Twick supporta nativamente Svelte 5 runes controllando la documentazione e i peer dependencies
3. Testare l'import base di Timeline e Event components in un file .svelte di test
4. Se Twick non supporta Svelte 5 runes, creare un wrapper component in `src/lib/components/timeline/TwickWrapper.svelte` che:
   - Converte i runes ($state, $derived) in props legacy
   - Gestisce le differenze nel lifecycle (onMount vs $effect)
   - Fornisce slot forwarding per contenuto dinamico
5. Documentare eventuali workaround necessari in un commento nel file wrapper
6. Creare un file di test `src/lib/components/timeline/Twick.test.ts` per verificare il rendering base

### 10.2. Creazione Timeline Page con Store scheduledPosts e Integrazione Base

**Status:** pending  
**Dependencies:** 10.1  

Creare la pagina timeline in SvelteKit con lo store Svelte 5 per i post schedulati e l'integrazione base con il componente Twick Timeline.

**Details:**

1. Creare lo store Svelte 5 `src/lib/stores/scheduling.svelte.ts` usando runes:
```typescript
import { $state } from 'svelte';

export interface ScheduledPost {
  id: string;
  platform: 'instagram' | 'tiktok' | 'youtube' | 'twitter';
  scheduledAt: Date;
  content: string;
  media: string[];
  widgetType: 'MediaPreview' | 'CaptionEditor' | 'ScheduleCard' | 'AnalyticsChart';
  data: Record<string, unknown>;
  status: 'pending' | 'published' | 'failed';
}

export const scheduledPosts = $state<ScheduledPost[]>([]);
```
2. Creare la route `src/routes/timeline/+page.svelte` con layout base
3. Implementare il rendering condizionale per stati vuoti/loading
4. Aggiungere stili Tailwind per il layout della timeline
5. Creare `+page.ts` per eventual server-side data loading

### 10.3. Implementazione Sistema A2UI con WidgetRegistry e AgentWidget Dinamico

**Status:** pending  
**Dependencies:** 10.1, 10.2  

Creare il sistema Agent-to-UI (A2UI) che permette la registrazione e il rendering dinamico di widget UI generati dagli agenti, con supporto per tipi multipli di widget.

**Details:**

1. Creare la directory `src/lib/components/agent-widgets/`
2. Implementare `WidgetRegistry.ts` come singleton pattern:
```typescript
type WidgetComponent = typeof import('*.svelte').default;
class WidgetRegistry {
  private widgets = new Map<string, WidgetComponent>();
  register(type: string, component: WidgetComponent): void;
  get(type: string): WidgetComponent | undefined;
  has(type: string): boolean;
}
export const widgetRegistry = new WidgetRegistry();
```
3. Creare i widget base:
   - `MediaPreview.svelte` - anteprima immagini/video con thumbnail
   - `CaptionEditor.svelte` - editor inline per caption con character count
   - `ScheduleCard.svelte` - card con date picker e platform selector
   - `AnalyticsChart.svelte` - mini chart per metriche engagement
4. Implementare `AgentWidget.svelte` con dynamic component rendering:
```svelte
<script>
  import { widgetRegistry } from './WidgetRegistry';
  export let type: string;
  export let data: Record<string, unknown>;
  $: Component = widgetRegistry.get(type);
</script>
{#if Component}
  <svelte:component this={Component} {...data} />
{/if}
```
5. Registrare tutti i widget all'avvio dell'app

### 10.4. Protocollo A2UI in FastAPI per Generazione Widget Specs

**Status:** pending  
**Dependencies:** None  

Implementare l'endpoint FastAPI per la generazione di specifiche widget basate sul contesto dell'agente, con schema di validazione e supporto per diversi tipi di widget.

**Details:**

1. Creare `python/api/a2ui.py` con l'endpoint principale:
```python
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Literal, Dict, Any

router = APIRouter(prefix='/a2ui')

class WidgetContext(BaseModel):
    agent_id: str
    post_id: str
    context_type: Literal['preview', 'edit', 'schedule', 'analytics']
    metadata: Dict[str, Any] = {}

class WidgetSpec(BaseModel):
    type: Literal['MediaPreview', 'CaptionEditor', 'ScheduleCard', 'AnalyticsChart']
    data: Dict[str, Any]
    actions: list[str] = []

@router.post('/generate', response_model=WidgetSpec)
async def generate_widget(context: WidgetContext) -> WidgetSpec:
    # Logic per generare widget spec basata su context
    pass
```
2. Implementare la logica di generazione widget per ogni tipo di contesto
3. Aggiungere validazione input con Pydantic
4. Registrare il router nel main.py FastAPI
5. Creare schema JSON per widget specs esportabile al frontend
6. Implementare caching per widget specs frequenti con Redis/memoria

### 10.5. SSE Streaming Real-time per Updates Widget e Drag-Drop Reordering Eventi

**Status:** pending  
**Dependencies:** 10.2, 10.3, 10.4  

Implementare Server-Sent Events per aggiornamenti real-time dei widget e funzionalità drag-and-drop per riordinare gli eventi nella timeline con persistenza delle modifiche.

**Details:**

1. Creare endpoint SSE in FastAPI `python/api/sse.py`:
```python
from fastapi import APIRouter
from fastapi.responses import StreamingResponse
import asyncio

router = APIRouter()

async def event_generator():
    while True:
        updates = await get_widget_updates()
        if updates:
            yield f"data: {json.dumps(updates)}\n\n"
        await asyncio.sleep(1)

@router.get('/stream/widgets')
async def widget_stream():
    return StreamingResponse(event_generator(), media_type='text/event-stream')
```
2. Creare `src/lib/services/sse-client.ts` per gestire connessione SSE lato frontend
3. Implementare reconnection logic con exponential backoff
4. Integrare gli update SSE nello store scheduledPosts
5. Implementare drag-and-drop in Timeline usando @twick/svelte API o libreria custom:
   - Event handlers per dragstart, dragover, drop
   - Visual feedback durante drag
   - Animazioni smooth per reorder
6. Creare endpoint `PATCH /timeline/reorder` per persistere nuovo ordine
7. Ottimistic UI update con rollback su errore
8. Integrare con scheduling agent per validare nuove date/orari
