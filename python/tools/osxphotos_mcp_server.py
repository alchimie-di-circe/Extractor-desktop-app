#!/usr/bin/env python3
"""
osxphotos MCP Server - Exposes osxphotos tool as Model Context Protocol server.

This server implements the MCP specification to expose osxphotos functionality
to cagent and other MCP clients. Runs on stdio and communicates via JSON-RPC 2.0.

Usage:
    python tools/osxphotos_mcp_server.py

Environment variables:
    OSXPHOTOS_SOCKET: Path to osxphotos JSON-RPC socket (default: /tmp/trae-osxphotos-{uid}/server.sock)
"""

import asyncio
import json
import logging
import os
import sys
from typing import Any, Optional

try:
    # When run as a script directly
    from osxphotos_tool import OsxphotosTool, OsxphotosError
except ImportError:
    # When imported as a module (tests)
    from .osxphotos_tool import OsxphotosTool, OsxphotosError

try:
    from sandboxed.path_whitelist import validate_export_path, SecurityError
except ImportError:
    from ..sandboxed.path_whitelist import validate_export_path, SecurityError

# Configure logging (to stderr to avoid stdout pollution)
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    stream=sys.stderr,
)
logger = logging.getLogger(__name__)


class OsxphotosMCPServer:
    """
    MCP Server for osxphotos functionality.

    Implements the Model Context Protocol to expose osxphotos as tools
    available to language models and agents.
    """

    def __init__(self, socket_path: Optional[str] = None):
        """
        Initialize MCP server.

        Args:
            socket_path: Path to osxphotos JSON-RPC socket
        """
        self.socket_path = socket_path or os.getenv(
            "OSXPHOTOS_SOCKET", f"/tmp/trae-osxphotos-{os.getuid()}/server.sock"
        )
        self.request_id = 0
        self.tool = None
        self._init_tool()

    def _init_tool(self) -> None:
        """Initialize osxphotos tool."""
        try:
            self.tool = OsxphotosTool(socket_path=self.socket_path)
            logger.info(f"osxphotos tool initialized with socket: {self.socket_path}")
        except Exception as e:
            logger.warning(
                f"Failed to initialize osxphotos tool: {e}. "
                "Some tools will return errors until socket is available."
            )

    def _next_request_id(self) -> int:
        """Get next JSON-RPC request ID."""
        self.request_id += 1
        return self.request_id

    def _send_response(
        self,
        request_id: int,
        result: Optional[Any] = None,
        error: Optional[dict] = None,
    ) -> str:
        """
        Format JSON-RPC 2.0 response.

        Args:
            request_id: Request ID to echo back
            result: Result object (if success)
            error: Error object (if error)

        Returns:
            JSON-RPC 2.0 response string
        """
        response = {
            "jsonrpc": "2.0",
            "id": request_id,
        }

        if error:
            response["error"] = error
        else:
            # Explicitly check for None: falsy values like [], 0, False are valid results
            response["result"] = result if result is not None else {}

        return json.dumps(response)

    def _error_response(
        self, request_id: int, code: int, message: str, data: Optional[dict] = None
    ) -> str:
        """Create JSON-RPC error response."""
        error = {"code": code, "message": message}
        if data:
            error["data"] = data

        return self._send_response(request_id, error=error)

    async def handle_request(self, request_str: str) -> str:
        """
        Handle incoming JSON-RPC 2.0 request.

        Args:
            request_str: JSON-RPC request string

        Returns:
            JSON-RPC response string
        """
        try:
            request = json.loads(request_str)
        except json.JSONDecodeError as e:
            return self._error_response(
                None, -32700, "Parse error", {"details": str(e)}
            )

        request_id = request.get("id", -1)

        # Validate JSON-RPC 2.0 structure
        if request.get("jsonrpc") != "2.0":
            return self._error_response(
                request_id, -32600, "Invalid Request: jsonrpc must be 2.0"
            )

        method = request.get("method")
        if not method:
            return self._error_response(
                request_id, -32600, "Invalid Request: missing method"
            )

        params = request.get("params", {})

        # Dispatch to method handlers
        try:
            if method == "tools/list":
                return await self._handle_tools_list(request_id)
            elif method == "tools/call":
                return await self._handle_tools_call(request_id, params)
            else:
                return self._error_response(
                    request_id, -32601, f"Method not found: {method}"
                )

        except Exception as e:
            logger.exception(f"Error handling request {request_id}")
            return self._error_response(
                request_id, -32603, "Internal error", {"details": str(e)}
            )

    async def _handle_tools_list(self, request_id: int) -> str:
        """
        Handle tools/list request.

        Returns list of available tools.
        """
        tools = [
            {
                "name": "list_albums",
                "description": "List all albums in Apple Photos library",
                "inputSchema": {
                    "type": "object",
                    "properties": {},
                    "required": [],
                },
            },
            {
                "name": "get_photos",
                "description": "Get photos from a specific album with optional filtering",
                "inputSchema": {
                    "type": "object",
                    "properties": {
                        "album_id": {
                            "type": "string",
                            "description": "Album UUID to query",
                        },
                        "limit": {
                            "type": "integer",
                            "description": "Maximum number of photos to return (1-500, default: 50)",
                            "default": 50,
                        },
                        "offset": {
                            "type": "integer",
                            "description": "Pagination offset (default: 0)",
                            "default": 0,
                        },
                        "include_metadata": {
                            "type": "boolean",
                            "description": "Include full EXIF metadata (default: true)",
                            "default": True,
                        },
                    },
                    "required": ["album_id"],
                },
            },
            {
                "name": "request_export",
                "description": "Request export of photos from an album (async job)",
                "inputSchema": {
                    "type": "object",
                    "properties": {
                        "album_id": {
                            "type": "string",
                            "description": "Album UUID containing photos",
                        },
                        "photo_ids": {
                            "type": "array",
                            "items": {"type": "string"},
                            "description": "List of photo UUIDs to export",
                        },
                        "export_path": {
                            "type": "string",
                            "description": "Destination directory path (must be whitelisted)",
                        },
                        "format": {
                            "type": "string",
                            "enum": ["original", "jpg", "png", "heic"],
                            "description": "Export format (default: original)",
                            "default": "original",
                        },
                    },
                    "required": ["album_id", "photo_ids", "export_path"],
                },
            },
            {
                "name": "get_export_status",
                "description": "Get status of an export job",
                "inputSchema": {
                    "type": "object",
                    "properties": {
                        "job_id": {
                            "type": "string",
                            "description": "Job UUID from request_export",
                        }
                    },
                    "required": ["job_id"],
                },
            },
            {
                "name": "search_photos",
                "description": "Search photos across all albums by filename, date, or metadata",
                "inputSchema": {
                    "type": "object",
                    "properties": {
                        "query": {
                            "type": "string",
                            "description": "Search query (filename, date, camera, etc.)",
                        },
                        "limit": {
                            "type": "integer",
                            "description": "Maximum results (1-100, default: 20)",
                            "default": 20,
                        },
                        "include_metadata": {
                            "type": "boolean",
                            "description": "Include full EXIF metadata (default: false)",
                            "default": False,
                        },
                    },
                    "required": ["query"],
                },
            },
        ]

        return self._send_response(request_id, {"tools": tools})

    async def _handle_tools_call(
        self, request_id: int, params: dict
    ) -> str:
        """
        Handle tools/call request.

        Args:
            request_id: JSON-RPC request ID
            params: Tool parameters including 'name' and tool-specific arguments

        Returns:
            JSON-RPC response with tool result or error
        """
        if not self.tool:
            return self._error_response(
                request_id,
                -32000,
                "osxphotos tool not available",
                {"details": f"Socket not found at {self.socket_path}"},
            )

        tool_name = params.get("name")
        tool_params = params.get("arguments", {})

        try:
            if tool_name == "list_albums":
                result = self.tool.list_albums()
                return self._send_response(request_id, {"albums": result})

            elif tool_name == "get_photos":
                album_id = tool_params.get("album_id")
                if not album_id:
                    return self._error_response(
                        request_id, -32602, "Missing required parameter: album_id"
                    )

                photos = self.tool.get_photos(
                    album_id=album_id,
                    limit=tool_params.get("limit", 50),
                    offset=tool_params.get("offset", 0),
                    include_metadata=tool_params.get("include_metadata", True),
                )
                return self._send_response(request_id, {"photos": photos})

            elif tool_name == "request_export":
                album_id = tool_params.get("album_id")
                photo_ids = tool_params.get("photo_ids")
                export_path = tool_params.get("export_path")

                if album_id is None or photo_ids is None or export_path is None:
                    return self._error_response(
                        request_id,
                        -32602,
                        "Missing required parameters: album_id, photo_ids, export_path",
                    )

                try:
                    safe_path = validate_export_path(export_path)
                except SecurityError as e:
                    return self._error_response(
                        request_id, -32602, f"Invalid export path: {e}"
                    )

                result = self.tool.request_export(
                    album_id=album_id,
                    photo_ids=photo_ids,
                    export_path=safe_path,
                    format=tool_params.get("format", "original"),
                )
                return self._send_response(request_id, result)

            elif tool_name == "get_export_status":
                job_id = tool_params.get("job_id")
                if not job_id:
                    return self._error_response(
                        request_id, -32602, "Missing required parameter: job_id"
                    )

                result = self.tool.get_export_status(job_id)
                return self._send_response(request_id, result)

            elif tool_name == "search_photos":
                query = tool_params.get("query")
                if not query:
                    return self._error_response(
                        request_id, -32602, "Missing required parameter: query"
                    )

                photos = self.tool.search_photos(
                    query=query,
                    limit=tool_params.get("limit", 20),
                    include_metadata=tool_params.get("include_metadata", False),
                )
                return self._send_response(request_id, {"photos": photos})

            else:
                return self._error_response(
                    request_id, -32601, f"Tool not found: {tool_name}"
                )

        except OsxphotosError as e:
            return self._error_response(
                request_id,
                -32000,
                f"osxphotos error: {str(e)}",
                {"tool": tool_name},
            )

    async def run(self) -> None:
        """
        Run MCP server on stdin/stdout.

        Reads JSON-RPC requests from stdin line-by-line and writes
        responses to stdout.
        """
        logger.info("osxphotos MCP server starting on stdio")

        loop = asyncio.get_running_loop()

        try:
            while True:
                # Read line from stdin in a non-blocking way
                line = await loop.run_in_executor(
                    None, sys.stdin.readline
                )

                if not line:
                    # EOF
                    logger.info("EOF received, shutting down")
                    break

                line = line.strip()
                if not line:
                    continue

                logger.debug(f"Received: {line}")

                # Handle request
                response = await self.handle_request(line)

                # Write response
                print(response, flush=True)
                logger.debug(f"Sent: {response}")

        except KeyboardInterrupt:
            logger.info("Interrupted by user")
        except Exception:
            logger.exception("Unexpected error in main loop")
            raise


async def main():
    """Entry point for MCP server."""
    server = OsxphotosMCPServer()
    await server.run()


if __name__ == "__main__":
    asyncio.run(main())
