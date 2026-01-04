# Task ID: 11

**Title:** Orchestrator Agent e Comunicazione A2A

**Status:** pending

**Dependencies:** 6, 7, 8, 9

**Priority:** high

**Description:** Implementare l'agente orchestratore che coordina tutti gli altri agenti specializzati, gestendo il protocollo A2A (Agent-to-Agent) per passaggio contesto e handoff.

**Details:**

1. Creare `python/agents/orchestrator_agent.py`:
```python
from cagent import Agent, Handoff

class OrchestratorAgent(Agent):
    name = 'orchestrator'
    description = 'Coordina il workflow completo di gestione media'
    
    sub_agents = [
        'extraction_agent',
        'editing_agent', 
        'captioning_agent',
        'scheduling_agent'
    ]
    
    async def process_request(self, user_request: str, context: Dict):
        # Analizza richiesta e determina workflow
        workflow = self.plan_workflow(user_request)
        
        results = {}
        for step in workflow:
            agent = self.get_agent(step.agent_name)
            result = await agent.execute(step.task, context={**context, **results})
            results[step.agent_name] = result
            
            # Notifica UI via SSE
            await self.emit_event('step_complete', {
                'agent': step.agent_name,
                'result': result
            })
        
        return results
    
    def plan_workflow(self, request: str) -> List[WorkflowStep]:
        # LLM determina sequenza agenti
        pass
```
2. Implementare protocollo A2A:
   - Schema contesto condiviso
   - Handoff con preservazione stato
   - Error handling e retry
3. Dashboard orchestrazione in `src/routes/+page.svelte`:
   - Visualizzazione workflow attivo
   - Status ogni agente
   - Interruzione/pausa workflow
4. Logging conversazioni agenti per debug

**Test Strategy:**

Test unitari per planning workflow. Test A2A handoff tra agenti. Test error recovery. Test E2E per workflow completo extraction->edit->caption->schedule.

## Subtasks

### 11.1. Definizione Protocollo A2A con Schema Contesto Condiviso

**Status:** pending  
**Dependencies:** None  

Progettare e implementare il protocollo Agent-to-Agent (A2A) con uno schema tipizzato per il contesto condiviso tra agenti, includendo serializzazione e validazione dei dati.

**Details:**

Creare `python/protocols/a2a_protocol.py` con:
1. Definizione Pydantic models per A2AContext:
   - `SharedContext`: dati condivisi (media_paths, metadata, user_preferences)
   - `AgentState`: stato corrente dell'agente (status, progress, errors)
   - `HandoffPayload`: payload per trasferimento tra agenti
2. Definire `A2AMessage` con fields: sender, receiver, action, context, timestamp, correlation_id
3. Implementare `ContextValidator` per validazione schema prima di handoff
4. Creare `ContextSerializer` per JSON serialization con supporto per tipi complessi (datetime, Path, bytes)
5. Definire enum `A2AAction`: START, HANDOFF, COMPLETE, ERROR, ROLLBACK
6. Implementare versioning dello schema per backward compatibility

### 11.2. Implementazione OrchestratorAgent Base con Registro Sub-Agents

**Status:** pending  
**Dependencies:** 11.1  

Creare la classe OrchestratorAgent con sistema di registrazione dinamica degli agenti specializzati e discovery automatico.

**Details:**

Creare `python/agents/orchestrator_agent.py`:
1. Classe `OrchestratorAgent` che estende `Agent` dal cagent framework
2. Implementare `AgentRegistry` con:
   - `register_agent(name, agent_class)`: registra agente
   - `get_agent(name)`: recupera istanza agente
   - `list_agents()`: lista agenti disponibili
   - `agent_capabilities`: mapping nome -> capabilities
3. Auto-discovery agenti da `python/agents/` usando importlib
4. Implementare `AgentPool` per gestione istanze con lazy initialization
5. Definire interfaccia `ISpecializedAgent` che tutti gli agenti devono implementare
6. Metodo `validate_agents()` per verificare tutti i sub-agents siano disponibili
7. Configurazione agenti via YAML/JSON per flessibilità deployment

### 11.3. Implementazione Workflow Planner con LLM

**Status:** pending  
**Dependencies:** 11.2  

Sviluppare il sistema di pianificazione workflow che utilizza LLM per analizzare richieste utente e determinare la sequenza ottimale di agenti da invocare.

**Details:**

Creare `python/agents/workflow_planner.py`:
1. Classe `WorkflowPlanner` con metodo `plan_workflow(user_request, available_agents) -> List[WorkflowStep]`
2. `WorkflowStep` dataclass: agent_name, task_description, expected_inputs, expected_outputs, timeout
3. Prompt engineering per LLM:
   - System prompt con descrizione capabilities ogni agente
   - Few-shot examples per workflow comuni
   - Output strutturato JSON per parsing affidabile
