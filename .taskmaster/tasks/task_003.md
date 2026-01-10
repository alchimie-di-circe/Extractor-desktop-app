# Task ID: 3

**Title:** UI Configurazione Provider LLM Multi-Provider

**Status:** done

**Dependencies:** 1, 2

**Priority:** high

**Description:** Creare l'interfaccia utente per configurare multipli provider LLM (Anthropic, OpenAI, Google, Perplexity, OpenRouter) con validazione delle connessioni e memorizzazione sicura delle API keys.

**Details:**

1. Creare `src/routes/settings/llm-providers/+page.svelte` con form per ogni provider
2. Implementare componente `src/lib/components/custom/LLMProviderCard.svelte`:
```svelte
<script lang="ts">
  import { Card, CardContent, CardHeader } from '$lib/components/ui/card';
  import { Input } from '$lib/components/ui/input';
  import { Button } from '$lib/components/ui/button';
  
  export let provider: { id: string; name: string; logo: string; models: string[] };
  let apiKey = '';
  let selectedModel = '';
  let connectionStatus: 'idle' | 'testing' | 'success' | 'error' = 'idle';
  
  async function testConnection() {
    connectionStatus = 'testing';
    try {
      await window.electronAPI.testLLMConnection(provider.id, apiKey, selectedModel);
      connectionStatus = 'success';
    } catch { connectionStatus = 'error'; }
  }
  
  async function saveCredentials() {
    await window.electronAPI.saveCredential('llm-provider', provider.id, apiKey);
  }
</script>
```
3. Creare servizio `src/lib/services/llm-config.ts` per interagire con IPC
4. Implementare store Svelte 5 runes per stato provider: `src/lib/stores/llm-providers.svelte.ts`
5. Creare IPC handler in main process per test connessione ai provider
6. Provider supportati: Anthropic (Claude), OpenAI (GPT-4), Google (Gemini), Perplexity (Research), **OpenRouter (aggregatore)**
7. Memorizzare preferenze modello per ruolo Cagent: **orchestrator, extraction, editing, captioning, scheduling**

**Test Strategy:**

Test unitari per form validation. Test di mock per verificare che le API keys vengano salvate correttamente. Test E2E per il flusso completo: inserimento key -> test connessione -> salvataggio.

## Subtasks

### 3.1. Creazione Route Settings LLM Providers con Layout Tab

**Status:** done  
**Dependencies:** None  
**Completed:** 2026-01-10

Creare la pagina principale di configurazione dei provider LLM con navigazione a tab per ogni provider supportato (Anthropic, OpenAI, Google, Perplexity, OpenRouter).

**Details:**

1. ✅ Creare la struttura delle cartelle: `src/routes/settings/llm-providers/+page.svelte`
2. ✅ Importare componenti shadcn-svelte: Tabs, TabsList, TabsTrigger, TabsContent
3. ✅ Definire 5 provider con i loro metadati (id, name, logo, modelli disponibili) - **esteso a 5 provider**
4. ✅ Implementare layout responsive con tab orizzontali su desktop e verticali su mobile (`grid-cols-2 md:grid-cols-3 lg:grid-cols-5`)
5. ✅ Aggiungere breadcrumb navigation: Settings > LLM Providers
6. ✅ Configurare SvelteKit routing con hash-based navigation per Electron compatibility

**Implementation Notes:**
- File: `src/routes/settings/llm-providers/+page.svelte` (409 lines)
- Aggiunto OpenRouter come 5° provider
- Tabs responsive con grid columns adattive

### 3.2. Implementazione Componente LLMProviderCard.svelte

**Status:** done  
**Dependencies:** 3.1  
**Completed:** 2026-01-10

Sviluppare il componente riutilizzabile per la configurazione di ogni singolo provider LLM con form, validazione e indicatore stato connessione.

**Details:**

1. ✅ Creare `src/lib/components/custom/LLMProviderCard.svelte` con Card shadcn-svelte
2. ✅ Implementare form con Input per API key (tipo password con toggle visibilità Eye/EyeOff)
3. ✅ Creare Select/Dropdown per selezione modello dal provider
4. ✅ Aggiungere stati visivi per connectionStatus: idle, testing, success, error con icone appropriate (Check, X, Loader2)
5. ✅ Implementare validazione form: API key required, formato con `validateApiKeyFormat()`
6. ✅ Usare Svelte 5 runes ($state, $derived) per gestione stato locale
7. ✅ Aggiungere skeleton loading durante operazioni async (isSaving, isDeleting states)

**Implementation Notes:**
- File: `src/lib/components/custom/LLMProviderCard.svelte` (328 lines)
- Badge con colori per status (default/destructive/secondary/outline)
- Link esterno al website del provider
- Ultimo test timestamp visualizzato

### 3.3. Creazione Store llm-providers.svelte.ts con Svelte 5 Runes

**Status:** done  
**Dependencies:** 3.1  
**Completed:** 2026-01-10

Implementare lo store globale per la gestione dello stato dei provider LLM utilizzando Svelte 5 runes per reattività e persistenza.

**Details:**

