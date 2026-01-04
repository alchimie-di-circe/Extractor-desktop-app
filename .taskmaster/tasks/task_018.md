# Task ID: 18

**Title:** OPTIONAL UPGRADE: MCP Deep Search con Jina AI e Firecrawl

**Status:** pending

**Dependencies:** 4, 5, 8

**Priority:** low

**Description:** Implementare l'integrazione opzionale di Jina AI MCP e Firecrawl MCP per ricerca web approfondita, con rate limiting configurabile, quota tracking in UI, e fallback automatico a DuckDuckGo quando i servizi non sono disponibili.

**Details:**

## Struttura Directory

```
python/
├── mcp/
│   ├── __init__.py
│   ├── jina_client.py              # Wrapper Jina AI MCP
│   ├── firecrawl_client.py         # Wrapper Firecrawl MCP
│   ├── rate_limiter.py             # Token bucket rate limiter
│   └── search_orchestrator.py      # Orchestrator con fallback chain
src/lib/
├── services/
│   └── deep-search.ts              # Client TypeScript per sidecar
├── stores/
│   └── search-quota.svelte.ts      # Store Svelte 5 per quota tracking
└── components/custom/
    └── SearchQuotaWidget.svelte    # Widget UI per visualizzazione quota
electron/
└── ipc-handlers.ts                 # Estensione con handler deep search
```

## 1. Configurazione MCP Servers in `.mcp.json`

```json
{
  "mcpServers": {
    "jina-ai": {
      "command": "npx",
      "args": ["-y", "@anthropic/mcp-jina"],
      "env": {
        "JINA_API_KEY": "${JINA_API_KEY}"
      }
    },
    "firecrawl": {
      "command": "npx",
      "args": ["-y", "@anthropic/mcp-firecrawl"],
      "env": {
        "FIRECRAWL_API_KEY": "${FIRECRAWL_API_KEY}"
      }
    }
  }
}
```

## 2. Rate Limiter (`python/mcp/rate_limiter.py`)

```python
import time
from dataclasses import dataclass
from typing import Dict
import asyncio

@dataclass
class RateLimitConfig:
    requests_per_minute: int = 10
    burst_limit: int = 3

class TokenBucketRateLimiter:
    def __init__(self, config: RateLimitConfig):
        self.config = config
        self.tokens = config.burst_limit
        self.last_refill = time.time()
        self._lock = asyncio.Lock()
    
    async def acquire(self) -> bool:
        async with self._lock:
            self._refill()
            if self.tokens > 0:
                self.tokens -= 1
                return True
            return False
    
    def _refill(self):
        now = time.time()
        elapsed = now - self.last_refill
        refill_amount = elapsed * (self.config.requests_per_minute / 60)
        self.tokens = min(self.config.burst_limit, self.tokens + refill_amount)
        self.last_refill = now

    def get_wait_time(self) -> float:
        if self.tokens > 0:
            return 0
        return (1 - self.tokens) * (60 / self.config.requests_per_minute)
```

## 3. Jina AI Client (`python/mcp/jina_client.py`)

```python
from typing import List, Dict, Optional
from cagent import Tool
from .rate_limiter import TokenBucketRateLimiter, RateLimitConfig

class JinaSearchClient:
    def __init__(self, rate_limiter: TokenBucketRateLimiter):
        self.rate_limiter = rate_limiter
        self.tools = [
            Tool('jina_search', 'Deep web search via Jina AI'),
            Tool('jina_reader', 'Extract structured content from URL'),
        ]
    
    async def deep_search(self, query: str, max_results: int = 10) -> List[Dict]:
        """Ricerca web approfondita con estrazione contenuto strutturato"""
        if not await self.rate_limiter.acquire():
            wait_time = self.rate_limiter.get_wait_time()
            raise RateLimitExceeded(f"Rate limit exceeded. Retry in {wait_time:.1f}s")
        
        # Chiama Jina MCP tool via cagent
        results = await self._call_mcp_tool('jina_search', {'query': query, 'limit': max_results})
        return results
    
    async def read_url(self, url: str) -> Dict:
        """Estrae contenuto strutturato da una URL"""
        if not await self.rate_limiter.acquire():
            raise RateLimitExceeded("Rate limit exceeded")
        
        return await self._call_mcp_tool('jina_reader', {'url': url})
    
    async def _call_mcp_tool(self, tool_name: str, params: dict) -> Dict:
        # Implementazione chiamata MCP
        pass
```

## 4. Firecrawl Client (`python/mcp/firecrawl_client.py`)

