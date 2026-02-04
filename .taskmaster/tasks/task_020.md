# Task ID: 20

**Title:** Integrazione Runtime Cagent in Sidecar Python

**Status:** pending

**Dependencies:** 4 ✓, 5 ✓

**Priority:** high

**Description:** Integrare il motore di esecuzione Cagent nel server FastAPI (main.py) per permettere l'esecuzione reale degli agenti definiti in team.yaml. Sostituire i placeholder con la logica di caricamento configurazione e dispatch delle richieste.

**Details:**

1.  Aggiungere `cagent` (o il pacchetto corretto) a `python/requirements.txt`.\n2.  Modificare `python/main.py` per inizializzare il runtime Cagent all'avvio (`lifespan`).\n3.  Implementare la funzione `get_agent_runner()` per recuperare l'istanza dell'agente richiesto.\n4.  Aggiornare l'endpoint `POST /agent/execute` per invocare l'agente e restituire la risposta reale.\n5.  Collegare il sistema di eventi Cagent alla coda SSE esistente per lo streaming del pensiero/tool usage.\n6.  Verificare che `team.yaml` venga caricato correttamente.

**Test Strategy:**

Unit test con mock del runner Cagent. Integration test chiamando /agent/execute con un agente semplice (es. orchestrator) e verificando la risposta non-placeholder.
