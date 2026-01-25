# Task ID: 4

**Title:** Python Sidecar con FastAPI e Lifecycle Management

**Status:** done

**Dependencies:** 2

**Priority:** high

**Description:** Implementare il sistema di sidecar Python con FastAPI che ospiterà il Cagent engine, includendo gestione del ciclo di vita del processo dal main Electron.

**Details:**

1. Creare struttura `python/`:
   - `python/main.py` - FastAPI server con SSE support
   - `python/requirements.txt` - dipendenze (fastapi, uvicorn, sse-starlette, cagent)
   - `python/agents/` - implementazioni agenti
   - `python/tools/` - wrapper MCP tools
2. Implementare FastAPI server:
```python
from fastapi import FastAPI, Request
from sse_starlette.sse import EventSourceResponse
import asyncio

app = FastAPI()

@app.get("/health")
async def health():
    return {"status": "ok"}

@app.post("/agent/execute")
async def execute_agent(request: Request):
    data = await request.json()
    # Esegui agente con Cagent
    return {"result": "..."}

@app.get("/agent/stream")
async def stream_events(request: Request):
    async def event_generator():
        while True:
            yield {"data": "..."}
            await asyncio.sleep(0.1)
    return EventSourceResponse(event_generator())
```
3. Creare `electron/sidecar-manager.ts`:
   - spawn processo Python con uvicorn
   - health check polling
   - graceful shutdown su app quit
   - restart automatico su crash
4. Bundling: includere Python embedded o usare pyinstaller per distribuzione
5. Creare `src/lib/services/cagent-client.ts` per HTTP client verso sidecar

**Test Strategy:**

Test unitari per FastAPI endpoints. Test di integrazione per verificare spawn/shutdown del sidecar. Test health check polling. Test SSE streaming.

## Subtasks

### 4.1. Creazione struttura directory python/ con requirements.txt

**Status:** done  
**Dependencies:** None  

Creare la struttura completa della directory python/ con tutti i file e sottocartelle necessarie per il sidecar FastAPI, incluso requirements.txt con tutte le dipendenze.

**Details:**

Creare la seguente struttura:
- `python/main.py` - entry point vuoto iniziale
- `python/requirements.txt` con dipendenze: fastapi>=0.104.0, uvicorn[standard]>=0.24.0, sse-starlette>=1.8.0, pydantic>=2.5.0, python-dotenv>=1.0.0
- `python/agents/__init__.py` - package per implementazioni agenti
- `python/tools/__init__.py` - package per wrapper MCP tools
- `python/config.py` - configurazione server (host, port, log level)
- `python/.gitignore` per __pycache__, .venv, *.pyc

Aggiungere commenti placeholder che indicano dove verranno implementate le funzionalità successive.

### 4.2. Implementazione FastAPI server con endpoint health e execute

**Status:** done  
**Dependencies:** 4.1  

Implementare il server FastAPI base in main.py con gli endpoint /health per monitoring e /agent/execute per esecuzione sincrona degli agenti.

**Details:**

Implementare in `python/main.py`:
```python
from fastapi import FastAPI, Request, HTTPException
from pydantic import BaseModel
import logging

app = FastAPI(title='Cagent Sidecar', version='1.0.0')
logger = logging.getLogger(__name__)

class AgentRequest(BaseModel):
    agent_id: str
    input: dict
    context: dict | None = None

class AgentResponse(BaseModel):
    result: dict
    execution_time: float
    agent_id: str

@app.get('/health')
async def health():
    return {'status': 'ok', 'version': '1.0.0'}

@app.post('/agent/execute', response_model=AgentResponse)
async def execute_agent(request: AgentRequest):
    # Placeholder per integrazione Cagent
    pass
```
Aggiungere middleware per logging request/response e CORS per comunicazione con Electron.

### 4.3. Implementazione SSE streaming per eventi agenti

**Status:** done  
**Dependencies:** 4.2  

Aggiungere endpoint SSE (Server-Sent Events) per streaming real-time degli eventi durante l'esecuzione degli agenti verso il frontend Electron.

**Details:**

Implementare in `python/main.py`:
```python
from sse_starlette.sse import EventSourceResponse
import asyncio
from typing import AsyncGenerator

class StreamEvent(BaseModel):
    event_type: str  # 'thinking', 'tool_call', 'result', 'error'
    data: dict
    timestamp: float

async def agent_event_generator(agent_id: str, request_id: str) -> AsyncGenerator:
    # Queue per eventi dall'agente
    event_queue = asyncio.Queue()
    try:
        while True:
            event = await asyncio.wait_for(event_queue.get(), timeout=30.0)
            yield {'event': event.event_type, 'data': event.json()}
            if event.event_type in ('result', 'error'):
                break
    except asyncio.TimeoutError:
        yield {'event': 'keepalive', 'data': '{}'}

@app.get('/agent/stream/{request_id}')
async def stream_events(request_id: str, request: Request):
    return EventSourceResponse(agent_event_generator(request_id))
```
Gestire disconnessione client e cleanup risorse.

### 4.4. Creazione sidecar-manager.ts in Electron per spawn/kill processo Python

**Status:** done  
**Dependencies:** 4.1  

Implementare il modulo TypeScript in Electron che gestisce lo spawn del processo Python uvicorn e la terminazione controllata del sidecar.

**Details:**

