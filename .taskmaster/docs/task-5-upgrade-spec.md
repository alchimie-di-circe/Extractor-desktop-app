# Task 5 Estesa: Generazione cagent.yaml + IDEA-VALIDATOR

## Obiettivo

Implementare sistema che genera dinamicamente `team.yaml` cagent con:
- **6 agent** (Orchestrator, Extraction, Editing, Captioning, Scheduling, IDEA-VALIDATOR)
- **RAG nativa condivisa** tra tutti gli agent
- **MCP tools verificati** (Perplexity, Firecrawl, Jina, Cloudinary)
- **System prompts modulari** in file separati

---

## MCP Server Verificati (Coordinate Ufficiali)

### 1. Perplexity MCP
- **Repo Ufficiale**: https://github.com/perplexityai/modelcontextprotocol
- **Package NPM**: `@perplexity-ai/mcp-server`
- **Comando**: `npx -y @perplexity-ai/mcp-server`
- **Env Variable**: `PERPLEXITY_API_KEY`
- **Tools Disponibili**:
  - `perplexity_search` – ricerca web veloce
  - `perplexity_ask` – conversazione con ricerca
  - `perplexity_research` – ricerca approfondita con citazioni
  - `perplexity_reason` – reasoning avanzato
- **Utilizzo in team.yaml**:
  ```yaml
  toolsets:
    - type: mcp
      command: npx
      args: ["-y", "@perplexity-ai/mcp-server"]
      env:
        PERPLEXITY_API_KEY: ${PERPLEXITY_API_KEY}
  ```

### 2. Firecrawl MCP
- **Repo Ufficiale**: https://github.com/mendableai/firecrawl-mcp-server
- **Package NPM**: `firecrawl-mcp`
- **Comando Locale**: `npx -y firecrawl-mcp`
- **Remote URL**: `https://mcp.firecrawl.dev/{FIRECRAWL_API_KEY}/v2/mcp`
- **Env Variable**: `FIRECRAWL_API_KEY`
- **Tools Disponibili**:
  - `firecrawl_scrape` – scraping singolo URL
  - `firecrawl_search` – ricerca web
  - `firecrawl_crawl` – crawl sito
  - `firecrawl_map` – mappa URL sito
  - `firecrawl_extract` – estrazione dati strutturati
- **Utilizzo in team.yaml**:
  ```yaml
  toolsets:
    - type: mcp
      command: npx
      args: ["-y", "firecrawl-mcp"]
      env:
        FIRECRAWL_API_KEY: ${FIRECRAWL_API_KEY}
  ```

### 3. Jina AI MCP (REMOTE)
- **Repo Ufficiale**: https://github.com/jina-ai/MCP
- **URL Endpoint**: `https://mcp.jina.ai/v1`
- **Header Auth**: `Authorization: Bearer ${JINA_API_KEY}` (opzionale per alcuni tool)
- **Env Variable**: `JINA_API_KEY` (opzionale – rate limit senza)
- **Tools Disponibili**:
  - `read_url` – estrazione contenuto da URL
  - `search_web` – ricerca web
  - `search_images` – ricerca immagini
  - `search_arxiv` – ricerca paper accademici
  - `parallel_search_web` – ricerche web parallele
  - `sort_by_relevance` – reranking per rilevanza
  - `deduplicate_strings` – deduplicazione semantica
- **Utilizzo in team.yaml** (via proxy locale):
  ```yaml
  toolsets:
    - type: mcp
      command: npx
      args: ["mcp-remote", "https://mcp.jina.ai/v1", "--header", "Authorization: Bearer ${JINA_API_KEY}"]
  ```
- **Nota**: Jina è un MCP **remote**, quindi usiamo `mcp-remote` come proxy locale

### 4. Cloudinary MCP
- **Repo Ufficiale**: https://github.com/cloudinary/mcp-servers
- **Package NPM**: `@cloudinary/asset-management-mcp`
- **Comando**: `npx -y --package @cloudinary/asset-management-mcp -- mcp start`
- **Remote URL**: `https://asset-management.mcp.cloudinary.com/sse`
- **Env Variables**: `CLOUDINARY_URL` oppure `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`
- **Utilizzo in team.yaml** (locale):
  ```yaml
  toolsets:
    - type: mcp
      command: npx
      args: ["-y", "--package", "@cloudinary/asset-management-mcp", "--", "mcp", "start"]
      env:
        CLOUDINARY_URL: ${CLOUDINARY_URL}
  ```

---

## Sintassi YAML Cagent Corretta

### Prompt Modulari: `add_prompt_files`

**CORRETTO** (usare `instruction` + `add_prompt_files`):
```yaml
agents:
  idea_validator:
    model: ${IDEA_VALIDATOR_MODEL}
    description: "Valida idee contenuto, analizza trend, propone alternative"
    instruction: |
      Sei IDEA-VALIDATOR & FORMAT EXPERT.
      Segui SEMPRE le istruzioni contenute nei file referenziati.
    add_prompt_files:
      - ./prompts/idea-validator/instruction.md
      - ./prompts/idea-validator/rules.md
      - ./prompts/idea-validator/examples.md
```