```python
from typing import List, Dict
from .rate_limiter import TokenBucketRateLimiter

class FirecrawlClient:
    def __init__(self, rate_limiter: TokenBucketRateLimiter):
        self.rate_limiter = rate_limiter
    
    async def scrape_url(self, url: str, options: Dict = None) -> Dict:
        """Web scraping avanzato con rendering JavaScript"""
        if not await self.rate_limiter.acquire():
            raise RateLimitExceeded("Rate limit exceeded")
        
        return await self._call_mcp_tool('firecrawl_scrape', {
            'url': url,
            'options': options or {'waitFor': 2000, 'formats': ['markdown', 'html']}
        })
    
    async def crawl_site(self, start_url: str, max_pages: int = 10) -> List[Dict]:
        """Crawling multi-pagina con limite configurabile"""
        if not await self.rate_limiter.acquire():
            raise RateLimitExceeded("Rate limit exceeded")
        
        return await self._call_mcp_tool('firecrawl_crawl', {
            'url': start_url,
            'limit': max_pages,
            'scrapeOptions': {'formats': ['markdown']}
        })
```

## 5. Search Orchestrator con Fallback Chain (`python/mcp/search_orchestrator.py`)

```python
from typing import List, Dict, Optional
from enum import Enum
import logging

class SearchProvider(Enum):
    JINA = "jina"
    FIRECRAWL = "firecrawl"
    DUCKDUCKGO = "duckduckgo"

class DeepSearchOrchestrator:
    def __init__(self, jina: JinaSearchClient, firecrawl: FirecrawlClient, duckduckgo_tool):
        self.jina = jina
        self.firecrawl = firecrawl
        self.duckduckgo = duckduckgo_tool
        self.logger = logging.getLogger(__name__)
        
        # Quota tracking
        self.quota_used = {p.value: 0 for p in SearchProvider}
    
    async def search(self, query: str, preferred_provider: SearchProvider = SearchProvider.JINA) -> Dict:
        """Ricerca con fallback chain automatico"""
        providers = self._get_fallback_chain(preferred_provider)
        
        for provider in providers:
            try:
                result = await self._search_with_provider(provider, query)
                self.quota_used[provider.value] += 1
                return {'provider': provider.value, 'results': result, 'fallback_used': provider != preferred_provider}
            except RateLimitExceeded as e:
                self.logger.warning(f"{provider.value} rate limited: {e}")
                continue
            except ServiceUnavailable as e:
                self.logger.warning(f"{provider.value} unavailable: {e}")
                continue
        
        raise AllProvidersUnavailable("All search providers failed")
    
    async def trend_research(self, topic: str, platforms: List[str]) -> Dict:
        """Ricerca trend per CaptioningAgent"""
        results = {}
        for platform in platforms:
            query = f"{topic} {platform} trends 2025 social media"
            try:
                search_result = await self.search(query)
                results[platform] = search_result
            except AllProvidersUnavailable:
                results[platform] = {'error': 'No providers available'}
        return results
    
    def get_quota_status(self) -> Dict:
        return {
            'used': self.quota_used.copy(),
            'limits': {
                'jina': 10,  # per minute
                'firecrawl': 10,
                'duckduckgo': 'unlimited'
            }
        }
    
    def _get_fallback_chain(self, preferred: SearchProvider) -> List[SearchProvider]:
        chain = [preferred]
        if preferred != SearchProvider.JINA:
            chain.append(SearchProvider.JINA)
        if preferred != SearchProvider.FIRECRAWL:
            chain.append(SearchProvider.FIRECRAWL)
        chain.append(SearchProvider.DUCKDUCKGO)  # Always last fallback
        return chain
```

## 6. Integrazione CaptioningAgent (`python/agents/captioning_agent.py` - estensione)

```python
class CaptioningAgent:
    def __init__(self, knowledge_base, llm_provider, search_orchestrator: DeepSearchOrchestrator = None):
        self.knowledge_base = knowledge_base
        self.llm_provider = llm_provider
        self.search = search_orchestrator  # Optional deep search
    
    async def generate_caption_with_trends(self, content_desc: str, platform: str, tone: str) -> Dict:
        """Genera caption arricchita con trend research"""
        # 1. Contesto brand da RAG
        brand_context = self._get_brand_context(content_desc)
        
        # 2. Trend research (se disponibile)
        trend_context = ""
        if self.search:
            try:
                trends = await self.search.trend_research(content_desc, [platform])
                trend_context = self._format_trends(trends.get(platform, {}))
            except Exception as e:
                logging.warning(f"Trend research failed: {e}")
        
        # 3. Genera caption con contesto arricchito
        prompt = self._build_prompt(content_desc, platform, tone, brand_context, trend_context)
        return await self.llm_provider.generate(prompt)
```

