# Task ID: 16

**Title:** Integrazione Docker MCP Gateway per Gestione Centralizzata Tool MCP

**Status:** pending

**Dependencies:** 2 ✓, 4 ✓, 5 ✓, 7

**Priority:** high

**Description:** Implementare l'integrazione con Docker MCP Gateway per la gestione centralizzata dei tool MCP, includendo detection di Docker Engine, auto-installazione del plugin CLI Gateway, UI Settings per toggle Cloud/Local per-tool, e generazione dinamica cagent.yaml con fallback chain intelligente.

**Details:**

## Struttura File

```
electron/
├── docker-detector.ts          # Detection Docker Engine
├── mcp-gateway-installer.ts    # Auto-install CLI plugin
└── ipc-handlers.ts             # Estensione con handler Docker/Gateway

src/lib/
├── services/
│   ├── docker-gateway.ts       # Client per Docker MCP Gateway
│   └── mcp-mode-manager.ts     # Gestione modalità Cloud/Local
├── stores/
│   └── mcp-settings.svelte.ts  # Store Svelte 5 per settings MCP
└── components/custom/
    └── MCPToolToggle.svelte    # Toggle per-tool Cloud/Local

python/
└── tools/
    └── mcp_resolver.py         # Risoluzione dinamica ref MCP
```

## 1. Docker Engine Detection (`electron/docker-detector.ts`)

```typescript
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export interface DockerStatus {
  isInstalled: boolean;
  isRunning: boolean;
  version: string | null;
  isDesktop: boolean;  // true = Desktop, false = Engine only
  gatewayInstalled: boolean;
  gatewayVersion: string | null;
}

export async function detectDocker(): Promise<DockerStatus> {
  const status: DockerStatus = {
    isInstalled: false,
    isRunning: false,
    version: null,
    isDesktop: false,
    gatewayInstalled: false,
    gatewayVersion: null
  };

  try {
    // Check docker info (verifica sia installazione che running)
    const { stdout } = await execAsync('docker info --format "{{.ServerVersion}}"', {
      timeout: 5000
    });
    status.isInstalled = true;
    status.isRunning = true;
    status.version = stdout.trim();

    // Detect if Docker Desktop (check for Desktop-specific indicators)
    const { stdout: infoFull } = await execAsync('docker info', { timeout: 5000 });
    status.isDesktop = infoFull.includes('Docker Desktop') || 
                       infoFull.includes('desktop-linux');

    // Check MCP Gateway plugin
    await checkGatewayPlugin(status);
  } catch (error) {
    // docker command exists ma daemon non running
    try {
      await execAsync('docker --version');
      status.isInstalled = true;
    } catch {
      status.isInstalled = false;
    }
  }

  return status;
}

async function checkGatewayPlugin(status: DockerStatus): Promise<void> {
  try {
    const { stdout } = await execAsync('docker mcp --version', { timeout: 3000 });
    status.gatewayInstalled = true;
    status.gatewayVersion = stdout.trim();
  } catch {
    status.gatewayInstalled = false;
  }
}
```

## 2. MCP Gateway Auto-Installer (`electron/mcp-gateway-installer.ts`)

```typescript
import { app } from 'electron';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as https from 'https';
import { createWriteStream } from 'fs';

const GATEWAY_RELEASES_URL = 'https://api.github.com/repos/docker/mcp-gateway/releases/latest';

interface ReleaseAsset {
  name: string;
  browser_download_url: string;
}

export async function installMCPGateway(): Promise<{ success: boolean; error?: string }> {
  try {
    // 1. Fetch latest release info
    const releaseInfo = await fetchLatestRelease();
    
    // 2. Determine platform-specific binary
    const platform = process.platform;
    const arch = process.arch === 'arm64' ? 'arm64' : 'amd64';
    const binaryName = `docker-mcp-${platform === 'darwin' ? 'darwin' : 'linux'}-${arch}`;
    
    const asset = releaseInfo.assets.find((a: ReleaseAsset) => a.name === binaryName);
    if (!asset) {
      return { success: false, error: `Binary non trovato per ${platform}-${arch}` };
    }

    // 3. Download binary
    const cliPluginsDir = path.join(process.env.HOME || '', '.docker', 'cli-plugins');
    await fs.mkdir(cliPluginsDir, { recursive: true });
    
    const destPath = path.join(cliPluginsDir, 'docker-mcp');
    await downloadFile(asset.browser_download_url, destPath);
    
    // 4. Make executable
    await fs.chmod(destPath, 0o755);

    return { success: true };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

async function fetchLatestRelease(): Promise<{ assets: ReleaseAsset[] }> {
  return new Promise((resolve, reject) => {
    https.get(GATEWAY_RELEASES_URL, { 
      headers: { 'User-Agent': 'Trae-Extractor-App' } 
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(JSON.parse(data)));
    }).on('error', reject);
  });
}

async function downloadFile(url: string, dest: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const file = createWriteStream(dest);
    https.get(url, { headers: { 'User-Agent': 'Trae-Extractor-App' } }, (res) => {
      // Handle redirects
      if (res.statusCode === 302 && res.headers.location) {
        https.get(res.headers.location, (redirectRes) => {
          redirectRes.pipe(file);
          file.on('finish', () => { file.close(); resolve(); });
        }).on('error', reject);
      } else {
        res.pipe(file);
        file.on('finish', () => { file.close(); resolve(); });
      }
    }).on('error', reject);
  });
}

export async function enableGatewayServer(serverName: string): Promise<boolean> {
  const { exec } = require('child_process');
  return new Promise((resolve) => {
    exec(`docker mcp server enable ${serverName}`, (error: Error | null) => {
      resolve(!error);
    });
  });
}
```

