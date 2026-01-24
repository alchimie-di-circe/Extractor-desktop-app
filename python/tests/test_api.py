"""Tests for FastAPI server endpoints"""

import pytest
from httpx import AsyncClient
from main import app


@pytest.mark.asyncio
async def test_health_check():
    """Test health check endpoint"""
    async with AsyncClient(app=app, base_url="http://test") as client:
        response = await client.get("/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "ok"
        assert data["version"] == "1.0.0"


@pytest.mark.asyncio
async def test_agent_execute():
    """Test agent execution endpoint with placeholder"""
    async with AsyncClient(app=app, base_url="http://test") as client:
        request_data = {
            "agent_id": "test_agent",
            "input": {"test": "data"},
            "context": {"source": "test"},
        }
        response = await client.post("/agent/execute", json=request_data)
        assert response.status_code == 200
        data = response.json()
        assert data["agent_id"] == "test_agent"
        assert data["result"]["status"] == "placeholder"


@pytest.mark.asyncio
async def test_shutdown_endpoint():
    """Test shutdown endpoint"""
    async with AsyncClient(app=app, base_url="http://test") as client:
        response = await client.post("/shutdown")
        assert response.status_code == 200
        assert response.json()["status"] == "shutting down"
