# Task ID: 15

**Title:** Sandboxed osxphotos Process Manager con Isolamento di Sicurezza

**Status:** pending

**Dependencies:** 2 ✓, 4 ✓, 6

**Priority:** high

**Description:** Implementare un processo Python completamente isolato in python/sandboxed/ per l'accesso sicuro alla Photos Library di macOS, comunicante esclusivamente via Unix socket con protocollo JSON-RPC 2.0 e supervisione auto-restart con circuit breaker.

**Details:**

## Struttura Directory

```
python/
├── sandboxed/
│   ├── __init__.py
│   ├── main.py                    # Entry point processo sandboxed
│   ├── socket_server.py           # Server Unix socket
│   ├── jsonrpc_handler.py         # Handler JSON-RPC 2.0
│   ├── photos_service.py          # Wrapper osxphotos
│   ├── path_validator.py          # Validazione whitelist directory
│   └── requirements.txt           # Dipendenze isolate
```

## 1. Unix Socket Server (`socket_server.py`)

```python
import socket
import os
import asyncio
from typing import Callable

SOCKET_PATH = '/tmp/trae-osxphotos.sock'

class UnixSocketServer:
    def __init__(self, handler: Callable):
        self.handler = handler
        self.socket_path = SOCKET_PATH
        
    async def start(self):
        # Rimuovi socket esistente
        if os.path.exists(self.socket_path):
            os.unlink(self.socket_path)
        
        server = await asyncio.start_unix_server(
            self._handle_client,
            path=self.socket_path
        )
        # Permessi restrittivi: solo owner
        os.chmod(self.socket_path, 0o600)
        
        async with server:
            await server.serve_forever()
    
    async def _handle_client(self, reader, writer):
        try:
            data = await reader.read(1024 * 1024)  # Max 1MB
            response = await self.handler(data.decode())
            writer.write(response.encode())
            await writer.drain()
        finally:
            writer.close()
            await writer.wait_closed()
```

## 2. JSON-RPC 2.0 Handler (`jsonrpc_handler.py`)

```python
import json
from typing import Dict, Any, Optional

class JsonRpcHandler:
    def __init__(self, photos_service):
        self.photos_service = photos_service
        self.methods = {
            'list_albums': self.photos_service.list_albums,
            'get_photos': self.photos_service.get_photos,
            'export_photo': self.photos_service.export_photo,
            'get_photo_metadata': self.photos_service.get_photo_metadata,
            'search_photos': self.photos_service.search_photos,
        }
    
    async def handle(self, request_str: str) -> str:
        try:
            request = json.loads(request_str)
            
            # Validazione JSON-RPC 2.0
            if request.get('jsonrpc') != '2.0':
                return self._error_response(None, -32600, 'Invalid Request')
            
            method = request.get('method')
            params = request.get('params', {})
            req_id = request.get('id')
            
            if method not in self.methods:
                return self._error_response(req_id, -32601, 'Method not found')
            
            result = await self.methods[method](**params)
            return self._success_response(req_id, result)
            
        except json.JSONDecodeError:
            return self._error_response(None, -32700, 'Parse error')
        except Exception as e:
            return self._error_response(req_id, -32000, str(e))
    
    def _success_response(self, id: Any, result: Any) -> str:
        return json.dumps({
            'jsonrpc': '2.0',
            'result': result,
            'id': id
        })
    
    def _error_response(self, id: Any, code: int, message: str) -> str:
        return json.dumps({
            'jsonrpc': '2.0',
            'error': {'code': code, 'message': message},
            'id': id
        })
```

## 3. Path Validator con Whitelist (`path_validator.py`)

```python
import os
from pathlib import Path
from typing import List

class PathValidator:
    WHITELIST_DIRECTORIES = [
        os.path.expanduser('~/Exports/'),
        os.path.expanduser('~/Documents/TraeExports/'),
    ]
    
    @classmethod
    def validate_export_path(cls, target_path: str) -> bool:
        """Valida che il path sia nella whitelist e non contenga path traversal."""
        real_path = os.path.realpath(target_path)
        
        # Check path traversal
        if '..' in target_path:
            raise SecurityError(f'Path traversal detected: {target_path}')
        
        # Check whitelist
        for allowed in cls.WHITELIST_DIRECTORIES:
            allowed_real = os.path.realpath(allowed)
            if os.path.commonpath([real_path, allowed_real]) == allowed_real:
                return True
        
        raise SecurityError(f'Path not in whitelist: {target_path}')
    
    @classmethod
    def ensure_directories_exist(cls):
        """Crea le directory whitelist se non esistono."""
        for dir_path in cls.WHITELIST_DIRECTORIES:
            Path(dir_path).mkdir(parents=True, exist_ok=True)

class SecurityError(Exception):
    pass
```