## 7. TypeScript Client (`src/lib/services/deep-search.ts`)

```typescript
interface SearchQuota {
  used: Record<string, number>;
  limits: Record<string, number | 'unlimited'>;
}

interface SearchResult {
  provider: string;
  results: any[];
  fallback_used: boolean;
}

export class DeepSearchClient {
  async search(query: string, preferredProvider: 'jina' | 'firecrawl' = 'jina'): Promise<SearchResult> {
    const response = await window.electronAPI.invoke('deep-search:query', { query, preferredProvider });
    if (!response.success) throw new Error(response.error);
    return response.data;
  }
  
  async trendResearch(topic: string, platforms: string[]): Promise<Record<string, SearchResult>> {
    const response = await window.electronAPI.invoke('deep-search:trends', { topic, platforms });
    if (!response.success) throw new Error(response.error);
    return response.data;
  }
  
  async getQuotaStatus(): Promise<SearchQuota> {
    const response = await window.electronAPI.invoke('deep-search:quota');
    return response.data;
  }
}
```

## 8. Svelte 5 Store per Quota (`src/lib/stores/search-quota.svelte.ts`)

```typescript
import { DeepSearchClient } from '$lib/services/deep-search';

const client = new DeepSearchClient();

let quota = $state<SearchQuota>({ used: {}, limits: {} });
let lastUpdated = $state<Date | null>(null);

export const searchQuotaStore = {
  get quota() { return quota; },
  get lastUpdated() { return lastUpdated; },
  
  async refresh() {
    quota = await client.getQuotaStatus();
    lastUpdated = new Date();
  },
  
  getUsagePercentage(provider: string): number {
    const used = quota.used[provider] || 0;
    const limit = quota.limits[provider];
    if (limit === 'unlimited') return 0;
    return Math.min(100, (used / (limit as number)) * 100);
  }
};

// Auto-refresh ogni 30 secondi
setInterval(() => searchQuotaStore.refresh(), 30000);
```

## 9. Widget UI Quota (`src/lib/components/custom/SearchQuotaWidget.svelte`)

```svelte
<script lang="ts">
  import { searchQuotaStore } from '$lib/stores/search-quota.svelte';
  import { Progress } from '$lib/components/ui/progress';
  import { Card, CardContent, CardHeader, CardTitle } from '$lib/components/ui/card';
  import { Badge } from '$lib/components/ui/badge';
  
  const providers = ['jina', 'firecrawl', 'duckduckgo'];
</script>

<Card class="w-64">
  <CardHeader class="pb-2">
    <CardTitle class="text-sm">Search Quota</CardTitle>
  </CardHeader>
  <CardContent class="space-y-3">
    {#each providers as provider}
      {@const percentage = searchQuotaStore.getUsagePercentage(provider)}
      {@const used = searchQuotaStore.quota.used[provider] || 0}
      {@const limit = searchQuotaStore.quota.limits[provider]}
      <div class="space-y-1">
        <div class="flex justify-between text-xs">
          <span class="capitalize">{provider}</span>
          <span>{used}/{limit === 'unlimited' ? '∞' : limit}</span>
        </div>
        {#if limit !== 'unlimited'}
          <Progress value={percentage} class="h-1" />
        {:else}
          <Badge variant="outline" class="text-xs">Unlimited</Badge>
        {/if}
      </div>
    {/each}
    {#if searchQuotaStore.lastUpdated}
      <p class="text-xs text-muted-foreground">
        Updated: {searchQuotaStore.lastUpdated.toLocaleTimeString()}
      </p>
    {/if}
  </CardContent>
</Card>
```

## 10. IPC Handlers (`electron/ipc-handlers.ts` - estensione)

```typescript
// Aggiungere a registerIpcHandlers()
ipcMain.handle('deep-search:query', async (_, { query, preferredProvider }) => {
  try {
    const result = await sidecarClient.post('/search/query', { query, preferredProvider });
    return { success: true, data: result };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('deep-search:trends', async (_, { topic, platforms }) => {
  try {
    const result = await sidecarClient.post('/search/trends', { topic, platforms });
    return { success: true, data: result };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('deep-search:quota', async () => {
  try {
    const result = await sidecarClient.get('/search/quota');
    return { success: true, data: result };
  } catch (error) {
    return { success: false, error: error.message };
  }
});
```

## 11. FastAPI Endpoints (`python/main.py` - estensione)

