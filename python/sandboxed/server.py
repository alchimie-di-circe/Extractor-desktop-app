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
import sys
from pathlib import Path

from jsonrpc_handler import JsonRpcHandler, JsonRpcError, JsonRpcErrorCode


logger = logging.getLogger(__name__)
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    stream=sys.stdout,
)


class OsxphotosServer:
    """Unix domain socket server for sandboxed osxphotos."""

    def __init__(self, socket_path: str = "/tmp/trae-osxphotos.sock"):
        """Initialize server."""
        self.socket_path = socket_path
        self.handler = JsonRpcHandler()
        self.server = None
        self.shutdown_event = asyncio.Event()

        # Register methods
        self._register_methods()

    def _register_methods(self) -> None:
        """Register JSON-RPC methods."""
        self.handler.register("ping", self.handle_ping)
        self.handler.register("list_albums", self.handle_list_albums)
        self.handler.register("get_photos", self.handle_get_photos)

    async def handle_ping(self) -> dict:
        """Simple ping method for health checks."""
        return {"status": "ok", "message": "pong"}

    async def handle_list_albums(self) -> dict:
        """List available albums (placeholder)."""
        # TODO: Implement with osxphotos.PhotosDB
        return {
            "albums": [
                {"id": "1", "name": "Library", "count": 100},
            ]
        }

    async def handle_get_photos(self, album_id: str) -> dict:
        """Get photos from album (placeholder)."""
        # TODO: Implement with osxphotos.PhotosDB
        return {"album_id": album_id, "photos": []}

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
                    length_bytes = await asyncio.wait_for(reader.readexactly(4), timeout=5.0)
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
                    request_data = await asyncio.wait_for(reader.readexactly(length), timeout=5.0)
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
        # Remove old socket if it exists
        socket_file = Path(self.socket_path)
        if socket_file.exists():
            socket_file.unlink()
            logger.info(f"Removed stale socket: {self.socket_path}")

        # Create server
        self.server = await asyncio.start_unix_server(
            self.handle_client, path=self.socket_path
        )

        # Set socket permissions (accessible only to owner)
        os.chmod(self.socket_path, 0o600)

        logger.info(f"Server listening on: {self.socket_path}")

        # Wait for shutdown
        async with self.server:
            await self.shutdown_event.wait()

        logger.info("Server shutting down")

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