## 4. Photos Service con osxphotos (`photos_service.py`)

```python
import osxphotos
from typing import List, Dict, Optional
from path_validator import PathValidator, SecurityError

class PhotosService:
    def __init__(self, photos_db_path: Optional[str] = None):
        self.photosdb = osxphotos.PhotosDB(dbfile=photos_db_path)
        PathValidator.ensure_directories_exist()
    
    async def list_albums(self) -> List[Dict]:
        return [
            {'title': a.title, 'uuid': a.uuid, 'photo_count': len(a.photos)}
            for a in self.photosdb.album_info
        ]
    
    async def get_photos(
        self, 
        album_uuid: Optional[str] = None,
        from_date: Optional[str] = None,
        to_date: Optional[str] = None,
        limit: int = 100
    ) -> List[Dict]:
        photos = self.photosdb.photos()
        
        if album_uuid:
            album = next((a for a in self.photosdb.album_info if a.uuid == album_uuid), None)
            if album:
                photos = album.photos
        
        return [
            {
                'uuid': p.uuid,
                'filename': p.original_filename,
                'date': p.date.isoformat() if p.date else None,
                'width': p.width,
                'height': p.height,
                'has_exif': bool(p.exif_info),
            }
            for p in list(photos)[:limit]
        ]
    
    async def export_photo(
        self, 
        photo_uuid: str, 
        target_directory: str,
        preserve_exif: bool = True
    ) -> Dict:
        # CRITICAL: Validazione whitelist
        PathValidator.validate_export_path(target_directory)
        
        photo = next((p for p in self.photosdb.photos() if p.uuid == photo_uuid), None)
        if not photo:
            raise ValueError(f'Photo not found: {photo_uuid}')
        
        exported = photo.export(
            target_directory,
            use_photos_export=True,
            exiftool=preserve_exif
        )
        
        return {'exported_path': exported[0] if exported else None}
    
    async def get_photo_metadata(self, photo_uuid: str) -> Dict:
        photo = next((p for p in self.photosdb.photos() if p.uuid == photo_uuid), None)
        if not photo:
            raise ValueError(f'Photo not found: {photo_uuid}')
        
        return {
            'uuid': photo.uuid,
            'filename': photo.original_filename,
            'date': photo.date.isoformat() if photo.date else None,
            'exif': photo.exif_info.__dict__ if photo.exif_info else None,
            'location': {'lat': photo.latitude, 'lon': photo.longitude},
            'keywords': photo.keywords,
            'persons': [p.name for p in photo.person_info],
        }
```

## 5. Main Entry Point (`main.py`)

```python
import asyncio
import signal
import sys
import os

# SECURITY: Blocca accesso network
def block_network():
    """Impedisce qualsiasi connessione network."""
    import socket
    _original_socket = socket.socket
    
    def restricted_socket(*args, **kwargs):
        # Permetti SOLO Unix socket (AF_UNIX)
        if args and args[0] == socket.AF_UNIX:
            return _original_socket(*args, **kwargs)
        raise PermissionError('Network access is disabled in sandboxed process')
    
    socket.socket = restricted_socket

block_network()

from socket_server import UnixSocketServer
from jsonrpc_handler import JsonRpcHandler
from photos_service import PhotosService

async def main():
    photos_service = PhotosService()
    handler = JsonRpcHandler(photos_service)
    server = UnixSocketServer(handler.handle)
    
    print(f'[osxphotos-sandbox] Starting on {server.socket_path}', file=sys.stderr)
    
    def shutdown_handler(sig, frame):
        print('[osxphotos-sandbox] Shutting down...', file=sys.stderr)
        sys.exit(0)
    
    signal.signal(signal.SIGTERM, shutdown_handler)
    signal.signal(signal.SIGINT, shutdown_handler)
    
    await server.start()

if __name__ == '__main__':
    asyncio.run(main())
```

## 6. Electron Main Process Supervisor (`electron/osxphotos-supervisor.ts`)

