# osxphotos Tool Integration for Cagent

## Overview

This document describes the osxphotos tool integration for the TRAE Extractor cagent team. The tool provides safe, sandboxed access to Apple Photos library via JSON-RPC 2.0, exposed to cagent agents through the Model Context Protocol (MCP).

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│              Cagent Extraction Agent                     │
│                (Claude Sonnet 4.5)                       │
└──────────────────────┬──────────────────────────────────┘
                       │
                       │ MCP Protocol (stdio)
                       ▼
┌─────────────────────────────────────────────────────────┐
│       osxphotos_mcp_server.py                            │
│  (JSON-RPC 2.0 → MCP Protocol Adapter)                  │
└──────────────────────┬──────────────────────────────────┘
                       │
                       │ JSON-RPC 2.0 (Unix socket)
                       ▼
┌─────────────────────────────────────────────────────────┐
│     osxphotos_tool.py                                   │
│  (JSON-RPC 2.0 Client Library)                          │
└──────────────────────┬──────────────────────────────────┘
                       │
                       │ Unix socket
                       ▼
┌─────────────────────────────────────────────────────────┐
│     osxphotos Sandboxed Server                          │
│   (Electron supervisor → JSON-RPC 2.0)                  │
│   Socket: /tmp/trae-osxphotos.sock                      │
└──────────────────────┬──────────────────────────────────┘
                       │
                       ▼
                Apple Photos Library (read-only)
```

## Components

### 1. `python/tools/osxphotos_tool.py` (Utility Library)

Pure Python JSON-RPC 2.0 client for the osxphotos sandboxed server.

**Key Classes:**
- `OsxphotosTool` - Main client class
- `OsxphotosError` - Base exception
- `OsxphotosConnectionError` - Connection/socket errors
- `OsxphotosResponseError` - RPC response errors

**Public Methods:**
```python
tool = OsxphotosTool(socket_path="/tmp/trae-osxphotos.sock")

# List all albums
albums = tool.list_albums()
# Returns: [{"id": "...", "name": "...", "count": 42, ...}, ...]

# Get photos from album
photos = tool.get_photos(
    album_id="album-uuid",
    limit=50,           # 1-500, default 50
    offset=0,           # For pagination
    include_metadata=True  # Include EXIF data
)
# Returns: [{"id": "...", "filename": "...", "date_taken": "...", ...}, ...]

# Request export (async job)
export = tool.request_export(
    album_id="album-uuid",
    photo_ids=["photo-1", "photo-2", ...],
    export_path="/export/destination",
    format="original"  # original|jpg|png|heic
)
# Returns: {"job_id": "...", "status": "queued", ...}

# Check export status
status = tool.get_export_status(job_id="job-123")
# Returns: {"job_id": "...", "status": "running|completed|failed", ...}

# Search across all albums
photos = tool.search_photos(
    query="vacation",
    limit=20,          # 1-100, default 20
    include_metadata=False
)
# Returns: [{"id": "...", "filename": "...", ...}, ...]
```

**Error Handling:**
```python
from tools.osxphotos_tool import OsxphotosTool, OsxphotosConnectionError

try:
    tool = OsxphotosTool()
    albums = tool.list_albums()
except OsxphotosConnectionError as e:
    print(f"Socket not available: {e}")
