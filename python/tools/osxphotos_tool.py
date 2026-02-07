"""
osxphotos Tool - JSON-RPC client for osxphotos sandboxed server.

Connects to the osxphotos JSON-RPC 2.0 server running on /tmp/trae-osxphotos-{uid}/server.sock
and provides methods to query and manage photos from Apple Photos library.

This module is designed to be used by cagent agents to access photos
without requiring direct access to the Photos library.
"""

import asyncio
import json
import logging
import os
import socket
from typing import Any, Optional

logger = logging.getLogger(__name__)
DEFAULT_SOCKET_PATH = f"/tmp/trae-osxphotos-{os.getuid()}/server.sock"


class OsxphotosError(Exception):
    """Base exception for osxphotos tool."""

    pass


class OsxphotosConnectionError(OsxphotosError):
    """Error connecting to osxphotos JSON-RPC server."""

    pass


class OsxphotosResponseError(OsxphotosError):
    """Error in JSON-RPC response from server."""

    pass


class OsxphotosTool:
    """
    JSON-RPC 2.0 client for osxphotos sandboxed server.

    Provides high-level methods to:
    - List albums with metadata
    - Get photos from albums with filtering
    - Request photo exports
    """

    def __init__(
        self,
        socket_path: str = DEFAULT_SOCKET_PATH,
        timeout: float = 30.0,
    ):
        """
        Initialize osxphotos tool.

        Args:
            socket_path: Path to Unix socket (default: /tmp/trae-osxphotos-{uid}/server.sock)
            timeout: Request timeout in seconds (default: 30)

        Raises:
            OsxphotosConnectionError: If socket path is invalid or not accessible
        """
        self.socket_path = socket_path
        self.timeout = timeout
        self._request_id = 0
        self._verify_socket_accessible()

    def _verify_socket_accessible(self) -> None:
        """
        Verify socket path is valid and accessible.

        Raises:
            OsxphotosConnectionError: If socket doesn't exist or isn't accessible
        """
        if not os.path.exists(self.socket_path):
            raise OsxphotosConnectionError(
                f"osxphotos socket not found at {self.socket_path}. "
                "Ensure the osxphotos supervisor is running."
            )

        if not os.access(self.socket_path, os.R_OK | os.W_OK):
            raise OsxphotosConnectionError(
                f"No read/write permission for socket at {self.socket_path}"
            )

    def _next_request_id(self) -> int:
        """Get next JSON-RPC request ID."""
        self._request_id += 1
        return self._request_id

    def _send_request(self, method: str, params: Optional[dict] = None) -> dict:
        """
        Send JSON-RPC 2.0 request to osxphotos server and get response.

        Args:
            method: RPC method name
            params: Method parameters (default: empty dict)

        Returns:
            Response result from RPC server

        Raises:
            OsxphotosConnectionError: If connection fails
            OsxphotosResponseError: If RPC error is returned
        """
        if params is None:
            params = {}

        request = {
            "jsonrpc": "2.0",
            "method": method,
            "params": params,
            "id": self._next_request_id(),
        }

        request_json = json.dumps(request)
        logger.debug(f"RPC Request: {request_json}")

        try:
            # Connect to Unix socket
            sock = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
            sock.settimeout(self.timeout)
            sock.connect(self.socket_path)

            try:
                # Send request with 4-byte length prefix to match server protocol
                request_bytes = request_json.encode("utf-8")
                request_length = len(request_bytes).to_bytes(4, byteorder="big")
                sock.sendall(request_length + request_bytes)

                # Receive response length prefix
                response_length_bytes = sock.recv(4)
                if not response_length_bytes:
                    raise OsxphotosResponseError(
                        "Server closed connection without response"
                    )
                response_length = int.from_bytes(response_length_bytes, byteorder="big")

                # Receive full response payload
                response_data = b""
                while len(response_data) < response_length:
                    chunk = sock.recv(response_length - len(response_data))
                    if not chunk:
                        raise OsxphotosResponseError(
                            "Connection closed before full response received"
                        )
                    response_data += chunk
                response_text = response_data.decode("utf-8")
                response = json.loads(response_text)

                logger.debug(f"RPC Response: {response_text}")

                # Check for RPC errors
                if "error" in response and response["error"] is not None:
                    error_msg = response["error"].get(
                        "message", "Unknown RPC error"
                    )
                    error_code = response["error"].get("code", -1)
                    raise OsxphotosResponseError(
                        f"RPC error (code {error_code}): {error_msg}"
                    )

                return response.get("result", {})

            finally:
                sock.close()

        except socket.timeout:
            raise OsxphotosConnectionError(
                f"Connection timeout to osxphotos server (>{self.timeout}s)"
            ) from None
        except (socket.error, ConnectionRefusedError, FileNotFoundError) as e:
            raise OsxphotosConnectionError(
                f"Failed to connect to osxphotos server: {e}"
            ) from e
        except json.JSONDecodeError as e:
            raise OsxphotosResponseError(f"Invalid JSON response from server: {e}") from e

    def list_albums(self) -> list[dict[str, Any]]:
        """
        List all albums in Apple Photos library.

        Returns:
            List of album objects with structure:
            [
                {
                    "id": "album-uuid",
                    "name": "Album Name",
                    "count": 42,
                    "type": "folder|smart|album",
                    "created": "2024-01-15T10:30:00Z",
                    "modified": "2024-01-20T15:45:00Z"
                },
                ...
            ]

        Raises:
            OsxphotosConnectionError: If server is unreachable
            OsxphotosResponseError: If RPC returns error
        """
        result = self._send_request("list_albums")
        albums = result.get("albums", [])

        # Ensure consistent structure
        for album in albums:
            album.setdefault("id", "")
            album.setdefault("name", "Unknown")
            album.setdefault("count", 0)
            album.setdefault("type", "album")

        return albums

    def get_photos(
        self,
        album_id: str,
        limit: int = 50,
        offset: int = 0,
        include_metadata: bool = True,
    ) -> list[dict[str, Any]]:
        """
        Get photos from an album.

        Args:
            album_id: Album UUID to query
            limit: Maximum number of photos to return (default: 50, max: 500)
            offset: Pagination offset (default: 0)
            include_metadata: Include EXIF metadata (default: True)

        Returns:
            List of photo objects with structure:
            [
                {
                    "id": "photo-uuid",
                    "filename": "IMG_1234.jpg",
                    "size_bytes": 2048576,
                    "date_taken": "2024-01-15T10:30:00Z",
                    "album_id": "album-uuid",
                    "width": 3024,
                    "height": 4032,
                    "camera": "iPhone 15 Pro",
                    "metadata": {...}  # if include_metadata=True
                },
                ...
            ]

        Raises:
            OsxphotosConnectionError: If server is unreachable
            OsxphotosResponseError: If RPC returns error or album not found
        """
        # Clamp limit to reasonable range
        limit = max(1, min(limit, 500))

        result = self._send_request(
            "get_photos",
            {
                "album_id": album_id,
                "limit": limit,
                "offset": offset,
                "include_metadata": include_metadata,
            },
        )

        photos = result.get("photos", [])

        # Ensure consistent structure
        for photo in photos:
            photo.setdefault("id", "")
            photo.setdefault("filename", "unknown")
            photo.setdefault("size_bytes", 0)
            photo.setdefault("album_id", album_id)

        return photos

    def request_export(
        self,
        album_id: str,
        photo_ids: list[str],
        export_path: str,
        format: str = "original",
    ) -> dict[str, Any]:
        """
        Request export of photos from an album.

        Queues an async export job on the server. Returns immediately with job ID.
        Client should poll job status separately if needed.

        Args:
            album_id: Album UUID containing photos
            photo_ids: List of photo UUIDs to export
            export_path: Destination directory path (must be whitelisted)
            format: Export format - "original", "jpg", "png", "heic" (default: "original")

        Returns:
            Export job object with structure:
            {
                "job_id": "job-uuid",
                "status": "queued|running|completed|failed",
                "count": 5,
                "album_id": "album-uuid",
                "export_path": "/export/path",
                "format": "original",
                "started_at": "2024-01-20T15:45:00Z",
                "error": null  # if status != "failed"
            }

        Raises:
            OsxphotosConnectionError: If server is unreachable
            OsxphotosResponseError: If RPC returns error
        """
        result = self._send_request(
            "request_export",
            {
                "album_id": album_id,
                "photo_ids": photo_ids,
                "export_path": export_path,
                "format": format,
            },
        )

        # Ensure consistent structure
        result.setdefault("job_id", "")
        result.setdefault("status", "queued")
        result.setdefault("count", len(photo_ids))
        result.setdefault("error", None)

        return result

    def get_export_status(self, job_id: str) -> dict[str, Any]:
        """
        Get status of an export job.

        Args:
            job_id: Job UUID from request_export

        Returns:
            Export job status object with structure:
            {
                "job_id": "job-uuid",
                "status": "queued|running|completed|failed",
                "count": 5,
                "completed": 3,
                "error": null,
                "started_at": "2024-01-20T15:45:00Z",
                "completed_at": "2024-01-20T15:45:30Z"
            }

        Raises:
            OsxphotosConnectionError: If server is unreachable
            OsxphotosResponseError: If RPC returns error
        """
        result = self._send_request("get_export_status", {"job_id": job_id})

        result.setdefault("job_id", job_id)
        result.setdefault("status", "unknown")
        result.setdefault("count", 0)
        result.setdefault("completed", 0)

        return result

    def search_photos(
        self,
        query: str,
        limit: int = 20,
        include_metadata: bool = False,
    ) -> list[dict[str, Any]]:
        """
        Search photos across all albums.

        Searches by filename, EXIF metadata, and semantic tags.

        Args:
            query: Search query (filename, date, camera, etc.)
            limit: Maximum results (default: 20, max: 100)
            include_metadata: Include full EXIF metadata (default: False)

        Returns:
            List of matching photo objects

        Raises:
            OsxphotosConnectionError: If server is unreachable
            OsxphotosResponseError: If RPC returns error
        """
        limit = max(1, min(limit, 100))

        result = self._send_request(
            "search_photos",
            {
                "query": query,
                "limit": limit,
                "include_metadata": include_metadata,
            },
        )

        return result.get("photos", [])


# For backward compatibility and REPL/debugging
async def list_albums_async(
    socket_path: str = DEFAULT_SOCKET_PATH,
) -> list[dict[str, Any]]:
    """Async wrapper for list_albums (offloads blocking socket I/O to thread pool)."""
    def _sync() -> list[dict[str, Any]]:
        tool = OsxphotosTool(socket_path)
        return tool.list_albums()
    
    return await asyncio.to_thread(_sync)


async def get_photos_async(
    album_id: str,
    limit: int = 50,
    socket_path: str = DEFAULT_SOCKET_PATH,
) -> list[dict[str, Any]]:
    """Async wrapper for get_photos (offloads blocking socket I/O to thread pool)."""
    def _sync() -> list[dict[str, Any]]:
        tool = OsxphotosTool(socket_path)
        return tool.get_photos(album_id, limit)
    
    return await asyncio.to_thread(_sync)