```python
from fastapi import APIRouter
from python.mcp.search_orchestrator import DeepSearchOrchestrator, SearchProvider

search_router = APIRouter(prefix="/search", tags=["search"])

@search_router.post("/query")
async def search_query(query: str, preferredProvider: str = "jina"):
    provider = SearchProvider(preferredProvider)
    return await search_orchestrator.search(query, provider)

@search_router.post("/trends")
async def search_trends(topic: str, platforms: list[str]):
    return await search_orchestrator.trend_research(topic, platforms)

@search_router.get("/quota")
async def get_quota():
    return search_orchestrator.get_quota_status()
```

## Configurazione Rate Limiting

Il rate limiting default è 10 req/min per Jina e Firecrawl, configurabile in:
- `python/mcp/rate_limiter.py` - RateLimitConfig
- UI Settings (futuro) per override utente

**Test Strategy:**

## Test Unitari Python

### 1. `tests/unit/test_rate_limiter.py`
- Test che TokenBucketRateLimiter blocchi dopo burst_limit richieste consecutive
- Test che i token vengano ricaricati correttamente nel tempo (simulare 60s per refill completo)
- Test che `get_wait_time()` ritorni valore corretto quando rate limited
- Test concorrenza con asyncio.gather per verificare thread safety del lock

### 2. `tests/unit/test_jina_client.py`
- Test `deep_search()` con mock MCP tool che ritorna risultati validi
- Test che `RateLimitExceeded` venga sollevata quando rate limiter blocca
- Test `read_url()` con URL valida e mock response
- Test gestione errori per URL malformata

### 3. `tests/unit/test_firecrawl_client.py`
- Test `scrape_url()` con opzioni default
- Test `scrape_url()` con opzioni custom (waitFor, formats)
- Test `crawl_site()` rispetti max_pages limit
- Test rate limiting integrato

### 4. `tests/unit/test_search_orchestrator.py`
- Test fallback chain: Jina → Firecrawl → DuckDuckGo
- Test che quota tracking incrementi correttamente per ogni provider
- Test `trend_research()` con multiple piattaforme
- Test che `AllProvidersUnavailable` venga sollevata quando tutti falliscono
- Test `get_quota_status()` ritorna struttura corretta

## Test Integrazione

### 5. `tests/integration/test_captioning_with_trends.py`
- Test CaptioningAgent con mock DeepSearchOrchestrator
- Test che trend context venga incluso nel prompt quando disponibile
- Test graceful degradation quando search fallisce (caption generata comunque)
- Test che quota venga aggiornata dopo trend research

### 6. `tests/integration/test_ipc_deep_search.py`
- Test IPC handler `deep-search:query` con mock sidecar
- Test IPC handler `deep-search:trends` ritorna risultati per ogni piattaforma
- Test IPC handler `deep-search:quota` con quota parzialmente esaurita
- Test error handling per sidecar non disponibile

## Test Componenti Svelte

### 7. `tests/components/SearchQuotaWidget.test.ts`
- Test rendering con quota vuota
- Test rendering con quota parziale (50% jina, 80% firecrawl)
- Test che "unlimited" mostri badge invece di progress bar
- Test aggiornamento timestamp "lastUpdated"
- Test responsive su diverse dimensioni schermo

### 8. `tests/stores/search-quota.test.ts`
- Test `refresh()` aggiorna stato correttamente
- Test `getUsagePercentage()` calcola percentuale corretta
- Test `getUsagePercentage()` ritorna 0 per 'unlimited'
- Test auto-refresh interval (mock timers)

## Test E2E

### 9. `tests/e2e/deep-search-flow.test.ts`
- Test flusso completo: Settings → Abilita Jina API key → Caption generation con trends
- Test fallback visibile in UI quando Jina rate limited
- Test quota widget si aggiorna dopo ricerche
- Test che DuckDuckGo funzioni come fallback finale senza API key

## Test Fallback

### 10. `tests/fallback/test_duckduckgo_fallback.py`
- Test che ricerca funzioni con solo DuckDuckGo disponibile
- Test che risultati DuckDuckGo siano formattati consistentemente con Jina/Firecrawl
- Test performance: DuckDuckGo risponda entro 5s

## Metriche di Qualità

- Copertura test: minimo 80% per moduli search
- Latenza media ricerca: < 3s per Jina, < 5s per Firecrawl, < 2s per DuckDuckGo
- Rate limit accuracy: 10 ± 1 req/min
- Fallback success rate: > 99% quando almeno un provider disponibile

## Subtasks

### 18.1. Configurazione MCP Servers per Jina AI e Firecrawl

**Status:** pending  
**Dependencies:** None  

Configurare i server MCP per Jina AI e Firecrawl nel file .mcp.json, implementare il wrapper client base per entrambi i servizi e gestire le API keys tramite variabili d'ambiente.

