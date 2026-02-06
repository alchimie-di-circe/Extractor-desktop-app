"""
Tests for osxphotos_tool module.

Tests both the OsxphotosTool class and integration with mock JSON-RPC server.
"""

import json
import os
import socket
import tempfile
from unittest.mock import MagicMock, Mock, patch

import pytest

from tools.osxphotos_tool import (
    OsxphotosConnectionError,
    OsxphotosError,
    OsxphotosResponseError,
    OsxphotosTool,
)


@pytest.fixture
def temp_socket():
    """Create a temporary Unix socket for testing."""
    with tempfile.TemporaryDirectory() as tmpdir:
        socket_path = os.path.join(tmpdir, "test.sock")
        yield socket_path


@pytest.fixture
def tool():
    """Create OsxphotosTool instance with mocked socket."""
    with patch("os.path.exists", return_value=True), patch(
        "os.access", return_value=True
    ):
        return OsxphotosTool(socket_path="/tmp/test.sock", timeout=5.0)


class TestOsxphotosToolInitialization:
    """Test tool initialization and validation."""

    def test_init_with_default_socket(self):
        """Test initialization with default socket path."""
        with patch("os.path.exists", return_value=True), patch(
            "os.access", return_value=True
        ):
            tool = OsxphotosTool()
            assert tool.socket_path == "/tmp/trae-osxphotos.sock"
            assert tool.timeout == 30.0

    def test_init_with_custom_socket(self):
        """Test initialization with custom socket path."""
        custom_socket = "/custom/path/osxphotos.sock"
        with patch("os.path.exists", return_value=True), patch(
            "os.access", return_value=True
        ):
            tool = OsxphotosTool(socket_path=custom_socket, timeout=15.0)
            assert tool.socket_path == custom_socket
            assert tool.timeout == 15.0

    def test_init_socket_not_found(self):
        """Test initialization fails if socket doesn't exist."""
        with patch("os.path.exists", return_value=False):
            with pytest.raises(OsxphotosConnectionError) as exc_info:
                OsxphotosTool(socket_path="/nonexistent/socket")

            assert "socket not found" in str(exc_info.value)
            assert "osxphotos supervisor" in str(exc_info.value)

    def test_init_socket_no_permissions(self):
        """Test initialization fails if socket not accessible."""
        with patch("os.path.exists", return_value=True), patch(
            "os.access", return_value=False
        ):
            with pytest.raises(OsxphotosConnectionError) as exc_info:
                OsxphotosTool()

            assert "No read/write permission" in str(exc_info.value)


class TestOsxphotosToolRPC:
    """Test JSON-RPC request/response handling."""

    def test_request_id_increment(self, tool):
        """Test request ID increments for each call."""
        assert tool._next_request_id() == 1
        assert tool._next_request_id() == 2
        assert tool._next_request_id() == 3

    def test_send_request_success(self, tool):
        """Test successful RPC request."""
        mock_response = {"jsonrpc": "2.0", "result": {"albums": []}, "id": 1}

        with patch("socket.socket") as mock_socket_class:
            mock_socket = MagicMock()
            mock_socket_class.return_value = mock_socket
            mock_socket.recv.return_value = json.dumps(mock_response).encode()

            result = tool._send_request("list_albums")

            assert result == {"albums": []}
            mock_socket.connect.assert_called_once_with("/tmp/test.sock")
            mock_socket.sendall.assert_called()
            mock_socket.close.assert_called_once()

    def test_send_request_with_params(self, tool):
        """Test RPC request with parameters."""
        mock_response = {
            "jsonrpc": "2.0",
            "result": {"photos": []},
            "id": 1,
        }

        with patch("socket.socket") as mock_socket_class:
            mock_socket = MagicMock()
            mock_socket_class.return_value = mock_socket
            mock_socket.recv.return_value = json.dumps(mock_response).encode()

            result = tool._send_request(
                "get_photos", {"album_id": "test-album", "limit": 10}
            )

            assert result == {"photos": []}

            # Verify request was sent with parameters
            calls = mock_socket.sendall.call_args_list
            request_data = calls[0][0][0].decode()
            request = json.loads(request_data)
            assert request["method"] == "get_photos"
            assert request["params"]["album_id"] == "test-album"
            assert request["params"]["limit"] == 10

    def test_send_request_rpc_error(self, tool):
        """Test RPC error response handling."""
        mock_response = {
            "jsonrpc": "2.0",
            "error": {"code": -32600, "message": "Invalid request"},
            "id": 1,
        }

        with patch("socket.socket") as mock_socket_class:
            mock_socket = MagicMock()
            mock_socket_class.return_value = mock_socket
            mock_socket.recv.return_value = json.dumps(mock_response).encode()

            with pytest.raises(OsxphotosResponseError) as exc_info:
                tool._send_request("list_albums")

            assert "RPC error" in str(exc_info.value)
            assert "Invalid request" in str(exc_info.value)

    def test_send_request_socket_timeout(self, tool):
        """Test socket timeout handling."""
        with patch("socket.socket") as mock_socket_class:
            mock_socket = MagicMock()
            mock_socket_class.return_value = mock_socket
            mock_socket.connect.side_effect = socket.timeout()

            with pytest.raises(OsxphotosConnectionError) as exc_info:
                tool._send_request("list_albums")

            assert "Connection timeout" in str(exc_info.value)

    def test_send_request_connection_error(self, tool):
        """Test connection error handling."""
        with patch("socket.socket") as mock_socket_class:
            mock_socket = MagicMock()
            mock_socket_class.return_value = mock_socket
            mock_socket.connect.side_effect = ConnectionRefusedError("Refused")

            with pytest.raises(OsxphotosConnectionError) as exc_info:
                tool._send_request("list_albums")

            assert "Failed to connect" in str(exc_info.value)

    def test_send_request_invalid_json(self, tool):
        """Test invalid JSON response handling."""
        with patch("socket.socket") as mock_socket_class:
            mock_socket = MagicMock()
            mock_socket_class.return_value = mock_socket
            mock_socket.recv.return_value = b"not valid json {"

            with pytest.raises(OsxphotosResponseError) as exc_info:
                tool._send_request("list_albums")

            assert "Invalid JSON response" in str(exc_info.value)