## 3. UI Settings Toggle (`src/lib/components/custom/MCPToolToggle.svelte`)

```svelte
<script lang="ts">
  import { Switch } from '$lib/components/ui/switch';
  import { Label } from '$lib/components/ui/label';
  import { Badge } from '$lib/components/ui/badge';
  import { mcpSettings } from '$lib/stores/mcp-settings.svelte';
  
  interface Props {
    toolId: string;
    toolName: string;
    description: string;
    supportsGateway: boolean;
  }
  
  let { toolId, toolName, description, supportsGateway }: Props = $props();
  
  const dockerStatus = $derived(mcpSettings.dockerStatus);
  const toolMode = $derived(mcpSettings.getToolMode(toolId));
  const canUseGateway = $derived(
    supportsGateway && 
    dockerStatus.isRunning && 
    dockerStatus.gatewayInstalled
  );
  
  function toggleMode() {
    if (!canUseGateway) return;
    mcpSettings.setToolMode(toolId, toolMode === 'gateway' ? 'local' : 'gateway');
  }
</script>

<div class="flex items-center justify-between p-4 border rounded-lg">
  <div class="space-y-1">
    <div class="flex items-center gap-2">
      <Label class="text-base font-medium">{toolName}</Label>
      {#if toolMode === 'gateway'}
        <Badge variant="secondary">Cloud</Badge>
      {:else}
        <Badge variant="outline">Local</Badge>
      {/if}
    </div>
    <p class="text-sm text-muted-foreground">{description}</p>
    {#if !canUseGateway && supportsGateway}
      <p class="text-xs text-yellow-600">
        {#if !dockerStatus.isRunning}
          Docker non attivo - usando modalità locale
        {:else if !dockerStatus.gatewayInstalled}
          MCP Gateway non installato
        {/if}
      </p>
    {/if}
  </div>
  
  <Switch 
    checked={toolMode === 'gateway'}
    disabled={!canUseGateway}
    onCheckedChange={toggleMode}
  />
</div>
```

## 4. MCP Settings Store (`src/lib/stores/mcp-settings.svelte.ts`)

