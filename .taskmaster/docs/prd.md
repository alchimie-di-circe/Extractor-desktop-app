# PRD v2.5: Sveltronkit + Human-in-the-Loop Cagent (RPG Format) - INTEGRATED

## 🎯 Core Problem & Vision
**Problem**: Content creators waste 10+ hours/week manually extracting photos from Apple Photos, editing them in multiple tools, writing captions, and scheduling posts across platforms.

**Solution**: A local-first desktop AI command center (Sveltronkit-based) that brings the AI to the user's data, with human-in-the-loop decision points for agent architecture, integrating the proven Sveltronkit foundation from v2.0.

**Success Metrics**: 
- 80% of media workflow automated via AI agents
- < 5% manual intervention rate after initial setup
- Zero user photos uploaded to external servers (privacy-first)

## 🏗️ Human-in-the-Loop Architecture Decisions

### Key Decisions To Be Made Together:
1. **Cagent Team Structure**: Single orchestrator with handoffs vs independent specialized agents
2. **Default Models**: Optimal LLM selection for each agent role (GPT-4, Claude, Gemini)
3. **RAG Strategy**: Shared brand knowledge vs agent-specific knowledge bases  
4. **A2UI Protocol**: Safety constraints for agent-generated UI components
5. **Timeline Integration**: How Twick timeline component integrates with A2UI widgets
6. **Sveltronkit Configuration**: Template selection and initial setup from v2.0 proven architecture

### Architecture Overview (Integrated from v2.0):
- **Tier 1**: SvelteKit 2 + Svelte 5 Runes + shadcn-svelte UI with Twick timeline and A2UI-generated widgets
- **Tier 2**: Electron 32+ Main managing Python sidecar lifecycle with context isolation
- **Tier 3**: Cagent engine with configurable LLM providers and native RAG (NO external ChromaDB)
- **External**: Cloudinary MCP servers for media operations and Postiz for publishing

## 📋 Functional Capabilities (Enhanced from v2.0)

### Capability: Sveltronkit Foundation (From v2.0)
**Feature**: Complete Desktop App Setup
- **Description**: Initialize Sveltronkit template with Electron + SvelteKit + shadcn-svelte
- **Inputs**: Pandoks/sveltronkit template, TypeScript configuration
- **Outputs**: Working desktop window with hash routing, native Mac integration
- **Behavior**: Single-file SPA, ~2.5MB bundle, context isolation security

### Capability: Multi-Provider AI Configuration (New)
**Feature**: LLM Provider Settings UI
- **Description**: User-configurable AI providers with secure API key storage
- **Inputs**: Provider selection, API credentials, model preferences
- **Outputs**: Validated connection + saved configuration in OS keychain
- **Behavior**: Connection testing, model validation, dynamic cagent.yaml generation

### Capability: Native Cagent RAG (New)
**Feature**: Local File-Based Knowledge Base
- **Description**: Cagent's built-in RAG indexing local brand assets (NO external ChromaDB)
- **Inputs**: PDF guidelines, tone documents from ./brand_assets/
- **Outputs**: Searchable knowledge embeddings in local SQLite
- **Behavior**: Automatic indexing on file changes, semantic search by meaning

### Capability: Cloudinary MCP Integration (New)
**Feature**: Official Cloudinary MCP Servers
- **Description**: Access to Cloudinary's full media management via MCP protocol
- **Inputs**: Media files, transformation requests via natural language
- **Outputs**: Processed media URLs, AI-generated transformations
- **Behavior**: Background removal, upscale, auto-crop via agent commands

### Capability: A2A + A2UI Protocol (New)
**Feature**: Agent-to-Agent + Agent-to-UI Communication
- **Description**: Agents can create UI elements and pass context between each other
- **Inputs**: User requests, agent decisions, workflow context
- **Outputs**: Dynamic UI widgets, workflow artifacts, timeline events
- **Behavior**: Real-time component generation, SSE streaming to UI

### Capability: Photo Extraction (From v2.0)
**Feature**: Local Apple Photos Integration
- **Tool**: osxphotos Python library (proven from v2.0)
- **Function**: Scans local Photos library with EXIF preservation
- **AI Enhancement**: Extraction Agent analyzes metadata and suggests tags
- **Workflow**: Browse albums → Filter by date → Extract with progress bar