```typescript
import { spawn, ChildProcess } from 'child_process';
import * as path from 'path';
import * as net from 'net';

interface CircuitBreakerState {
  failures: number;
  lastFailure: number;
  isOpen: boolean;
}

export class OsxphotosSupervisor {
  private process: ChildProcess | null = null;
  private circuitBreaker: CircuitBreakerState = {
    failures: 0,
    lastFailure: 0,
    isOpen: false,
  };
  
  private readonly MAX_FAILURES = 3;
  private readonly RESET_TIMEOUT_MS = 5 * 60 * 1000; // 5 minuti
  private readonly SOCKET_PATH = '/tmp/trae-osxphotos.sock';
  
  async start(): Promise<void> {
    if (this.circuitBreaker.isOpen) {
      const elapsed = Date.now() - this.circuitBreaker.lastFailure;
      if (elapsed < this.RESET_TIMEOUT_MS) {
        throw new Error(`Circuit breaker open. Retry in ${Math.ceil((this.RESET_TIMEOUT_MS - elapsed) / 1000)}s`);
      }
      // Reset circuit breaker
      this.circuitBreaker = { failures: 0, lastFailure: 0, isOpen: false };
    }
    
    const pythonPath = this.getPythonPath();
    const scriptPath = path.join(__dirname, '../python/sandboxed/main.py');
    
    this.process = spawn(pythonPath, [scriptPath], {
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, PYTHONUNBUFFERED: '1' },
    });
    
    this.process.stderr?.on('data', (data) => {
      console.log(`[osxphotos-sandbox] ${data.toString().trim()}`);
    });
    
    this.process.on('exit', (code, signal) => {
      console.log(`[osxphotos-sandbox] Exited with code ${code}, signal ${signal}`);
      this.handleProcessExit(code);
    });
    
    // Wait for socket to be ready
    await this.waitForSocket();
  }
  
  private handleProcessExit(code: number | null): void {
    if (code !== 0) {
      this.circuitBreaker.failures++;
      this.circuitBreaker.lastFailure = Date.now();
      
      if (this.circuitBreaker.failures >= this.MAX_FAILURES) {
        this.circuitBreaker.isOpen = true;
        console.error('[osxphotos-sandbox] Circuit breaker OPEN - max failures reached');
        return;
      }
      
      // Auto-restart
      console.log(`[osxphotos-sandbox] Restarting (attempt ${this.circuitBreaker.failures}/${this.MAX_FAILURES})`);
      setTimeout(() => this.start(), 1000);
    }
  }
  
  private waitForSocket(timeout = 5000): Promise<void> {
    return new Promise((resolve, reject) => {
      const start = Date.now();
      const check = () => {
        const socket = net.createConnection(this.SOCKET_PATH);
        socket.on('connect', () => {
          socket.destroy();
          resolve();
        });
        socket.on('error', () => {
          if (Date.now() - start > timeout) {
            reject(new Error('Socket connection timeout'));
          } else {
            setTimeout(check, 100);
          }
        });
      };
      check();
    });
  }
  
  async call<T>(method: string, params: Record<string, any> = {}): Promise<T> {
    return new Promise((resolve, reject) => {
      const socket = net.createConnection(this.SOCKET_PATH);
      const request = JSON.stringify({
        jsonrpc: '2.0',
        method,
        params,
        id: Date.now(),
      });
      
      socket.on('connect', () => {
        socket.write(request);
      });
      
      socket.on('data', (data) => {
        const response = JSON.parse(data.toString());
        socket.destroy();
        
        if (response.error) {
          reject(new Error(response.error.message));
        } else {
          resolve(response.result);
        }
      });
      
      socket.on('error', reject);
    });
  }
  
  stop(): void {
    if (this.process) {
      this.process.kill('SIGTERM');
      this.process = null;
    }
  }
  
  private getPythonPath(): string {
    // In development usa python3, in production usa bundled Python
    return process.env.NODE_ENV === 'development' 
      ? 'python3' 
      : path.join(__dirname, '../python-dist/bin/python3');
  }
}
```

## 7. Registrazione IPC Handlers (`electron/ipc-handlers.ts` - estensione)

```typescript
import { ipcMain } from 'electron';
import { OsxphotosSupervisor } from './osxphotos-supervisor';

const supervisor = new OsxphotosSupervisor();

export function registerPhotosHandlers(): void {
  ipcMain.handle('photos:start-service', async () => {
    await supervisor.start();
    return { success: true };
  });
  
  ipcMain.handle('photos:list-albums', async () => {
    return supervisor.call('list_albums');
  });
  
  ipcMain.handle('photos:get-photos', async (_, params) => {
    return supervisor.call('get_photos', params);
  });
  
  ipcMain.handle('photos:export', async (_, params) => {
    return supervisor.call('export_photo', params);
  });
  
  ipcMain.handle('photos:get-metadata', async (_, { uuid }) => {
    return supervisor.call('get_photo_metadata', { photo_uuid: uuid });
  });
}
```

## Requisiti Python (`python/sandboxed/requirements.txt`)

```
osxphotos>=0.67.0
```