```typescript
import { writable } from 'svelte/store';

interface DockerStatus {
  isInstalled: boolean;
  isRunning: boolean;
  gatewayInstalled: boolean;
  gatewayVersion: string | null;
}

type ToolMode = 'gateway' | 'local';

interface MCPToolConfig {
  mode: ToolMode;
  gatewayRef: string;    // es: 'mcp/cloudinary'
  localRef: string;      // es: 'npx @cloudinary/mcp-server'
  envVars: string[];     // es: ['CLOUDINARY_URL']
}

const SUPPORTED_TOOLS: Record<string, MCPToolConfig> = {
  cloudinary: {
    mode: 'gateway',
    gatewayRef: 'mcp/cloudinary',
    localRef: 'npx @cloudinary/mcp-server',
    envVars: ['CLOUDINARY_URL']
  },
  duckduckgo: {
    mode: 'gateway',
    gatewayRef: 'mcp/duckduckgo',
    localRef: 'npx @anthropics/duckduckgo-mcp-server',
    envVars: []
  }
};

function createMCPSettingsStore() {
  let dockerStatus = $state<DockerStatus>({
    isInstalled: false,
    isRunning: false,
    gatewayInstalled: false,
    gatewayVersion: null
  });
  
  let toolModes = $state<Record<string, ToolMode>>({
    cloudinary: 'gateway',
    duckduckgo: 'gateway'
  });

  return {
    get dockerStatus() { return dockerStatus; },
    get toolModes() { return toolModes; },
    
    setDockerStatus(status: DockerStatus) {
      dockerStatus = status;
    },
    
    getToolMode(toolId: string): ToolMode {
      return toolModes[toolId] ?? 'local';
    },
    
    setToolMode(toolId: string, mode: ToolMode) {
      toolModes[toolId] = mode;
      // Trigger cagent.yaml regeneration
      window.electronAPI?.regenerateCagentConfig();
    },
    
    getToolRef(toolId: string): string {
      const config = SUPPORTED_TOOLS[toolId];
      if (!config) return '';
      
      const mode = this.getToolMode(toolId);
      if (mode === 'gateway' && dockerStatus.isRunning && dockerStatus.gatewayInstalled) {
        return config.gatewayRef;
      }
      return config.localRef;
    },
    
    async refreshDockerStatus() {
      const status = await window.electronAPI?.detectDocker();
      if (status) this.setDockerStatus(status);
    }
  };
}

export const mcpSettings = createMCPSettingsStore();
```

## 5. Generazione Dinamica cagent.yaml (Estensione `src/lib/services/cagent-config.ts`)

```typescript
// Aggiungere alla funzione generateCagentYaml esistente (Task 5)

interface MCPToolsetConfig {
  type: 'mcp';
  ref: string;
  env?: Record<string, string>;
}

export function generateMCPToolsets(
  toolModes: Record<string, ToolMode>,
  dockerStatus: DockerStatus
): MCPToolsetConfig[] {
  const toolsets: MCPToolsetConfig[] = [];
  
  for (const [toolId, mode] of Object.entries(toolModes)) {
    const config = SUPPORTED_TOOLS[toolId];
    if (!config) continue;
    
    const useGateway = mode === 'gateway' && 
                       dockerStatus.isRunning && 
                       dockerStatus.gatewayInstalled;
    
    toolsets.push({
      type: 'mcp',
      ref: useGateway ? config.gatewayRef : config.localRef,
      env: config.envVars.reduce((acc, envVar) => {
        acc[envVar] = `\${${envVar}}`;  // Placeholder per env vars
        return acc;
      }, {} as Record<string, string>)
    });
  }
  
  return toolsets;
}
```

## 6. Fallback Chain Implementation (`python/tools/mcp_resolver.py`)

```python
import subprocess
import asyncio
from typing import Optional, Tuple
from dataclasses import dataclass
from enum import Enum

class MCPMode(Enum):
    GATEWAY = "gateway"
    LOCAL = "local"
    ERROR = "error"

@dataclass
class MCPResolution:
    mode: MCPMode
    ref: str
    error_message: Optional[str] = None

class MCPResolver:
    """Risolve il modo MCP con fallback chain: Gateway → Local → Error"""
    
    def __init__(self, tool_id: str, gateway_ref: str, local_ref: str):
        self.tool_id = tool_id
        self.gateway_ref = gateway_ref
        self.local_ref = local_ref
    
    async def resolve(self, preferred_mode: str = "gateway") -> MCPResolution:
        """
        Fallback chain:
        1. Se preferred_mode == gateway: prova Gateway, fallback a Local
        2. Se preferred_mode == local: usa direttamente Local
        3. Se tutto fallisce: Error con istruzioni
        """
        if preferred_mode == "gateway":
            # Try Gateway first
            gateway_ok = await self._check_gateway()
            if gateway_ok:
                return MCPResolution(MCPMode.GATEWAY, self.gateway_ref)
            
            # Fallback to Local
            local_ok = await self._check_local()
            if local_ok:
                return MCPResolution(MCPMode.LOCAL, self.local_ref)
        else:
            # Direct Local mode
            local_ok = await self._check_local()
            if local_ok:
                return MCPResolution(MCPMode.LOCAL, self.local_ref)
        
        # Error state
        return MCPResolution(
            MCPMode.ERROR,
            "",
            error_message=self._generate_error_instructions()
        )
    
    async def _check_gateway(self) -> bool:
        """Verifica se Docker MCP Gateway è disponibile"""
        try:
            proc = await asyncio.create_subprocess_exec(
                'docker', 'mcp', 'server', 'list',
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )
            await proc.wait()
            return proc.returncode == 0
        except Exception:
            return False
    
    async def _check_local(self) -> bool:
        """Verifica se il tool locale è disponibile"""
        try:
            # Check if npx command would work
            proc = await asyncio.create_subprocess_exec(
                'which', 'npx',
                stdout=asyncio.subprocess.PIPE
            )
            await proc.wait()
            return proc.returncode == 0
        except Exception:
            return False
    
    def _generate_error_instructions(self) -> str:
        return f"""
Tool MCP '{self.tool_id}' non disponibile.

Per risolvere:

OPZIONE 1 - Docker MCP Gateway (consigliato):
  1. Docker MCP Gateway: Settings > Tools > Installa Gateway
  2. Usa gli MCP server del Docker MCP Toolkit da Docker Hub (ogni map è un immagine/container su docker hub) SENZA INSTALLARE DOCKER DESKTOP o DOCKER ENGINE IN LOCALE (la gateway serve proprio a quello

OPZIONE 2 - Modalità Locale:
  1. Assicurati che Node.js sia installato
  2. Configura le API keys in Settings > Providers
  3. Il tool verrà eseguito via npx: {self.local_ref}
"""
```