1. ✅ Creare `src/lib/stores/llm-providers.svelte.ts`
2. ✅ Definire interfacce TypeScript: ProviderState, ProvidersState, AgentRoleConfig
3. ✅ Implementare stato con $state rune per: providers[], modelRoles, isLoading
4. ✅ Creare $derived per computed properties: hasValidOrchestratorProvider, configuredProviders, configuredAgentCount
5. ✅ Implementare funzioni per update stato: setConnectionStatus, setSelectedModel, setHasApiKey
6. ✅ Aggiungere persistenza preferenze per 5 ruoli Cagent: **orchestrator, extraction, editing, captioning, scheduling**
7. ✅ Creare funzione initFromStorage per caricare configurazione salvata all'avvio
8. ✅ Aggiunto `autoConfigureAgentRoles()` per configurazione automatica con modelli raccomandati

**Implementation Notes:**
- File: `src/lib/stores/llm-providers.svelte.ts` (287 lines)
- **CAMBIATO**: Ruoli da `main/fallback/research` a 5 ruoli Cagent specifici
- Migrazione automatica da vecchio formato config in `initFromStorage()`
- Uso di `$derived.by()` per computed null-safe

### 3.4. Implementazione IPC Handlers per Test Connessione Multi-Provider

**Status:** done  
**Dependencies:** 3.2, 3.3  
**Completed:** 2026-01-10

Creare gli handler IPC nel main process Electron per testare la connessione ai diversi provider LLM (Anthropic, OpenAI, Google, Perplexity, OpenRouter).

**Details:**

1. ✅ IPC handlers registrati in `electron/ipc-handlers.ts` per canale 'llm:test-connection'
2. ✅ Creare `electron/llm-connector.ts` con funzione testLLMConnection
3. ✅ Implementare metodi specifici per ogni provider:
   - testAnthropic(apiKey, model) - POST a api.anthropic.com/v1/messages
   - testOpenAI(apiKey, model) - POST a api.openai.com/v1/chat/completions
   - testGoogle(apiKey, model) - POST a generativelanguage.googleapis.com
   - testPerplexity(apiKey, model) - POST a api.perplexity.ai
   - **testOpenRouter(apiKey, model)** - POST a openrouter.ai/api/v1/chat/completions
4. ✅ Gestire timeout e error handling specifico con `mapApiError()` per ogni provider
5. ✅ Esporre via preload.ts: `window.electronAPI.llm.testConnection()`

**Implementation Notes:**
- File: `electron/llm-connector.ts` (377 lines)
- Mapping errori HTTP → codici interni (INVALID_API_KEY, RATE_LIMIT, MODEL_NOT_FOUND, NETWORK_ERROR)
- OpenRouter richiede headers HTTP-Referer e X-Title

### 3.5. Integrazione Keychain e Configurazione Ruoli Modello

**Status:** done  
**Dependencies:** 3.2, 3.3, 3.4  
**Completed:** 2026-01-10

Collegare il sistema keychain per salvataggio sicuro delle API keys e implementare la configurazione dei ruoli modello per i 5 agent Cagent.

**Details:**

1. ✅ Creare `src/lib/services/llm-config.ts` per interazione con IPC
2. ✅ Implementare funzioni:
   - saveProviderCredentials(providerId, apiKey) - salva in keychain via IPC
   - loadProviderCredentials(providerId) - recupera da keychain
   - deleteProviderCredentials(providerId) - rimuove da keychain
   - testProviderConnection() - wrapper per test connessione
   - setModelRole() / getModelRoles() - gestione ruoli
3. ✅ Creare UI per assegnazione ruoli: **orchestrator, extraction, editing, captioning, scheduling**
4. ✅ Implementare Select component per scegliere quale provider+modello usare per ogni ruolo
5. ✅ Salvare configurazione ruoli in electron-store (non sensibile)
6. ✅ Aggiungere validazione: almeno Orchestrator configurato prima di procedere
7. ✅ Creare Toast notifications con svelte-sonner per feedback operazioni

**Implementation Notes:**
- File: `src/lib/services/llm-config.ts` (221 lines)
- Toaster aggiunto in `src/routes/+layout.svelte`
- Toast feedback per: save/delete API key, test connection, role change, auto-configure
- UI mostra icone per ogni agent role con descrizione

## Enhancements Beyond Original Scope

1. **OpenRouter come 5° provider** - Aggregatore con accesso a 20+ modelli di vari provider
2. **Modelli aggiornati al 2026** - Claude 4.5, GPT-5.2, Gemini 3, DeepSeek V3.2, Qwen3, etc.
3. **5 ruoli Cagent** - Sostituiti `main/fallback/research` con i 5 agent definiti nel PRD
4. **Auto-configurazione** - Pulsante "Auto-configura" per assegnare modelli raccomandati a tutti gli agent
5. **Documentazione agent** - Creato `.taskmaster/docs/cagent-team.md` con reference completa

## Files Created/Modified

### Created:
- `src/routes/settings/llm-providers/+page.svelte`
- `src/lib/components/custom/LLMProviderCard.svelte`
- `src/lib/stores/llm-providers.svelte.ts`
- `src/lib/services/llm-config.ts`
- `electron/llm-connector.ts`
- `.taskmaster/docs/cagent-team.md`

### Modified:
- `shared/types.ts` - Aggiunto OpenRouter, AgentRole type, ModelRoleConfig
- `shared/llm-providers.ts` - Aggiunto OpenRouter, modelli 2026, DEFAULT_AGENT_MODELS
- `electron/ipc-handlers.ts` - Aggiunto handler LLM con validazione nuovi ruoli
- `electron/preload.ts` - Esposto llmApi
- `src/routes/+layout.svelte` - Integrato Toaster per notifications