### Capability: Multi-Platform Publishing (From v2.0)
**Feature**: Social Media Scheduling
- **Service**: Postiz API (proven from v2.0)
- **Function**: Publishing Agent schedules content across platforms
- **Analytics**: Webhook listener updates local engagement stats
- **Platforms**: Instagram, Facebook, LinkedIn, Twitter, TikTok

## 🏗️ Structural Architecture (Enhanced v2.0)

```
brand-asset-manager/
├── src/                          # SvelteKit Frontend (Enhanced v2.0)
│   ├── routes/
│   │   ├── +layout.svelte       # Root layout + navigation (from v2.0)
│   │   ├── +page.svelte         # Dashboard (#/) (from v2.0)
│   │   ├── brands/              # Brand management (#/brands) (from v2.0)
│   │   ├── extract/             # Photo extraction (#/extract) (from v2.0)
│   │   ├── edit/                # Asset editing (#/edit) (from v2.0)
│   │   ├── publish/             # Publishing (#/publish) (from v2.0)
│   │   ├── settings/            # App settings (#/settings) (from v2.0)
│   │   │   ├── llm-providers/ # NEW: AI provider configuration
│   │   │   └── agents/        # NEW: Agent management
│   │   └── timeline/          # NEW: Twick timeline integration
│   └── lib/
│       ├── components/
│   │   │   ├── ui/              # shadcn-svelte (auto-generated) (from v2.0)
│   │   │   ├── custom/          # App-specific (from v2.0)
│   │   │   └── agent-widgets/   # NEW: A2UI-generated components
│       ├── services/            # Business logic (IPC calls) (from v2.0)
│       │   ├── db.ts            # SQLite client (from v2.0)
│   │   ├── cagent-client.ts     # UPDATED: HTTP client for Python sidecar
│   │   └── postiz.ts            # Postiz API (from v2.0)
│       └── stores/              # Svelte 5 Runes (from v2.0)
├── electron/                      # Main Process (Enhanced v2.0)
│   ├── main.ts                  # App lifecycle (from v2.0)
│   ├── preload.ts               # IPC bridge (from v2.0)
│   ├── ipc-handlers.ts          # Business logic (from v2.0)
│   ├── keychain.ts              # NEW: Secure credential storage
│   └── sidecar-manager.ts       # NEW: Python process lifecycle
├── python/                        # Cagent Sidecar (NEW)
│   ├── main.py                  # FastAPI server
│   ├── cagent.yaml             # Agent configuration (generated)
│   ├── agents/                 # Agent implementations
│   └── tools/                  # MCP tool wrappers
└── resources/                     # Static assets (from v2.0)
    ├── brand-assets/           # User brand materials
    └── vector-store/           # Cagent RAG storage (local SQLite)
```

## 🔒 Security Architecture (NEW)

### Process Isolation Model
L'applicazione usa un'architettura multi-processo per la sicurezza:

```
┌─────────────────────────────────────────┐
│  Electron Main Process                  │
│  ├─ IPC Bridge                          │
│  ├─ Keychain Manager                    │
│  └─ Sidecar Lifecycle                   │
└─────────────────────────────────────────┘
             ↓ HTTP (localhost:8765)
┌─────────────────────────────────────────┐
│  FastAPI Sidecar                        │
│  ├─ Orchestrator Agent                  │
│  ├─ Editing Agent                       │
│  ├─ Captioning Agent                    │
│  └─ Proxy endpoint /agent/extract       │
└─────────────────────────────────────────┘
             ↓ Unix Socket
┌─────────────────────────────────────────┐
│  Sandboxed osxphotos Process (isolato)  │
│  └─ ExtractionAgent SOLO                │
└─────────────────────────────────────────┘
```

