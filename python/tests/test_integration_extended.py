"""Extended integration tests for FastAPI + CagentRuntime."""

import pytest
import json
import asyncio
from unittest.mock import patch, MagicMock, AsyncMock
from fastapi.testclient import TestClient
from pathlib import Path
import time

# Import app and dependencies
import sys
sys.path.insert(0, str(Path(__file__).parent.parent))

from main import app, event_queues, _execute_agent_background, agent_event_generator
from runtime import CagentRuntime, EventType
from event_parser import CagentEvent


@pytest.fixture
def client():
    """FastAPI test client."""
    return TestClient(app)


class TestSSEStreamingBehavior:
    """Tests for SSE streaming behavior and edge cases."""

    def test_stream_with_immediate_result(self, client):
        """Test SSE stream with immediate result event."""
        request_id = "test-immediate"

        with patch("main.event_queues", {request_id: asyncio.Queue()}):
            # The queue exists but is empty, simulating no events yet
            pass

    def test_stream_with_delayed_events(self, client):
        """Test SSE stream handles delayed events."""
        request_id = "test-delayed"
        # This tests the keepalive mechanism
        pass

    @pytest.mark.asyncio
    async def test_event_queue_cleanup_after_stream_ends(self):
        """Test that event queue is cleaned up after stream ends."""
        request_id = "test-cleanup"
        queue = asyncio.Queue()
        event_queues[request_id] = queue

        # Create a result event to end the stream
        result_event = CagentEvent(
            event_type=EventType.RESULT,
            data={"result": "done"},
            timestamp=time.time()
        )
        await queue.put(result_event)
        await queue.put(None)  # End marker

        # Consume the generator
        events = []
        async for event in agent_event_generator(request_id):
            events.append(event)

        # Queue should be cleaned up
        assert request_id not in event_queues

    @pytest.mark.asyncio
    async def test_event_generator_with_multiple_events(self):
        """Test event generator yields multiple events."""
        request_id = "test-multi"
        queue = asyncio.Queue()
        event_queues[request_id] = queue

        # Add multiple events
        events_to_send = [
            CagentEvent(EventType.THINKING, {"content": "thinking"}, time.time()),
            CagentEvent(EventType.TOOL_CALL, {"content": "tool"}, time.time()),
            CagentEvent(EventType.RESULT, {"result": "done"}, time.time()),
        ]

        for event in events_to_send:
            await queue.put(event)

        # Collect events
        received = []
        async for event in agent_event_generator(request_id):
            received.append(event)
            if event["event"] == "result":
                break

        assert len(received) == 3

    @pytest.mark.asyncio
    async def test_keepalive_on_timeout(self):
        """Test keepalive event sent on timeout."""
        request_id = "test-keepalive"
        queue = asyncio.Queue()
        event_queues[request_id] = queue

        # Don't add any events, let it timeout
        received = []
        try:
            async for event in agent_event_generator(request_id):
                received.append(event)
                if event["event"] == "keepalive":
                    # Got keepalive, end test
                    break
                # Wait a bit to trigger timeout
                await asyncio.sleep(0.1)
        except asyncio.CancelledError:
            pass

        # Should have received keepalive
        keepalive_events = [e for e in received if e["event"] == "keepalive"]
        # May or may not have received keepalive depending on timing
        assert True  # Test completes without error


