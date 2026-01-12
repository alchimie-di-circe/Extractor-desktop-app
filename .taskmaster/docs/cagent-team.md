# Cagent Team Reference

Questo documento definisce il team di AI agents che compongono il cuore dell'applicazione Trae Extractor.

## Overview

L'architettura utilizza **5 agent specializzati** che collaborano tramite il protocollo A2A (Agent-to-Agent). Ogni agent ha un ruolo specifico nel workflow di gestione media per content creators.

```
┌─────────────────────────────────────────────────────────────┐
│                    USER REQUEST                              │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                 ORCHESTRATOR AGENT                           │
│         Coordina workflow, gestisce handoff                  │
│         Model consigliato: Claude Opus 4.5 / GPT-5.2        │
└─────────────────────────────────────────────────────────────┘
          │              │              │              │
          ▼              ▼              ▼              ▼
┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│  EXTRACTION  │ │   EDITING    │ │  CAPTIONING  │ │  SCHEDULING  │
│    AGENT     │ │    AGENT     │ │    AGENT     │ │    AGENT     │
│              │ │              │ │              │ │              │
│  osxphotos   │ │  Cloudinary  │ │  Native RAG  │ │  Postiz API  │
│  (sandboxed) │ │     MCP      │ │  Brand KB    │ │  Calendar    │
└──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘
```

---

## Agent Definitions

### 1. Orchestrator Agent

**Ruolo**: Coordinatore centrale del team. Riceve le richieste utente, le decompone in subtask, assegna agli agent specializzati, e assembla i risultati finali.

| Proprietà | Valore |
|-----------|--------|
| ID | `orchestrator` |
| Processo | FastAPI Sidecar (main) |
| Tools | A2A Protocol, Native RAG |
| Input | User requests, workflow context |
| Output | Task assignments, final responses |

**Caratteristiche richieste dal modello**:
- Reasoning avanzato per decomposizione task
- Context window ampio per gestire conversazioni lunghe
- Capacità di tool calling per A2A handoff

**Modelli consigliati**:
| Provider | Modello | Note |
|----------|---------|------|
| Anthropic | Claude Opus 4.5 | Best reasoning, costoso |
| OpenAI | GPT-5.2 | Veloce, ottimo tool calling |
| OpenRouter | anthropic/claude-opus-4.5 | Via unified API |
| DeepSeek | V3.2-Speciale | Open weights, ottimo rapporto costo/qualità |

---

### 2. Extraction Agent

**Ruolo**: Estrae foto dalla libreria Apple Photos locale. Analizza metadata EXIF, suggerisce tag, gestisce filtri per data/album.

| Proprietà | Valore |
|-----------|--------|
| ID | `extraction` |
| Processo | Sandboxed Python (isolato) |
| Tools | osxphotos library |
| Input | Album/date filters, extraction requests |
| Output | Extracted photos with metadata |

**Caratteristiche richieste dal modello**:
- Buona comprensione di metadata e strutture dati
- Velocità (molte operazioni batch)
- Non richiede reasoning complesso

**Modelli consigliati**:
| Provider | Modello | Note |
|----------|---------|------|
| Anthropic | Claude Haiku 4.5 | Veloce, economico |
| OpenAI | GPT-4o Mini | Fast, cost-effective |
| Google | Gemini 3 Flash | Molto veloce |
| OpenRouter | google/gemini-3-flash | Free tier disponibile |

**Security Notes**:
- Esegue in processo separato (sandbox)
- NO accesso network
- Read-only su Photos Library
- Write solo su directory whitelist

---

### 3. Editing Agent

**Ruolo**: Elabora media con operazioni AI: background removal, upscaling, smart crop, color correction.

| Proprietà | Valore |
|-----------|--------|
| ID | `editing` |
| Processo | FastAPI Sidecar |
| Tools | Cloudinary MCP Server |
| Input | Media files, transformation requests |
| Output | Processed media URLs |

**Caratteristiche richieste dal modello**:
- Buona comprensione di richieste in linguaggio naturale
- Capacità di tradurre intent in parametri API specifici
- Vision capabilities (opzionale, per analisi immagini)

**Modelli consigliati**:
| Provider | Modello | Note |
|----------|---------|------|
| Anthropic | Claude Sonnet 4.5 | Ottimo balance |
| OpenAI | GPT-4o | Multimodale, vision |
| Google | Gemini 3 Pro | Vision nativo |
| OpenRouter | anthropic/claude-sonnet-4.5 | Via unified API |

**MCP Integration**:
```yaml
toolsets:
  - type: mcp
    ref: mcp/cloudinary
    env:
      CLOUDINARY_URL: ${CLOUDINARY_URL}
```

---

### 4. Captioning Agent

**Ruolo**: Genera caption per social media. Usa brand knowledge base (RAG) per mantenere tone of voice consistente.

| Proprietà | Valore |
|-----------|--------|
| ID | `captioning` |
| Processo | FastAPI Sidecar |
| Tools | Native RAG, Content Tools |
| Input | Media context, brand guidelines, platform |
| Output | Platform-specific captions |

**Caratteristiche richieste dal modello**:
- Eccellente writing e creatività
- Capacità di adattare tone per diverse piattaforme
- Buon utilizzo di RAG/knowledge retrieval

