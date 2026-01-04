# Task ID: 14

**Title:** Electron Packaging e Distribuzione

**Status:** pending

**Dependencies:** 11, 13

**Priority:** low

**Description:** Configurare il packaging finale dell'applicazione Electron con bundling Python sidecar, code signing, e setup per distribuzione.

**Details:**

1. Configurare Electron Forge in `forge.config.ts`:
   - Maker DMG per macOS con notarization
   - Maker Squirrel per Windows
   - Maker DEB/RPM per Linux
2. Bundling Python sidecar:
   - Opzione A: PyInstaller per creare eseguibile standalone
   - Opzione B: Embedded Python con venv
```typescript
// forge.config.ts
const config = {
  packagerConfig: {
    extraResource: ['./python-dist'],
    osxSign: { identity: '...' },
    osxNotarize: { appleId: '...', appleIdPassword: '...' }
  },
  makers: [
    { name: '@electron-forge/maker-dmg', config: {} },
    { name: '@electron-forge/maker-squirrel', config: {} },
  ]
};
```
3. Gestione aggiornamenti automatici con electron-updater
4. Configurare code signing per macOS e Windows
5. Setup GitHub Releases per distribuzione
6. Documentazione installazione per utenti finali
7. Verificare bundle size target: ~2.5MB (escludendo Python)

**Test Strategy:**

Test build su macOS, Windows, Linux. Test installazione pulita su sistema vergine. Test auto-update flow. Verificare code signing valido.

## Subtasks

### 14.1. Configurazione Electron Forge Maker DMG con Notarization macOS

**Status:** pending  
**Dependencies:** None  

Configurare il maker DMG in forge.config.ts con supporto completo per code signing e notarization Apple, necessario per distribuzione su macOS Sequoia e versioni successive.

**Details:**

1. Aggiungere MakerDMG alla configurazione in forge.config.ts sostituendo MakerZIP per darwin
2. Configurare packagerConfig con osxSign:
   - identity: Developer ID Application certificate
   - optionsForFile: funzione per configurare entitlements
3. Configurare osxNotarize con:
   - appleId: email sviluppatore Apple
   - appleIdPassword: app-specific password (da Keychain @keychain:AC_PASSWORD)
   - teamId: Apple Team ID
4. Creare file entitlements.plist con capabilities necessarie (hardened-runtime, allow-unsigned-executable-memory per Python sidecar)
5. Configurare environment variables in .env per credenziali Apple (APPLE_ID, APPLE_ID_PASSWORD, APPLE_TEAM_ID)
6. Testare build locale con `npm run make` e verificare firma con `codesign -dv --verbose=4`
7. Verificare notarization con `spctl -a -v` e `stapler validate`

### 14.2. Configurazione Maker Squirrel Windows con Code Signing Authenticode

**Status:** pending  
**Dependencies:** None  

Configurare MakerSquirrel per Windows con supporto Authenticode code signing, creazione installer NSIS/Squirrel, e gestione icone e metadata applicazione.

**Details:**

1. Configurare MakerSquirrel in forge.config.ts con opzioni:
   - name: nome applicazione senza spazi
   - authors: nome autore per metadata
   - exe: nome eseguibile finale
   - setupIcon: percorso icona .ico
   - loadingGif: splash screen opzionale
   - certificateFile: path al certificato .pfx
   - certificatePassword: password certificato (da env var WINDOWS_CERTIFICATE_PASSWORD)
2. Creare script PowerShell per signing: `sign-windows.ps1` con signtool.exe
3. Configurare packagerConfig per Windows:
   - icon: percorso icona .ico
   - win32metadata: CompanyName, FileDescription, ProductName
4. Aggiungere hook afterSign per verifica firma
5. Creare assets: icon.ico (256x256, 128x128, 64x64, 48x48, 32x32, 16x16)
6. Configurare environment variables: WINDOWS_CERTIFICATE_FILE, WINDOWS_CERTIFICATE_PASSWORD
7. Documentare acquisizione certificato Authenticode (DigiCert, Sectigo, etc.)

### 14.3. Bundling Python Sidecar con PyInstaller Cross-Platform

**Status:** pending  
**Dependencies:** None  

Creare sistema di bundling per il Python sidecar usando PyInstaller, con build separati per macOS (universal2), Windows (x64), e Linux (x64/arm64), inclusi tutti i moduli Cagent.

**Details:**

1. Creare python/pyinstaller.spec con configurazione:
   - Analysis: main.py come entry, hidden imports per FastAPI, uvicorn, sse-starlette, cagent
   - Exclude: tkinter, matplotlib, test modules per ridurre size
   - Datas: includere assets e config necessari
   - hiddenimports: tutti i moduli dinamici di cagent e MCP tools
