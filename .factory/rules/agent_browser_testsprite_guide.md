# Best Practices: Vercel agent-browser + TestSprite MCP Integration

## Sommario Esecutivo

Stai lavorando con **3 CLI agent** (Claude Code, Droid, Gemini) + Electron + Svelte.  
Vercel **agent-browser** è un CLI nativo/Rust per browser automation orientato ai CLI agent.  
**TestSprite MCP** è un AI testing agent che genera/esegue test end-to-end.

La **miglior integrazione** è:
- **agent-browser**: Browser automation comandata dai CLI agent (snapshot → refs → interact)
- **TestSprite MCP**: Orchestrazione test (genera test plan, coordina esecuzione, riporta risultati)
- Entrambi lavorano **in parallelo**, non in sostituzione.

---

## Parte 1: agent-browser per Electron App (CLI-Native)

### Cosa lo rende ideale per Electron + CLI agent

**Punti di forza**:
1. **Rust CLI nativo** → velocissimo rispetto a Playwright puro
2. **Ref system** (`@e1`, `@e2`) → deterministic element selection per AI
3. **Semantic locators** (find role, find label, find text) → non fragile come CSS selectors
4. **Accessibility tree snapshot** → AI-friendly format
5. **CDP mode** → si connette a Electron apps via Chrome DevTools Protocol
6. **--json output** → machine-readable per agenti
7. **Sessions isolate** → multiple browser instances senza conflitti

### Setup per la tua app Electron

```bash
# 1. Installa globalmente
npm install -g agent-browser
agent-browser install

# 2. Verifica Electron CDP
# Assicurati che la tua app Electron avvii con:
# --remote-debugging-port=9222
```

Nel tuo `electron/main.ts` (o simile):
```typescript
const mainWindow = new BrowserWindow({
  webPreferences: {
    // ...
  },
});

// Abilita remote debugging per agent-browser
mainWindow.webContents.debugger.attach('1.3');
```

### Workflow ottimale con CLI agent

#### Fase 1: CLI agent prende snapshot
```bash
agent-browser --cdp 9222 open "file://path/to/app"
agent-browser snapshot -i --json
# Output: Accessibility tree con refs [@e1, @e2, @e3, ...]
```

#### Fase 2: Agent interpreta snapshot e agisce
```bash
# Agent vede snapshot, identifica @e2 (button), interagisce
agent-browser click @e2
agent-browser fill @e3 "test@example.com"
agent-browser screenshot results.png
```

#### Fase 3: Agent ottiene nuovo snapshot se UI cambia
```bash
agent-browser wait --text "Settings saved"
agent-browser snapshot -i --json  # nuovo stato
```

### Vantaggi per i tuoi 3 CLI agent

- **Claude Code CLI**: Esegue comandi agent-browser nel suo terminale nativo
- **Droid**: Stesso, ma in ambiente Droid
- **Gemini CLI**: Stesso, ma in ambiente Google

**Nessuna dipendenza da VS Code Command Palette** → totale autonomia.

---

## Parte 2: TestSprite MCP per Orchestrazione Test E2E

### Cosa fa TestSprite (vs agent-browser)

| Aspetto | agent-browser | TestSprite MCP |
|---------|--------------|----------------|
| **Cosa** | Browser automation CLI | AI testing agent + sandbox |
| **Come** | Comandi diretti (snapshot, click, fill) | Genera test plan, crea test code, esegue |
| **Output** | Screenshot, text values, refs | Test report (pass/fail, coverage, sugg.) |
| **Velocità** | Immediato (real-time) | Minuti (gen + exec) |
| **Best for** | Debugging live, manual interaction | Comprehensive coverage, regression |

### Workflow integrato (Variante 1 da SOP)

```
1. CLI agent usa agent-browser per esplorare app (5 secondi)
   → snapshot interattivo, capisce struttura

2. Agent chiede a TestSprite MCP: "Genera test plan per questo flusso"
   → TestSprite legge code, genera test cases

3. TestSprite esegue test in sandbox (2-5 minuti)
   → Report: pass/fail, screenshots, recommendations

4. Se fallisce: Agent usa agent-browser + TestSprite per debug iterativo
   → Fix codice → Rigenera test → Valida
```

### Setup TestSprite MCP

```bash
# 1. Installa MCP server
npm install -D @testsprite/testsprite-mcp

# 2. Configura in .mcp.json (già fatto da Claude Code)
{
  "mcpServers": {
    "testsprite": {
      "command": "node",
      "args": ["node_modules/@testsprite/testsprite-mcp/dist/index.js"]
    }
  }
}

# 3. Aggiungi testsprite.config.json (già fatto)
{
  "projectName": "Trae_Extractor-app-v2",
  "framework": "sveltekit",
  "localPort": 5173,
  "testDirectory": "testsprite_tests"
}
```