**SBAGLIATO** (NON supportato):
```yaml
instruction_file: "./prompts/..."  # ❌ Campo non riconosciuto
rules_file: "./prompts/..."        # ❌ Campo non riconosciuto
```

### RAG Nativa Condivisa

**Configurazione top-level** (una sola volta):
```yaml
rag:
  brand_guidelines:
    docs: ["./knowledge/brand/guidelines.md"]
    strategies:
      - type: chunked-embeddings
        embedding_model: openai/text-embedding-3-small
        vector_dimensions: 1536
        database: ./rag/brand_guidelines.db
  
  platform_specs:
    docs: ["./knowledge/brand/platforms.md"]
    strategies:
      - type: chunked-embeddings
        embedding_model: openai/text-embedding-3-small
        vector_dimensions: 1536
        database: ./rag/platform_specs.db
  
  competitors:
    docs: ["./knowledge/brand/competitors.md"]
    strategies:
      - type: chunked-embeddings
        embedding_model: openai/text-embedding-3-small
        vector_dimensions: 1536
        database: ./rag/competitors.db
```

**Uso negli agent** (referenziare per nome):
```yaml
agents:
  captioning:
    rag: [brand_guidelines, platform_specs]
  
  idea_validator:
    rag: [brand_guidelines, platform_specs, competitors]
```

### MCP Toolsets Corretti

```yaml
toolsets:
  # MCP locale (npx con pacchetto)
  - type: mcp
    command: npx
    args: ["-y", "@perplexity-ai/mcp-server"]
    env:
      PERPLEXITY_API_KEY: ${PERPLEXITY_API_KEY}
  
  # MCP remoto via proxy locale
  - type: mcp
    command: npx
    args: ["mcp-remote", "https://mcp.jina.ai/v1", "--header", "Authorization: Bearer ${JINA_API_KEY}"]
  
  # Thinking e Memory
  - type: think
  - type: memory
    path: ./memory/idea_validator.db
```

---

## Best Practice (dalla doc ufficiale)

### 1. Handling Large Command Outputs
**Problema**: Command output grande → overflow context window

**Soluzione**: Redirigere a file, poi leggere con filesystem:
```yaml
instruction: |
  Run validation: `docker buildx bake validate > validation.log 2>&1`
  Read validation.log to check for errors (first 2000 lines).
toolsets:
  - type: filesystem
  - type: shell
```

### 2. Model Selection per Agent
- **Modelli grandi** (Claude Sonnet, GPT-5): reasoning, planning, writing, coordinamento
- **Modelli piccoli** (Claude Haiku, GPT-5 Mini): validation, tool-calling, alta volumetria

**Esempio nel team**:
```yaml
agents:
  orchestrator:
    model: anthropic/claude-sonnet-4-5  # Reasoning complesso
  
  idea_validator:
    model: anthropic/claude-sonnet-4-5  # Content analysis
  
  scheduling:
    model: anthropic/claude-haiku-4-5   # Solo tool-calling
```

### 3. RAG Optimization
```yaml
strategies:
  - type: chunked-embeddings
    embedding_model: openai/text-embedding-3-small
    batch_size: 50                    # Più chunks per API call
    max_embedding_concurrency: 10     # Richieste parallele
    chunking:
      size: 2000                      # Chunks più grandi
      overlap: 150
```

### 4. Team Multi-Agent Pattern
```yaml
agents:
  root:
    description: Coordinator
    sub_agents: [specialist1, specialist2]
    instruction: |
      Coordinate work:
      1. Delegate task A to specialist1
      2. Delegate task B to specialist2
      3. Aggregate results
  
  specialist1:
    description: Focus on X
  
  specialist2:
    description: Focus on Y
```

---

## Reindicizzazione RAG

**IMPORTANTE**: La reindicizzazione è **AUTOMATICA** su file modificati.

❌ NON esiste comando: `cagent rag reindex --source brand_guidelines`

✅ Cagent rileva automaticamente se i file in `docs:` sono stati modificati e reindicizza.

---

## Struttura Cartelle

```
python/
├── prompts/
│   ├── orchestrator/
│   │   └── instruction.md
│   ├── extraction/
│   │   └── instruction.md
│   ├── editing/
│   │   └── instruction.md
│   ├── captioning/
│   │   └── instruction.md
│   ├── scheduling/
│   │   └── instruction.md
│   └── idea-validator/              # NUOVO
│       ├── instruction.md           # Core identity + workflow
│       ├── rules.md                 # Marketing etico + comportamento
│       └── examples.md              # Few-shot examples
│
├── knowledge/                        # RAG sources
│   └── brand/
│       ├── guidelines.md
│       ├── platforms.md
│       └── competitors.md
│
├── rag/                              # Vector stores (auto-creati)
│   ├── brand_guidelines.db
│   ├── platform_specs.db
│   └── competitors.db
│
└── team.yaml                         # Config cagent generato
```

