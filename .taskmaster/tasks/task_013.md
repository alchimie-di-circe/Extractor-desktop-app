# Task ID: 13

**Title:** Testing Suite Completa e CI/CD Setup

**Status:** pending

**Dependencies:** 11

**Priority:** medium

**Description:** Implementare suite di test completa con unit, integration, e E2E tests, insieme a pipeline CI/CD per build automatiche.

**Details:**

1. Configurare test pyramid:
   - 70% Unit tests (Vitest per frontend, pytest per Python)
   - 20% Integration tests (IPC, agent communication)
   - 10% E2E tests (Playwright)
2. Creare `tests/` struttura:
```
tests/
├── unit/
│   ├── components/
│   ├── services/
│   └── stores/
├── integration/
│   ├── ipc/
│   ├── agents/
│   └── rag/
└── e2e/
    ├── workflows/
    └── fixtures/
```
3. Test critici da implementare:
   - Provider configuration validation
   - Agent handoff context preservation
   - A2UI component generation safety
   - Timeline drag-drop scheduling
   - Twick timeline rendering
   - Electron context isolation
4. CI/CD in `.github/workflows/`:
   - Lint + Type check
   - Unit tests
   - Integration tests
   - E2E tests
   - Build artefatti per macOS/Windows/Linux
5. Pre-commit hooks con husky

**Test Strategy:**

Meta-testing: verificare copertura test >80%. Test che CI pipeline completi senza errori. Test build artefatti su tutte le piattaforme.

## Subtasks

### 13.1. Configurazione Test Pyramid e Struttura Directory tests/

**Status:** pending  
**Dependencies:** None  

Creare la struttura organizzativa delle directory per test unitari, di integrazione ed E2E, configurando la test pyramid con rapporto 70/20/10

**Details:**

1. Creare la gerarchia di directory tests/ con subdirectory unit/, integration/, e2e/
2. Configurare sottocartelle specifiche:
   - tests/unit/components/, tests/unit/services/, tests/unit/stores/
   - tests/integration/ipc/, tests/integration/agents/, tests/integration/rag/
   - tests/e2e/workflows/, tests/e2e/fixtures/
3. Estendere vite.config.ts per includere i nuovi percorsi di test
4. Configurare vitest workspace per separare test client e server con ambienti appropriati (jsdom per componenti, node per servizi)
5. Aggiungere script package.json per eseguire test per categoria (test:unit, test:integration, test:e2e)
6. Creare file di setup vitest-setup-client.ts e vitest-setup-server.ts con mock globali
7. Documentare la strategia test pyramid nel README con metriche di coverage target (70% unit, 20% integration, 10% E2E)

### 13.2. Unit Tests per Componenti Svelte e Servizi TypeScript con Vitest

**Status:** pending  
**Dependencies:** 13.1  

Implementare suite completa di test unitari per componenti Svelte 5 e servizi TypeScript utilizzando Vitest e Testing Library

**Details:**

1. Configurare @testing-library/svelte con supporto Svelte 5 runes e componenti
2. Creare test per componenti UI critici:
   - Timeline component (rendering, drag-drop handlers)
   - Provider configuration forms (validazione input)
   - A2UI generated components (safety checks)
   - Twick timeline rendering
3. Test per servizi TypeScript:
   - IPC service mocking con vi.mock
   - Store tests (Svelte stores e state management)
   - API client tests con mock fetch
4. Configurare coverage reporter (istanbul/v8) con soglia minima 70%
5. Aggiungere snapshot testing per componenti UI stabili
6. Creare helper utilities per render testing di componenti con contesto Svelte
7. Mock per Electron APIs (contextBridge, ipcRenderer) nei test client
8. Test per provider configuration validation con casi edge

### 13.3. Unit Tests Python per Agenti e Sistema RAG con pytest

**Status:** pending  
**Dependencies:** 13.1  

Creare suite di test unitari Python con pytest per il sistema di agenti Cagent e il modulo RAG con embeddings

**Details:**

