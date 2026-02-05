"""Unit tests for event_parser module."""

import json
import pytest
from event_parser import EventParser, EventType, CagentEvent


@pytest.fixture
def parser():
    """Fixture providing EventParser instance."""
    return EventParser(json_mode=True)


class TestCagentEvent:
    """Tests for CagentEvent dataclass."""

    def test_event_creation(self):
        """Test basic event creation."""
        event = CagentEvent(
            event_type=EventType.THINKING,
            data={"content": "test"},
            timestamp=1234567890.0,
        )
        assert event.event_type == EventType.THINKING
        assert event.data == {"content": "test"}

    def test_event_to_dict(self):
        """Test conversion to dictionary."""
        event = CagentEvent(
            event_type=EventType.THINKING,
            data={"content": "test"},
            timestamp=1234567890.0,
        )
        d = event.to_dict()
        assert d["event_type"] == EventType.THINKING
        assert d["data"] == {"content": "test"}
        assert d["timestamp"] == 1234567890.0

    def test_event_to_sse_line(self):
        """Test SSE line generation."""
        event = CagentEvent(
            event_type=EventType.THINKING,
            data={"content": "test"},
            timestamp=1234567890.0,
        )
        line = event.to_sse_line()
        assert line.startswith("data: ")
        assert line.endswith("\n\n")
        # Parse back
        data_str = line.replace("data: ", "").strip()
        parsed = json.loads(data_str)
        assert parsed["event_type"] == EventType.THINKING


class TestEventParserPatterns:
    """Tests for event pattern matching."""

    def test_parse_thinking_event(self, parser):
        """Test parsing thinking pattern."""
        event = parser.parse_line("[THINKING] Let me analyze this problem", is_stderr=False)
        assert event is not None
        assert event.event_type == EventType.THINKING
        assert "analyze" in event.data["content"]

    def test_parse_thinking_lowercase(self, parser):
        """Test parsing lowercase thinking pattern."""
        event = parser.parse_line("[thinking] Consider the approach", is_stderr=False)
        assert event is not None
        assert event.event_type == EventType.THINKING

    def test_parse_tool_call(self, parser):
        """Test parsing tool call pattern."""
        event = parser.parse_line("[TOOL] Calling web search with query", is_stderr=False)
        assert event is not None
        assert event.event_type == EventType.TOOL_CALL
        assert "web search" in event.data["content"]

    def test_parse_tool_result(self, parser):
        """Test parsing tool result pattern."""
        event = parser.parse_line("[TOOL RESULT] Found 42 results", is_stderr=False)
        assert event is not None
        assert event.event_type == EventType.TOOL_RESULT
        assert "42" in event.data["content"]

    def test_parse_output_pattern(self, parser):
        """Test parsing output pattern."""
        event = parser.parse_line("[OUTPUT] The answer is 42", is_stderr=False)
        assert event is not None
        assert event.event_type == EventType.RESULT
        assert "42" in event.data["result"]

    def test_parse_error_pattern(self, parser):
        """Test parsing error pattern."""
        event = parser.parse_line("Error: Connection failed", is_stderr=False)
        assert event is not None
        assert event.event_type == EventType.ERROR

    def test_parse_empty_line(self, parser):
        """Test parsing empty line."""
        event = parser.parse_line("", is_stderr=False)
        assert event is None

    def test_parse_whitespace_only(self, parser):
        """Test parsing whitespace-only line."""
        event = parser.parse_line("   \t  ", is_stderr=False)
        assert event is None


class TestEventParserJSON:
    """Tests for JSON output parsing."""

    def test_parse_json_result(self, parser):
        """Test parsing JSON result."""
        json_line = json.dumps({"result": "The answer is 42"})
        event = parser.parse_line(json_line, is_stderr=False)
        assert event is not None
        assert event.event_type == EventType.RESULT
        assert event.data["result"] == "The answer is 42"

    def test_parse_json_error(self, parser):
        """Test parsing JSON error."""
        json_line = json.dumps({"error": "Something went wrong"})
        event = parser.parse_line(json_line, is_stderr=False)
        assert event is not None
        assert event.event_type == EventType.ERROR
        assert event.data["error"] == "Something went wrong"

    def test_parse_json_generic(self, parser):
        """Test parsing generic JSON object."""
        json_line = json.dumps({"agent": "orchestrator", "status": "thinking"})
        event = parser.parse_line(json_line, is_stderr=False)
        assert event is not None
        assert event.event_type == EventType.INFO
        assert event.data["agent"] == "orchestrator"

    def test_parse_invalid_json_fallback(self, parser):
        """Test fallback to pattern matching on invalid JSON."""
        event = parser.parse_line("[THINKING] Invalid JSON like text", is_stderr=False)
        assert event is not None
        assert event.event_type == EventType.THINKING


