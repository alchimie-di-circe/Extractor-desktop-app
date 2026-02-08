"""
JSON-RPC 2.0 Handler - Dispatches method calls over Unix domain sockets.

Implements JSON-RPC 2.0 specification:
- Request/Response protocol
- Error codes and messages
- Method dispatch with validation
"""

import json
import logging
from typing import Any, Callable, Dict, Optional, Union

logger = logging.getLogger(__name__)


class JsonRpcError(Exception):
    """JSON-RPC error with code and message."""

    def __init__(self, code: int, message: str, data: Any = None):
        self.code = code
        self.message = message
        self.data = data
        super().__init__(message)


# Standard JSON-RPC 2.0 error codes
class JsonRpcErrorCode:
    """JSON-RPC 2.0 error codes."""

    PARSE_ERROR = -32700
    INVALID_REQUEST = -32600
    METHOD_NOT_FOUND = -32601
    INVALID_PARAMS = -32602
    INTERNAL_ERROR = -32603
    SERVER_ERROR_START = -32099
    SERVER_ERROR_END = -32000


class JsonRpcHandler:
    """Handles JSON-RPC 2.0 requests and dispatches to registered methods."""

    def __init__(self):
        """Initialize the handler."""
        self.methods: Dict[str, Callable] = {}

    def register(self, name: str, method: Callable) -> None:
        """
        Register a method handler.

        Args:
            name: Method name
            method: Callable that handles the method
        """
        self.methods[name] = method
        logger.info(f"Registered method: {name}")

    async def handle(self, request_data: bytes) -> bytes:
        """
        Handle a JSON-RPC 2.0 request.

        Args:
            request_data: Raw request bytes (JSON)

        Returns:
            Response bytes (JSON) or empty if notification
        """
        try:
            # Parse request
            request_text = request_data.decode("utf-8")
            request = json.loads(request_text)
        except (UnicodeDecodeError, json.JSONDecodeError) as e:
            logger.error(f"Parse error: {e}")
            return self._error_response(
                None, JsonRpcErrorCode.PARSE_ERROR, f"Parse error: {e}"
            )

        # Handle single request or batch
        if isinstance(request, list):
            return await self._handle_batch(request)
        else:
            return await self._handle_single(request)

    async def _handle_single(self, request: Dict[str, Any]) -> bytes:
        """Handle a single JSON-RPC request."""
        try:
            # Validate request structure
            if not isinstance(request, dict):
                return self._error_response(
                    None, JsonRpcErrorCode.INVALID_REQUEST, "Request must be object"
                )

            jsonrpc_version = request.get("jsonrpc")
            method = request.get("method")
            params = request.get("params", {})
            request_id = request.get("id")

            # Validate required fields
            if jsonrpc_version != "2.0":
                return self._error_response(
                    request_id,
                    JsonRpcErrorCode.INVALID_REQUEST,
                    "Invalid or missing jsonrpc version",
                )

            if not isinstance(method, str):
                return self._error_response(
                    request_id,
                    JsonRpcErrorCode.INVALID_REQUEST,
                    "Method must be string",
                )

            # Method not found
            if method not in self.methods:
                return self._error_response(
                    request_id,
                    JsonRpcErrorCode.METHOD_NOT_FOUND,
                    f"Method not found: {method}",
                )

            # Call method
            try:
                if isinstance(params, list):
                    result = await self.methods[method](*params)
                else:
                    result = await self.methods[method](**params)
            except TypeError as e:
                logger.error(f"Invalid params for {method}: {e}")
                return self._error_response(
                    request_id,
                    JsonRpcErrorCode.INVALID_PARAMS,
                    f"Invalid params: {e}",
                )
            except JsonRpcError as e:
                return self._error_response(request_id, e.code, e.message, e.data)
            except Exception as e:
                logger.error(f"Internal error in {method}: {e}", exc_info=True)
                return self._error_response(
                    request_id,
                    JsonRpcErrorCode.INTERNAL_ERROR,
                    f"Internal error: {e}",
                )

            # Return response (skip for notifications)
            if request_id is None:
                return b""

            return self._success_response(request_id, result)

        except Exception as e:
            logger.error(f"Unhandled error: {e}", exc_info=True)
            return self._error_response(
                None,
                JsonRpcErrorCode.INTERNAL_ERROR,
                f"Unhandled error: {e}",
            )

    async def _handle_batch(self, requests: list) -> bytes:
        """Handle a batch of JSON-RPC requests."""
        responses = []

        for request in requests:
            response = await self._handle_single(request)
            if response:  # Skip notification responses
                responses.append(json.loads(response.decode("utf-8")))

        if not responses:
            return b""

        return json.dumps(responses).encode("utf-8")

    def _success_response(self, request_id: Any, result: Any) -> bytes:
        """Create a success response."""
        response = {
            "jsonrpc": "2.0",
            "id": request_id,
            "result": result,
        }
        return json.dumps(response).encode("utf-8")

    def _error_response(
        self, request_id: Any, code: int, message: str, data: Any = None
    ) -> bytes:
        """Create an error response."""
        response = {
            "jsonrpc": "2.0",
            "id": request_id,
            "error": {
                "code": code,
                "message": message,
            },
        }
        if data is not None:
            response["error"]["data"] = data

        return json.dumps(response).encode("utf-8")