## 7. IPC Handlers Estensione (`electron/ipc-handlers.ts`)

```typescript
// Aggiungere ai handler esistenti

import { detectDocker } from './docker-detector';
import { installMCPGateway, enableGatewayServer } from './mcp-gateway-installer';

export function registerDockerHandlers(ipcMain: Electron.IpcMain) {
  ipcMain.handle('docker:detect', async () => {
    return await detectDocker();
  });
  
  ipcMain.handle('docker:install-gateway', async () => {
    return await installMCPGateway();
  });
  
  ipcMain.handle('docker:enable-server', async (_, serverName: string) => {
    return await enableGatewayServer(serverName);
  });
  
  ipcMain.handle('docker:start-gateway', async () => {
    const { exec } = require('child_process');
    return new Promise((resolve) => {
      exec('docker mcp gateway run --detach', (error: Error | null) => {
        resolve(!error);
      });
    });
  });
}
```

## 8. Settings Page Integration (`src/routes/settings/tools/+page.svelte`)

```svelte
<script lang="ts">
  import { onMount } from 'svelte';
  import { Button } from '$lib/components/ui/button';
  import { Card, CardContent, CardHeader, CardTitle } from '$lib/components/ui/card';
  import { Alert, AlertDescription } from '$lib/components/ui/alert';
  import MCPToolToggle from '$lib/components/custom/MCPToolToggle.svelte';
  import { mcpSettings } from '$lib/stores/mcp-settings.svelte';
  
  let installing = $state(false);
  let installError = $state<string | null>(null);
  
  const dockerStatus = $derived(mcpSettings.dockerStatus);
  
  onMount(() => {
    mcpSettings.refreshDockerStatus();
  });
  
  async function installGateway() {
    installing = true;
    installError = null;
    
    const result = await window.electronAPI.installMCPGateway();
    if (result.success) {
      await mcpSettings.refreshDockerStatus();
    } else {
      installError = result.error ?? 'Installazione fallita';
    }
    
    installing = false;
  }
</script>

<div class="space-y-6">
  <Card>
    <CardHeader>
      <CardTitle>Docker MCP Gateway</CardTitle>
    </CardHeader>
    <CardContent class="space-y-4">
      <div class="flex items-center justify-between">
        <div>
          <p class="font-medium">Stato Docker Engine</p>
          <p class="text-sm text-muted-foreground">
            {#if dockerStatus.isRunning}
              ✅ Docker attivo (v{dockerStatus.version})
            {:else if dockerStatus.isInstalled}
              ⚠️ Docker installato ma non attivo
            {:else}
              ❌ Docker non installato
            {/if}
          </p>
        </div>
      </div>
      
      <div class="flex items-center justify-between">
        <div>
          <p class="font-medium">MCP Gateway Plugin</p>
          <p class="text-sm text-muted-foreground">
            {#if dockerStatus.gatewayInstalled}
              ✅ Installato (v{dockerStatus.gatewayVersion})
            {:else}
              ❌ Non installato
            {/if}
          </p>
        </div>
        {#if !dockerStatus.gatewayInstalled && dockerStatus.isRunning}
          <Button onclick={installGateway} disabled={installing}>
            {installing ? 'Installazione...' : 'Installa Gateway'}
          </Button>
        {/if}
      </div>
      
      {#if installError}
        <Alert variant="destructive">
          <AlertDescription>{installError}</AlertDescription>
        </Alert>
      {/if}
    </CardContent>
  </Card>
  
  <Card>
    <CardHeader>
      <CardTitle>Configurazione Tool MCP</CardTitle>
    </CardHeader>
    <CardContent class="space-y-4">
      <MCPToolToggle
        toolId="cloudinary"
        toolName="Cloudinary"
        description="Background removal, upscale, auto-crop"
        supportsGateway={true}
      />
      <MCPToolToggle
        toolId="duckduckgo"
        toolName="DuckDuckGo Search"
        description="Web search senza API key"
        supportsGateway={true}
      />
    </CardContent>
  </Card>
</div>
```