---

## Subtask Implementazione

| # | Titolo | Stima | Dipendenze | Status |
|---|--------|-------|------------|--------|
| 5.1 | TypeScript Interfaces (6 agent roles) | 30min | - | pending |
| 5.2 | generateCagentYaml() con add_prompt_files + MCP | 1.5h | 5.1 | pending |
| 5.3 | UI Settings/Agents (6 agent + MCP toggle) | 2h | 5.1, 5.2 | pending |
| 5.4 | IPC Handler YAML + prompts directory | 1h | 5.2 | pending |
| 5.5 | Hot-Reload sidecar | 1h | 5.4 | pending |
| 5.6 | IDEA-VALIDATOR prompts (merge 2 file) | 1h | - | pending |
| 5.7 | Knowledge files (brand/, platforms/) | 30min | - | pending |

**Totale: ~7.5h (parallelizzabile: 5.6/5.7 con gli altri)**

---

## System Prompt IDEA-VALIDATOR: Unificazione

### `prompts/idea-validator/instruction.md`

```markdown
# IDEA VALIDATOR & FORMAT EXPERT

## Identità
Sei un consulente esperto di comunicazione digitale e strategie di contenuto.
Combini le competenze di "IDEA VALIDATOR" (validazione strategica) e 
"CONTENT BRAIN-STORMER" (analisi media e produzione).

## Workflow

### FASE 1: Analisi Input
- Ricevi asset estratti (post-Extraction) OPPURE idee standalone
- Analizza foto/video: storie, temi, argomenti principali
- Presenta sintesi delle scoperte all'utente

### FASE 2: Ricerca Trend
Usa i tool MCP disponibili:
- `perplexity_research`: ricerche approfondite con citazioni
- `firecrawl_search`: ricerca web + scraping contenuti
- `search_web` (Jina): ricerca web veloce
- `search_images` (Jina): ricerca immagini simili

Cerca:
- Trend e keyword più cercate dal pubblico target
- Format performanti per l'argomento specifico
- Engagement storico del brand (RAG: competitors)

### FASE 3: Valutazione
- Punteggio PERFORMANCE 1-10 con giustificazione dettagliata
- Confronto con best practice di piattaforma

### FASE 4: Proposte Alternative
Proponi SEMPRE 3 soluzioni ottimizzate:
- Combinazione: Posizionamento × Angle × Editing
- Include proposte specifiche di montaggio/editing

### FASE 5: Suggerimenti Strategici
- Cross-posting opportunities
- Format ricorrenti suggeriti
- Proposte per blog/newsletter/ADS correlati

## Posizionamenti Supportati
REEL_INSTAGRAM, CAROUSEL_INSTAGRAM, POST_INSTAGRAM, SHORT_YOUTUBE,
LONG_YOUTUBE, TIKTOK_VIDEO, PINTEREST_PIN, PINTEREST_CAROUSEL,
FACEBOOK_POST, FACEBOOK_COLLAGE, BLOG_SITO, NEWSLETTER

## Output Structure
1. Conferma analisi + sintesi scoperte
2. Risultati ricerca trend (bullet points con fonti)
3. Punteggio Performance 1-10 + motivazione
4. 3 Alternative dettagliate (tabella strutturata)
5. Suggerimenti strategici aggiuntivi
```

### `prompts/idea-validator/rules.md`

```markdown
# Regole di Comportamento

## Marketing Etico (SEMPRE)
- NO demagogia, NO comunicazione transazionale
- Ogni contenuto deve fornire VALORE reale
- NO clickbait, rispetta l'attenzione del pubblico
- Anche contenuti su prodotti devono essere utili/informativi

## Tono
- DIRETTO e INFORMALE ma analitico quando serve
- Sagace, ironico dove opportuno (brand Slow Food)
- Orientato ai DATI ma rispettoso dei valori artigianali
- Autentico, mai corporate-speak

## Vincoli di Produzione
- NON generare immagini/video AI (solo editing asset utente)
- Rispetta dimensioni/formati per ogni piattaforma
- File names SEO-friendly quando proponi export

## Uso Tools MCP
- USA `perplexity_research` per analisi approfondite con citazioni
- USA `firecrawl_scrape` per estrarre contenuti da URL specifici
- USA `search_web` (Jina) per ricerche veloci
- USA RAG `competitors` per confronto con competitor
- COMBINA più ricerche in parallelo quando possibile
```

---

## Riferimenti

- **Cagent Best Practices**: https://docs.docker.com/ai/cagent/best-practices/
- **Cagent RAG Guide**: https://docs.docker.com/ai/cagent/rag/
- **Cagent Reference**: https://docs.docker.com/ai/cagent/reference/config/
- **Cagent Toolsets**: https://docs.docker.com/ai/cagent/reference/toolsets/
- **Docker MCP Toolkit**: https://docs.docker.com/ai/mcp-catalog-and-toolkit/
