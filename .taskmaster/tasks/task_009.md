# Task ID: 9

**Title:** Integrazione Postiz API e Scheduling Agent

**Status:** pending

**Dependencies:** 5

**Priority:** medium

**Description:** Implementare l'agente di scheduling che utilizza l'API Postiz per pubblicare contenuti su multiple piattaforme social con analytics webhook.

**Details:**

1. Creare `src/lib/services/postiz.ts`:
```typescript
const POSTIZ_BASE_URL = 'https://api.postiz.com/v1';

export class PostizClient {
  constructor(private apiKey: string) {}
  
  async schedulePost(post: {
    content: string;
    media: string[];
    platforms: string[];
    scheduledAt: Date;
  }) {
    return fetch(`${POSTIZ_BASE_URL}/posts`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${this.apiKey}` },
      body: JSON.stringify(post)
    });
  }
  
  async getAnalytics(postId: string) { /* ... */ }
}
```
2. Creare `python/agents/scheduling_agent.py`:
   - Ottimizzazione orari pubblicazione per piattaforma
   - Suggerimenti basati su analytics storici
   - Gestione code pubblicazione
3. Creare UI in `src/routes/publish/+page.svelte`:
   - Form scheduling con date picker
   - Preview post per ogni piattaforma
   - Lista post schedulati
4. Implementare webhook listener in main process per analytics
5. Salvare analytics in SQLite locale
6. Piattaforme: Instagram, Facebook, LinkedIn, Twitter, TikTok

**Test Strategy:**

Test con mock Postiz API. Test UI per scheduling flow. Test webhook processing. Test E2E per flusso completo di pubblicazione.

## Subtasks

### 9.1. Creazione PostizClient TypeScript con metodi API completi

**Status:** pending  
**Dependencies:** None  

Implementare il client TypeScript per l'API Postiz con tutti i metodi necessari: schedulePost per la programmazione dei post, getAnalytics per recuperare le metriche, cancelPost per annullare pubblicazioni e getScheduledPosts per elencare i post programmati.

**Details:**

Creare `src/lib/services/postiz.ts` con la classe PostizClient che incapsula tutte le chiamate REST all'API Postiz. Implementare gestione errori robusta con retry logic, tipizzazione TypeScript completa per request/response, e supporto per rate limiting. Includere metodi: schedulePost(post), getAnalytics(postId), cancelPost(postId), getScheduledPosts(), updatePost(postId, updates). Utilizzare fetch con timeout configurabile e headers di autenticazione Bearer token.

### 9.2. Implementazione SchedulingAgent Python con ottimizzazione orari

**Status:** pending  
**Dependencies:** 9.1  

Creare l'agente Python di scheduling che analizza gli analytics storici per suggerire orari di pubblicazione ottimali per ogni piattaforma social, gestendo code di pubblicazione intelligenti.

**Details:**

Creare `python/agents/scheduling_agent.py` estendendo la classe Agent di cagent. Implementare logica di ottimizzazione orari basata su: engagement rate storico per fascia oraria, best practices per piattaforma (es. LinkedIn mattina, Instagram sera), analisi pattern utente specifici. Gestire coda pubblicazioni con priorità e conflict resolution. Esporre tool MCP: suggest_best_time(platform, content_type), optimize_schedule(posts_batch), get_platform_insights(platform).

### 9.3. UI Publish Page con form scheduling e preview multi-piattaforma

**Status:** pending  
**Dependencies:** 9.1  

Sviluppare l'interfaccia utente completa per la pubblicazione in `src/routes/publish/+page.svelte` con form di scheduling, date picker, preview per ogni piattaforma e lista post schedulati.

**Details:**

Creare pagina Svelte 5 con: form scheduling usando componenti shadcn-svelte (Input, Textarea, DatePicker, Select per piattaforme), preview real-time del post adattato a ogni piattaforma selezionata (diversi limiti caratteri, aspect ratio immagini), upload media con drag-drop, lista post schedulati con filtri per data/piattaforma/status, azioni quick (modifica, cancella, duplica). Utilizzare store Svelte 5 runes per stato reattivo. Integrare con PostizClient via IPC per operazioni CRUD.

### 9.4. Implementazione webhook listener in Electron main process

**Status:** pending  
**Dependencies:** 9.1  

Creare un server HTTP nel main process Electron per ricevere webhook di analytics da Postiz, processando e inoltrando i dati al renderer process tramite IPC.

**Details:**

Creare `electron/webhook-server.ts` con server HTTP Express/Fastify leggero su porta configurabile. Implementare endpoint POST /webhooks/postiz/analytics per ricevere notifiche. Validare signature webhook per sicurezza. Parsare payload analytics (impressions, engagement, clicks, shares per post). Inoltrare dati al renderer via IPC per aggiornamento UI real-time. Gestire lifecycle server (start/stop con app). Implementare retry queue per webhook falliti. Configurare ngrok/localtunnel per sviluppo locale.

### 9.5. Storage analytics SQLite con query e visualizzazione grafici

**Status:** pending  
**Dependencies:** 9.4  

Implementare lo storage locale degli analytics in SQLite con schema ottimizzato per query temporali e creare componenti di visualizzazione con grafici storici delle performance.

**Details:**

Estendere schema SQLite in `src/lib/db/schema.ts` con tabelle: post_analytics (post_id, platform, timestamp, impressions, engagement, clicks, shares), daily_aggregates (date, platform, totals). Creare `src/lib/services/analytics-storage.ts` con metodi: saveAnalytics(), getAnalyticsByPost(), getAnalyticsByPlatform(), getTimeRangeAggregates(). Creare componenti grafici in `src/lib/components/analytics/` usando libreria charts (Chart.js o similar): EngagementChart, PlatformComparison, TimelinePerformance. Implementare filtri data range e export CSV.
