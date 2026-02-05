# Task ID: 19

**Title:** OPTIONAL UPGRADE: Docker Model Runner per LLM Locali

**Status:** pending

**Dependencies:** 3 ✓, 4 ✓, 5 ✓, 16

**Priority:** low

**Description:** Implementare l'integrazione opzionale con Docker Model Runner per l'esecuzione locale di modelli LLM (Qwen, Llama, Mistral, Gemma) senza costi API, includendo detection Docker Desktop 4.40+, UI Model Browser con download manager, benchmark performance e integrazione come provider 'dmr' in cagent.yaml con fallback automatico a cloud.

**Details:**

## Struttura Directory

```
electron/
├── docker-model-runner.ts          # Detection e gestione Docker Model Runner
├── dmr-benchmark.ts                 # Benchmark locale vs cloud
└── ipc-handlers.ts                  # Estensione con handler DMR

python/
├── providers/
│   ├── __init__.py
│   ├── dmr_provider.py              # Provider LLM per Docker Model Runner
│   └── fallback_manager.py          # Gestione fallback locale → cloud

src/lib/
├── services/
│   └── dmr-client.ts                # Client TypeScript per Docker Model Runner
├── stores/
│   └── dmr-models.svelte.ts         # Store Svelte 5 per modelli locali
└── components/custom/
    ├── DMRModelBrowser.svelte       # Browser modelli disponibili
    ├── DMRDownloadManager.svelte    # Download con progress bar
    └── DMRBenchmarkCard.svelte      # Risultati benchmark

src/routes/settings/
└── local-llm/
    └── +page.svelte                 # Pagina settings LLM locali
```

## 1. Detection Docker Desktop e Model Runner (`electron/docker-model-runner.ts`)

```typescript
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

interface DockerDesktopInfo {
  installed: boolean;
  version: string | null;
  modelRunnerEnabled: boolean;
  platform: 'macos' | 'windows' | 'linux';
  architecture: 'arm64' | 'amd64';
}

interface DMRModel {
  name: string;
  size: string;
  quantization: string;
  downloaded: boolean;
  downloadProgress?: number;
}

export class DockerModelRunnerDetector {
  async detectDockerDesktop(): Promise<DockerDesktopInfo> {
    try {
      // Verifica Docker Desktop (NON solo Engine)
      const { stdout: versionOutput } = await execAsync('docker version --format "{{.Server.Platform.Name}}"');
      const isDesktop = versionOutput.includes('Docker Desktop');
      
      if (!isDesktop) {
        return { installed: false, version: null, modelRunnerEnabled: false, platform: this.getPlatform(), architecture: this.getArch() };
      }
      
      // Estrai versione Docker Desktop
      const { stdout: fullVersion } = await execAsync('docker version --format "{{.Client.Version}}"');
      const version = fullVersion.trim();
      const [major, minor] = version.split('.').map(Number);
      
      // Richiede Docker Desktop 4.40+
      const meetsMinVersion = major > 4 || (major === 4 && minor >= 40);
      
      // Verifica Model Runner enabled
      const modelRunnerEnabled = meetsMinVersion && await this.checkModelRunnerEnabled();
      
      return {
        installed: true,
        version,
        modelRunnerEnabled,
        platform: this.getPlatform(),
        architecture: this.getArch()
      };
    } catch (error) {
      return { installed: false, version: null, modelRunnerEnabled: false, platform: this.getPlatform(), architecture: this.getArch() };
    }
  }
  
  private async checkModelRunnerEnabled(): Promise<boolean> {
    try {
      // Docker Model Runner espone endpoint OpenAI-compatibile su localhost
      const { stdout } = await execAsync('curl -s http://localhost:12434/v1/models');
      return stdout.includes('models');
    } catch {
      return false;
    }
  }
  
  async listAvailableModels(): Promise<DMRModel[]> {
    // Modelli supportati da Docker Model Runner
    return [
      { name: 'ai/qwen2.5:7B-Q4_K_M', size: '4.4GB', quantization: 'Q4_K_M', downloaded: false },
      { name: 'ai/qwen2.5:14B-Q4_K_M', size: '8.9GB', quantization: 'Q4_K_M', downloaded: false },
      { name: 'ai/llama3.2:3B-Q4_K_M', size: '2.0GB', quantization: 'Q4_K_M', downloaded: false },
      { name: 'ai/llama3.1:8B-Q4_K_M', size: '4.9GB', quantization: 'Q4_K_M', downloaded: false },
      { name: 'ai/mistral:7B-Q4_K_M', size: '4.4GB', quantization: 'Q4_K_M', downloaded: false },
      { name: 'ai/gemma2:9B-Q4_K_M', size: '5.4GB', quantization: 'Q4_K_M', downloaded: false },
    ];
  }
  
  async pullModel(modelName: string, onProgress: (progress: number) => void): Promise<boolean> {
    return new Promise((resolve, reject) => {
      const proc = exec(`docker model pull ${modelName}`);
      
      proc.stdout?.on('data', (data) => {
        // Parse progress da output Docker
        const match = data.match(/(\d+)%/);
        if (match) onProgress(parseInt(match[1]));
      });
      
      proc.on('close', (code) => resolve(code === 0));
      proc.on('error', reject);
    });
  }
}
```

