"""Tests for FastAPI server endpoints"""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from httpx import ASGITransport, AsyncClient

from main import app


@pytest.mark.asyncio
async def test_health_check():
    """Test health check endpoint."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://testclient") as client:
        response = await client.get("/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] in ["ok", "degraded"]
        assert data["version"] == "1.0.0"


@pytest.mark.asyncio
async def test_agent_execute():
    """Test agent execution endpoint returns request metadata."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://testclient") as client:
        with patch("main.cagent_runtime", MagicMock()):
            request_data = {
                "agent_id": "test_agent",
                "input": {"input": "test data"},
                "context": {"source": "test"},
            }
            response = await client.post("/agent/execute", json=request_data)

    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "started"
    assert "request_id" in data
    assert data["request_id"] in data["message"]


@pytest.mark.asyncio
async def test_shutdown_endpoint():
    """Test shutdown endpoint."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://testclient") as client:
        with patch("main.cagent_runtime") as mock_runtime:
            mock_runtime.shutdown = AsyncMock(return_value=None)
            response = await client.post("/shutdown")

    assert response.status_code == 200
    assert response.json()["status"] == "shutting down"