class TestOsxphotosToolMethods:
    """Test high-level tool methods."""

    def test_list_albums_success(self, tool):
        """Test successful list_albums call."""
        mock_response = {
            "albums": [
                {
                    "id": "album-1",
                    "name": "Vacation",
                    "count": 42,
                    "type": "album",
                    "created": "2024-01-01T00:00:00Z",
                    "modified": "2024-01-15T00:00:00Z",
                },
                {
                    "id": "album-2",
                    "name": "Recent",
                    "count": 100,
                    "type": "smart",
                },
            ]
        }

        with patch.object(tool, "_send_request", return_value=mock_response):
            albums = tool.list_albums()

            assert len(albums) == 2
            assert albums[0]["name"] == "Vacation"
            assert albums[0]["count"] == 42
            assert albums[1]["name"] == "Recent"

    def test_list_albums_empty(self, tool):
        """Test list_albums with no albums."""
        with patch.object(tool, "_send_request", return_value={}):
            albums = tool.list_albums()

            assert albums == []

    def test_list_albums_missing_fields(self, tool):
        """Test list_albums fills in missing fields with defaults."""
        mock_response = {"albums": [{"name": "Test"}]}

        with patch.object(tool, "_send_request", return_value=mock_response):
            albums = tool.list_albums()

            assert len(albums) == 1
            assert albums[0]["name"] == "Test"
            assert albums[0]["id"] == ""
            assert albums[0]["count"] == 0
            assert albums[0]["type"] == "album"

    def test_get_photos_success(self, tool):
        """Test successful get_photos call."""
        mock_response = {
            "photos": [
                {
                    "id": "photo-1",
                    "filename": "IMG_001.jpg",
                    "size_bytes": 2048576,
                    "date_taken": "2024-01-15T10:30:00Z",
                    "album_id": "album-1",
                    "width": 3024,
                    "height": 4032,
                    "camera": "iPhone 15 Pro",
                },
                {
                    "id": "photo-2",
                    "filename": "IMG_002.jpg",
                    "size_bytes": 2097152,
                    "date_taken": "2024-01-15T10:31:00Z",
                    "album_id": "album-1",
                },
            ]
        }

        with patch.object(tool, "_send_request", return_value=mock_response):
            photos = tool.get_photos("album-1", limit=50)

            assert len(photos) == 2
            assert photos[0]["filename"] == "IMG_001.jpg"
            assert photos[1]["size_bytes"] == 2097152

    def test_get_photos_limit_clamping(self, tool):
        """Test get_photos clamps limit to 1-500 range."""
        with patch.object(tool, "_send_request") as mock_send:
            mock_send.return_value = {"photos": []}

            # Test upper limit
            tool.get_photos("album-1", limit=1000)
            call_args = mock_send.call_args
            assert call_args[0][1]["limit"] == 500

            # Test lower limit
            tool.get_photos("album-1", limit=0)
            call_args = mock_send.call_args
            assert call_args[0][1]["limit"] == 1

    def test_get_photos_with_metadata(self, tool):
        """Test get_photos with metadata flag."""
        with patch.object(tool, "_send_request") as mock_send:
            mock_send.return_value = {"photos": []}

            tool.get_photos("album-1", include_metadata=True)

            call_args = mock_send.call_args
            assert call_args[0][1]["include_metadata"] is True

    def test_request_export_success(self, tool):
        """Test successful request_export call."""
        mock_response = {
            "job_id": "job-123",
            "status": "queued",
            "count": 3,
            "album_id": "album-1",
            "export_path": "/export/path",
            "format": "original",
            "started_at": "2024-01-20T15:45:00Z",
            "error": None,
        }

        with patch.object(tool, "_send_request", return_value=mock_response):
            result = tool.request_export(
                album_id="album-1",
                photo_ids=["photo-1", "photo-2", "photo-3"],
                export_path="/export/path",
            )

            assert result["job_id"] == "job-123"
            assert result["status"] == "queued"
            assert result["count"] == 3

    def test_request_export_fills_defaults(self, tool):
        """Test request_export fills in defaults."""
        with patch.object(tool, "_send_request", return_value={}):
            result = tool.request_export(
                album_id="album-1",
                photo_ids=["p1", "p2"],
                export_path="/export",
            )

            assert result["job_id"] == ""
            assert result["status"] == "queued"
            assert result["count"] == 2
            assert result["error"] is None

    def test_get_export_status_success(self, tool):
        """Test successful get_export_status call."""
        mock_response = {
            "job_id": "job-123",
            "status": "running",
            "count": 5,
            "completed": 3,
            "error": None,
        }

        with patch.object(tool, "_send_request", return_value=mock_response):
            result = tool.get_export_status("job-123")

            assert result["job_id"] == "job-123"
            assert result["status"] == "running"
            assert result["completed"] == 3

    def test_search_photos_success(self, tool):
        """Test successful search_photos call."""
        mock_response = {
            "photos": [
                {"id": "p1", "filename": "test.jpg"},
                {"id": "p2", "filename": "test2.jpg"},
            ]
        }

        with patch.object(tool, "_send_request", return_value=mock_response):
            photos = tool.search_photos("test", limit=20)

            assert len(photos) == 2
            assert photos[0]["filename"] == "test.jpg"

    def test_search_photos_limit_clamping(self, tool):
        """Test search_photos clamps limit to 1-100 range."""
        with patch.object(tool, "_send_request") as mock_send:
            mock_send.return_value = {"photos": []}

            # Test upper limit
            tool.search_photos("query", limit=500)
            assert mock_send.call_args[0][1]["limit"] == 100

            # Test lower limit
            tool.search_photos("query", limit=-5)
            assert mock_send.call_args[0][1]["limit"] == 1