## 2. Provider Python per Docker Model Runner (`python/providers/dmr_provider.py`)

```python
from typing import AsyncIterator, Optional
import httpx
import json

class DockerModelRunnerProvider:
    """Provider LLM che utilizza Docker Model Runner via API OpenAI-compatibile."""
    
    def __init__(self, base_url: str = "http://localhost:12434/v1"):
        self.base_url = base_url
        self.client = httpx.AsyncClient(base_url=base_url, timeout=120.0)
    
    async def health_check(self) -> bool:
        """Verifica che Docker Model Runner sia attivo."""
        try:
            response = await self.client.get("/models")
            return response.status_code == 200
        except httpx.RequestError:
            return False
    
    async def list_models(self) -> list[dict]:
        """Elenca modelli disponibili localmente."""
        response = await self.client.get("/models")
        data = response.json()
        return data.get("data", [])
    
    async def chat_completion(
        self,
        model: str,
        messages: list[dict],
        temperature: float = 0.7,
        max_tokens: int = 2048,
        stream: bool = False
    ) -> AsyncIterator[str] | dict:
        """Esegue inference locale con streaming opzionale."""
        payload = {
            "model": model,
            "messages": messages,
            "temperature": temperature,
            "max_tokens": max_tokens,
            "stream": stream
        }
        
        if stream:
            async with self.client.stream("POST", "/chat/completions", json=payload) as response:
                async for line in response.aiter_lines():
                    if line.startswith("data: "):
                        chunk = line[6:]
                        if chunk != "[DONE]":
                            yield json.loads(chunk)["choices"][0]["delta"].get("content", "")
        else:
            response = await self.client.post("/chat/completions", json=payload)
            return response.json()
    
    async def close(self):
        await self.client.aclose()
```

## 3. Fallback Manager (`python/providers/fallback_manager.py`)

```python
from typing import Optional
import logging

logger = logging.getLogger(__name__)

class FallbackManager:
    """Gestisce fallback automatico da locale a cloud."""
    
    def __init__(self, local_provider, cloud_providers: dict):
        self.local = local_provider
        self.cloud_providers = cloud_providers  # {'anthropic': ..., 'openai': ...}
        self.local_failures = 0
        self.max_local_failures = 3
    
    async def execute_with_fallback(
        self,
        model: str,
        messages: list[dict],
        preferred_cloud: str = "anthropic",
        **kwargs
    ):
        """Esegue locale con fallback automatico a cloud."""
        
        # Tentativo locale
        if self.local_failures < self.max_local_failures:
            try:
                if await self.local.health_check():
                    result = await self.local.chat_completion(model, messages, **kwargs)
                    self.local_failures = 0  # Reset su successo
                    return {"source": "local", "result": result}
            except Exception as e:
                self.local_failures += 1
                logger.warning(f"Local model failed ({self.local_failures}/{self.max_local_failures}): {e}")
        
        # Fallback a cloud
        cloud = self.cloud_providers.get(preferred_cloud)
        if cloud:
            logger.info(f"Falling back to cloud provider: {preferred_cloud}")
            result = await cloud.chat_completion(messages, **kwargs)
            return {"source": "cloud", "provider": preferred_cloud, "result": result}
        
        raise RuntimeError("No available LLM provider (local failed, no cloud configured)")
```

## 4. UI Model Browser (`src/lib/components/custom/DMRModelBrowser.svelte`)

