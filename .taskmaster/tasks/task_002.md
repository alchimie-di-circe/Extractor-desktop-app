# Task ID: 2

**Title:** Sistema IPC Bridge e Gestione Sicura delle Credenziali

**Status:** pending

**Dependencies:** None

**Priority:** high

**Description:** Implementare il sistema IPC tra main process e renderer, includendo un servizio keychain per la memorizzazione sicura delle API keys tramite OS keychain nativo.

**Details:**

1. Estendere `electron/preload.ts` con contextBridge per esporre API sicure:
```typescript
import { contextBridge, ipcRenderer } from 'electron';
contextBridge.exposeInMainWorld('electronAPI', {
  // Keychain
  saveCredential: (service: string, account: string, password: string) => 
    ipcRenderer.invoke('keychain:save', service, account, password),
  getCredential: (service: string, account: string) => 
    ipcRenderer.invoke('keychain:get', service, account),
  deleteCredential: (service: string, account: string) => 
    ipcRenderer.invoke('keychain:delete', service, account),
  // Config
  getConfig: (key: string) => ipcRenderer.invoke('config:get', key),
  setConfig: (key: string, value: any) => ipcRenderer.invoke('config:set', key, value),
});
```
2. Creare `electron/keychain.ts` usando `keytar` per macOS keychain nativo
3. Creare `electron/ipc-handlers.ts` per gestire tutti gli handler IPC
4. Creare `electron/config-manager.ts` per gestire configurazioni persistenti con electron-store
5. Aggiornare `electron/main.ts` per registrare tutti gli handler IPC
6. Installare dipendenze: `keytar`, `electron-store`
7. Creare tipi TypeScript in `src/app.d.ts` per l'API esposta
8. Abilitare context isolation e sandbox nel BrowserWindow

**Test Strategy:**

Test di integrazione per verificare che le credenziali vengano salvate e recuperate correttamente dal keychain. Test per assicurarsi che il context isolation sia attivo e che il renderer non possa accedere direttamente a Node.js APIs.

## Subtasks

### 2.1. Installazione dipendenze native keytar ed electron-store con configurazione build

**Status:** pending  
**Dependencies:** None  

Installare keytar per l'accesso al keychain nativo di macOS e electron-store per la persistenza delle configurazioni, includendo la configurazione necessaria per i moduli nativi Node.

**Details:**

1. Eseguire `pnpm add keytar electron-store` per installare le dipendenze
2. Aggiungere `keytar` alla configurazione `pnpm.onlyBuiltDependencies` in package.json per garantire la compilazione corretta dei moduli nativi
3. Verificare che electron-rebuild sia disponibile o installarlo se necessario per la ricompilazione dei moduli nativi
4. Testare che keytar venga compilato correttamente eseguendo `pnpm start`
5. In caso di errori di build, configurare node-gyp con le dipendenze di sistema richieste (Xcode Command Line Tools su macOS)

### 2.2. Implementazione modulo keychain.ts con wrapper keytar cross-platform

**Status:** pending  
**Dependencies:** 2.1  

Creare il modulo electron/keychain.ts che incapsula le operazioni di keytar per la gestione sicura delle credenziali tramite il keychain nativo del sistema operativo.

**Details:**

1. Creare `electron/keychain.ts` con le seguenti funzioni:
   - `saveCredential(service: string, account: string, password: string): Promise<void>`
   - `getCredential(service: string, account: string): Promise<string | null>`
   - `deleteCredential(service: string, account: string): Promise<boolean>`
2. Implementare gestione degli errori con messaggi descrittivi
3. Definire costanti per il service name dell'applicazione (es. 'com.electron-svelte.credentials')
4. Aggiungere logging per debugging in development
5. Gestire il caso in cui keytar non sia disponibile (fallback o errore esplicito)

### 2.3. Implementazione config-manager.ts con electron-store per configurazioni persistenti

**Status:** pending  
**Dependencies:** 2.1  

Creare il modulo electron/config-manager.ts per gestire le configurazioni persistenti dell'applicazione utilizzando electron-store con schema tipizzato.

**Details:**