**Details:**

Creare la configurazione MCP in .mcp.json con i server jina-ai e firecrawl utilizzando npx per l'esecuzione. Implementare python/mcp/__init__.py e le classi base JinaSearchClient e FirecrawlClient con integrazione cagent Tool. Gestire le API keys JINA_API_KEY e FIRECRAWL_API_KEY tramite variabili d'ambiente. Implementare i metodi _call_mcp_tool per invocare i tool MCP tramite cagent. Includere gestione errori per API keys mancanti e servizi non disponibili con eccezioni ServiceUnavailable.

### 18.2. Implementazione Token Bucket Rate Limiter

**Status:** pending  
**Dependencies:** None  

Implementare il sistema di rate limiting con algoritmo token bucket per controllare il numero di richieste API verso Jina AI e Firecrawl, con configurazione personalizzabile e calcolo del tempo di attesa.

**Details:**

Creare python/mcp/rate_limiter.py con la classe TokenBucketRateLimiter che implementa l'algoritmo token bucket. Definire RateLimitConfig con requests_per_minute=10 e burst_limit=3 come default. Implementare il metodo acquire() con lock asincrono per thread-safety, il metodo _refill() per ricaricare i token in base al tempo trascorso, e get_wait_time() per calcolare quanto tempo attendere prima della prossima richiesta disponibile. Sollevare eccezione RateLimitExceeded quando i token sono esauriti.

### 18.3. Search Orchestrator con Fallback Chain Automatico

**Status:** pending  
**Dependencies:** 18.1, 18.2  

Implementare l'orchestratore di ricerca che coordina Jina AI, Firecrawl e DuckDuckGo con fallback automatico, quota tracking e gestione intelligente dei provider non disponibili.

**Details:**

Creare python/mcp/search_orchestrator.py con DeepSearchOrchestrator che gestisce JinaSearchClient, FirecrawlClient e DuckDuckGo tool. Implementare il metodo search() che tenta i provider in ordine di preferenza (Jina → Firecrawl → DuckDuckGo) con gestione eccezioni RateLimitExceeded e ServiceUnavailable. Implementare _get_fallback_chain() per costruire la catena di fallback dinamica. Aggiungere quota_used tracking per ogni provider e metodo get_quota_status() per esporre le statistiche. Implementare _search_with_provider() per normalizzare le risposte dei diversi provider. Sollevare AllProvidersUnavailable solo quando tutti i provider falliscono.

### 18.4. Integrazione Trend Research in CaptioningAgent

**Status:** pending  
**Dependencies:** 18.3  

Estendere il CaptioningAgent per utilizzare il DeepSearchOrchestrator per ricerche di trend social media, arricchendo la generazione di caption con insight contestuali aggiornati.

**Details:**

Modificare python/agents/captioning_agent.py per accettare un parametro opzionale search_orchestrator: DeepSearchOrchestrator. Implementare il metodo trend_research() in DeepSearchOrchestrator che esegue ricerche multi-piattaforma usando query ottimizzate '{topic} {platform} trends 2025 social media'. Estendere generate_caption_with_trends() per combinare brand_context da RAG con trend_context da deep search. Implementare _format_trends() per normalizzare i risultati di ricerca in formato utilizzabile dal prompt LLM. Gestire gracefully i fallimenti di ricerca trend con logging warning e fallback a generazione senza trend context.

### 18.5. UI Quota Widget e IPC Handlers per Deep Search

**Status:** pending  
**Dependencies:** 18.3, 18.4  

Implementare il widget Svelte 5 per visualizzare le quote di utilizzo dei provider di ricerca, il client TypeScript per comunicare con il sidecar, e gli handler IPC Electron per collegare frontend e backend.

**Details:**

Creare src/lib/services/deep-search.ts con DeepSearchClient che espone metodi search(), trendResearch() e getQuotaStatus() tramite window.electronAPI. Implementare src/lib/stores/search-quota.svelte.ts come Svelte 5 runes store con stato reattivo per quota, lastUpdated, e metodi refresh() e getUsagePercentage(). Creare src/lib/components/custom/SearchQuotaWidget.svelte con Progress bar per Jina e Firecrawl e Badge 'Unlimited' per DuckDuckGo. Estendere electron/ipc-handlers.ts con handler 'deep-search:query', 'deep-search:trends' e 'deep-search:quota' che chiamano il sidecar FastAPI. Aggiungere FastAPI endpoints in python/main.py: POST /search/query, POST /search/trends, GET /search/quota. Implementare auto-refresh quota ogni 30 secondi nel store.
