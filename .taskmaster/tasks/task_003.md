# Task ID: 3

**Title:** UI Configurazione Provider LLM Multi-Provider

**Status:** pending

**Dependencies:** 1, 2

**Priority:** high

**Description:** Creare l'interfaccia utente per configurare multipli provider LLM (Anthropic, OpenAI, Google, Perplexity) con validazione delle connessioni e memorizzazione sicura delle API keys.

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
6. Provider supportati: Anthropic (Claude), OpenAI (GPT-4), Google (Gemini), Perplexity (Research)
7. Memorizzare preferenze modello per ruolo: main, fallback, research

**Test Strategy:**

Test unitari per form validation. Test di mock per verificare che le API keys vengano salvate correttamente. Test E2E per il flusso completo: inserimento key -> test connessione -> salvataggio.

## Subtasks

### 3.1. Creazione Route Settings LLM Providers con Layout Tab

**Status:** pending  
**Dependencies:** None  

Creare la pagina principale di configurazione dei provider LLM con navigazione a tab per ogni provider supportato (Anthropic, OpenAI, Google, Perplexity).

**Details:**

1. Creare la struttura delle cartelle: `src/routes/settings/llm-providers/+page.svelte`
2. Importare componenti shadcn-svelte: Tabs, TabsList, TabsTrigger, TabsContent
3. Definire i 4 provider con i loro metadati (id, name, logo, modelli disponibili)
4. Implementare layout responsive con tab orizzontali su desktop e verticali su mobile
5. Aggiungere breadcrumb navigation: Settings > LLM Providers
6. Configurare SvelteKit routing con hash-based navigation per Electron compatibility

### 3.2. Implementazione Componente LLMProviderCard.svelte

**Status:** pending  
**Dependencies:** 3.1  

Sviluppare il componente riutilizzabile per la configurazione di ogni singolo provider LLM con form, validazione e indicatore stato connessione.

**Details:**

1. Creare `src/lib/components/custom/LLMProviderCard.svelte` con Card shadcn-svelte
2. Implementare form con Input per API key (tipo password con toggle visibilità)
3. Creare Select/Dropdown per selezione modello dal provider
4. Aggiungere stati visivi per connectionStatus: idle, testing, success, error con icone appropriate
5. Implementare validazione form: API key required, formato minimo caratteri
6. Usare Svelte 5 runes ($state, $derived) per gestione stato locale
7. Aggiungere skeleton loading durante operazioni async

### 3.3. Creazione Store llm-providers.svelte.ts con Svelte 5 Runes

**Status:** pending  
**Dependencies:** 3.1  

Implementare lo store globale per la gestione dello stato dei provider LLM utilizzando Svelte 5 runes per reattività e persistenza.

**Details:**

1. Creare `src/lib/stores/llm-providers.svelte.ts`
2. Definire interfacce TypeScript: LLMProvider, LLMProviderState, ModelRole
3. Implementare stato con $state rune per: providers[], selectedModels, connectionStatuses
4. Creare $derived per computed properties: hasValidMainProvider, configuredProviders
5. Implementare funzioni per update stato: setApiKey, setModel, updateConnectionStatus
6. Aggiungere persistenza preferenze modello per ruolo (main, fallback, research)
7. Creare funzione initFromStorage per caricare configurazione salvata all'avvio

### 3.4. Implementazione IPC Handlers per Test Connessione Multi-Provider

**Status:** pending  
**Dependencies:** 3.2, 3.3  

Creare gli handler IPC nel main process Electron per testare la connessione ai diversi provider LLM (Anthropic, OpenAI, Google, Perplexity).

**Details:**

1. Estendere `electron/main.ts` con ipcMain.handle per 'llm:test-connection'
2. Creare `electron/services/llm-connector.ts` con classe LLMConnector
3. Implementare metodi specifici per ogni provider:
   - testAnthropicConnection(apiKey, model) - POST a api.anthropic.com/v1/messages
   - testOpenAIConnection(apiKey, model) - POST a api.openai.com/v1/chat/completions
   - testGoogleConnection(apiKey, model) - POST a generativelanguage.googleapis.com
   - testPerplexityConnection(apiKey, model) - POST a api.perplexity.ai
4. Gestire timeout (10s) e error handling specifico per ogni provider
5. Esporre via preload.ts: window.electronAPI.testLLMConnection()

### 3.5. Integrazione Keychain e Configurazione Ruoli Modello

**Status:** pending  
**Dependencies:** 3.2, 3.3, 3.4  

Collegare il sistema keychain per salvataggio sicuro delle API keys e implementare la configurazione dei ruoli modello (main, fallback, research).

**Details:**

1. Creare `src/lib/services/llm-config.ts` per interazione con IPC
2. Implementare funzioni:
   - saveProviderCredentials(providerId, apiKey) - salva in keychain via IPC
   - loadProviderCredentials(providerId) - recupera da keychain
   - deleteProviderCredentials(providerId) - rimuove da keychain
3. Creare UI per assegnazione ruoli: main (uso primario), fallback (backup), research (Perplexity)
4. Implementare Select component per scegliere quale provider usare per ogni ruolo
5. Salvare configurazione ruoli in electron-store (non sensibile)
6. Aggiungere validazione: almeno un provider main configurato prima di procedere
7. Creare Toast notifications per feedback operazioni (save success/error)