```svelte
<script lang="ts">
  import { Card, CardContent, CardHeader, CardTitle } from '$lib/components/ui/card';
  import { Button } from '$lib/components/ui/button';
  import { Progress } from '$lib/components/ui/progress';
  import { Badge } from '$lib/components/ui/badge';
  import { dmrModelsStore } from '$lib/stores/dmr-models.svelte';
  import { Download, Check, Cpu, HardDrive } from 'lucide-svelte';
  
  interface Model {
    name: string;
    displayName: string;
    size: string;
    quantization: string;
    downloaded: boolean;
    downloading: boolean;
    downloadProgress: number;
    recommended: boolean;
    minRam: string;
  }
  
  let { models, dockerStatus } = $derived(dmrModelsStore);
  
  async function downloadModel(model: Model) {
    await window.electronAPI.dmr.pullModel(model.name);
  }
  
  function formatModelName(name: string): string {
    return name.replace('ai/', '').replace(/:.*/, '');
  }
</script>

<div class="space-y-4">
  {#if !dockerStatus.modelRunnerEnabled}
    <Card class="border-yellow-500 bg-yellow-50 dark:bg-yellow-950">
      <CardContent class="pt-6">
        <p class="text-yellow-800 dark:text-yellow-200">
          Docker Desktop 4.40+ con Model Runner è richiesto per i modelli locali.
          <a href="https://docs.docker.com/desktop/features/model-runner/" class="underline" target="_blank">
            Scopri come abilitarlo
          </a>
        </p>
      </CardContent>
    </Card>
  {:else}
    <div class="grid gap-4 md:grid-cols-2">
      {#each models as model}
        <Card class:border-green-500={model.downloaded}>
          <CardHeader class="pb-2">
            <div class="flex items-center justify-between">
              <CardTitle class="text-lg">{formatModelName(model.name)}</CardTitle>
              {#if model.recommended}
                <Badge variant="secondary">Raccomandato</Badge>
              {/if}
            </div>
          </CardHeader>
          <CardContent>
            <div class="flex items-center gap-4 text-sm text-muted-foreground mb-4">
              <span class="flex items-center gap-1">
                <HardDrive class="h-4 w-4" />
                {model.size}
              </span>
              <span class="flex items-center gap-1">
                <Cpu class="h-4 w-4" />
                {model.minRam} RAM min
              </span>
              <Badge variant="outline">{model.quantization}</Badge>
            </div>
            
            {#if model.downloading}
              <Progress value={model.downloadProgress} class="mb-2" />
              <p class="text-sm text-muted-foreground">{model.downloadProgress}% completato</p>
            {:else if model.downloaded}
              <Button variant="outline" disabled class="w-full">
                <Check class="mr-2 h-4 w-4" />
                Installato
              </Button>
            {:else}
              <Button onclick={() => downloadModel(model)} class="w-full">
                <Download class="mr-2 h-4 w-4" />
                Download
              </Button>
            {/if}
          </CardContent>
        </Card>
      {/each}
    </div>
  {/if}
</div>
```

## 5. Integrazione cagent.yaml con provider 'dmr'

Estendere `src/lib/services/cagent-config.ts` per supportare il provider DMR:

```typescript
// Aggiungere a CagentConfig interface
type LLMProvider = 'anthropic' | 'openai' | 'google' | 'perplexity' | 'dmr';

interface AgentRole {
  name: string;
  model: string;
  provider: LLMProvider;
  fallbackProvider?: LLMProvider; // Fallback automatico se locale fallisce
  // ...
}

// Template YAML per DMR
const DMR_CONFIG_TEMPLATE = `
agents:
  captioning_agent:
    provider: dmr
    model: ai/qwen2.5:7B-Q4_K_M
    fallback_provider: anthropic
    fallback_model: claude-3-haiku
  extraction_agent:
    provider: dmr
    model: ai/llama3.2:3B-Q4_K_M
    fallback_provider: openai
    fallback_model: gpt-4o-mini
`;
```

## 6. Benchmark Performance (`electron/dmr-benchmark.ts`)

```typescript
interface BenchmarkResult {
  model: string;
  provider: 'local' | 'cloud';
  tokensPerSecond: number;
  latencyMs: number;
  memoryUsageMB: number;
  quality: 'high' | 'medium' | 'low';
}

export async function runBenchmark(
  localModel: string,
  cloudProvider: string,
  cloudModel: string,
  testPrompt: string
): Promise<{local: BenchmarkResult, cloud: BenchmarkResult}> {
  // Benchmark locale
  const localStart = Date.now();
  const localResult = await callDMR(localModel, testPrompt);
  const localLatency = Date.now() - localStart;
  
  // Benchmark cloud
  const cloudStart = Date.now();
  const cloudResult = await callCloud(cloudProvider, cloudModel, testPrompt);
  const cloudLatency = Date.now() - cloudStart;
  
  return {
    local: {
      model: localModel,
      provider: 'local',
      tokensPerSecond: calculateTPS(localResult, localLatency),
      latencyMs: localLatency,
      memoryUsageMB: await getProcessMemory(),
      quality: evaluateQuality(localResult, cloudResult) // Usa cloud come riferimento
    },
    cloud: {
      model: cloudModel,
      provider: 'cloud',
      tokensPerSecond: calculateTPS(cloudResult, cloudLatency),
      latencyMs: cloudLatency,
      memoryUsageMB: 0,
      quality: 'high'
    }
  };
}
```