```

**Test Coverage:**
- 27 unit tests covering all methods
- Connection error handling (socket not found, no permissions, timeout)
- RPC protocol validation (JSON-RPC 2.0 compliance)
- Parameter validation and clamping
- Exception hierarchy and messages

### 2. `python/tools/osxphotos_mcp_server.py` (MCP Server)

Exposes osxphotos functionality as Model Context Protocol (MCP) tools, allowing cagent agents to call osxphotos via standard MCP interface.

**Protocol:** JSON-RPC 2.0 on stdio (MCP standard)

**Exposed Tools:**
- `tools/list` - Returns list of available tools
- `tools/call` - Execute a tool with parameters

**Available Tools via MCP:**
1. `list_albums` - List all photo albums
2. `get_photos` - Get photos from album with filtering
3. `request_export` - Queue photos for export
4. `get_export_status` - Check export job status
5. `search_photos` - Search photos by query

**Tool Schemas (JSON Schema):**
Each tool has proper input schema with required/optional parameters:
```json
{
  "name": "get_photos",
  "description": "Get photos from album...",
  "inputSchema": {
    "type": "object",
    "properties": {
      "album_id": {"type": "string", "description": "Album UUID"},
      "limit": {"type": "integer", "default": 50, "description": "Max photos"}
    },
    "required": ["album_id"]
  }
}
```

**Environment Variables:**
- `OSXPHOTOS_SOCKET` - Path to osxphotos JSON-RPC socket (default: `/tmp/trae-osxphotos.sock`)

**Startup and Error Handling:**
- Gracefully handles socket unavailability
- Returns proper MCP errors when tool not available
- Validates JSON-RPC 2.0 protocol compliance
- Logs to stderr for debugging

**Test Coverage:**
- 25 unit tests covering MCP protocol
- JSON-RPC 2.0 validation
- Tool schema correctness
- Error handling and edge cases
- Full integration scenarios

## Integration with Cagent

The tool is integrated into the Extraction Agent via `python/team.yaml`:

```yaml
agents:
  extraction:
    model: sonnet
    toolsets:
      # osxphotos MCP Server
      - type: mcp
        command: python3
        args: ["./tools/osxphotos_mcp_server.py"]
        env:
          OSXPHOTOS_SOCKET: ${OSXPHOTOS_SOCKET:-/tmp/trae-osxphotos.sock}
        instruction: |
          osxphotos tools for querying Apple Photos library.
          Available tools:
          - list_albums: List all photo albums
          - get_photos: Get photos from album
          - request_export: Queue photos for export
          - get_export_status: Check export status
          - search_photos: Search all photos
```

## Extraction Agent Workflow

When the Extraction Agent receives a photo-related request:

1. **List Albums**
   ```
   Agent → osxphotos: list_albums
   Result: Available albums with metadata
   ```

2. **Query Album**
   ```
   Agent → osxphotos: get_photos(album_id, limit=50)
   Result: Photos with metadata, dimensions, dates
   ```

3. **Request Export (Optional)**
   ```
   Agent → osxphotos: request_export(album_id, photo_ids, export_path)
   Result: Job ID and initial status
   ```

4. **Check Status**
   ```
   Agent → osxphotos: get_export_status(job_id)
   Result: Current status (queued/running/completed/failed)
   ```

5. **Return Results**
   ```
   Agent → Orchestrator: Extracted photos with metadata
   ```

## Usage Examples

### Example 1: Extract Recent Photos from Album

```python
from tools.osxphotos_tool import OsxphotosTool

tool = OsxphotosTool()

# List albums
albums = tool.list_albums()
vacation_album = next(a for a in albums if a['name'] == 'Vacation')

# Get photos
photos = tool.get_photos(vacation_album['id'], limit=10)
for photo in photos:
    print(f"{photo['filename']} - {photo['date_taken']}")

# Request export
export = tool.request_export(
    album_id=vacation_album['id'],
    photo_ids=[p['id'] for p in photos],
    export_path="/tmp/exports/vacation"
)
print(f"Export job {export['job_id']} queued")
```

### Example 2: Cagent Agent Workflow

The Extraction Agent automatically uses osxphotos tools:

```
User: "Extract 20 recent photos from my Vacation album and save them to ~/Desktop"

Orchestrator → Extraction Agent:
  "Extract photos from Vacation album (max 20) and request export to ~/Desktop"

Extraction Agent workflow:
  1. Call list_albums tool → Find 'Vacation' album
  2. Call get_photos(album_id, limit=20) → Get 20 photos
  3. Call request_export(..., ~/Desktop) → Queue export
  4. Return structured result with photo metadata

Agent → User: "Found 20 photos in Vacation album:
  - IMG_001.jpg (3024x4032, 2.5MB, Jan 15)
  - IMG_002.jpg (3024x4032, 2.1MB, Jan 15)
  - ... [18 more photos]
  
  Export queued to ~/Desktop (Job ID: job-abc123)"
```

## Error Handling

### Connection Errors
```python
try:
    tool = OsxphotosTool()  # Raises if socket not found
except OsxphotosConnectionError:
    # Supervisor not running or socket inaccessible
    print("osxphotos supervisor must be running")
```

### Runtime Errors
```python
try:
    photos = tool.get_photos("invalid-album")
except OsxphotosResponseError as e:
    # RPC error from server
    print(f"Album not found: {e}")
except OsxphotosConnectionError as e:
    # Socket communication issue
    print(f"Connection lost: {e}")