1. Creare `electron/config-manager.ts` con interfaccia tipizzata per le configurazioni:
   ```typescript
   interface AppConfig {
     selectedProvider?: string;
     selectedModel?: string;
     theme?: 'light' | 'dark' | 'system';
     // altre configurazioni non sensibili
   }
   ```
2. Inizializzare electron-store con schema e valori di default
3. Implementare funzioni:
   - `getConfig<K extends keyof AppConfig>(key: K): AppConfig[K]`
   - `setConfig<K extends keyof AppConfig>(key: K, value: AppConfig[K]): void`
   - `getAllConfig(): AppConfig`
4. NON memorizzare API keys in electron-store (usare keychain)
5. Configurare la directory di storage appropriata per l'app

### 2.4. Creazione ipc-handlers.ts centralizzato per keychain e config

**Status:** pending  
**Dependencies:** 2.2, 2.3  

Implementare il modulo electron/ipc-handlers.ts che registra tutti gli handler IPC per keychain e configurazioni, centralizzando la logica di comunicazione main-renderer.

**Details:**

1. Creare `electron/ipc-handlers.ts` con funzione `registerIPCHandlers()`
2. Registrare handler per keychain:
   - `keychain:save` -> invoca keychain.saveCredential
   - `keychain:get` -> invoca keychain.getCredential  
   - `keychain:delete` -> invoca keychain.deleteCredential
3. Registrare handler per config:
   - `config:get` -> invoca configManager.getConfig
   - `config:set` -> invoca configManager.setConfig
4. Implementare validazione degli input per prevenire injection
5. Aggiungere try-catch con messaggi di errore appropriati per ogni handler
6. Loggare operazioni sensibili per audit trail

### 2.5. Estensione preload.ts con contextBridge API sicure

**Status:** pending  
**Dependencies:** 2.4  

Implementare il preload script che espone API sicure al renderer tramite contextBridge, creando un'interfaccia tipizzata per keychain e configurazioni.

**Details:**

1. Modificare `electron/preload.ts` per importare contextBridge e ipcRenderer
2. Usare `contextBridge.exposeInMainWorld('electronAPI', {...})` per esporre:
   - `saveCredential(service, account, password)` -> ipcRenderer.invoke('keychain:save', ...)
   - `getCredential(service, account)` -> ipcRenderer.invoke('keychain:get', ...)
   - `deleteCredential(service, account)` -> ipcRenderer.invoke('keychain:delete', ...)
   - `getConfig(key)` -> ipcRenderer.invoke('config:get', ...)
   - `setConfig(key, value)` -> ipcRenderer.invoke('config:set', ...)
3. NON esporre ipcRenderer direttamente
4. Aggiornare `src/app.d.ts` con dichiarazione globale:
   ```typescript
   interface ElectronAPI {
     saveCredential(service: string, account: string, password: string): Promise<void>;
     getCredential(service: string, account: string): Promise<string | null>;
     deleteCredential(service: string, account: string): Promise<boolean>;
     getConfig(key: string): Promise<unknown>;
     setConfig(key: string, value: unknown): Promise<void>;
   }
   declare global {
     interface Window {
       electronAPI: ElectronAPI;
     }
   }
   ```

### 2.6. Aggiornamento main.ts con security settings e registrazione handlers

**Status:** pending  
**Dependencies:** 2.4, 2.5  

Configurare BrowserWindow con le impostazioni di sicurezza Electron (context isolation, sandbox, nodeIntegration:false) e integrare la registrazione degli handler IPC.

**Details:**

1. Modificare `electron/main.ts` per importare e chiamare `registerIPCHandlers()` prima di app.on('ready')
2. Aggiornare webPreferences di BrowserWindow:
   ```typescript
   webPreferences: {
     preload: path.join(import.meta.dirname, 'preload.js'),
     contextIsolation: true,
     sandbox: true,
     nodeIntegration: false,
     webSecurity: true,
   }
   ```
3. Aggiungere Content Security Policy appropriata
4. Implementare gestione errori per la registrazione degli handler
5. Verificare che il preload script venga caricato correttamente
6. Aggiungere logging all'avvio per confermare che tutti i moduli siano inizializzati