---

## Parte 3: Pattern di Integrazione Avanzato (A2A Workflow)

### Agent-to-Agent (A2A) Feedback Loop

Questo è il **pattern nuovo** che TestSprite introduce: un agente (Claude/Droid) chiama un altro agente (TestSprite) che ritorna feedback dettagliato.

**Flusso**:
```
[CLI Agent: Claude/Droid/Gemini]
         ↓
    "Test this flow"
         ↓
[TestSprite MCP Server]
    ├─ Analizza codice
    ├─ Genera test plan
    ├─ Esegue in sandbox
    └─ Ritorna report dettagliato
         ↓
[CLI Agent]
    ├─ Legge report
    ├─ Identifica failures
    ├─ Usa agent-browser per debug live
    ├─ Fissa codice
    └─ Rigenera test
         ↓
Loop chiuso
```

### Implementazione pratica per te

**Prompt per Claude Code / Droid / Gemini**:
```markdown
## Workflow: Test E2E con agent-browser + TestSprite

1. **Esplora UI** con agent-browser:
   - agent-browser --cdp 9222 snapshot -i --json
   - Identifica elementi key (refs)

2. **Genera test** con TestSprite MCP:
   - "Usa TestSprite MCP per creare test plan per il flusso LLM settings"
   - Leggi il plan generato

3. **Esegui test** in TestSprite sandbox:
   - TestSprite esegue test e ritorna report

4. **Debug iterativo**:
   - Se test fallisce, usa agent-browser per ispezionare live
   - Fissa bug nel codice
   - Rigenera test con TestSprite

5. **Valida**:
   - Tutti i test passano? → Pronto per PR
   - Fallisce ancora? → Loop a passo 4
```

---

## Parte 4: Best Practices da Reddit/Hacker News/Community

### Dalla comunità (Reddit, Hacker News):

1. **Usa sessions isolate di agent-browser** per test paralleli
   ```bash
   AGENT_BROWSER_SESSION=test1 agent-browser click @e1
   AGENT_BROWSER_SESSION=test2 agent-browser click @e2
   ```

2. **Combina CDP mode + streaming** per debugging visuale
   ```bash
   AGENT_BROWSER_STREAM_PORT=9223 agent-browser --cdp 9222 open file://...
   # Apri browser in http://localhost:9223 per live preview
   ```

3. **Usa --headed per debugging** quando agent non riesce
   ```bash
   agent-browser --headed open file://...  # Vedi il browser visibile
   ```

4. **TestSprite MCP come "AI QA Supervisor"**
   - Agent scrive codice
   - TestSprite valida automaticamente
   - Feedback loop chiuso

5. **Non mescolare agent-browser con Playwright in CLI**
   - agent-browser è 10-100x più veloce
   - Usa quello per tutto ciò che è automation

### Considera anche:

**Browserbase** (cloud browser):
- Se runi agent in serverless (Lambda, Vercel Functions)
- Imposta: `BROWSERBASE_API_KEY` e `BROWSERBASE_PROJECT_ID`
- agent-browser si connette automaticamente

**Browser Use** (alternativa cloud):
- Se preferisci servizio diverso
- `AGENT_BROWSER_PROVIDER=browseruse`

---

## Parte 5: Slash Commands per i tuoi 3 CLI Agent

### Equivalente per Claude Code (già in `.claude/commands`)

```markdown
# /testsprite-e2e (già esiste)
Usa TestSprite MCP per generare e eseguire test.
```

### Equivalente per Droid (nuovo, da creare):

```yaml
# .droid/commands/testsprite-e2e.yaml
name: testsprite-e2e
type: testing
description: "Generate and run E2E tests with TestSprite"
steps:
  - use_mcp: testsprite_bootstrap
    params:
      localPort: 5173
      type: frontend
  - use_mcp: testsprite_generate_frontend_test_plan
  - use_mcp: testsprite_generate_code_and_execute
workflow: "bootstrap → generate plan → execute"
```

### Equivalente per Gemini CLI (nuovo, da creare):

```yaml
# .gemini/commands/testsprite-e2e.yaml
# Stesso formato, ma Gemini user adaptar tool names
```

---

## Parte 6: Checklist Implementation

Per avere il miglior flusso test E2E con agent-browser + TestSprite:

- [ ] **agent-browser installato globalmente**
  - `npm install -g agent-browser && agent-browser install`

- [ ] **Electron app ha CDP mode abilitato**
  - `--remote-debugging-port=9222`

- [ ] **TestSprite MCP configur in .mcp.json**
  - Server attivo e raggiungibile