### osxphotos Sandboxing (CRITICAL)
- **Problema**: osxphotos richiede Full Disk Access - rischio sicurezza se eseguito nello stesso processo del sidecar principale
- **Soluzione**: Processo Python separato che comunica via Unix socket
- **Caratteristiche**:
  - NO accesso network
  - Read-only su Photos Library
  - Write SOLO su directory whitelist (~/Exports/, ~/Documents/TraeExports/)
  - Auto-restart su crash con circuit breaker (max 3 restart in 5 min)
  - JSON-RPC 2.0 per IPC

### FastAPI Sidecar Hardening
- NO accesso diretto a filesystem sensibili (Photos Library)
- Proxy endpoint `/agent/extract` → Unix socket (forward-only)
- Validazione path traversal con `os.path.realpath()` e `os.path.commonpath()`
- Whitelist directory per export
- Rate limiting: max 5 concurrent extraction jobs

### Path Whitelist
Export paths ristretti a:
- `~/Exports/`
- `~/Documents/TraeExports/`
- `${app.getPath('userData')}/exports/`

Validazione: reject path con `..` o symlink non risolti.

### Permission Model
| Componente | Photos Library | Network | Filesystem |
|------------|----------------|---------|------------|
| Electron Main | ❌ | ✅ | Whitelist only |
| FastAPI Sidecar | ❌ | localhost | Whitelist only |
| osxphotos Sandbox | ✅ Read | ❌ | Whitelist write |
| MCP Gateway containers | ❌ | Isolated | Container-only |

## 🐳 Docker MCP Gateway Integration (NEW)

### Requisiti
- **Docker Engine**: Richiesto per MCP Gateway (NO Docker Desktop necessario)
- **Docker Desktop 4.40+**: Solo per Docker Model Runner (OPTIONAL UPGRADE)

### MCP Gateway vs Local
L'applicazione supporta due modalità per i tool MCP:

| Modalità | Requisiti | Vantaggi | Svantaggi |
|----------|-----------|----------|-----------|
| Docker Gateway | Docker Engine | Auto-update, sandboxing, catalog curato | Richiede Docker |
| Local (npx) | Node.js | Zero dipendenze extra | Gestione manuale updates |

### Configurazione UI
- Settings > Tools: toggle per-tool Cloud/Local
- Auto-detect Docker Engine presenza (`docker info`)
- Fallback automatico: Gateway → Local → Error con istruzioni

### Tool Supportati via Gateway
- `mcp/cloudinary` - Media management (background removal, upscale, crop)
- `mcp/duckduckgo` - Web search (no API key required)

### Installazione MCP Gateway
```bash
# Download binary da GitHub releases
wget https://github.com/docker/mcp-gateway/releases/latest/download/docker-mcp-darwin-arm64
mv docker-mcp-darwin-arm64 ~/.docker/cli-plugins/docker-mcp
chmod +x ~/.docker/cli-plugins/docker-mcp

# Abilita server
docker mcp server enable cloudinary
docker mcp gateway run
```

### Fallback Chain
1. Docker MCP Gateway (se Docker running + Gateway installato)
2. Local npx server (se API keys configurate)
3. Error con istruzioni utente per installazione

### Configurazione cagent.yaml Dinamica
```yaml
# Generato dinamicamente in base a user settings
agents:
  editing_agent:
    toolsets:
      - type: mcp
        ref: ${MCP_CLOUDINARY_MODE}  # "mcp/cloudinary" | "npx @cloudinary/mcp-server"
        env:
          CLOUDINARY_URL: ${CLOUDINARY_URL}
```

## 🔗 Dependency Chain (Critical for Task Master)

### Foundation Layer (Phase 0) - From v2.0
- **sveltronkit-init**: No dependencies - clone Pandoks/sveltronkit template
- **config-manager**: No dependencies - manages LLM provider settings
- **keychain-service**: No dependencies - secure credential storage

### UI Framework Layer (Phase 1) - Enhanced v2.0
- **shadcn-setup**: Depends on [sveltronkit-init] - install UI components
- **timeline-integration**: Depends on [shadcn-setup] - integrate Twick timeline
- **electron-window**: Depends on [sveltronkit-init] - native window setup with context isolation

### Agent Configuration Layer (Phase 2) - NEW
- **llm-provider-ui**: Depends on [config-manager, keychain-service, shadcn-setup]
- **cagent-config**: Depends on [config-manager] - generates YAML from user settings
- **python-sidecar**: Depends on [cagent-config] - FastAPI server with SSE