class TestOsxphotosToolExceptions:
    """Test exception hierarchy and handling."""

    def test_exception_hierarchy(self):
        """Test exception class hierarchy."""
        assert issubclass(OsxphotosConnectionError, OsxphotosError)
        assert issubclass(OsxphotosResponseError, OsxphotosError)
        assert issubclass(OsxphotosError, Exception)

    def test_connection_error_message(self):
        """Test connection error message clarity."""
        error = OsxphotosConnectionError(
            "osxphotos socket not found at /tmp/test.sock. "
            "Ensure the osxphotos supervisor is running."
        )
        assert "osxphotos supervisor" in str(error)

    def test_response_error_message(self):
        """Test response error message clarity."""
        error = OsxphotosResponseError("RPC error (code -32600): Invalid request")
        assert "RPC error" in str(error)
        assert "-32600" in str(error)


class TestOsxphotosIntegration:
    """Integration-style tests with realistic scenarios."""

    def test_full_workflow_list_and_export(self, tool):
        """Test realistic workflow: list albums, get photos, request export."""
        albums_response = {
            "albums": [
                {"id": "album-1", "name": "Vacation", "count": 10}
            ]
        }
        photos_response = {
            "photos": [
                {"id": "photo-1", "filename": "IMG_001.jpg"},
                {"id": "photo-2", "filename": "IMG_002.jpg"},
            ]
        }
        export_response = {
            "job_id": "job-123",
            "status": "queued",
            "count": 2,
        }

        with patch.object(
            tool, "_send_request"
        ) as mock_send:
            # Step 1: List albums
            mock_send.return_value = albums_response
            albums = tool.list_albums()
            assert len(albums) == 1
            assert albums[0]["name"] == "Vacation"

            # Step 2: Get photos from album
            mock_send.return_value = photos_response
            photos = tool.get_photos("album-1")
            assert len(photos) == 2

            # Step 3: Request export
            photo_ids = [p["id"] for p in photos]
            mock_send.return_value = export_response
            export = tool.request_export(
                "album-1", photo_ids, "/export/path"
            )
            assert export["job_id"] == "job-123"

    def test_error_recovery_sequence(self, tool):
        """Test handling multiple operations with one failure."""
        with patch.object(tool, "_send_request") as mock_send:
            # First operation succeeds
            mock_send.return_value = {"albums": [{"id": "a1", "name": "Test"}]}
            albums = tool.list_albums()
            assert len(albums) == 1

            # Second operation fails
            mock_send.side_effect = OsxphotosConnectionError("Connection lost")
            with pytest.raises(OsxphotosConnectionError):
                tool.get_photos("a1")

            # Reset mock for third operation
            mock_send.side_effect = None
            mock_send.return_value = {"albums": []}
            albums = tool.list_albums()
            assert albums == []