- [ ] **Wallaby attivo localmente** (per unit test)
  - `Wallaby.js: Start` manuale o auto-start

- [ ] **Slash command `/testsprite-e2e` in Claude Code**
  - Usa agent-browser + TestSprite in sequenza

- [ ] **Equivalenti command per Droid/Gemini**
  - Tradotti nella loro sintassi

- [ ] **Documentazione "AGENTS.md" nella repo**
  ```markdown
   ## E2E Testing Workflow
   
   1. agent-browser per automation live
   2. TestSprite MCP per test generation + orchestration
   3. Feedback loop: test → debug → fix → retest
   ```

---

## Parte 7: Differenza "Agent-browser CLI" vs "Wallaby Local"

| Aspetto | agent-browser CLI | Wallaby Local |
|---------|-------------------|---------------|
| **Tipo test** | E2E / UI automation | Unit test + coverage |
| **Esecuzione** | CLI commands (live) | Background (real-time) |
| **Quando usare** | Pre-push (full validation) | While coding (fast feedback) |
| **Integrazione CLI agent** | ✅ Nativa (comandi) | ⚠️ Via MCP (lettura dati) |
| **Per Electron app** | ✅ CDP mode | ⚠️ Problematico (IDE-only) |

**TL;DR**: 
- Wallaby = unit test loop, locale, al-volo
- agent-browser = e2e test automation, da CLI, end-to-end

---

## Next: Come implementare?

Suggerisco questo ordine:

1. **Testa agent-browser** su Electron app in locale
   ```bash
   agent-browser --cdp 9222 snapshot -i --json
   ```

2. **Crea `/agent-browser-e2e` command** per Claude Code/Droid
   - Usa agent-browser per automation
   - Coordina con TestSprite se serve

3. **Traduci per Gemini cli, Opencode, kilocode cli, ecc **
   - Stesso workflow, sintassi diversa

4. **Documenta in AGENTS.md**
   - Link di riferimento per tutti gli agent




VARIANTE ROLE-BASED

Sì, ha **assolutamente senso** e anzi, è probabilmente il design pattern più efficiente per chi usa AI agents.

La divisione che proponi è una **stratificazione del rischio e della velocità** perfetta:

### 1. Livello "Instant/Local" (Speed > Coverage)
- **Tool**: `agent-browser` (E2E/UI veloce) + `Wallaby` (Unit)
- **Quando**: Mentre scrivi codice (vibe coding), loop di feedback < 10 secondi.
- **Chi lo usa**: Tu e i tuoi CLI Agent (Claude/Droid/Gemini).
- **Goal**: "Ho rotto qualcosa ora?" / "Il bottone clicca?" / "La logica regge?"
- **Vantaggio**: Non aspetti minuti per una sandbox cloud. Agent-browser è un CLI nativo rapidissimo per un check "smoke test" locale immediato.

### 2. Livello "CI/Async" (Coverage > Speed)
- **Tool**: `TestSprite` (E2E completo + Fix Agent)
- **Quando**: Async in background, o pre-merge.
- **Chi lo usa**: CI Pipeline o trigger manuale "heavy".
- **Goal**: "Fammi una scansione completa di regressione e, se trovi bug, proponi la PR di fix."
- **Vantaggio**: TestSprite è un agente "autonomo" che può girare di notte o su ogni PR, analizzare fallimenti complessi e generare codice di fix senza bloccare il tuo terminale.

***

### Perché è meglio del "Monolite"
Se usassi TestSprite per tutto (anche check locali rapidi):
- **Lentezza**: Ogni volta dovresti aspettare generazione piano + sandbox startup.
- **Overkill**: Per vedere se un bottone è blu, agent-browser ci mette 2 secondi. TestSprite 2 minuti.

Se usassi agent-browser per tutto (anche CI):
- **Fragilità**: agent-browser è un "telecomando" per agenti, non un framework di test strutturato con report storici e analisi di regressione come TestSprite.
- **Mancanza di auto-fix**: agent-browser vede l'errore, ma non ha la logica "agentica" integrata per analizzare il codice e fixarlo da solo come fa TestSprite.

### Workflow Implementativo

Ecco come configuro i comandi per te:

1. **Locale (Slash Commands)**:
   - `/smoke-ui` → Usa `agent-browser` per un rapido click-through del flusso che stai toccando.
   - `/unit` → Usa `Wallaby` per feedback immediato sulla logica.

2. **Remoto/CI**:
   - `/qa-full` (o push in CI) → Triggera `TestSprite` per generare suite completa ed eseguirla.
   - TestSprite, se trova bug, apre una PR (o ti dà il diff) con il fix.

È un setup molto maturo, simile a come operano team AI-native avanzati (es. Vercel, Replit).

