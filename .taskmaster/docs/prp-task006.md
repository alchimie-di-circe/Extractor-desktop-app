# PRP: Secure Sandboxed Extraction & Agent Integration (Task 6)

## Goal
Implement a secure, isolated Python process for extracting photos from the macOS Photos Library (`osxphotos`), communicating with the main Electron app via a Unix socket, and integrated into the Cagent AI workflow.

## Why
- **Security**: The Photos Library requires Full Disk Access. Isolating this access in a dedicated, network-blocked process minimizes attack surface.
- **Stability**: If `osxphotos` crashes (e.g., database locked), it shouldn't bring down the main sidecar or the Electron app.
- **Privacy**: Ensuring photos never leave the local device (network lock) except via explicit, user-controlled export paths.
- **Automation**: Enabling AI agents to programmatically search and extract photos for content creation.

## Architecture

5-Layer Architecture:

```mermaid
graph TD
    UI[Layer 5: UI (Svelte)] <--> IPC[Layer 3: Electron Supervisor]
    IPC <--> Socket[Unix Socket /tmp/trae-osxphotos.sock]
    Socket <--> Sandbox[Layer 1: Sandboxed Process]
    Sandbox <--> Logic[Layer 2: Extraction Logic]
    Agent[Layer 4: Agent Tool] -.-> Socket
```

## All Needed Context

### Documentation & References
- **osxphotos**: [GitHub](https://github.com/RhetTbull/osxphotos) - Use `PhotosDB` for read-only access.
- **Python `socket`**: `asyncio.start_unix_server` for IPC.
- **Electron `net`**: `net.createConnection` to talk to the Unix socket.
- **JSON-RPC 2.0**: [Spec](https://www.jsonrpc.org/specification) - Simple protocol for method calls.

### Key Constraints & Gotchas
- **Full Disk Access**: The Python process *must* have FDA. If not, `osxphotos` raises `sqlite3.OperationalError` or `PermissionError`. We must catch this and return a specific error code to the UI to show a "Grant Permissions" guide.
- **Network Lock**: `socket.socket` must be patched *immediately* at startup to allow only `AF_UNIX`.
- **Path Validation**: Strict whitelist (`~/Exports`, `~/Documents/TraeExports`) to prevent writing photos to arbitrary system locations.
- **Circuit Breaker**: The supervisor must not infinite-loop restart if the process keeps crashing (e.g., due to persistent permission errors).

## Implementation Blueprint

### Layer 1: Sandboxed Infrastructure (`python/sandboxed/`)

**1. `network_lock.py`**
- **Critical**: Must be the *first* import in `main.py`.
- Monkey-patches `socket.socket` to raise `PermissionError` if `family` is not `AF_UNIX`.

**2. `path_whitelist.py`**
- Validates export paths against `~/Exports/` and `~/Documents/TraeExports/`.
- Checks for `..` traversal and symlinks resolving outside the whitelist.

**3. `server.py` & `jsonrpc_handler.py`**
- Asyncio Unix Domain Socket server.
- JSON-RPC 2.0 dispatcher.
- Handles `SIGTERM` for graceful shutdown.

### Layer 2: Logic (`python/sandboxed/`)

**1. `photos_service.py`**
- Wraps `osxphotos.PhotosDB`.
- Methods: `list_albums`, `get_photos`, `export_photo`.
- Catches permission errors and re-raises them as structured JSON-RPC errors.

**2. `temporal_grouping.py`**
- Logic to group photos by time clusters (gap > 6 mins = new cluster).

### Layer 3: Electron Supervisor (`electron/osxphotos-supervisor.ts`)

- **Spawn**: `spawn('python3', ['python/sandboxed/server.py'])`.
- **Communication**: Uses `net.connect()` to send JSON-RPC requests.
- **Resilience**: Implements Circuit Breaker (3 crashes/5min).
- **IPC**: Exposes methods via `ipcMain` (`osxphotos:list-albums`, etc.).

### Layer 4: Agent Integration (`python/tools/`)

**1. `osxphotos_tool.py`**
- Implements a Cagent `Tool` class.
- Connects to the *same* Unix socket to request data (acting as a client, just like Electron).
- Allows the agent to "see" albums and request exports.

### Layer 5: UI (`src/routes/extract/`)

- Tabs: "Upload" (existing) vs "Photos Library" (new).
- Tree view for albums.
- Progress bar driven by SSE events (forwarded from the sandboxed process).

## Validation Gates

### 1. Security Tests
```bash
# Verify Network Lock
python3 -c "import python.sandboxed.network_lock; import socket; socket.socket(socket.AF_INET, socket.SOCK_STREAM)"
# Expected: PermissionError

# Verify Path Whitelist
python3 -c "from python.sandboxed.path_whitelist import validate; validate('/etc/passwd')"
# Expected: SecurityError
```

### 2. Functional Tests
```bash
# Verify Unix Socket
python3 python/sandboxed/server.py &
curl --unix-socket /tmp/trae-osxphotos.sock -d '{"jsonrpc": "2.0", "method": "list_albums", "id": 1}'
# Expected: JSON response with albums (or permission error)
```

## Step-by-Step Implementation

1.  **Scaffold**: Create `python/sandboxed` directories and empty files.
2.  **Security Core**: Implement `network_lock.py` and `path_whitelist.py`. Verify with script.
3.  **Server**: Implement `server.py` and `jsonrpc_handler.py`. Verify connection.
4.  **Logic**: Implement `photos_service.py` with `osxphotos`. Connect to handler.
5.  **Electron**: Implement `osxphotos-supervisor.ts` and IPC hooks.
6.  **Agent**: Create `osxphotos_tool.py` and update `team.yaml`.
7.  **UI**: Build the Svelte interface.

## Quality Checklist
- [ ] Network lock prevents `requests.get('https://google.com')`.
- [ ] Writing to `~/Desktop` is blocked.
- [ ] Electron handles process crash gracefully (no zombie processes).
- [ ] Agent can query albums via tool.