Creare `electron/sidecar-manager.ts`:
```typescript
import { spawn, ChildProcess } from 'child_process';
import path from 'path';
import { app } from 'electron';

export class SidecarManager {
  private process: ChildProcess | null = null;
  private readonly port: number = 8765;
  private readonly host: string = '127.0.0.1';

  async start(): Promise<void> {
    const pythonPath = this.getPythonPath();
    const scriptPath = path.join(app.getAppPath(), 'python', 'main.py');
    
    this.process = spawn(pythonPath, [
      '-m', 'uvicorn',
      'main:app',
      '--host', this.host,
      '--port', String(this.port)
    ], { cwd: path.dirname(scriptPath) });
    
    this.setupEventHandlers();
  }

  async stop(): Promise<void> {
    // SIGTERM con timeout, poi SIGKILL
  }

  getBaseUrl(): string {
    return `http://${this.host}:${this.port}`;
  }
}
```
Gestire stdout/stderr logging e rilevamento errori startup.

### 4.5. Implementazione health check polling con auto-restart e backoff esponenziale

**Status:** done  
**Dependencies:** 4.4  

Aggiungere sistema di health check polling al SidecarManager con logica di auto-restart in caso di crash e backoff esponenziale per evitare restart loop.

**Details:**

Estendere `electron/sidecar-manager.ts`:
```typescript
interface HealthCheckConfig {
  interval: number;        // 5000ms default
  timeout: number;         // 2000ms default  
  maxRetries: number;      // 3 prima di restart
  maxRestarts: number;     // 5 prima di circuit breaker
  backoffMultiplier: number; // 2.0
  maxBackoff: number;      // 60000ms
}

class SidecarManager {
  private healthCheckTimer: NodeJS.Timer | null = null;
  private restartCount: number = 0;
  private currentBackoff: number = 1000;

  private async checkHealth(): Promise<boolean> {
    try {
      const response = await fetch(`${this.getBaseUrl()}/health`, {
        signal: AbortSignal.timeout(this.config.timeout)
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  private async handleUnhealthy(): Promise<void> {
    if (this.restartCount >= this.config.maxRestarts) {
      this.emit('circuit-breaker-open');
      return;
    }
    await this.restart();
    this.currentBackoff = Math.min(
      this.currentBackoff * this.config.backoffMultiplier,
      this.config.maxBackoff
    );
  }
}
```
Emettere eventi per UI feedback sullo stato del sidecar.

### 4.6. Gestione graceful shutdown su app quit con timeout e SIGTERM/SIGKILL

**Status:** done  
**Dependencies:** 4.5  

Implementare la logica di shutdown graceful del sidecar Python quando l'app Electron viene chiusa, con escalation da SIGTERM a SIGKILL dopo timeout.

**Details:**

Estendere `electron/sidecar-manager.ts` e integrare con lifecycle Electron:
```typescript
import { app } from 'electron';

class SidecarManager {
  private readonly shutdownTimeout: number = 5000;

  registerShutdownHandlers(): void {
    app.on('before-quit', async (event) => {
      if (this.process) {
        event.preventDefault();
        await this.gracefulShutdown();
        app.quit();
      }
    });

    process.on('SIGINT', () => this.gracefulShutdown());
    process.on('SIGTERM', () => this.gracefulShutdown());
  }

  private async gracefulShutdown(): Promise<void> {
    if (!this.process) return;
    
    this.stopHealthCheck();
    
    // Notifica sidecar di shutdown
    try {
      await fetch(`${this.getBaseUrl()}/shutdown`, { method: 'POST' });
    } catch {}

    // SIGTERM
    this.process.kill('SIGTERM');
    
    // Attendi o forza SIGKILL
    const killed = await this.waitForExit(this.shutdownTimeout);
    if (!killed) {
      this.process.kill('SIGKILL');
    }
  }
}
```
Aggiungere endpoint /shutdown in FastAPI per cleanup risorse Python.

### 4.7. Bundling strategy con PyInstaller per distribuzione cross-platform

**Status:** done  
**Dependencies:** 4.6  

Configurare PyInstaller per creare un eseguibile standalone del sidecar Python che può essere distribuito insieme all'app Electron su Windows, macOS e Linux.

**Details:**

Creare `python/build/` con configurazione PyInstaller:
1. `python/pyinstaller.spec`:
```python
a = Analysis(
    ['main.py'],
    pathex=[],
    binaries=[],
    datas=[('agents', 'agents'), ('tools', 'tools')],
    hiddenimports=['uvicorn.logging', 'uvicorn.protocols.http'],
    hookspath=[],
    noarchive=False,
)
pyz = PYZ(a.pure)
exe = EXE(
    pyz, a.scripts, a.binaries, a.datas,
    name='cagent-sidecar',
    console=False,
    onefile=True
)
```
2. Script `scripts/build-sidecar.sh`:
```bash
#!/bin/bash
pyinstaller --clean --noconfirm python/pyinstaller.spec
cp dist/cagent-sidecar resources/sidecar/
```
3. Modificare `SidecarManager.getPythonPath()` per usare eseguibile bundled in produzione:
```typescript
getSidecarPath(): string {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'sidecar', 'cagent-sidecar');
  }
  return 'python3'; // Dev mode
}
```
4. Aggiornare electron-builder config per includere sidecar negli extraResources.