## Requisiti Hardware Documentati

Aggiungere in UI e documentazione:

| Modello | RAM Minima | RAM Raccomandata | Note |
|---------|------------|------------------|------|
| 3B (Llama 3.2) | 8GB | 12GB | Veloce, qualità base |
| 7B (Qwen, Mistral) | 16GB | 24GB | Buon compromesso |
| 14B (Qwen) | 32GB | 48GB | Alta qualità, lento |

- Apple Silicon M1+ raccomandato per performance ottimali
- Su Intel/AMD, aspettarsi 2-5x più lento rispetto a Apple Silicon
- GPU dedicata non utilizzata (Docker Model Runner usa CPU)

**Test Strategy:**

## Test Unitari TypeScript

### 1. `test/docker-model-runner.test.ts`
- Test `detectDockerDesktop()` con mock exec che simula Docker Desktop 4.40+ installato
- Test `detectDockerDesktop()` con mock che simula solo Docker Engine (non Desktop)
- Test `detectDockerDesktop()` con versione < 4.40 (modelRunnerEnabled deve essere false)
- Test `checkModelRunnerEnabled()` con mock curl response successo
- Test `checkModelRunnerEnabled()` con timeout/errore connessione
- Test `listAvailableModels()` ritorna lista modelli corretta
- Test `pullModel()` con mock progress events

### 2. `test/dmr-client.test.ts`
- Test client HTTP verso endpoint DMR mock
- Test streaming response parsing
- Test timeout handling (modelli locali possono essere lenti)
- Test retry logic su errori temporanei

## Test Unitari Python

### 1. `tests/unit/test_dmr_provider.py`
- Test `health_check()` con mock server attivo → True
- Test `health_check()` con connection refused → False
- Test `chat_completion()` non-streaming con risposta valida
- Test `chat_completion()` streaming con chunks multipli
- Test handling errori API (4xx, 5xx)
- Test timeout su risposte lente

### 2. `tests/unit/test_fallback_manager.py`
- Test che locale venga usato se disponibile
- Test fallback a cloud dopo 3 fallimenti locali consecutivi
- Test reset contatore fallimenti dopo successo
- Test errore se né locale né cloud disponibili
- Test preferenza cloud provider rispettata

## Test Integrazione

### 1. `tests/integration/test_dmr_e2e.py`
- Test con Docker Model Runner reale (skip se non disponibile)
- Test pull modello piccolo (3B) e verifica download
- Test inference base con prompt semplice
- Test performance: latency < 30s per prompt corto su M1+

### 2. Test UI Svelte
- Test rendering DMRModelBrowser con modelli mock
- Test progress bar aggiornamento durante download
- Test stato "non disponibile" quando Docker Desktop manca
- Test click download triggera IPC corretto
- Test badge "Installato" appare dopo download completato

## Test Benchmark

### 1. `tests/benchmark/test_performance.ts`
- Test calcolo tokens/secondo corretto
- Test comparazione locale vs cloud produce risultati validi
- Test memory usage tracking durante inference

## Test E2E

### 1. `e2e/dmr-flow.test.ts`
- Flow completo: detect Docker → mostra UI → download modello → configura come provider → esegui inference
- Verifica fallback automatico: disabilita Docker → verifica switch a cloud
- Verifica persistenza: riavvia app → modelli scaricati ancora visibili
- Test settings: assegna modello locale a ruolo → verifica cagent.yaml generato correttamente

## Subtasks

### 19.1. Detection Docker Desktop 4.40+ e Model Runner Status

**Status:** pending  
**Dependencies:** None  

Implementare il modulo di rilevamento Docker Desktop con verifica versione minima 4.40+ e stato di abilitazione del Model Runner.

**Details:**

Creare `electron/docker-model-runner.ts` con classe `DockerModelRunnerDetector` che: 1) Esegue `docker version` per verificare presenza Docker Desktop (non solo Engine), 2) Estrae e valida versione >= 4.40, 3) Verifica Model Runner attivo tramite health check su `http://localhost:12434/v1/models`, 4) Rileva piattaforma (macos/windows/linux) e architettura (arm64/amd64), 5) Espone IPC handlers in `ipc-handlers.ts` per query stato da renderer. Gestire tutti i casi di errore con fallback graceful.

