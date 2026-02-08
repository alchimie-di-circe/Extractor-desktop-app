"""
Tests for osxphotos_mcp_server module.

Tests JSON-RPC 2.0 protocol handling and MCP server integration.
"""

import json
from unittest.mock import MagicMock, patch

import pytest

import sys
from pathlib import Path

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from tools.osxphotos_mcp_server import OsxphotosMCPServer


@pytest.fixture
def server():
    """Create MCP server instance with mocked osxphotos tool."""
    with patch("tools.osxphotos_mcp_server.OsxphotosTool"):
        return OsxphotosMCPServer(socket_path="/tmp/test.sock")


@pytest.fixture
def server_without_tool():
    """Create MCP server with unavailable osxphotos tool."""
    with patch("tools.osxphotos_mcp_server.OsxphotosTool") as mock_class:
        mock_class.side_effect = Exception("Socket not found")
        return OsxphotosMCPServer(socket_path="/nonexistent/socket")


class TestOsxphotosMCPServerInitialization:
    """Test server initialization."""

    def test_init_default_socket(self):
        """Test initialization with default socket path."""
        with patch("tools.osxphotos_mcp_server.OsxphotosTool"):
            server = OsxphotosMCPServer()
            assert server.socket_path == "/tmp/trae-osxphotos.sock"

    def test_init_custom_socket(self):
        """Test initialization with custom socket path."""
        with patch("tools.osxphotos_mcp_server.OsxphotosTool"):
            server = OsxphotosMCPServer(socket_path="/custom/path.sock")
            assert server.socket_path == "/custom/path.sock"

    def test_init_env_var_socket(self):
        """Test initialization with environment variable."""
        with patch.dict("os.environ", {"OSXPHOTOS_SOCKET": "/env/path.sock"}):
            with patch("tools.osxphotos_mcp_server.OsxphotosTool"):
                server = OsxphotosMCPServer()
                assert server.socket_path == "/env/path.sock"

    def test_init_tool_failure_graceful(self):
        """Test graceful handling of tool initialization failure."""
        with patch("tools.osxphotos_mcp_server.OsxphotosTool") as mock_class:
            mock_class.side_effect = Exception("Connection failed")
            server = OsxphotosMCPServer(socket_path="/tmp/test.sock")
            assert server.tool is None


class TestOsxphotosMCPServerProtocol:
    """Test JSON-RPC 2.0 protocol handling."""

    def test_request_id_increment(self, server):
        """Test request ID increments."""
        assert server._next_request_id() == 1
        assert server._next_request_id() == 2
        assert server._next_request_id() == 3

    def test_send_response_success(self, server):
        """Test successful response formatting."""
        response = server._send_response(1, result={"albums": []})
        data = json.loads(response)

        assert data["jsonrpc"] == "2.0"
        assert data["id"] == 1
        assert data["result"] == {"albums": []}
        assert "error" not in data

    def test_send_response_error(self, server):
        """Test error response formatting."""
        error = {"code": -32600, "message": "Invalid request"}
        response = server._send_response(1, error=error)
        data = json.loads(response)

        assert data["jsonrpc"] == "2.0"
        assert data["id"] == 1
        assert data["error"] == error
        assert "result" not in data

    def test_send_response_empty_result(self, server):
        """Test response with no result provided."""
        response = server._send_response(1)
        data = json.loads(response)

        assert data["result"] == {}

    def test_error_response(self, server):
        """Test error response helper."""
        response = server._error_response(1, -32600, "Invalid request")
        data = json.loads(response)

        assert data["error"]["code"] == -32600
        assert data["error"]["message"] == "Invalid request"
        assert "data" not in data

    def test_error_response_with_data(self, server):
        """Test error response with additional data."""
        response = server._error_response(
            1, -32602, "Invalid params", {"missing": "album_id"}
        )
        data = json.loads(response)

        assert data["error"]["code"] == -32602
        assert data["error"]["data"] == {"missing": "album_id"}


