"""
Sandboxed osxphotos server - Unix domain socket server with JSON-RPC 2.0.

CRITICAL: network_lock must be the FIRST import to enable socket restrictions.
"""

# CRITICAL: Import network_lock FIRST to install socket restriction
import python.sandboxed.network_lock  # noqa: F401

import asyncio
import logging
import os
import signal
import stat
import sys
from pathlib import Path

from jsonrpc_handler import JsonRpcHandler, JsonRpcError, JsonRpcErrorCode
from python.sandboxed.photos_service import PhotosService, PhotosServiceError
from python.sandboxed.path_whitelist import validate_export_path, SecurityError


logger = logging.getLogger(__name__)
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    stream=sys.stdout,
)


class OsxphotosServer:
    """Unix domain socket server for sandboxed osxphotos."""

    def __init__(
        self,
        socket_path: str = None,
    ):
        """Initialize server."""
        # Use per-user private directory for socket (TOCTOU mitigation)
        if socket_path is None:
            uid = os.getuid()
            socket_path = f"/tmp/trae-osxphotos-{uid}/server.sock"
        self.socket_path = socket_path
        self.handler = JsonRpcHandler()
        self.server = None
        self.shutdown_event = None
        self.photos_service = PhotosService()

        # Register methods
        self._register_methods()

    def _register_methods(self) -> None:
        """Register JSON-RPC methods."""
        self.handler.register("ping", self.handle_ping)
        self.handler.register("list_albums", self.handle_list_albums)
        self.handler.register("get_photos", self.handle_get_photos)
        self.handler.register("export_photo", self.handle_export_photo)

    async def handle_ping(self) -> dict:
        """Simple ping method for health checks."""
        return {"status": "ok", "message": "pong"}

    async def handle_list_albums(self) -> dict:
        """List available albums."""
        try:
            albums = await self.photos_service.list_albums()
            return {"albums": albums}
        except PhotosServiceError as e:
            logger.error(f"Photos service error: {e}")
            return {
                "success": False,
                "error": {"code": "SERVICE_ERROR", "message": str(e)},
            }
        except Exception as e:
            logger.error(f"Unexpected error listing albums: {e}", exc_info=True)
            return {
                "success": False,
                "error": {"code": "INTERNAL_ERROR", "message": "Failed to list albums"},
            }

    async def handle_get_photos(self, album_id: str, limit: int = 100, offset: int = 0) -> dict:
        """Get photos from album."""
        try:
            result = await self.photos_service.get_photos(album_id, limit=limit, offset=offset)
            return result
        except PhotosServiceError as e:
            logger.error(f"Photos service error: {e}")
            return {
                "success": False,
                "error": {"code": "SERVICE_ERROR", "message": str(e)},
            }
        except Exception as e:
            logger.error(f"Unexpected error getting photos: {e}", exc_info=True)
            return {
                "success": False,
                "error": {"code": "INTERNAL_ERROR", "message": "Failed to get photos"},
            }

    async def handle_export_photo(self, photo_id: str, export_path: str) -> dict:
        """Export a photo to disk."""
        try:
            # Validate export path against whitelist (defense-in-depth)
            try:
                validated_path = validate_export_path(export_path)
            except SecurityError as e:
                logger.warning(f"Export path validation failed: {e}")
                return {
                    "success": False,
                    "error": {"code": "SECURITY_ERROR", "message": str(e)},
                }

            result = await self.photos_service.export_photo(photo_id, validated_path)
            return {"success": True, "data": result}
        except PhotosServiceError as e:
            logger.error(f"Photos service error: {e}")
            return {
                "success": False,
                "error": {"code": "SERVICE_ERROR", "message": str(e)},
            }
        except Exception as e:
            logger.error(f"Unexpected error exporting photo: {e}", exc_info=True)
            return {
                "success": False,
                "error": {"code": "INTERNAL_ERROR", "message": "Failed to export photo"},
            }

    async def handle_client(
        self, reader: asyncio.StreamReader, writer: asyncio.StreamWriter
    ) -> None:
        """Handle a client connection."""
        addr = writer.get_extra_info("peername")
        logger.info(f"Client connected: {addr}")

        try:
            while not self.shutdown_event.is_set():
                # Read request (format: 4-byte length + JSON)
                try:
                    length_bytes = await asyncio.wait_for(reader.readexactly(4), timeout=30.0)
                except asyncio.TimeoutError:
                    logger.debug(f"Timeout waiting for data from {addr}")
                    break
                except asyncio.IncompleteReadError:
                    logger.debug(f"Client {addr} disconnected")
                    break

                length = int.from_bytes(length_bytes, byteorder="big")
                if length > 1024 * 1024:  # 1MB max request
                    logger.error(f"Request too large from {addr}: {length}")
                    break

                try:
                    request_data = await asyncio.wait_for(reader.readexactly(length), timeout=30.0)
                except asyncio.TimeoutError:
                    logger.error(f"Timeout reading request from {addr}")
                    break

                # Handle request
                try:
                    response_data = await self.handler.handle(request_data)
                except Exception as e:
                    logger.error(f"Error handling request: {e}", exc_info=True)
                    break

                # Send response
                if response_data:
                    response_length = len(response_data).to_bytes(4, byteorder="big")
                    writer.write(response_length + response_data)
                    await writer.drain()

        except Exception as e:
            logger.error(f"Error with client {addr}: {e}", exc_info=True)
        finally:
            writer.close()
            await writer.wait_closed()
            logger.info(f"Client {addr} disconnected")

    async def start(self) -> None:
        """Start the server."""
        # Initialize shutdown event in the running loop (Python 3.9 compatibility)
        self.shutdown_event = asyncio.Event()

        # Create private socket directory with restrictive permissions (TOCTOU mitigation)
        socket_file = Path(self.socket_path)
        socket_dir = socket_file.parent
        if not socket_dir.exists():
            socket_dir.mkdir(mode=0o700, parents=True, exist_ok=True)
            logger.info(f"Created private socket directory: {socket_dir}")
        else:
            # Verify ownership and permissions on existing directory
            dir_stat = socket_dir.stat()
            current_uid = os.getuid()
            dir_mode = stat.S_IMODE(dir_stat.st_mode)

            if dir_stat.st_uid != current_uid:
                raise RuntimeError(
                    f"Socket directory {socket_dir} is owned by uid {dir_stat.st_uid}, "
                    f"expected {current_uid}. Directory may have been compromised."
                )

            if dir_mode != 0o700:
                logger.warning(f"Fixing insecure permissions on socket directory {socket_dir}")
                os.chmod(str(socket_dir), 0o700)

        # Remove old socket if it exists
        if socket_file.exists():
            socket_file.unlink()
            logger.info(f"Removed stale socket: {self.socket_path}")

        # Set umask to restrict socket file creation permissions
        old_umask = os.umask(0o077)
        try:
            # Create server
            self.server = await asyncio.start_unix_server(
                self.handle_client, path=self.socket_path
            )

            # Set socket permissions explicitly (accessible only to owner)
            os.chmod(self.socket_path, 0o600)

            logger.info(f"Server listening on: {self.socket_path}")

            # Wait for shutdown
            async with self.server:
                await self.shutdown_event.wait()

            logger.info("Server shutting down")
        finally:
            # Restore old umask
            os.umask(old_umask)

    async def shutdown(self) -> None:
        """Trigger shutdown."""
        logger.info("Shutdown signal received")
        self.shutdown_event.set()


async def main() -> None:
    """Main entry point."""
    server = OsxphotosServer()

    # Handle signals
    def signal_handler(sig: int, frame) -> None:
        logger.info(f"Signal {sig} received")
        asyncio.create_task(server.shutdown())

    signal.signal(signal.SIGTERM, signal_handler)
    signal.signal(signal.SIGINT, signal_handler)

    try:
        await server.start()
    except Exception as e:
        logger.error(f"Server error: {e}", exc_info=True)
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())
