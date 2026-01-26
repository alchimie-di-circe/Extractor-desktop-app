Cagent Framework

Questo progetto usa **cagent** (Agent Builder and Runtime by Docker) come framework per creare e orchestrare agenti AI multi-provider, MCP-enabled e con RAG avanzato.

**MCP Server Verificati**: Perplexity (`@perplexity-ai/mcp-server`), Firecrawl (`firecrawl-mcp`), Jina AI (`https://mcp.jina.ai/v1`), Cloudinary (`@cloudinary/asset-management-mcp`)

**Team di 6 Agent**: Orchestrator, Extraction, Editing, Captioning, Scheduling, IDEA-VALIDATOR (NEW in Task 5)

Per details: `.taskmaster/docs/cagent-team.md`, `.taskmaster/docs/task-5-upgrade-spec.md`, `.factory/rules/cagent-framework.rule.md`

## Ruolo di cagent nel progetto

- Tutti gli agenti “di sistema” (per coding, devops, RAG su docs/codice, automazioni interne) vengono definiti come config YAML cagent.
- `cagent` è la fonte di verità per:
  - quali provider/modelli usiamo;
  - quali MCP tools sono attivi;
  - quali knowledge base RAG vengono indicizzate. [web:2]

## File e knowledge base

**Cagent Official Documentation** (source of truth):
@.taskmaster/docs/CAGENT-reference/cagent-configuration-reference.md.txt
@.taskmaster/docs/CAGENT-reference/cagent-toolsets-reference.md.txt
@.taskmaster/docs/CAGENT-reference/cagent-RAG-reference.md.txt
@.taskmaster/docs/CAGENT-reference/cagent-examples.md.txt
@.taskmaster/docs/CAGENT-reference/cagent-best-practices.md.txt
@.taskmaster/docs/CAGENT-reference/cagent-cli-reference.md.txt
@.taskmaster/docs/CAGENT-reference/cagent-model-providers.md.txt
@.taskmaster/docs/CAGENT-reference/cagent-local-models-suppor.md.txt

**Project-specific cagent config**:
@.taskmaster/docs/cagent-team.md
@.taskmaster/docs/task-5-upgrade-spec.md

**Agent rules**:
@.factory/rules/cagent-framework.rule.md

Ogni modifica sostanziale alla struttura degli agent YAML va riflessa in almeno uno di questi file.

## Regole per tutti i coder assistant

Quando un coder assistant (Droid, Claude, altri) lavora su questa repo:

1. **Riconoscere cagent come framework centrale**  
   Se nel contesto compaiono config cagent o file `@cagent-*`, deve usare la rule `agents.cagent.rule.md` come guida.

2. **Non sovrascrivere a caso**  
   - Prima di cambiare file YAML esistenti, proporre un diff e chiedere conferma.  
   - Preferire estensioni incrementali, spiegando le scelte.

3. **Chiedere sempre provider/modelli e vincoli**  
   - Mai assumere provider o modelli impliciti se non specificati.
   - Chiedere sempre se è disponibile DMR locale e quali MCP Docker sono attivati (Gateway, Toolkit). [web:2]

4. **Spiegare come usare i comandi cagent suggeriti**  
   Ogni volta che propone comandi, chiarire se sono per:
   - sviluppo locale interattivo (`cagent run`); [web:2]
   - integrazione headless (`cagent exec`); [web:2]
   - backend API (`cagent api`); [web:2]
   - MCP server (`cagent mcp`); [web:2]
   - distribuzione tramite Docker Hub (`cagent push/pull`). [web:2]

5. **Tenere separato “framework” da “stack app”**  
   - Tutto ciò che riguarda cagent, RAG, MCP, DMR va mantenuto in questa sezione dell’AGENTS e nei file `@cagent-*`.
   - Le specifiche dello stack (frontend, backend, DB, deployment) vanno in sezioni dedicate.

---