### 19.2. UI Model Browser con Lista Modelli Disponibili

**Status:** pending  
**Dependencies:** 19.1  

Creare interfaccia Svelte per visualizzare i modelli LLM disponibili (Qwen, Llama, Mistral, Gemma) con informazioni su dimensione, quantizzazione e requisiti hardware.

**Details:**

Implementare: 1) Store Svelte 5 `dmr-models.svelte.ts` con stato modelli e Docker status usando runes ($state, $derived), 2) Componente `DMRModelBrowser.svelte` con grid card per ogni modello mostrando: nome, dimensione disco, quantizzazione (Q4_K_M), RAM minima richiesta, badge 'Raccomandato' per modelli ottimali, 3) Warning card se Docker Desktop < 4.40 o Model Runner disabilitato con link documentazione, 4) Pagina settings `src/routes/settings/local-llm/+page.svelte` integrata nel menu esistente. Utilizzare componenti shadcn-svelte (Card, Badge, Button).

### 19.3. Download Manager con Progress Tracking

**Status:** pending  
**Dependencies:** 19.1, 19.2  

Implementare sistema di download modelli con progress bar real-time, gestione errori e resume capability.

**Details:**

Estendere `DockerModelRunnerDetector` con metodo `pullModel()` che: 1) Esegue `docker model pull <nome>` in background, 2) Parsa output per estrarre percentuale progresso, 3) Emette eventi IPC per aggiornare UI in tempo reale. Creare componente `DMRDownloadManager.svelte` con: Progress bar per download attivo, stato 'Installato' per modelli già scaricati, gestione cancellazione download, persistenza stato in store. Gestire edge cases: interruzione rete, spazio disco insufficiente, download paralleli.

### 19.4. Provider Python per Docker Model Runner API OpenAI-compatibile

**Status:** pending  
**Dependencies:** None  

Creare provider Python che utilizza l'API OpenAI-compatibile esposta da Docker Model Runner per inference locale.

**Details:**

Implementare `python/providers/dmr_provider.py` con classe `DockerModelRunnerProvider`: 1) Client httpx async con base URL `http://localhost:12434/v1`, 2) Metodo `health_check()` per verifica disponibilità, 3) Metodo `list_models()` per elenco modelli installati, 4) Metodo `chat_completion()` con supporto streaming SSE, 5) Parametri: model, messages, temperature, max_tokens. Timeout configurabile (default 120s per modelli lenti). Gestione errori con eccezioni specifiche per timeout, connessione refused, modello non trovato.

### 19.5. Fallback Manager Locale → Cloud

**Status:** pending  
**Dependencies:** 19.4  

Implementare gestore fallback automatico che passa da modello locale a provider cloud quando l'inference locale fallisce.

**Details:**

Creare `python/providers/fallback_manager.py` con classe `FallbackManager`: 1) Accetta provider locale + dizionario provider cloud (anthropic, openai), 2) Metodo `execute_with_fallback()` che tenta prima locale, poi cloud su failure, 3) Circuit breaker: dopo 3 fallimenti consecutivi locali, bypassa diretto a cloud per N minuti, 4) Logging dettagliato source (local/cloud) per analytics, 5) Reset contatore fallimenti su successo locale. Integrare in FastAPI sidecar come middleware per tutti gli endpoint agent. Configurazione fallback_provider in cagent.yaml per-agent.

### 19.6. Benchmark Performance Locale vs Cloud

**Status:** pending  
**Dependencies:** 19.1, 19.4  

Creare sistema di benchmark per confrontare performance (tokens/sec, latenza) tra modelli locali Docker Model Runner e provider cloud.

**Details:**

Implementare `electron/dmr-benchmark.ts` con funzione `runBenchmark()`: 1) Prompt di test standardizzato (~100 token input), 2) Misura tempo risposta e calcola tokens/secondo per locale e cloud, 3) Rileva memoria utilizzata dal processo Docker, 4) Valutazione qualità comparando output locale vs cloud reference. Creare componente `DMRBenchmarkCard.svelte` con: bottone 'Esegui Benchmark', risultati tabulari (locale vs cloud), indicatori visivi performance (verde/giallo/rosso), raccomandazione automatica quale modello usare per ogni ruolo agent. Salvare risultati in localStorage per riferimento.
