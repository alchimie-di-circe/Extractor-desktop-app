# Task ID: 5

**Title:** Generazione Dinamica cagent.yaml e Configurazione Agenti

**Status:** done

**Dependencies:** 3, 4

**Priority:** high

**Description:** Implementare il sistema che genera dinamicamente il file cagent.yaml basandosi sulle configurazioni utente dei provider LLM e ruoli agenti.

**Details:**

1. Creare `src/lib/services/cagent-config.ts`:
```typescript
interface AgentRole {
  name: string;
  model: string;
  provider: string;
  systemPrompt: string;
  tools: string[];
}

interface CagentConfig {
  version: string;
  agents: AgentRole[];
  rag: { vectorStore: string; embeddingModel: string; };
  mcp: { servers: string[]; };
}

export async function generateCagentYaml(config: CagentConfig): Promise<string> {
  // Genera YAML dalla configurazione
}
```
2. Creare IPC handler per scrivere cagent.yaml nel path corretto
3. Implementare UI in `src/routes/settings/agents/+page.svelte` per:
   - Assegnare modelli a ruoli (Orchestrator, Extraction, Editing, Captioning, Scheduling)
   - Configurare system prompts per agente
   - Abilitare/disabilitare tools per agente
4. Creare template YAML di default in `resources/cagent-template.yaml`
5. Validazione configurazione prima di salvataggio
6. Hot-reload: notificare sidecar Python di ricaricare config

**Test Strategy:**

Test unitari per generazione YAML corretta. Test di validazione configurazione. Test che il sidecar riceva correttamente le notifiche di reload.

## Subtasks

### 5.1. Definizione TypeScript Interfaces per CagentConfig e AgentRole

**Status:** done  
**Dependencies:** None  

Creare le interfacce TypeScript complete per la configurazione del sistema cagent, includendo AgentRole, CagentConfig, RAGConfig e MCPConfig con tutti i tipi necessari per la validazione statica e l'esportazione del modulo.

**Details:**

Creare il file `src/lib/types/cagent.ts` con le seguenti interfacce: 1) `AgentRole` con proprietà name, model, provider, systemPrompt e tools (array di stringhe), 2) `RAGConfig` con vectorStore e embeddingModel, 3) `MCPConfig` con array servers, 4) `CagentConfig` con version, array agents di tipo AgentRole[], rag di tipo RAGConfig e mcp di tipo MCPConfig. Aggiungere type guards per validazione runtime: `isAgentRole()`, `isCagentConfig()`. Definire costanti per i ruoli predefiniti: ORCHESTRATOR, EXTRACTION, EDITING, CAPTIONING, SCHEDULING. Creare tipi utility come `PartialAgentRole` per update parziali. Esportare tutto dal barrel file `src/lib/types/index.ts`.

### 5.2. Creazione cagent-config.ts con Funzione generateCagentYaml e Serializzazione

**Status:** done  
**Dependencies:** 5.1  

Implementare il servizio principale in src/lib/services/cagent-config.ts per la generazione del file YAML cagent, includendo serializzazione YAML con libreria js-yaml, template di default e gestione errori completa.

**Details:**

Installare dipendenza `js-yaml` e relativi types `@types/js-yaml`. Creare `src/lib/services/cagent-config.ts` con: 1) Funzione `generateCagentYaml(config: CagentConfig): string` che serializza la configurazione in formato YAML, 2) Funzione `parseCagentYaml(yaml: string): CagentConfig` per il parsing inverso, 3) Funzione `getDefaultConfig(): CagentConfig` che ritorna la configurazione di default con tutti e 5 i ruoli agente preconfigurati, 4) Funzione `mergeWithDefaults(partial: Partial<CagentConfig>): CagentConfig` per merge intelligente, 5) Funzione `validateConfig(config: unknown): ValidationResult` per validazione schema. Creare template YAML di default in `resources/cagent-template.yaml` come riferimento. Gestire edge cases: config vuota, valori mancanti, tipi incorretti.

### 5.3. Implementazione UI Settings/Agents per Configurazione Ruoli e System Prompts

**Status:** done  
**Dependencies:** 5.1, 5.2  

Creare l'interfaccia utente Svelte in src/routes/settings/agents/+page.svelte per la configurazione degli agenti, permettendo di assegnare modelli LLM a ruoli, modificare system prompts e gestire tools abilitati per ogni agente.

**Details:**

Creare la struttura directory `src/routes/settings/agents/` con +page.svelte e +page.ts. Implementare UI con: 1) Lista dei 5 ruoli agente (Orchestrator, Extraction, Editing, Captioning, Scheduling) con card espandibili, 2) Select dropdown per assegnare provider e modello a ciascun ruolo (popolato da Task 3 - config providers), 3) Textarea per modificare system prompt di ogni agente con preview markdown, 4) Checkbox list per tools abilitati per ogni agente, 5) Pulsante 'Salva Configurazione' che chiama l'IPC handler, 6) Pulsante 'Ripristina Default' per reset. Utilizzare Svelte store per stato locale. Implementare validazione form con feedback visivo. Aggiungere skeleton loading mentre si caricano i dati. Integrare con il layout settings esistente aggiungendo link nella sidebar.

### 5.4. IPC Handler per Scrittura File YAML e Validazione Schema

**Status:** done  
**Dependencies:** 5.2  

Implementare gli handler IPC Electron per scrivere il file cagent.yaml nel filesystem del sistema operativo, con validazione schema JSON/YAML completa e gestione errori filesystem con backup automatico.

**Details:**

Nel processo main Electron creare handler IPC in `src-electron/ipc/cagent-handlers.ts`: 1) `cagent:save-config` - riceve CagentConfig, valida con JSON Schema, genera YAML, scrive su disco in `~/.trae-extractor/cagent.yaml`, 2) `cagent:load-config` - legge file YAML esistente e ritorna CagentConfig, 3) `cagent:validate-config` - valida configurazione senza salvare, 4) `cagent:get-config-path` - ritorna path del file config. Implementare backup automatico prima di ogni scrittura (cagent.yaml.bak). Gestire errori: permessi insufficienti, disco pieno, file locked. Creare JSON Schema per validazione in `resources/cagent-schema.json`. Registrare handlers in main.ts. Creare preload bridge per esporre funzioni al renderer process.

### 5.5. Implementazione Hot-Reload Notifica al Sidecar Python

**Status:** done  
**Dependencies:** 5.4  

Implementare il meccanismo di notifica al sidecar Python quando la configurazione cagent viene modificata dall'UI, permettendo il reload dinamico della configurazione senza necessità di riavviare il processo Python.

**Details:**

Estendere la comunicazione con il sidecar Python (da Task 4) per supportare hot-reload: 1) Nel sidecar FastAPI aggiungere endpoint `POST /config/reload` che ricarica cagent.yaml e reinizializza gli agenti, 2) Nel frontend implementare chiamata HTTP all'endpoint reload dopo salvataggio config riuscito, 3) Implementare retry logic con backoff esponenziale se il sidecar non risponde (max 3 tentativi), 4) Mostrare toast notification in UI con stato reload (successo/fallimento), 5) Aggiungere file watcher opzionale in Python per rilevare modifiche esterne al file, 6) Implementare WebSocket channel `/ws/config-events` per notifiche bidirezionali real-time tra Electron e sidecar. Gestire graceful degradation: se reload fallisce, mantenere configurazione precedente e notificare utente.