1. Configurare pytest in python/ directory con pytest.ini e conftest.py
2. Creare fixtures condivise per:
   - Mock FastAPI TestClient
   - Database SQLite in-memory per RAG tests
   - Fake embeddings model per test veloci
3. Test per agent communication:
   - Handoff context preservation tra agenti
   - Agent state machine transitions
   - Tool invocation mocking
4. Test per sistema RAG:
   - Document indexing con embeddings mock
   - Similarity search accuracy
   - Brand knowledge base queries
5. Test per captioning agent:
   - Caption generation con mock LLM
   - Brand guidelines adherence
6. Configurare pytest-cov per coverage Python >= 80%
7. Aggiungere pytest-asyncio per test async FastAPI endpoints
8. Creare test parametrizzati per diverse configurazioni agente

### 13.4. Integration Tests per IPC e Agent Communication

**Status:** pending  
**Dependencies:** 13.1, 13.2, 13.3  

Implementare test di integrazione per il bridge IPC tra Electron main/renderer e la comunicazione con il Python sidecar

**Details:**

1. Creare test framework per IPC integration:
   - Mock Electron main process per test isolati
   - Test contextBridge exposed APIs
   - Verifica context isolation attivo
2. Test IPC handlers:
   - Keychain save/get/delete operations
   - Provider API invocations
   - Error propagation tra processi
3. Test agent communication end-to-end:
   - HTTP/SSE streaming dal Python sidecar
   - Agent handoff con context preservation
   - Timeout e retry logic
4. Test RAG integration:
   - Document upload attraverso IPC
   - Query e retrieval pipeline
5. Configurare test database SQLite per integration tests
6. Mock external APIs (Postiz, provider APIs) con msw o simili
7. Test health check polling del sidecar
8. Verifica gestione errori di rete e reconnection

### 13.5. E2E Tests per Workflow Critici con Playwright

**Status:** pending  
**Dependencies:** 13.1, 13.4  

Implementare test end-to-end con Playwright per validare i flussi utente critici dell'applicazione Electron

**Details:**

1. Estendere playwright.config.ts per Electron testing:
   - Configurare electronPath per app packaging
   - Setup fixture per app instance
   - Screenshot e video recording su failure
2. Test workflow critici:
   - Provider configuration flow completo (add, validate, save)
   - Timeline drag-drop scheduling operations
   - Content generation e preview
   - Posting workflow con scheduling
3. Creare fixtures directory con:
   - Test media assets (images, videos)
   - Mock API responses
   - Pre-configured app states
4. Test A2UI component generation:
   - Safety checks per generated code
   - Rendering validation
5. Test multi-window scenarios se applicabile
6. Configurare retries e timeout appropriati per CI
7. Parallel test execution con sharding
8. Accessibility testing con axe-playwright

### 13.6. CI/CD Pipeline GitHub Actions con Build Multi-Piattaforma

**Status:** pending  
**Dependencies:** 13.1, 13.2, 13.3, 13.4, 13.5  

Configurare pipeline CI/CD completa in GitHub Actions per test automatici, build multi-piattaforma e code signing

**Details:**

1. Creare .github/workflows/ci.yml con jobs:
   - lint: ESLint + TypeScript type check
   - test-unit: Vitest unit tests con coverage
   - test-python: pytest per Python sidecar
   - test-integration: Integration tests
   - test-e2e: Playwright E2E (dopo build)
2. Creare .github/workflows/build.yml:
   - Build matrix: macOS-latest, windows-latest, ubuntu-latest
   - electron-forge make per artefatti nativi
   - Upload artifacts per ogni piattaforma
3. Configurare code signing:
   - macOS: Apple Developer ID con notarization
   - Windows: Code signing certificate
   - Secrets per certificati in GitHub Secrets
4. Setup pre-commit hooks con husky:
   - lint-staged per ESLint/Prettier
   - Commit message validation
   - Type check pre-push
5. Configurare Dependabot per security updates
6. Badge di status nel README
7. Cache per node_modules e Python venv
8. Conditional builds su tag per release