## Note di Sicurezza Critiche

1. **Network Blocking**: Il monkey-patching di `socket.socket` blocca qualsiasi tentativo di connessione network eccetto Unix socket
2. **Path Validation**: Ogni operazione di export passa attraverso whitelist validation con controllo path traversal
3. **Socket Permissions**: Il socket Unix ha permessi 0600 (solo owner)
4. **Circuit Breaker**: Previene restart loops infiniti in caso di errori persistenti
5. **Processo Separato**: Isolamento completo dal FastAPI sidecar principale

**Test Strategy:**

## Unit Tests Python

1. **test_path_validator.py**
   - Test che path nella whitelist siano accettati
   - Test che path fuori dalla whitelist siano rifiutati con SecurityError
   - Test che path traversal (`..`) siano rilevati e bloccati
   - Test che symlink non risolti siano gestiti correttamente
   - Test creazione automatica directory whitelist

2. **test_jsonrpc_handler.py**
   - Test risposta corretta per metodi validi
   - Test errore -32601 per metodi non esistenti
   - Test errore -32700 per JSON malformato
   - Test errore -32600 per richieste senza jsonrpc: '2.0'
   - Test che id venga preservato nella risposta

3. **test_photos_service.py** (con mock osxphotos)
   - Test list_albums ritorna struttura corretta
   - Test get_photos con filtri album_uuid
   - Test export_photo chiama PathValidator
   - Test get_photo_metadata ritorna tutti i campi EXIF

## Integration Tests Python

4. **test_unix_socket.py**
   - Test che il socket venga creato su /tmp/trae-osxphotos.sock
   - Test che permessi socket siano 0600
   - Test comunicazione bidirezionale client-server
   - Test cleanup socket su shutdown

5. **test_network_blocking.py**
   - Test che `socket.socket(AF_INET, ...)` sollevi PermissionError
   - Test che `socket.socket(AF_UNIX, ...)` funzioni normalmente
   - Test che import di librerie network (requests, urllib) falliscano

## Unit Tests TypeScript (Electron)

6. **osxphotos-supervisor.spec.ts**
   - Test start() spawna processo Python
   - Test circuit breaker si apre dopo 3 fallimenti
   - Test circuit breaker si resetta dopo 5 minuti
   - Test auto-restart funziona fino a MAX_FAILURES
   - Test waitForSocket timeout dopo 5 secondi
   - Test call() invia JSON-RPC corretto e parsa risposta

## E2E Tests

7. **test_full_workflow.py**
   - Test completo: avvio servizio → list albums → export foto → verifica file
   - Test che export su directory non whitelist fallisca
   - Test recovery dopo crash del processo sandboxed
   - Test che circuit breaker blocchi restart eccessivi

## Manual Testing Checklist

- [ ] Verificare che `Full Disk Access` sia richiesto solo per il processo sandboxed
- [ ] Confermare che il FastAPI sidecar NON abbia accesso a Photos Library
- [ ] Testare export su ~/Exports/ e ~/Documents/TraeExports/ - deve funzionare
- [ ] Testare export su ~/Desktop/ - deve fallire con SecurityError
- [ ] Verificare che kill del processo sandboxed triggeri auto-restart
- [ ] Testare 3+ crash consecutivi - circuit breaker deve bloccare
- [ ] Attendere 5 minuti e verificare reset circuit breaker

## Subtasks

### 15.1. Setup Unix Socket Server Python con JSON-RPC 2.0

**Status:** pending  
**Dependencies:** None  

Implementare il server Unix socket asincrono con handler JSON-RPC 2.0 completo per la comunicazione inter-processo sicura.

**Details:**

Creare `python/sandboxed/socket_server.py` con classe UnixSocketServer che utilizza asyncio.start_unix_server per gestire connessioni su `/tmp/trae-osxphotos.sock`. Implementare permessi restrittivi (0o600) sul socket. Creare `python/sandboxed/jsonrpc_handler.py` con validazione completa dello standard JSON-RPC 2.0 (versione, method, params, id). Gestire tutti i codici errore standard: -32700 (Parse error), -32600 (Invalid Request), -32601 (Method not found), -32000 (Server error). Configurare limite lettura 1MB per prevenire DoS. Creare `python/sandboxed/__init__.py` e `python/sandboxed/requirements.txt` con osxphotos>=0.67.0.

### 15.2. Implementazione Path Validator con Whitelist Directory per Export Sicuro

**Status:** pending  
**Dependencies:** 15.1  

Creare il sistema di validazione path con whitelist directory per garantire che le operazioni di export avvengano solo in directory autorizzate.

**Details:**