### Core Agent Layer (Phase 3) - NEW
- **orchestrator-agent**: Depends on [cagent-config, native-rag, python-sidecar]
- **extraction-agent**: Depends on [osxphotos-tools, python-sidecar]
- **editing-agent**: Depends on [cloudinary-mcp-servers, python-sidecar]
- **captioning-agent**: Depends on [native-rag, content-tools, python-sidecar]
- **scheduling-agent**: Depends on [postiz-api, calendar-tools, python-sidecar]

### A2UI Integration Layer (Phase 4) - NEW
- **agent-widget-system**: Depends on [all-agents, shadcn-setup, timeline-integration]
- **dynamic-ui-generator**: Depends on [agent-widget-system, a2a-protocol]

## 📊 Development Phases

### Phase 0: Foundation Setup (From v2.0)
**Goal**: Establish Sveltronkit base with Electron and shadcn-svelte
**Entry**: Clean repository
**Human Decision Point**: Approve Sveltronkit template selection and verify v2.0 structure

**Tasks**:
- [ ] Clone and configure Sveltronkit template with TypeScript (from v2.0)
- [ ] Setup Electron main process with context isolation (from v2.0)
- [ ] Install and configure shadcn-svelte components (from v2.0)
- [ ] Configure hash routing for SPA mode (from v2.0)
- [ ] Setup development environment with hot reload (from v2.0)

**Exit**: Working desktop app window with basic UI framework (proven v2.0)

### Phase 1: UI Framework & Timeline (Enhanced v2.0)
**Goal**: Build core UI components including Twick timeline integration
**Entry**: Phase 0 complete with working Electron app
**Human Decision Point**: Review Twick timeline configuration and styling options

**Tasks**:
- [ ] Integrate Twick timeline component with SvelteKit (from brainstorming)
- [ ] Create responsive layout with navigation (from v2.0)
- [ ] Setup brand asset management UI screens (from v2.0)
- [ ] Implement photo grid and preview components (from v2.0)
- [ ] Configure theme system with dark/light modes (from v2.0)

**Exit**: Functional UI with timeline and asset management interface

### Phase 2: Agent Configuration System (NEW)
**Goal**: Build user-configurable AI provider system with secure storage
**Entry**: Phase 1 complete with working UI framework
**Human Decision Point**: Approve LLM provider options and connection testing approach

**Tasks**:
- [ ] Implement secure credential storage via OS keychain
- [ ] Build LLM provider configuration UI with validation
- [ ] Create connection testing for each provider
- [ ] Setup dynamic cagent.yaml generation from user settings
- [ ] Implement model selection per agent role

**Exit**: User can configure AI providers with validated connections

### Phase 3: Agent Team Definition (NEW)
**Goal**: Build specialized agents with clear responsibilities and MCP integration
**Entry**: Phase 2 complete with working provider configuration
**Human Decision Points**: 
- Approve agent specialization and handoff logic
- Choose default models for each agent role
- Define agent communication patterns

**Tasks**:
- [ ] Implement extraction agent with osxphotos integration
- [ ] Build editing agent with Cloudinary MCP servers
- [ ] Create captioning agent with native RAG integration
- [ ] Develop scheduling agent with Postiz API
- [ ] Test A2A communication between agents

**Exit**: Functional agent team that can handle complete media workflows

### Phase 4: A2UI & Timeline Integration (NEW)
**Goal**: Enable agents to create dynamic UI components that integrate with Twick timeline
**Entry**: Phase 3 complete with working agent team
**Human Decision Point**: Review A2UI component generation patterns and timeline integration

**Tasks**:
- [ ] Implement A2UI protocol for agent-generated widgets
- [ ] Create dynamic component registry system
- [ ] Build timeline integration for scheduling workflows
- [ ] Implement real-time UI updates via SSE
- [ ] Create agent artifact management system

**Exit**: Agents can generate appropriate UI elements that integrate with timeline

## 🧪 Test Strategy (Enhanced)