4. Implementare `WorkflowOptimizer` per:
   - Parallelizzazione step indipendenti
   - Eliminazione step ridondanti
   - Stima durata workflow
5. Cache LRU per workflow comuni (hash della richiesta)
6. Fallback a regole statiche se LLM non disponibile
7. Validazione workflow: verifica dipendenze soddisfatte, agenti esistenti

### 11.4. Sistema Handoff con Preservazione Stato e Checkpoint

**Status:** pending  
**Dependencies:** 11.1, 11.2  

Implementare il meccanismo di handoff tra agenti con salvataggio dello stato per permettere rollback e recovery in caso di errori.

**Details:**

Creare `python/protocols/handoff_manager.py`:
1. Classe `HandoffManager` con:
   - `initiate_handoff(from_agent, to_agent, context)`: avvia trasferimento
   - `complete_handoff(handoff_id)`: conferma completamento
   - `rollback_handoff(handoff_id)`: ripristina stato precedente
2. Sistema checkpoint:
   - `CheckpointStore` con storage SQLite per persistenza
   - Salvataggio automatico prima di ogni handoff
   - Metadata: timestamp, agent_state, context_snapshot
3. Implementare `StateSnapshot` per deep copy dello stato agente
4. `HandoffTransaction` per garantire atomicità:
   - Prepare -> Commit/Rollback pattern
   - Timeout automatico per handoff pendenti
5. Event emitter per notifiche handoff (start, complete, rollback)
6. Cleanup automatico checkpoint vecchi (configurable retention)

### 11.5. Error Handling Robusto con Retry Policies e Circuit Breaker

**Status:** pending  
**Dependencies:** 11.4  

Implementare sistema di gestione errori avanzato con retry configurabili, circuit breaker pattern e graceful degradation.

**Details:**

Creare `python/resilience/error_handler.py`:
1. `RetryPolicy` configurabile:
   - max_retries, backoff_strategy (exponential, linear, fixed)
   - retry_exceptions: lista eccezioni da ritentare
   - on_retry callback per logging/metriche
2. `CircuitBreaker` per ogni agente:
   - Stati: CLOSED, OPEN, HALF_OPEN
   - failure_threshold, recovery_timeout, success_threshold
   - Metriche: failure_count, last_failure_time
3. `ErrorClassifier` per categorizzare errori:
   - Transient (retry), Permanent (fail fast), Unknown
4. `GracefulDegradation` strategies:
   - Skip agent non critico
   - Use cached result
   - Partial workflow completion
5. `ErrorAggregator` per raccogliere errori multipli in workflow
6. Integration con logging strutturato per troubleshooting
7. Alerting hooks per errori critici

### 11.6. Dashboard Orchestrazione UI con Workflow Visualization Real-time

**Status:** pending  
**Dependencies:** 11.3, 11.4  

Sviluppare l'interfaccia utente Svelte per visualizzare lo stato del workflow in tempo reale con controlli per pausa, interruzione e dettagli agenti.

**Details:**

Creare/estendere `src/routes/+page.svelte` e componenti:
1. `WorkflowVisualization.svelte`:
   - Grafo workflow con nodi agenti e frecce transizioni
   - Colori stato: pending (grigio), running (blu), complete (verde), error (rosso)
   - Animazioni transizioni handoff
2. `AgentStatusCard.svelte` per ogni agente:
   - Nome, descrizione, stato corrente
   - Progress bar se disponibile
   - Ultimo output/errore
3. Controlli workflow:
   - Pulsante Pause/Resume
   - Pulsante Stop con conferma
   - Pulsante Retry per step falliti
4. SSE listener per aggiornamenti real-time da backend
5. Store Svelte `workflowStore` per stato globale workflow
6. Timeline laterale con cronologia eventi
7. Modal dettagli per inspect contesto ogni step

### 11.7. Logging e Tracing Conversazioni Agenti per Debug

**Status:** pending  
**Dependencies:** 11.5  

Implementare sistema completo di logging strutturato e distributed tracing per tracciare conversazioni e interazioni tra agenti a fini di debug e analisi.

**Details:**

Creare `python/observability/agent_logger.py`:
1. `StructuredLogger` con output JSON:
   - Fields: timestamp, correlation_id, agent_name, action, payload, duration_ms
   - Log levels: DEBUG, INFO, WARN, ERROR con filtering
2. `ConversationTracer` per A2A:
   - Trace ID unico per ogni workflow
   - Span per ogni step agente
   - Parent-child relationships per nested calls
3. `LogStore` con SQLite per query storiche:
   - Ricerca per correlation_id, agent, timerange
   - Aggregazioni per analytics
4. UI componente `DebugPanel.svelte`:
   - Vista conversazioni per workflow
   - Filtri per agente/livello
   - Export logs come JSON
5. Integration con Python logging module
6. Log rotation e cleanup automatico
7. Sensitive data masking (API keys, tokens)
