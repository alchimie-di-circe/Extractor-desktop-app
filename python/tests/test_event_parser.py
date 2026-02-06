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

    def test_parse_stream_chronological_order(self, parser, monkeypatch):
        """Test that events are sorted chronologically."""
        timestamps = iter([1000.0, 998.0, 999.0])
        monkeypatch.setattr("event_parser.time.time", lambda: next(timestamps))

        stdout_lines = ["Line 1", "Line 2", "Line 3"]
        events = list(parser.parse_stream(stdout_lines, []))

        assert [event.data["message"] for event in events] == ["Line 2", "Line 3", "Line 1"]

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

    def test_parse_line_with_only_pattern_marker(self, parser):
        """Test parsing line with only pattern marker, no content."""
        event = parser.parse_line("[THINKING]", is_stderr=False)
        assert event is not None
        assert event.event_type == EventType.THINKING
        assert event.data["content"] == "[THINKING]"

    def test_parse_multiple_patterns_in_line(self, parser):
        """Test that first matching pattern takes precedence."""
        # THINKING appears before TOOL in the regex checks
        line = "[THINKING] I will use [TOOL] later"
        event = parser.parse_line(line, is_stderr=False)
        assert event is not None
        assert event.event_type == EventType.THINKING
        assert "[TOOL]" in event.data["content"]

    def test_parse_json_with_nested_objects(self, parser):
        """Test parsing complex nested JSON."""
        nested_json = json.dumps({
            "result": {
                "nested": {
                    "value": "deep data",
                    "array": [1, 2, 3]
                }
            }
        })
        event = parser.parse_line(nested_json, is_stderr=False)
        assert event is not None
        assert event.event_type == EventType.RESULT
        assert "nested" in event.data["result"]

    def test_parse_json_array(self, parser):
        """Test parsing JSON array (non-dict)."""
        json_array = json.dumps([1, 2, 3, 4])
        event = parser.parse_line(json_array, is_stderr=False)
        # Should fall through to pattern matching as it's not a dict
        assert event is not None
        assert event.event_type == EventType.INFO

    def test_parse_line_with_tabs_and_newlines(self, parser):
        """Test parsing line with tabs and embedded escape sequences."""
        line = "[TOOL]\tCalling\nfunction"
        event = parser.parse_line(line, is_stderr=False)
        assert event is not None
        assert event.event_type == EventType.TOOL_CALL

    def test_parse_case_insensitive_patterns(self, parser):
        """Test that patterns are case insensitive."""
        variations = [
            "[ThInKiNg] Mixed case",
            "Thinking: Lowercase prefix",
            "[THINKING] Uppercase",
        ]
        for line in variations:
            event = parser.parse_line(line, is_stderr=False)
            assert event is not None
            assert event.event_type == EventType.THINKING

    def test_parse_line_with_null_bytes(self, parser):
        """Test parsing line with null bytes."""
        line = "[THINKING] Text with \x00 null byte"
        event = parser.parse_line(line, is_stderr=False)
        assert event is not None
        assert event.event_type == EventType.THINKING

    def test_buffer_field_exists(self, parser):
        """Test that parser has buffer field for potential buffering."""
        assert hasattr(parser, 'buffer')
        assert parser.buffer == ""


class TestEventParserPatternPriority:
    """Tests for pattern matching priority and conflicts."""

    def test_error_pattern_overrides_info(self, parser):
        """Test that error pattern is detected properly."""
        line = "Error: This is an error message"
        event = parser.parse_line(line, is_stderr=False)
        assert event is not None
        assert event.event_type == EventType.ERROR

    def test_result_pattern_with_error_word(self, parser):
        """Test that OUTPUT pattern takes priority over error detection."""
        line = "[OUTPUT] Result contains word error in text"
        event = parser.parse_line(line, is_stderr=False)
        assert event is not None
        assert event.event_type == EventType.RESULT

    def test_json_mode_disabled(self):
        """Test parser with json_mode disabled."""
        parser = EventParser(json_mode=False)
        json_line = json.dumps({"result": "test"})
        event = parser.parse_line(json_line, is_stderr=False)
        # Should still match patterns or become INFO
        assert event is not None
        # With json_mode=False, should fall to INFO for valid JSON string
        assert event.event_type == EventType.INFO


class TestEventParserConcurrency:
    """Tests for concurrent parsing scenarios."""

    def test_parse_stream_with_large_volume(self, parser):
        """Test parsing a large volume of lines."""
        stdout_lines = [f"[THINKING] Line {i}" for i in range(1000)]
        stderr_lines = []

        events = list(parser.parse_stream(stdout_lines, stderr_lines))

        assert len(events) == 1000
        assert all(e.event_type == EventType.THINKING for e in events)

    def test_parse_stream_interleaved_timestamps(self, parser):
        """Test that events maintain chronological order with interleaving."""
        stdout_lines = ["[THINKING] First", "[TOOL] Second"]
        stderr_lines = ["Error in between"]

        events = list(parser.parse_stream(stdout_lines, stderr_lines))

        # Verify chronological ordering
        for i in range(len(events) - 1):
            assert events[i].timestamp <= events[i + 1].timestamp


class TestEventParserRegressionTests:
    """Regression tests for previously discovered bugs."""

    def test_empty_content_after_pattern_split(self, parser):
        """Regression: Ensure empty content after pattern doesn't cause issues."""
        event = parser.parse_line("[TOOL]", is_stderr=False)
        assert event is not None
        assert event.event_type == EventType.TOOL_CALL
        # Should use full line when split result is empty
        assert event.data["content"] == "[TOOL]"

    def test_json_parse_error_falls_back_gracefully(self, parser):
        """Regression: JSON parse errors should not crash parser."""
        invalid_json = '{"incomplete": '
        event = parser.parse_line(invalid_json, is_stderr=False)
        assert event is not None
        # Should fall back to INFO
        assert event.event_type == EventType.INFO

    def test_stderr_never_parsed_as_json(self, parser):
        """Regression: stderr should always be ERROR, never JSON parsed."""
        json_error = json.dumps({"result": "This is stderr"})
        event = parser.parse_line(json_error, is_stderr=True)
        assert event is not None
        assert event.event_type == EventType.ERROR
        assert json_error in event.data["error"]