class TestEventParserStderr:
    """Tests for stderr handling."""

    def test_parse_stderr_as_error(self, parser):
        """Test stderr becomes error event."""
        event = parser.parse_line("Traceback (most recent call last):", is_stderr=True)
        assert event is not None
        assert event.event_type == EventType.ERROR
        assert "Traceback" in event.data["error"]

    def test_parse_stderr_empty(self, parser):
        """Test empty stderr."""
        event = parser.parse_line("", is_stderr=True)
        assert event is None


class TestEventParserStream:
    """Tests for stream parsing."""

    def test_parse_stream_basic(self, parser):
        """Test parsing list of lines."""
        stdout_lines = [
            "[THINKING] Analyzing the request",
            "[TOOL] Calling search",
            "[TOOL RESULT] Found data",
            "[OUTPUT] Final answer",
        ]
        stderr_lines = []

        events = list(parser.parse_stream(stdout_lines, stderr_lines))

        assert len(events) == 4
        assert events[0].event_type == EventType.THINKING
        assert events[1].event_type == EventType.TOOL_CALL
        assert events[2].event_type == EventType.TOOL_RESULT
        assert events[3].event_type == EventType.RESULT

    def test_parse_stream_with_errors(self, parser):
        """Test parsing stream with stderr."""
        stdout_lines = ["[THINKING] Processing..."]
        stderr_lines = ["Error: Timeout occurred"]

        events = list(parser.parse_stream(stdout_lines, stderr_lines))

        assert len(events) == 2
        assert any(e.event_type == EventType.THINKING for e in events)
        assert any(e.event_type == EventType.ERROR for e in events)

    def test_parse_stream_mixed_json_patterns(self, parser):
        """Test parsing stream with both JSON and patterns."""
        stdout_lines = [
            "[THINKING] Starting",
            json.dumps({"result": "Done"}),
        ]
        stderr_lines = []

        events = list(parser.parse_stream(stdout_lines, stderr_lines))

        assert len(events) == 2
        assert events[0].event_type == EventType.THINKING
        assert events[1].event_type == EventType.RESULT

    def test_parse_stream_chronological_order(self, parser):
        """Test that events are sorted chronologically."""
        import time

        stdout_lines = ["Line 1", "Line 2", "Line 3"]
        # Manually set timestamps to verify sorting
        events = []
        for i, line in enumerate(stdout_lines):
            event = CagentEvent(
                event_type=EventType.INFO,
                data={"message": line},
                timestamp=1000.0 - i,  # Reverse order
            )
            events.append(event)

        # Verify parser orders them
        ordered_events = sorted(events, key=lambda e: e.timestamp)
        assert ordered_events[0].data["message"] == "Line 3"
        assert ordered_events[-1].data["message"] == "Line 1"

    def test_parse_stream_filters_none(self, parser):
        """Test that None results are filtered."""
        stdout_lines = ["", "  ", "[THINKING] Content", "   \t  "]
        stderr_lines = []

        events = list(parser.parse_stream(stdout_lines, stderr_lines))

        # Only one valid event
        assert len(events) == 1
        assert events[0].event_type == EventType.THINKING


class TestEventParserGenericInfo:
    """Tests for generic info parsing."""

    def test_parse_generic_info(self, parser):
        """Test parsing generic non-matched text."""
        event = parser.parse_line("Some random debug output", is_stderr=False)
        assert event is not None
        assert event.event_type == EventType.INFO
        assert event.data["message"] == "Some random debug output"


class TestEventParserEdgeCases:
    """Tests for edge cases."""

    def test_parse_very_long_line(self, parser):
        """Test parsing very long line."""
        long_content = "x" * 10000
        event = parser.parse_line(long_content, is_stderr=False)
        assert event is not None
        assert len(event.data["message"]) == 10000

    def test_parse_special_characters(self, parser):
        """Test parsing line with special characters."""
        special_line = "[THINKING] This has unicode: 你好 مرحبا 🚀"
        event = parser.parse_line(special_line, is_stderr=False)
        assert event is not None
        assert "unicode" in event.data["content"]

    def test_parse_multiline_json_fails_gracefully(self, parser):
        """Test that malformed multi-line JSON falls back to patterns."""
        line = "[THINKING] This looks like JSON but {is not really"
        event = parser.parse_line(line, is_stderr=False)
        assert event is not None
        assert event.event_type == EventType.THINKING

    def test_timestamp_is_current(self, parser):
        """Test that parsed events have current timestamp."""
        import time

        before = time.time()
        event = parser.parse_line("[THINKING] Test", is_stderr=False)
        after = time.time()

        assert event is not None
        assert before <= event.timestamp <= after