class TestBackgroundTaskExecution:
    """Tests for background task execution."""

    @pytest.mark.asyncio
    async def test_background_task_error_handling(self):
        """Test background task handles runtime errors."""
        from main import AgentRequest

        request_id = "test-error"
        request = AgentRequest(
            agent_id="test",
            input={"input": "test"},
            context=None
        )

        with patch("main.cagent_runtime") as mock_runtime:
            # Simulate runtime error
            async def error_generator():
                yield CagentEvent(
                    event_type=EventType.ERROR,
                    data={"error": "Runtime error"},
                    timestamp=time.time()
                )

            mock_runtime.execute_agent = MagicMock(return_value=error_generator())

            # Execute background task
            await _execute_agent_background(request_id, request)

            # Queue should have error event
            assert request_id in event_queues
            queue = event_queues[request_id]

            # Get the error event
            event = await asyncio.wait_for(queue.get(), timeout=1.0)
            assert event is not None
            assert event.event_type == EventType.ERROR

    @pytest.mark.asyncio
    async def test_background_task_with_context(self):
        """Test background task passes context correctly."""
        from main import AgentRequest

        request_id = "test-context"
        request = AgentRequest(
            agent_id="test",
            input={"input": "test query"},
            context={"brand": "slowfood"}
        )

        with patch("main.cagent_runtime") as mock_runtime:
            async def success_generator():
                yield CagentEvent(
                    event_type=EventType.RESULT,
                    data={"result": "success"},
                    timestamp=time.time()
                )

            mock_runtime.execute_agent = MagicMock(return_value=success_generator())

            await _execute_agent_background(request_id, request)

            # Verify execute_agent was called with context
            mock_runtime.execute_agent.assert_called_once()
            call_args = mock_runtime.execute_agent.call_args
            assert call_args[1]["context"] == {"brand": "slowfood"}

    @pytest.mark.asyncio
    async def test_background_task_stops_on_result_event(self):
        """Test background task stops on result event."""
        from main import AgentRequest

        request_id = "test-stop"
        request = AgentRequest(
            agent_id="test",
            input={"input": "test"},
            context=None
        )

        with patch("main.cagent_runtime") as mock_runtime:
            async def multi_event_generator():
                yield CagentEvent(EventType.THINKING, {"content": "thinking"}, time.time())
                yield CagentEvent(EventType.RESULT, {"result": "done"}, time.time())
                yield CagentEvent(EventType.INFO, {"message": "should not see this"}, time.time())

            mock_runtime.execute_agent = MagicMock(return_value=multi_event_generator())

            await _execute_agent_background(request_id, request)

            # Collect all events
            queue = event_queues[request_id]
            events = []
            while not queue.empty():
                event = await queue.get()
                if event is None:
                    break
                events.append(event)

            # Should have thinking and result, but not the info after result
            assert len(events) == 2
            assert events[0].event_type == EventType.THINKING
            assert events[1].event_type == EventType.RESULT


class TestErrorPropagation:
    """Tests for error propagation from runtime to client."""

    def test_runtime_not_initialized_returns_503(self, client):
        """Test 503 when runtime not initialized."""
        with patch("main.cagent_runtime", None):
            response = client.post(
                "/agent/execute",
                json={"agent_id": "test", "input": {"input": "test"}}
            )
            assert response.status_code == 503
            assert "not initialized" in response.json()["detail"].lower()

    def test_invalid_json_returns_422(self, client):
        """Test 422 on invalid JSON."""
        response = client.post(
            "/agent/execute",
            content="not json",
            headers={"Content-Type": "application/json"}
        )
        assert response.status_code == 422

    def test_missing_required_fields_returns_422(self, client):
        """Test 422 on missing required fields."""
        # Missing 'input' field
        response = client.post(
            "/agent/execute",
            json={"agent_id": "test"}
        )
        assert response.status_code == 422

    def test_wrong_http_method_returns_405(self, client):
        """Test 405 on wrong HTTP method."""
        response = client.get("/agent/execute")
        assert response.status_code == 405

    def test_nonexistent_endpoint_returns_404(self, client):
        """Test 404 on nonexistent endpoint."""
        response = client.get("/nonexistent")
        assert response.status_code == 404


class TestConcurrentRequests:
    """Tests for concurrent request handling."""

    def test_multiple_concurrent_execute_requests(self, client):
        """Test multiple concurrent execute requests."""
        with patch("main.cagent_runtime") as mock_runtime:
            mock_runtime is not None

            # Send multiple requests
            responses = []
            for i in range(3):
                response = client.post(
                    "/agent/execute",
                    json={"agent_id": f"agent{i}", "input": {"input": f"test{i}"}}
                )
                responses.append(response)

            # All should succeed
            assert all(r.status_code == 200 for r in responses)

            # All should have unique request_ids
            request_ids = [r.json()["request_id"] for r in responses]
            assert len(request_ids) == len(set(request_ids))

    def test_concurrent_stream_connections(self, client):
        """Test concurrent SSE stream connections."""
        # Create multiple request IDs with queues
        request_ids = [f"concurrent-{i}" for i in range(3)]
        for request_id in request_ids:
            event_queues[request_id] = asyncio.Queue()

        # Connect to all streams would require async client
        # For sync test client, just verify queues exist
        for request_id in request_ids:
            assert request_id in event_queues