**Modelli consigliati**:
| Provider | Modello | Note |
|----------|---------|------|
| Anthropic | Claude Sonnet 4.5 | Ottimo writing |
| OpenAI | GPT-5.2 | Creativo, versatile |
| OpenRouter | anthropic/claude-sonnet-4.5 | Best for content |
| Moonshot | Kimi K2 | Ottimo per content asiatico |

**RAG Integration**:
- Indicizza brand assets da `./brand_assets/`
- PDF guidelines, tone documents
- Semantic search per retrieval

---

### 5. Scheduling Agent

**Ruolo**: Programma pubblicazioni su multiple piattaforme social. Gestisce calendario editoriale e analytics.

| Proprietà | Valore |
|-----------|--------|
| ID | `scheduling` |
| Processo | FastAPI Sidecar |
| Tools | Postiz API, Calendar Tools |
| Input | Content, target platforms, timing preferences |
| Output | Scheduled posts, calendar events |

**Caratteristiche richieste dal modello**:
- Buona comprensione di date/time
- Capacità di ottimizzare timing per engagement
- Tool calling affidabile per API

**Modelli consigliati**:
| Provider | Modello | Note |
|----------|---------|------|
| Anthropic | Claude Haiku 4.5 | Veloce, affidabile |
| OpenAI | GPT-4o Mini | Economico, buon tool use |
| Google | Gemini 3 Flash | Fast |
| OpenRouter | openai/gpt-4o-mini | Cost-effective |

**Piattaforme supportate**:
- Instagram
- Facebook
- LinkedIn
- Twitter/X
- TikTok

---

## Model Role Configuration

### Default Assignments (per provider)

Quando l'utente seleziona un provider, questi sono i modelli default consigliati per ogni agent:

#### Anthropic (Direct API)
| Agent | Default Model |
|-------|--------------|
| Orchestrator | claude-opus-4-20250514 |
| Extraction | claude-3-5-haiku-20241022 |
| Editing | claude-sonnet-4-20250514 |
| Captioning | claude-sonnet-4-20250514 |
| Scheduling | claude-3-5-haiku-20241022 |

#### OpenAI (Direct API)
| Agent | Default Model |
|-------|--------------|
| Orchestrator | gpt-5.2 |
| Extraction | gpt-4o-mini |
| Editing | gpt-4o |
| Captioning | gpt-5.2 |
| Scheduling | gpt-4o-mini |

#### Google (Direct API)
| Agent | Default Model |
|-------|--------------|
| Orchestrator | gemini-3-pro |
| Extraction | gemini-3-flash |
| Editing | gemini-3-pro |
| Captioning | gemini-3-pro |
| Scheduling | gemini-3-flash |

#### Perplexity (Direct API)
| Agent | Default Model |
|-------|--------------|
| Orchestrator | sonar-pro |
| Extraction | sonar |
| Editing | sonar-pro |
| Captioning | sonar-reasoning-pro |
| Scheduling | sonar |

#### OpenRouter (Unified API)
| Agent | Default Model |
|-------|--------------|
| Orchestrator | anthropic/claude-opus-4.5 |
| Extraction | google/gemini-3-flash |
| Editing | anthropic/claude-sonnet-4.5 |
| Captioning | anthropic/claude-sonnet-4.5 |
| Scheduling | openai/gpt-4o-mini |

---

## A2A Protocol

Gli agent comunicano tramite il protocollo Agent-to-Agent (A2A):

```typescript
interface A2AMessage {
  from: AgentId;
  to: AgentId;
  type: 'task' | 'result' | 'error' | 'status';
  payload: {
    taskId: string;
    content: unknown;
    context?: Record<string, unknown>;
  };
  timestamp: string; // ISO 8601 format
}
```

### Handoff Flow Example

```
User: "Estrai le foto del weekend e crea caption per Instagram"

1. Orchestrator riceve richiesta
2. Orchestrator → Extraction: { type: 'task', payload: { filter: 'weekend' } }
3. Extraction → Orchestrator: { type: 'result', payload: { photos: [...] } }
4. Orchestrator → Captioning: { type: 'task', payload: { photos, platform: 'instagram' } }
5. Captioning → Orchestrator: { type: 'result', payload: { captions: [...] } }
6. Orchestrator → User: Risultato finale assemblato
```

---

## Configuration Storage

Le preferenze modello per agent sono salvate in:
- **electron-store**: `modelRoles` config (non sensibile)
- **Keychain**: API keys per provider (sensibile)

```typescript
interface ModelRoleConfig {
  orchestrator: { providerId: LLMProviderId | null; model: string | null };
  extraction: { providerId: LLMProviderId | null; model: string | null };
  editing: { providerId: LLMProviderId | null; model: string | null };
  captioning: { providerId: LLMProviderId | null; model: string | null };
  scheduling: { providerId: LLMProviderId | null; model: string | null };
}
```

---

## Cost Optimization Tips

1. **Use tiered models**: Orchestrator premium, altri agent economici
2. **Batch operations**: Extraction agent processa in batch
3. **Cache RAG results**: Captioning agent riusa embeddings
4. **OpenRouter free tiers**: Gemini Flash free per task semplici
5. **Local fallback**: Docker Model Runner per privacy + zero costi

---

## Related Documentation

- [PRD v2.5](./prd.md) - Product Requirements Document
- [Electron Forge Setup](./electron-forge.md) - Build configuration
- [shadcn-svelte](./shadcn-svelte.md) - UI components