@pytest.mark.asyncio
class TestOsxphotosMCPServerHandling:
    """Test request handling."""

    async def test_handle_request_parse_error(self, server):
        """Test handling of invalid JSON."""
        response = await server.handle_request("not valid json {")
        data = json.loads(response)

        assert data["error"]["code"] == -32700
        assert "Parse error" in data["error"]["message"]

    async def test_handle_request_missing_jsonrpc(self, server):
        """Test handling of missing jsonrpc field."""
        request = json.dumps({"method": "tools/list", "id": 1})
        response = await server.handle_request(request)
        data = json.loads(response)

        assert data["error"]["code"] == -32600
        assert "jsonrpc must be 2.0" in data["error"]["message"]

    async def test_handle_request_missing_method(self, server):
        """Test handling of missing method field."""
        request = json.dumps({"jsonrpc": "2.0", "id": 1})
        response = await server.handle_request(request)
        data = json.loads(response)

        assert data["error"]["code"] == -32600
        assert "missing method" in data["error"]["message"]

    async def test_handle_request_unknown_method(self, server):
        """Test handling of unknown method."""
        request = json.dumps({"jsonrpc": "2.0", "method": "unknown", "id": 1})
        response = await server.handle_request(request)
        data = json.loads(response)

        assert data["error"]["code"] == -32601
        assert "Method not found" in data["error"]["message"]


@pytest.mark.asyncio
class TestOsxphotosMCPToolsList:
    """Test tools/list RPC method."""

    async def test_tools_list_success(self, server):
        """Test successful tools/list call."""
        request = json.dumps({"jsonrpc": "2.0", "method": "tools/list", "id": 1})
        response = await server.handle_request(request)
        data = json.loads(response)

        assert data["result"]["tools"]
        assert len(data["result"]["tools"]) == 5

        # Check tool names
        tool_names = {t["name"] for t in data["result"]["tools"]}
        assert tool_names == {
            "list_albums",
            "get_photos",
            "request_export",
            "get_export_status",
            "search_photos",
        }

    async def test_tools_list_schemas(self, server):
        """Test tools have proper input schemas."""
        request = json.dumps({"jsonrpc": "2.0", "method": "tools/list", "id": 1})
        response = await server.handle_request(request)
        data = json.loads(response)

        tools = {t["name"]: t for t in data["result"]["tools"]}

        # Check list_albums schema
        assert tools["list_albums"]["inputSchema"]["type"] == "object"
        assert tools["list_albums"]["inputSchema"]["required"] == []

        # Check get_photos schema
        assert "album_id" in tools["get_photos"]["inputSchema"]["properties"]
        assert "album_id" in tools["get_photos"]["inputSchema"]["required"]

        # Check request_export schema
        required = tools["request_export"]["inputSchema"]["required"]
        assert set(required) == {"album_id", "photo_ids", "export_path"}


