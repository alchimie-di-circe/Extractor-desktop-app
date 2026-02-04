# Task ID: 5

**Title:** Generazione Dinamica cagent.yaml e Configurazione Agenti

**Status:** done

**Dependencies:** 3 ✓, 4 ✓

**Priority:** high

**Description:** Implementare il sistema che genera dinamicamente python/team.yaml con 7 agenti specializzati (Orchestrator, Extraction, Creative Planner, Creative Worker, Captioning, Scheduling, IDEA-VALIDATOR), MCP tools ufficiali (Perplexity, Firecrawl, Jina, Cloudinary, Shotstack), e RAG condivisa.

**Details:**

Vedere specifiche complete in: .taskmaster/docs/task-5-upgrade-spec.md

Implementazione completata:
- ✅ 7 agenti in python/team.yaml (non file .ts separati)
- ✅ TypeScript generator (src/lib/services/cagent-generator.ts) genera team.yaml
- ✅ UI settings (src/routes/settings/agents/+page.svelte) per configurare 7 agenti
- ✅ MCP tools verificati: Perplexity, Firecrawl, Jina, Cloudinary, Shotstack
- ✅ RAG: brand_guidelines, platform_specs, competitors, mcp_tools_knowledge
- ✅ System prompts modulari con add_prompt_files (non instruction_file)
- ✅ IPC handlers per scrittura YAML e hot-reload sidecar

Architettura:
- Orchestrator coordina i 6 sub-agents
- Creative Planner (Sonnet) pianifica → Creative Worker (Haiku) esegue
- IDEA-VALIDATOR valida contenuti e ricerca trend
- Tutti gli agenti condividono RAG knowledge bases

**Test Strategy:**

Test unitari per generazione YAML corretta. Test di validazione configurazione. Test che il sidecar riceva correttamente le notifiche di reload.

## Subtasks

### 5.1. Definizione TypeScript Interfaces per CagentConfig e 7-Agent Team

**Status:** done  
**Dependencies:** None  

Creare le interfacce TypeScript complete per la configurazione team.yaml con 7 agenti specializzati, includendo AgentRole, CagentConfig, RAGConfig e MCPConfig.

**Details:**

Creare il file `src/lib/types/cagent.ts` con le seguenti interfacce: 1) `AgentRole` con proprietà name, model, provider, systemPrompt e tools (array di stringhe), 2) `RAGConfig` con vectorStore e embeddingModel, 3) `MCPConfig` con array servers, 4) `CagentConfig` con version, array agents di tipo AgentRole[], rag di tipo RAGConfig e mcp di tipo MCPConfig. Aggiungere type guards per validazione runtime: `isAgentRole()`, `isCagentConfig()`. Definire costanti per i ruoli predefiniti: ORCHESTRATOR, EXTRACTION, EDITING, CAPTIONING, SCHEDULING. Creare tipi utility come `PartialAgentRole` per update parziali. Esportare tutto dal barrel file `src/lib/types/index.ts`.

### 5.2. Creazione cagent-generator.ts per Generazione team.yaml Dinamica

**Status:** done  
**Dependencies:** 5.1  

Implementare il servizio principale in src/lib/services/cagent-generator.ts per la generazione del file YAML team.yaml con 7 agenti, serializzazione YAML, e template di default.

**Details:**

Installare dipendenza `js-yaml` e relativi types `@types/js-yaml`. Creare `src/lib/services/cagent-config.ts` con: 1) Funzione `generateCagentYaml(config: CagentConfig): string` che serializza la configurazione in formato YAML, 2) Funzione `parseCagentYaml(yaml: string): CagentConfig` per il parsing inverso, 3) Funzione `getDefaultConfig(): CagentConfig` che ritorna la configurazione di default con tutti e 5 i ruoli agente preconfigurati, 4) Funzione `mergeWithDefaults(partial: Partial<CagentConfig>): CagentConfig` per merge intelligente, 5) Funzione `validateConfig(config: unknown): ValidationResult` per validazione schema. Creare template YAML di default in `resources/cagent-template.yaml` come riferimento. Gestire edge cases: config vuota, valori mancanti, tipi incorretti.

### 5.3. Implementazione UI Settings/Agents per Configurazione 7 Agenti

**Status:** done  
**Dependencies:** 5.1, 5.2  

Creare l'interfaccia utente Svelte in src/routes/settings/agents/+page.svelte per la configurazione dei 7 agenti, permettendo di assegnare modelli LLM a ruoli e modificare system prompts.

**Details:**

Creare la struttura directory `src/routes/settings/agents/` con +page.svelte e +page.ts. Implementare UI con: 1) Lista dei 5 ruoli agente (Orchestrator, Extraction, Editing, Captioning, Scheduling) con card espandibili, 2) Select dropdown per assegnare provider e modello a ciascun ruolo (popolato da Task 3 - config providers), 3) Textarea per modificare system prompt di ogni agente con preview markdown, 4) Checkbox list per tools abilitati per ogni agente, 5) Pulsante 'Salva Configurazione' che chiama l'IPC handler, 6) Pulsante 'Ripristina Default' per reset. Utilizzare Svelte store per stato locale. Implementare validazione form con feedback visivo. Aggiungere skeleton loading mentre si caricano i dati. Integrare con il layout settings esistente aggiungendo link nella sidebar.

### 5.4. IPC Handler per Scrittura team.yaml e Validazione Schema

**Status:** done  
**Dependencies:** 5.2  

Implementare gli handler IPC Electron per scrivere il file team.yaml nel filesystem con validazione schema JSON/YAML completa e gestione errori.

**Details:**

Nel processo main Electron creare handler IPC in `src-electron/ipc/cagent-handlers.ts`: 1) `cagent:save-config` - riceve CagentConfig, valida con JSON Schema, genera YAML, scrive su disco in `~/.trae-extractor/cagent.yaml`, 2) `cagent:load-config` - legge file YAML esistente e ritorna CagentConfig, 3) `cagent:validate-config` - valida configurazione senza salvare, 4) `cagent:get-config-path` - ritorna path del file config. Implementare backup automatico prima di ogni scrittura (cagent.yaml.bak). Gestire errori: permessi insufficienti, disco pieno, file locked. Creare JSON Schema per validazione in `resources/cagent-schema.json`. Registrare handlers in main.ts. Creare preload bridge per esporre funzioni al renderer process.

### 5.5. Implementazione Hot-Reload Notifica al Sidecar Python

**Status:** done  
**Dependencies:** 5.4  

Implementare il meccanismo di notifica al sidecar Python quando la configurazione team.yaml viene modificata dall'UI, permettendo il reload dinamico senza riavvio.

**Details:**

Estendere la comunicazione con il sidecar Python (da Task 4) per supportare hot-reload: 1) Nel sidecar FastAPI aggiungere endpoint `POST /config/reload` che ricarica cagent.yaml e reinizializza gli agenti, 2) Nel frontend implementare chiamata HTTP all'endpoint reload dopo salvataggio config riuscito, 3) Implementare retry logic con backoff esponenziale se il sidecar non risponde (max 3 tentativi), 4) Mostrare toast notification in UI con stato reload (successo/fallimento), 5) Aggiungere file watcher opzionale in Python per rilevare modifiche esterne al file, 6) Implementare WebSocket channel `/ws/config-events` per notifiche bidirezionali real-time tra Electron e sidecar. Gestire graceful degradation: se reload fallisce, mantenere configurazione precedente e notificare utente.