Creare `python/sandboxed/path_validator.py` con classe PathValidator contenente: WHITELIST_DIRECTORIES configurata per `~/Exports/` e `~/Documents/TraeExports/`. Metodo `validate_export_path()` che utilizza os.path.realpath() per risolvere symlink e path canonici, verifica assenza di path traversal (`..`), controlla che il path risolto sia sotto una directory whitelist usando os.path.commonpath(). Creare eccezione custom SecurityError per violazioni. Metodo `ensure_directories_exist()` per creare directory whitelist al bootstrap. Tutti i path devono essere normalizzati prima della validazione.

### 15.3. Wrapper PhotosService per osxphotos con Metadata Extraction

**Status:** pending  
**Dependencies:** 15.1, 15.2  

Implementare il servizio wrapper attorno a osxphotos per accesso alla Photos Library con estrazione completa dei metadati EXIF e info persone/luoghi.

**Details:**

Creare `python/sandboxed/photos_service.py` con classe PhotosService. Metodo `list_albums()` che ritorna lista album con title, uuid, photo_count. Metodo `get_photos()` con filtri opzionali (album_uuid, from_date, to_date, limit) che ritorna uuid, filename, date, width, height, has_exif. Metodo `export_photo()` che OBBLIGATORIAMENTE chiama PathValidator.validate_export_path() prima di qualsiasi operazione, supporta preserve_exif flag. Metodo `get_photo_metadata()` che estrae uuid, filename, date, exif completo, location (lat/lon), keywords, persons. Metodo `search_photos()` per ricerca testuale. Inizializzazione con PhotosDB opzionale per testing.

### 15.4. Network Blocking via Monkey-Patching Socket per Isolamento

**Status:** pending  
**Dependencies:** 15.1, 15.2, 15.3  

Implementare il blocco completo dell'accesso network nel processo sandboxed tramite monkey-patching del modulo socket Python.

**Details:**

In `python/sandboxed/main.py` implementare funzione `block_network()` chiamata IMMEDIATAMENTE all'avvio, PRIMA di qualsiasi import. La funzione deve salvare riferimento originale a socket.socket, sostituirlo con wrapper `restricted_socket()` che permette SOLO socket.AF_UNIX e solleva PermissionError per qualsiasi altro tipo (AF_INET, AF_INET6). Creare entry point asincrono `main()` che inizializza PhotosService, JsonRpcHandler, UnixSocketServer. Registrare signal handlers per SIGTERM e SIGINT per shutdown graceful. Log startup e shutdown su stderr con prefisso `[osxphotos-sandbox]`.

### 15.5. Supervisor TypeScript con Circuit Breaker e Auto-Restart

**Status:** pending  
**Dependencies:** 15.4  

Implementare il supervisor Electron/Node.js che gestisce il ciclo di vita del processo Python sandboxed con circuit breaker pattern per prevenire restart loop.

**Details:**

Creare `electron/osxphotos-supervisor.ts` con classe OsxphotosSupervisor. Implementare circuit breaker con: MAX_FAILURES=3, RESET_TIMEOUT_MS=5 minuti, stato (failures, lastFailure, isOpen). Metodo `start()` che verifica circuit breaker, spawna processo Python con stdio configurato, attende socket pronto. Metodo `handleProcessExit()` che incrementa failures, apre circuit breaker se necessario, altrimenti auto-restart con delay 1s. Metodo `waitForSocket()` con polling ogni 100ms e timeout 5s. Metodo `call<T>()` per invio richieste JSON-RPC via net.createConnection. Metodo `stop()` per SIGTERM. `getPythonPath()` che distingue development (python3) da production (bundled).

### 15.6. IPC Handlers per Comunicazione Electron con Processo Sandboxed

**Status:** pending  
**Dependencies:** 15.5  

Registrare gli IPC handlers nel main process Electron per esporre le funzionalità del processo sandboxed al renderer tramite contextBridge.

**Details:**

Estendere `electron/ipc-handlers.ts` con funzione `registerPhotosHandlers()`. Creare istanza singleton di OsxphotosSupervisor. Registrare handlers: `photos:start-service` -> supervisor.start(), `photos:list-albums` -> supervisor.call('list_albums'), `photos:get-photos` -> supervisor.call('get_photos', params), `photos:export` -> supervisor.call('export_photo', params), `photos:get-metadata` -> supervisor.call('get_photo_metadata', {photo_uuid}). Gestire errori con try/catch e ritornare oggetti errore strutturati. Chiamare registerPhotosHandlers() all'avvio dell'app in main.ts. Aggiornare preload.ts per esporre i nuovi canali IPC.
