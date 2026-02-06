"""
Integration tests for JSON-RPC server and Unix socket communication.
"""

import asyncio
import json
import pytest
import tempfile
from pathlib import Path

# Import after ensuring we don't trigger network_lock in test runner
from python.sandboxed.jsonrpc_handler import JsonRpcHandler, JsonRpcError, JsonRpcErrorCode


@pytest.mark.asyncio
async def test_jsonrpc_ping():
    """Test simple ping method."""
    handler = JsonRpcHandler()

    async def handle_ping():
        return {"status": "ok"}

    handler.register("ping", handle_ping)

    request = {
        "jsonrpc": "2.0",
        "method": "ping",
        "id": 1,
    }

    response_data = await handler.handle(json.dumps(request).encode("utf-8"))
    response = json.loads(response_data.decode("utf-8"))

    assert response["id"] == 1
    assert response["result"]["status"] == "ok"


@pytest.mark.asyncio
async def test_jsonrpc_method_not_found():
    """Test method not found error."""
    handler = JsonRpcHandler()

    request = {
        "jsonrpc": "2.0",
        "method": "unknown_method",
        "id": 2,
    }

    response_data = await handler.handle(json.dumps(request).encode("utf-8"))
    response = json.loads(response_data.decode("utf-8"))

    assert response["id"] == 2
    assert response["error"]["code"] == JsonRpcErrorCode.METHOD_NOT_FOUND


@pytest.mark.asyncio
async def test_jsonrpc_invalid_params():
    """Test invalid parameters error."""
    handler = JsonRpcHandler()

    async def require_param(required_param):
        return {"param": required_param}

    handler.register("test_method", require_param)

    request = {
        "jsonrpc": "2.0",
        "method": "test_method",
        "params": {},  # Missing required_param
        "id": 3,
    }

    response_data = await handler.handle(json.dumps(request).encode("utf-8"))
    response = json.loads(response_data.decode("utf-8"))

    assert response["id"] == 3
    assert response["error"]["code"] == JsonRpcErrorCode.INVALID_PARAMS


@pytest.mark.asyncio
async def test_jsonrpc_notification():
    """Test notification (no response expected)."""
    handler = JsonRpcHandler()

    async def handle_notify():
        return {"notification": "received"}

    handler.register("notify", handle_notify)

    request = {
        "jsonrpc": "2.0",
        "method": "notify",
        # No 'id' field = notification
    }

    response_data = await handler.handle(json.dumps(request).encode("utf-8"))
    assert response_data == b""  # No response for notifications


@pytest.mark.asyncio
async def test_jsonrpc_parse_error():
    """Test parse error on invalid JSON."""
    handler = JsonRpcHandler()

    response_data = await handler.handle(b"invalid json {")
    response = json.loads(response_data.decode("utf-8"))

    assert response["error"]["code"] == JsonRpcErrorCode.PARSE_ERROR


@pytest.mark.asyncio
async def test_jsonrpc_with_positional_params():
    """Test method with positional parameters."""
    handler = JsonRpcHandler()

    async def add(a, b):
        return {"result": a + b}

    handler.register("add", add)

    request = {
        "jsonrpc": "2.0",
        "method": "add",
        "params": [5, 3],
        "id": 4,
    }

    response_data = await handler.handle(json.dumps(request).encode("utf-8"))
    response = json.loads(response_data.decode("utf-8"))

    assert response["result"]["result"] == 8


@pytest.mark.asyncio
async def test_jsonrpc_with_named_params():
    """Test method with named parameters."""
    handler = JsonRpcHandler()

    async def greet(name, greeting="Hello"):
        return {"message": f"{greeting}, {name}!"}

    handler.register("greet", greet)

    request = {
        "jsonrpc": "2.0",
        "method": "greet",
        "params": {"name": "Alice", "greeting": "Hi"},
        "id": 5,
    }

    response_data = await handler.handle(json.dumps(request).encode("utf-8"))
    response = json.loads(response_data.decode("utf-8"))

    assert response["result"]["message"] == "Hi, Alice!"


@pytest.mark.asyncio
async def test_jsonrpc_rpc_error():
    """Test method that raises JsonRpcError."""
    handler = JsonRpcHandler()

    async def failing_method():
        raise JsonRpcError(
            JsonRpcErrorCode.INVALID_REQUEST,
            "Custom error message",
        )

    handler.register("fail", failing_method)

    request = {
        "jsonrpc": "2.0",
        "method": "fail",
        "id": 6,
    }

    response_data = await handler.handle(json.dumps(request).encode("utf-8"))
    response = json.loads(response_data.decode("utf-8"))

    assert response["error"]["code"] == JsonRpcErrorCode.INVALID_REQUEST
    assert response["error"]["message"] == "Custom error message"