2. Creare script build-python.sh / build-python.ps1:
   - Attivare venv
   - pip install -r requirements.txt
   - pyinstaller --onefile --windowed (macOS) / --onefile (Windows/Linux)
   - Copiare output in ./python-dist/
3. Configurare forge.config.ts extraResource: ['./python-dist']
4. Modificare main.ts per trovare sidecar in resources path:
   - process.resourcesPath per production
   - __dirname per development
5. Creare Makefile/package.json scripts per build cross-platform
6. Target size: ~50MB per sidecar (Python + dipendenze)
7. Verificare che sidecar parta correttamente da extraResources

### 14.4. Implementazione Auto-Update con electron-updater e GitHub Releases

**Status:** pending  
**Dependencies:** 14.1, 14.2  

Implementare sistema di aggiornamenti automatici usando electron-updater con backend GitHub Releases, includendo UI per notifiche e progress bar download.

**Details:**

1. Installare electron-updater: npm install electron-updater
2. Configurare forge.config.ts per generare file update:
   - publishers: GitHubPublisher con repo e owner
   - packagerConfig.protocols: deep link per update
3. Implementare in main.ts:
   - autoUpdater.setFeedURL() con GitHub repo
   - autoUpdater.checkForUpdatesAndNotify() all'avvio
   - Eventi: checking-for-update, update-available, update-downloaded, error
4. Creare IPC handlers per comunicare stato update al renderer:
   - 'update:check', 'update:download', 'update:install'
5. Implementare componente Svelte UpdateNotification.svelte:
   - Banner 'Nuovo aggiornamento disponibile'
   - Progress bar durante download
   - Pulsante 'Riavvia e Installa'
6. Configurare electron-builder.yml / forge publishers per:
   - Generare latest.yml/latest-mac.yml/latest-linux.yml
   - Upload automatico assets a GitHub Release
7. Gestire canali: stable, beta (opzionale)
8. Implementare rollback in caso di update fallito

### 14.5. Setup GitHub Actions CI/CD Pipeline per Build e Publish Automatico

**Status:** pending  
**Dependencies:** 14.1, 14.2, 14.3  

Creare workflow GitHub Actions per build automatico multi-piattaforma, code signing in CI, upload a GitHub Releases, e gestione versioning semantico.

**Details:**

1. Creare .github/workflows/build.yml per build su ogni push:
   - Matrix: macos-latest, windows-latest, ubuntu-latest
   - Cache node_modules e Python venv
   - npm ci && npm run make
   - Upload artifacts per testing
2. Creare .github/workflows/release.yml trigger su tag v*:
   - Build per tutte le piattaforme in parallelo
   - macOS: import certificati da secrets, notarize
   - Windows: import certificato .pfx da secrets, sign
   - Linux: build DEB e RPM
   - Upload tutti gli assets a GitHub Release
3. Configurare GitHub Secrets:
   - APPLE_ID, APPLE_ID_PASSWORD, APPLE_TEAM_ID, APPLE_CERTIFICATE_P12, APPLE_CERTIFICATE_PASSWORD
   - WINDOWS_CERTIFICATE_PFX (base64), WINDOWS_CERTIFICATE_PASSWORD
4. Creare script release.sh per bump version e tag
5. Configurare electron-forge publish per GitHub:
   - GITHUB_TOKEN per upload assets
6. Aggiungere workflow per PR checks (lint, test, build)
7. Implementare caching aggressivo per ridurre build time

### 14.6. Documentazione Installazione e Troubleshooting per Utenti Finali

**Status:** pending  
**Dependencies:** 14.4, 14.5  

Creare documentazione completa per installazione su macOS, Windows e Linux, incluse FAQ, troubleshooting per errori comuni, e guida per sviluppatori che vogliono contribuire.

**Details:**

1. Creare docs/installation/README.md con sezioni:
   - Requisiti di sistema (OS version, RAM, disk space)
   - Download links per ogni piattaforma
   - Istruzioni passo-passo con screenshot
2. Creare docs/installation/macos.md:
   - Gestione Gatekeeper ('app da sviluppatore non identificato')
   - Permessi Privacy: Accessibilità, Full Disk Access se necessari
   - Troubleshooting notarization issues
3. Creare docs/installation/windows.md:
   - SmartScreen warning per prime esecuzioni
   - Windows Defender exceptions se necessario
   - Installazione silente con parametri CLI
4. Creare docs/installation/linux.md:
   - Istruzioni per DEB (apt), RPM (yum/dnf), AppImage
   - Permessi e dipendenze (libsecret per keychain)
5. Creare docs/troubleshooting.md:
   - Errori comuni e soluzioni
   - Come raccogliere logs (Console.app, Event Viewer, journalctl)
   - Come segnalare bug con template issue
6. Creare CHANGELOG.md template per release notes
7. Aggiornare README.md principale con quick start