@pytest.mark.asyncio
class TestOsxphotosMCPToolsCall:
    """Test tools/call RPC method."""

    async def test_call_tool_no_tool_available(self, server_without_tool):
        """Test tool call when osxphotos tool not available."""
        request = json.dumps(
            {
                "jsonrpc": "2.0",
                "method": "tools/call",
                "params": {"name": "list_albums", "arguments": {}},
                "id": 1,
            }
        )
        response = await server_without_tool.handle_request(request)
        data = json.loads(response)

        assert data["error"]["code"] == -32000
        assert "not available" in data["error"]["message"]

    async def test_call_list_albums(self, server):
        """Test list_albums tool call."""
        server.tool.list_albums.return_value = [
            {"id": "a1", "name": "Vacation", "count": 10}
        ]

        request = json.dumps(
            {
                "jsonrpc": "2.0",
                "method": "tools/call",
                "params": {"name": "list_albums", "arguments": {}},
                "id": 1,
            }
        )
        response = await server.handle_request(request)
        data = json.loads(response)

        assert data["result"]["albums"][0]["name"] == "Vacation"
        server.tool.list_albums.assert_called_once()

    async def test_call_get_photos_missing_album_id(self, server):
        """Test get_photos without required album_id parameter."""
        request = json.dumps(
            {
                "jsonrpc": "2.0",
                "method": "tools/call",
                "params": {"name": "get_photos", "arguments": {}},
                "id": 1,
            }
        )
        response = await server.handle_request(request)
        data = json.loads(response)

        assert data["error"]["code"] == -32602
        assert "album_id" in data["error"]["message"]

    async def test_call_get_photos_success(self, server):
        """Test get_photos tool call."""
        server.tool.get_photos.return_value = [
            {"id": "p1", "filename": "IMG_001.jpg"}
        ]

        request = json.dumps(
            {
                "jsonrpc": "2.0",
                "method": "tools/call",
                "params": {
                    "name": "get_photos",
                    "arguments": {"album_id": "a1", "limit": 50},
                },
                "id": 1,
            }
        )
        response = await server.handle_request(request)
        data = json.loads(response)

        assert data["result"]["photos"][0]["filename"] == "IMG_001.jpg"
        server.tool.get_photos.assert_called_once_with(
            album_id="a1", limit=50, offset=0, include_metadata=True
        )

    async def test_call_request_export_success(self, server):
        """Test request_export tool call."""
        server.tool.request_export.return_value = {
            "job_id": "job-123",
            "status": "queued",
            "count": 2,
        }

        request = json.dumps(
            {
                "jsonrpc": "2.0",
                "method": "tools/call",
                "params": {
                    "name": "request_export",
                    "arguments": {
                        "album_id": "a1",
                        "photo_ids": ["p1", "p2"],
                        "export_path": "/export",
                        "format": "jpg",
                    },
                },
                "id": 1,
            }
        )
        response = await server.handle_request(request)
        data = json.loads(response)

        assert data["result"]["job_id"] == "job-123"
        server.tool.request_export.assert_called_once_with(
            album_id="a1",
            photo_ids=["p1", "p2"],
            export_path="/export",
            format="jpg",
        )

    async def test_call_search_photos_success(self, server):
        """Test search_photos tool call."""
        server.tool.search_photos.return_value = [
            {"id": "p1", "filename": "vacation.jpg"}
        ]

        request = json.dumps(
            {
                "jsonrpc": "2.0",
                "method": "tools/call",
                "params": {
                    "name": "search_photos",
                    "arguments": {"query": "vacation", "limit": 20},
                },
                "id": 1,
            }
        )
        response = await server.handle_request(request)
        data = json.loads(response)

        assert data["result"]["photos"][0]["filename"] == "vacation.jpg"
        server.tool.search_photos.assert_called_once_with(
            query="vacation", limit=20, include_metadata=False
        )

    async def test_call_unknown_tool(self, server):
        """Test calling unknown tool."""
        request = json.dumps(
            {
                "jsonrpc": "2.0",
                "method": "tools/call",
                "params": {"name": "unknown_tool", "arguments": {}},
                "id": 1,
            }
        )
        response = await server.handle_request(request)
        data = json.loads(response)

        assert data["error"]["code"] == -32601
        assert "Tool not found" in data["error"]["message"]


@pytest.mark.asyncio
class TestOsxphotosMCPErrorHandling:
    """Test error handling in tool calls."""

    async def test_osxphotos_error_handling(self, server):
        """Test handling of osxphotos-specific errors."""
        from tools.osxphotos_tool import OsxphotosConnectionError

        server.tool.list_albums.side_effect = OsxphotosConnectionError(
            "Socket not found"
        )

        request = json.dumps(
            {
                "jsonrpc": "2.0",
                "method": "tools/call",
                "params": {"name": "list_albums", "arguments": {}},
                "id": 1,
            }
        )
        response = await server.handle_request(request)
        data = json.loads(response)

        assert data["error"]["code"] == -32000
        assert "osxphotos error" in data["error"]["message"]

    async def test_unexpected_error_handling(self, server):
        """Test handling of unexpected errors."""
        server.tool.list_albums.side_effect = RuntimeError("Unexpected error")

        request = json.dumps(
            {
                "jsonrpc": "2.0",
                "method": "tools/call",
                "params": {"name": "list_albums", "arguments": {}},
                "id": 1,
            }
        )
        response = await server.handle_request(request)
        data = json.loads(response)

        assert data["error"]["code"] == -32603
        assert "Internal error" in data["error"]["message"]