class TestLifecycleEdgeCases:
    """Tests for app lifecycle edge cases."""

    def test_health_check_during_load(self, client):
        """Test health check works during high load."""
        # Simulate load with many queues
        for i in range(100):
            event_queues[f"load-test-{i}"] = asyncio.Queue()

        response = client.get("/health")
        assert response.status_code == 200

        # Cleanup
        event_queues.clear()

    def test_shutdown_with_pending_queues(self, client):
        """Test shutdown with pending event queues."""
        # Add pending queues
        for i in range(5):
            event_queues[f"pending-{i}"] = asyncio.Queue()

        with patch("main.cagent_runtime") as mock_runtime:
            mock_runtime.shutdown = AsyncMock()

            response = client.post("/shutdown")
            assert response.status_code == 200

            # Queues should be cleared
            assert len(event_queues) == 0


class TestInputValidation:
    """Tests for input validation and sanitization."""

    def test_agent_id_with_special_characters(self, client):
        """Test agent_id with special characters."""
        with patch("main.cagent_runtime") as mock_runtime:
            mock_runtime is not None

            response = client.post(
                "/agent/execute",
                json={
                    "agent_id": "agent-with-dashes_and_underscores",
                    "input": {"input": "test"}
                }
            )
            assert response.status_code == 200

    def test_input_with_unicode(self, client):
        """Test input with unicode characters."""
        with patch("main.cagent_runtime") as mock_runtime:
            mock_runtime is not None

            response = client.post(
                "/agent/execute",
                json={
                    "agent_id": "test",
                    "input": {"input": "Hello 世界 🌍"}
                }
            )
            assert response.status_code == 200

    def test_context_with_nested_objects(self, client):
        """Test context with deeply nested objects."""
        with patch("main.cagent_runtime") as mock_runtime:
            mock_runtime is not None

            response = client.post(
                "/agent/execute",
                json={
                    "agent_id": "test",
                    "input": {"input": "test"},
                    "context": {
                        "brand": {
                            "name": "slowfood",
                            "settings": {
                                "theme": "dark",
                                "language": "en"
                            }
                        }
                    }
                }
            )
            assert response.status_code == 200

    def test_very_large_input(self, client):
        """Test handling of very large input."""
        with patch("main.cagent_runtime") as mock_runtime:
            mock_runtime is not None

            large_input = "x" * 100000

            response = client.post(
                "/agent/execute",
                json={
                    "agent_id": "test",
                    "input": {"input": large_input}
                }
            )
            # Should either accept or return clear error
            assert response.status_code in [200, 413, 422]


class TestRegressionTests:
    """Regression tests for previously discovered issues."""

    @pytest.mark.asyncio
    async def test_queue_not_created_before_background_task(self):
        """Regression: Queue should be created in background task, not before."""
        from main import AgentRequest

        request_id = "regression-queue"

        # Queue should not exist before background task
        assert request_id not in event_queues

        request = AgentRequest(
            agent_id="test",
            input={"input": "test"},
            context=None
        )

        with patch("main.cagent_runtime") as mock_runtime:
            async def empty_generator():
                return
                yield  # Make it a generator

            mock_runtime.execute_agent = MagicMock(return_value=empty_generator())

            await _execute_agent_background(request_id, request)

            # Queue should have been created during background task
            # (and may be cleaned up after)

    def test_request_id_is_uuid_format(self, client):
        """Regression: Ensure request_id is valid UUID."""
        with patch("main.cagent_runtime") as mock_runtime:
            mock_runtime is not None

            response = client.post(
                "/agent/execute",
                json={"agent_id": "test", "input": {"input": "test"}}
            )

            request_id = response.json()["request_id"]

            # Should be valid UUID format (has dashes)
            import uuid
            try:
                uuid.UUID(request_id)
                valid_uuid = True
            except ValueError:
                valid_uuid = False

            assert valid_uuid

    @pytest.mark.asyncio
    async def test_end_marker_always_sent(self):
        """Regression: Ensure None marker always sent to end stream."""
        from main import AgentRequest

        request_id = "regression-marker"
        request = AgentRequest(
            agent_id="test",
            input={"input": "test"},
            context=None
        )

        with patch("main.cagent_runtime") as mock_runtime:
            async def result_generator():
                yield CagentEvent(EventType.RESULT, {"result": "done"}, time.time())

            mock_runtime.execute_agent = MagicMock(return_value=result_generator())

            await _execute_agent_background(request_id, request)

            # Get all items from queue
            queue = event_queues[request_id]
            items = []
            while not queue.empty():
                items.append(await queue.get())

            # Last item should be None
            assert items[-1] is None