## Note Implementative

1. **Docker Engine/Desktop vs Docker Hub**: Il codice usa `docker info` che funziona sia con Engine che Desktop. Il flag `isDesktop` è informativo ma non bloccante.

2. **Sicurezza download**: Il download del binary Gateway usa HTTPS e verifica il redirect di GitHub releases.

3. **Fallback automatico**: La chain Gateway → Local → Error è implementata sia lato UI (disabilita toggle) che lato Python (runtime resolution).

4. **Regenerazione cagent.yaml**: Ogni cambio di modalità triggera la rigenerazione del file config tramite IPC.

5. **Tool supportati iniziali**: Cloudinary e DuckDuckGo come da specifiche, facilmente estendibile aggiungendo entry a `SUPPORTED_TOOLS`.

**Test Strategy:**

## Test Unitari TypeScript

1. **test/docker-detector.test.ts**
   - Test detectDocker() con mock exec che simula Docker running
   - Test detectDocker() con mock exec che simula Docker non installato
   - Test detectDocker() con mock exec che simula daemon non running
   - Test checkGatewayPlugin() con Gateway installato/non installato
   - Test timeout handling per comandi docker lenti

2. **test/mcp-gateway-installer.test.ts**
   - Test fetchLatestRelease() con mock GitHub API response
   - Test downloadFile() con mock HTTPS e redirect handling
   - Test installMCPGateway() su diverse piattaforme (darwin-arm64, darwin-amd64, linux-amd64)
   - Test gestione errori per download falliti o permessi file

3. **test/mcp-settings.svelte.test.ts**
   - Test getToolRef() ritorna gateway ref quando Docker è attivo
   - Test getToolRef() fallback a local ref quando Docker non disponibile
   - Test setToolMode() persiste correttamente le preferenze
   - Test refreshDockerStatus() aggiorna lo stato correttamente

## Test Unitari Python

4. **tests/test_mcp_resolver.py**
   - Test resolve() con Gateway disponibile → ritorna GATEWAY mode
   - Test resolve() con Gateway fallito → fallback a LOCAL mode
   - Test resolve() con tutto fallito → ritorna ERROR con istruzioni
   - Test _check_gateway() con subprocess mock
   - Test _check_local() verifica presenza npx
   - Test _generate_error_instructions() formato corretto

## Test Integrazione

5. **test/integration/docker-gateway.test.ts**
   - Test E2E flusso completo: detect → install → enable server
   - Test IPC handlers docker:detect, docker:install-gateway
   - Test regenerateCagentConfig triggera correttamente la rigenerazione

6. **test/integration/settings-ui.test.ts**
   - Test rendering pagina settings/tools con Playwright
   - Test toggle Cloud/Local aggiorna store
   - Test bottone "Installa Gateway" appare quando Docker attivo ma Gateway mancante
   - Test alert errore appare su installazione fallita

## Test E2E

7. **e2e/mcp-gateway-workflow.test.ts**
   - Test workflow completo: apertura Settings → Tools → toggle tool → verifica cagent.yaml aggiornato
   - Test fallback visuale: disabilita toggle quando Docker non disponibile
   - Test messaggio errore user-friendly quando nessun backend disponibile

## Verifiche Manuali

8. **Checklist manuale**
   - [ ] Su macOS con Docker Engine: `docker info` funziona
   - [ ] Su macOS senza Docker: app mostra stato "non installato"
   - [ ] Download Gateway da GitHub releases completa correttamente
   - [ ] Binary ha permessi esecuzione (755) dopo installazione
   - [ ] `docker mcp --version` funziona dopo installazione
   - [ ] Toggle Cloud/Local persiste dopo restart app
   - [ ] cagent.yaml contiene ref corretti ('mcp/cloudinary' vs 'npx @cloudinary/mcp-server')
   - [ ] Fallback chain funziona runtime (Gateway down → usa Local)