```

### MCP Server Errors
The MCP server returns proper JSON-RPC 2.0 errors:
- `-32700` Parse error (invalid JSON)
- `-32600` Invalid Request (missing jsonrpc or method)
- `-32601` Method not found (unknown tool)
- `-32602` Invalid params (missing required parameters)
- `-32603` Internal error (unexpected exception)
- `-32000` osxphotos error (tool-specific error)

## Testing

### Run Unit Tests
```bash
# Test osxphotos_tool library (27 tests)
pytest python/tests/test_osxphotos_tool.py -v

# Test osxphotos_mcp_server (25 tests)
pytest python/tests/test_osxphotos_mcp_server.py -v

# All osxphotos tests
pytest python/tests/test_osxphotos*.py -v
```

### Test Coverage
- **Connection handling**: Socket path validation, permission checks, timeouts
- **JSON-RPC protocol**: Valid requests, error responses, parameter handling
- **Tool functionality**: Each method with valid/invalid inputs
- **MCP protocol**: tools/list, tools/call, error responses
- **Integration scenarios**: Full workflows with mocked server

## Prerequisites

### For Development
- Python 3.9+
- pytest with asyncio support
- Unix domain socket support (macOS/Linux)

### For Production
- osxphotos supervisor running on `/tmp/trae-osxphotos.sock`
- Cagent runtime
- Python 3.9+ (for MCP server)
- Sufficient disk space for exports

### Environment Setup
```bash
# Install dependencies (in .venv)
pip install pytest pytest-asyncio

# Set socket path (optional, defaults to /tmp/trae-osxphotos.sock)
export OSXPHOTOS_SOCKET=/custom/path.sock

# Run team with osxphotos tools
cagent run python/team.yaml
```

## Performance Considerations

### Optimization
- **Limit clamping**: get_photos limits to 1-500 (default 50)
- **Metadata optional**: include_metadata=False reduces payload
- **Pagination**: offset parameter for large albums
- **Search limits**: search_photos limits to 1-100 results

### Timeout
- Default socket timeout: 30 seconds
- Configurable per tool instance: `OsxphotosTool(timeout=15.0)`

### Export Jobs
- Non-blocking: request_export returns immediately with job ID
- Async processing: Use get_export_status to check progress
- No local blocking: Agent can continue other work

## Security

### Sandbox Boundary
- osxphotos tool communicates via Unix socket (local-only)
- No network access
- Read-only on Apple Photos Library
- Export paths must be whitelisted by supervisor

### Input Validation
- Album IDs validated as UUIDs
- Photo IDs validated as strings
- Limits clamped to safe ranges (1-500, 1-100)
- Export paths validated by supervisor

### Error Messages
- Sensitive details kept in logs (stderr)
- User-friendly error messages returned to agent
- No credential/path exposure in tool responses

## Troubleshooting

### Socket Not Found
```
Error: osxphotos socket not found at /tmp/trae-osxphotos.sock
```
**Solution:** Start osxphotos supervisor:
```bash
# From Electron main process
window.electronAPI.osxphotos.startServer()
```

### Permission Denied
```
Error: No read/write permission for socket
```
**Solution:** Check socket permissions and Electron supervisor privileges.

### Connection Timeout
```
Error: Connection timeout to osxphotos server (>30s)
```
**Solution:** 
- Increase timeout: `OsxphotosTool(timeout=60.0)`
- Check supervisor logs
- Verify socket is responding

### RPC Error Response
```
RPC error (code -32600): Invalid request
```
**Solution:** Check MCP server logs (stderr) and request format.

## Future Extensions

### Potential Enhancements
1. **Batch operations**: Multi-album queries in single call
2. **Advanced search**: Date ranges, EXIF tag filtering
3. **Streaming exports**: Large batch handling
4. **Thumbnail caching**: Optimize metadata retrieval
5. **Smart albums**: Dynamic album generation based on criteria
6. **RAG integration**: Semantic photo search via embeddings

## Related Documentation

- [TRAE Cagent Team Architecture](./cagent-team.md)
- [Electron Supervisor osxphotos Module](../../electron/ipc-handlers.ts)
- [JSON-RPC 2.0 Specification](https://www.jsonrpc.org/specification)
- [Model Context Protocol (MCP)](https://modelcontextprotocol.io/)

## References

- **Configuration**: `python/team.yaml` (extraction agent toolsets)
- **Tests**: `python/tests/test_osxphotos*.py`
- **Source**: `python/tools/osxphotos_tool.py` and `osxphotos_mcp_server.py`