**Test Pyramid**:
- 70% Unit Tests (Fast, isolated agent logic)
- 20% Integration Tests (Agent-to-agent communication, MCP integration)
- 10% E2E Tests (Complete media workflow scenarios)

**Critical Test Scenarios**:
- **Provider Configuration**: Invalid API keys, connection failures, model validation
- **Agent Handoffs**: Context passing between agents, error handling in chains
- **A2UI Generation**: Malicious input sanitization, component validation
- **Timeline Integration**: Drag-drop scheduling, date/time validation
- **Twick Integration**: Timeline rendering, event handling, performance
- **Sveltronkit Foundation**: Electron packaging, context isolation, IPC security

## 🎯 Human-in-the-Loop Decision Points

1. **Sveltronkit Configuration**: Template selection and initial setup options (from v2.0)
2. **Twick Timeline Setup**: Configuration and styling preferences (from brainstorming)
3. **LLM Provider Selection**: Which providers to support and their priority (new)
4. **Agent Architecture**: Team-based vs individual agent approach (new)
5. **Model Assignment**: Optimal models for each agent's specialization (new)
6. **A2UI Safety**: Constraints on agent-generated UI components (new)
7. **Timeline Integration**: How A2UI widgets integrate with Twick timeline (new)

## 🚀 Optional Advanced Features (Post-MVP)

### UPGRADE-1: Docker Model Runner (Priority: LOW)
Esecuzione locale di modelli LLM senza costi API.

- **Prerequisito**: Docker Desktop 4.40+ (macOS/Windows) - NON funziona solo con Docker Engine
- **Funzionalità**:
  - LLM locali: Qwen, Llama, Mistral, Gemma
  - UI Model Browser con download manager e progress bar
  - Benchmark performance vs cloud prima di assegnare a ruoli
- **Use case**: Privacy-first, zero costi API per ruoli secondari (captioning, extraction)
- **Limitazioni**:
  - Hardware: 16GB+ RAM per modelli 7B, Apple Silicon M1+ raccomandato
  - Velocità: inferenza più lenta di cloud
  - Qualità: modelli <7B inferiori a Claude/GPT-4
- **Fallback**: local model failed → cloud provider automatico

### UPGRADE-2: Local Media Processing (Priority: MEDIUM)
Alternative locale a Cloudinary per utenti privacy-first.

- **Background Removal**:
  - Library: rembg (U2-Net model)
  - Quality: ~90% accuratezza Cloudinary

- **Upscaling**:
  - Library: Real-ESRGAN
  - Models: x2, x4 super-resolution
  - Download on-demand (~100MB per modello)

- **Smart Crop**:
  - Library: OpenCV + face detection
  - Fallback: center crop con aspect ratio

- **Trade-offs**:
  - ✅ 100% locale, nessun upload cloud
  - ✅ Nessun costo API
  - ⚠️ Più lento (dipende da hardware)
  - ⚠️ Qualità leggermente inferiore per edge cases

- **UI**: Settings toggle "Prefer local processing" checkbox
- **Fallback**: Local → Cloudinary quando local fallisce

### UPGRADE-3: MCP Deep Search (Priority: LOW)
Ricerca web approfondita per research agent.

- **Jina AI MCP**:
  - Deep web search + reader
  - Estrazione contenuto strutturato

- **Firecrawl MCP**:
  - Web scraping avanzato
  - Crawling multi-pagina

- **Features**:
  - Rate limiting: 10 req/min default
  - Quota tracking in UI
  - Integration con CaptioningAgent per trend research

- **Fallback**: Jina down → DuckDuckGo search (già disponibile)

## 📋 Task Master Integration

This PRD is structured for optimal parsing by Task Master's `parse-prd` tool:
- **Capabilities** → Main tasks with clear dependencies
- **Features** → Subtasks with acceptance criteria  
- **Dependency Chain** → Topological task ordering
- **Phases** → Development roadmap with human checkpoints
- **Integration Points** → Explicit references to v2.0 proven architecture

The dependency-aware task graph ensures proper sequencing while maintaining flexibility for human decisions during implementation, particularly around the Sveltronkit foundation and Twick timeline integration from the proven v2.0 architecture.