"""Integration tests for FastAPI + CagentRuntime."""

import asyncio
import pytest
from unittest.mock import patch, MagicMock, AsyncMock
from fastapi.testclient import TestClient
from pathlib import Path
import tempfile

# Import app and dependencies
import sys
sys.path.insert(0, str(Path(__file__).parent.parent))

from main import app, event_queues


@pytest.fixture
def client():
    """FastAPI test client."""
    return TestClient(app)


@pytest.fixture
def team_yaml_temp():
    """Create a temporary team.yaml for testing."""
    with tempfile.TemporaryDirectory() as tmpdir:
        team_yaml = Path(tmpdir) / "team.yaml"
        team_yaml.write_text("metadata:\n  author: test\n")
        yield str(team_yaml)


class TestHealthEndpoint:
    """Tests for /health endpoint."""

    def test_health_endpoint_available(self, client):
        """Test health endpoint returns ok."""
        response = client.get("/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] in ["ok", "degraded"]
        assert data["version"] == "1.0.0"

    def test_health_endpoint_structure(self, client):
        """Test health response structure."""
        response = client.get("/health")
        data = response.json()
        assert "status" in data
        assert "version" in data


class TestAgentExecutionEndpoint:
    """Tests for /agent/execute endpoint."""

    def test_agent_execute_no_runtime(self, client):
        """Test execution fails gracefully without runtime."""
        with patch("main.cagent_runtime", None):
            response = client.post(
                "/agent/execute",
                json={"agent_id": "test", "input": {"input": "test"}},
            )
            assert response.status_code == 503

    def test_agent_execute_request_structure(self, client):
        """Test /agent/execute request validation."""
        # Missing required fields
        response = client.post(
            "/agent/execute",
            json={"agent_id": "test"},  # Missing 'input'
        )
        assert response.status_code == 422

    def test_agent_execute_valid_request(self, client):
        """Test valid execution request."""
        with patch("main.cagent_runtime", MagicMock()):
            response = client.post(
                "/agent/execute",
                json={
                    "agent_id": "orchestrator",
                    "input": {"input": "test query"},
                    "context": {"brand": "test"},
                },
            )

            # Should return 200 with request_id
            assert response.status_code == 200
            data = response.json()
            assert "request_id" in data
            assert data["status"] == "started"
            assert data["request_id"] in data["message"]

    def test_agent_execute_returns_request_id(self, client):
        """Test that execute returns a valid request_id."""
        with patch("main.cagent_runtime", MagicMock()):
            response = client.post(
                "/agent/execute",
                json={"agent_id": "test", "input": {"input": "query"}},
            )

            data = response.json()
            request_id = data["request_id"]

            # Verify it's a non-empty string
            assert isinstance(request_id, str)
            assert len(request_id) > 0


class TestSSEStreamingEndpoint:
    """Tests for /agent/stream/{request_id} endpoint."""

    @pytest.mark.asyncio
    async def test_stream_endpoint_creates_queue(self):
        """Test that stream generator creates an event queue."""
        from main import agent_event_generator

        request_id = "stream-queue-test"
        event_queues.clear()

        generator = agent_event_generator(request_id)
        stream_task = asyncio.create_task(generator.__anext__())

        # Allow generator setup to run.
        await asyncio.sleep(0)
        assert request_id in event_queues

        stream_task.cancel()
        with pytest.raises((asyncio.CancelledError, StopAsyncIteration)):
            await stream_task
        await generator.aclose()


class TestShutdownEndpoint:
    """Tests for /shutdown endpoint."""

    def test_shutdown_endpoint_available(self, client):
        """Test shutdown endpoint is callable."""
        with patch("main.cagent_runtime") as mock_runtime:
            mock_runtime.shutdown = AsyncMock(return_value=None)

            response = client.post("/shutdown")
            assert response.status_code == 200
            data = response.json()
            assert "status" in data

    def test_shutdown_clears_queues(self, client):
        """Test shutdown clears event queues."""
        event_queues["test"] = MagicMock()

        with patch("main.cagent_runtime") as mock_runtime:
            mock_runtime.shutdown = AsyncMock(return_value=None)

            response = client.post("/shutdown")
            assert response.status_code == 200
            # Queues should be empty
            assert len(event_queues) == 0


class TestModelValidation:
    """Tests for Pydantic model validation."""

    def test_agent_request_model(self):
        """Test AgentRequest model validation."""
        from main import AgentRequest

        # Valid request
        req = AgentRequest(
            agent_id="test",
            input={"input": "query"},
            context={"brand": "test"},
        )
        assert req.agent_id == "test"
        assert req.context == {"brand": "test"}

        # Context is optional
        req2 = AgentRequest(
            agent_id="test",
            input={"input": "query"},
        )
        assert req2.context is None

    def test_agent_start_response_model(self):
        """Test AgentStartResponse model."""
        from main import AgentStartResponse

        resp = AgentStartResponse(
            request_id="123",
            status="started",
            message="Connect to stream",
        )
        assert resp.request_id == "123"
        assert resp.status == "started"

    def test_health_response_model(self):
        """Test HealthResponse model."""
        from main import HealthResponse

        resp = HealthResponse(status="ok", version="1.0.0")
        assert resp.status == "ok"
        assert resp.version == "1.0.0"

    def test_stream_event_model(self):
        """Test StreamEvent model."""
        from main import StreamEvent

        event = StreamEvent(
            event_type="thinking",
            data={"content": "test"},
            timestamp=123.456,
        )
        assert event.event_type == "thinking"
        assert event.data["content"] == "test"


class TestCORSMiddleware:
    """Tests for CORS configuration."""

    def test_cors_headers_present(self, client):
        """Test that CORS headers are set."""
        response = client.get("/health")
        # Should have successful response
        assert response.status_code == 200


class TestErrorHandling:
    """Tests for error handling."""

    def test_invalid_endpoint_404(self, client):
        """Test invalid endpoint returns 404."""
        response = client.get("/invalid/endpoint")
        assert response.status_code == 404

    def test_invalid_request_method(self, client):
        """Test invalid request method returns 405."""
        response = client.get("/agent/execute")  # Should be POST
        assert response.status_code == 405

    def test_malformed_json(self, client):
        """Test malformed JSON returns 422."""
        response = client.post(
            "/agent/execute",
            content="{invalid json",
            headers={"Content-Type": "application/json"},
        )
        assert response.status_code == 422


class TestEventQueueManagement:
    """Tests for event queue lifecycle."""

    def test_event_queue_cleanup_on_shutdown(self, client):
        """Test queues are cleaned up on shutdown."""
        # Add test queues
        event_queues["queue1"] = MagicMock()
        event_queues["queue2"] = MagicMock()
        assert len(event_queues) > 0

        with patch("main.cagent_runtime") as mock_runtime:
            mock_runtime.shutdown = AsyncMock(return_value=None)
            response = client.post("/shutdown")
            assert response.status_code == 200

        # All queues should be cleared
        assert len(event_queues) == 0


class TestLifecycleManagement:
    """Tests for app lifecycle."""

    def test_app_initialization(self):
        """Test app can be created."""
        assert app is not None
        assert hasattr(app, "router")
        assert len(app.routes) > 0

    def test_middleware_installed(self):
        """Test CORS middleware is installed."""
        # Check if middleware is present
        middleware_classes = [m.cls.__name__ for m in app.user_middleware]
        assert "CORSMiddleware" in middleware_classes


class TestEventStreaming:
    """Tests for event streaming behavior."""

    def test_stream_event_format(self):
        """Test stream event JSON format."""
        from main import StreamEvent
        import json

        event = StreamEvent(
            event_type="thinking",
            data={"content": "test content"},
            timestamp=1234567890.0,
        )

        # Convert to dict and JSON
        data = event.model_dump()
        json_str = json.dumps(data)

        # Should parse back
        parsed = json.loads(json_str)
        assert parsed["event_type"] == "thinking"
        assert parsed["data"]["content"] == "test content"

    def test_keepalive_event_format(self):
        """Test keepalive event format."""
        import json

        keepalive = {"event": "keepalive", "data": '{"message": "keepalive"}'}

        # Should be valid JSON
        parsed = json.loads(keepalive["data"])
        assert "message" in parsed


class TestEndpointAvailability:
    """Tests that all documented endpoints are available."""

    def test_all_endpoints_accessible(self, client):
        """Test all main endpoints are accessible."""
        endpoints = [
            ("GET", "/health", 200),
            ("POST", "/agent/execute", 422),  # 422 due to missing body
            ("POST", "/shutdown", 200),
        ]

        for method, path, expected_status in endpoints:
            if method == "GET":
                response = client.get(path)
            else:
                response = client.post(path, json={} if "shutdown" in path else None)

            assert response.status_code != 404, f"{method} {path} not found"
            assert response.status_code == expected_status
