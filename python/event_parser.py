"""
Event Parser Module: Parse cagent subprocess output into structured events.

Handles stdout/stderr parsing and converts cagent output patterns into
normalized CagentEvent objects for SSE streaming.
"""

import json
import logging
import re
import time
from dataclasses import dataclass, asdict
from typing import Generator, Optional, Union
from enum import Enum

logger = logging.getLogger(__name__)


class EventType(str, Enum):
    """Event types emitted during agent execution."""
    THINKING = "thinking"
    TOOL_CALL = "tool_call"
    TOOL_RESULT = "tool_result"
    RESULT = "result"
    ERROR = "error"
    KEEPALIVE = "keepalive"
    INFO = "info"


@dataclass
class CagentEvent:
    """Normalized event from agent execution."""
    event_type: str  # EventType
    data: dict
    timestamp: float

    def to_dict(self) -> dict:
        """Convert to dictionary for JSON serialization."""
        return asdict(self)

    def to_sse_line(self) -> str:
        """Convert to SSE event line for streaming."""
        return f"data: {json.dumps(self.to_dict())}\n\n"


class EventParser:
    """Parse cagent subprocess stdout/stderr into structured events."""

    # Pattern matching for cagent output
    THINKING_PATTERN = re.compile(r"\[THINKING\]|\[thinking\]|Thinking:", re.IGNORECASE)
    TOOL_CALL_PATTERN = re.compile(r"\[TOOL\]|\[tool\]|Calling tool:", re.IGNORECASE)
    TOOL_RESULT_PATTERN = re.compile(
        r"\[TOOL RESULT\]|\[tool result\]|Tool result:", re.IGNORECASE
    )
    AGENT_OUTPUT_PATTERN = re.compile(r"\[OUTPUT\]|\[output\]|Output:", re.IGNORECASE)
    ERROR_PATTERN = re.compile(r"(error|failed|exception):", re.IGNORECASE)

    def __init__(self, json_mode: bool = True):
        """
        Initialize parser.

        Args:
            json_mode: If True, expect JSON output from cagent --json flag
        """
        self.json_mode = json_mode
        self.buffer = ""

    def parse_line(self, line: str, is_stderr: bool = False) -> Optional[CagentEvent]:
        """
        Parse a single line of output.

        Args:
            line: Output line from subprocess
            is_stderr: Whether this is stderr (errors) or stdout

        Returns:
            CagentEvent if line represents a meaningful event, None otherwise
        """
        if not line or not line.strip():
            return None

        timestamp = time.time()

        # Try JSON parsing first (for --json mode)
        if self.json_mode and not is_stderr:
            try:
                obj = json.loads(line)
                if isinstance(obj, dict):
                    # Check for result object
                    if "result" in obj:
                        return CagentEvent(
                            event_type=EventType.RESULT,
                            data={"result": obj["result"]},
                            timestamp=timestamp,
                        )
                    # Check for error in JSON
                    if "error" in obj:
                        return CagentEvent(
                            event_type=EventType.ERROR,
                            data={"error": obj["error"]},
                            timestamp=timestamp,
                        )
                    # Generic JSON object
                    return CagentEvent(
                        event_type=EventType.INFO,
                        data=obj,
                        timestamp=timestamp,
                    )
            except json.JSONDecodeError:
                pass  # Fall through to pattern matching

        # stderr -> error event
        if is_stderr:
            return CagentEvent(
                event_type=EventType.ERROR,
                data={"error": line},
                timestamp=timestamp,
            )

        # Pattern matching on stdout
        stripped = line.strip()

        # Thinking
        if self.THINKING_PATTERN.search(stripped):
            content = self.THINKING_PATTERN.split(stripped)[-1].strip()
            return CagentEvent(
                event_type=EventType.THINKING,
                data={"content": content or stripped},
                timestamp=timestamp,
            )

        # Tool call
        if self.TOOL_CALL_PATTERN.search(stripped):
            content = self.TOOL_CALL_PATTERN.split(stripped)[-1].strip()
            return CagentEvent(
                event_type=EventType.TOOL_CALL,
                data={"content": content or stripped},
                timestamp=timestamp,
            )

        # Tool result
        if self.TOOL_RESULT_PATTERN.search(stripped):
            content = self.TOOL_RESULT_PATTERN.split(stripped)[-1].strip()
            return CagentEvent(
                event_type=EventType.TOOL_RESULT,
                data={"content": content or stripped},
                timestamp=timestamp,
            )

        # Output/Result
        if self.AGENT_OUTPUT_PATTERN.search(stripped):
            content = self.AGENT_OUTPUT_PATTERN.split(stripped)[-1].strip()
            return CagentEvent(
                event_type=EventType.RESULT,
                data={"result": content or stripped},
                timestamp=timestamp,
            )

        # Error detection by pattern
        if self.ERROR_PATTERN.search(stripped):
            return CagentEvent(
                event_type=EventType.ERROR,
                data={"error": stripped},
                timestamp=timestamp,
            )

        # Generic info line
        if stripped:
            return CagentEvent(
                event_type=EventType.INFO,
                data={"message": stripped},
                timestamp=timestamp,
            )

        return None

    def parse_stream(
        self, stdout_lines: list[str], stderr_lines: list[str]
    ) -> Generator[CagentEvent, None, None]:
        """
        Parse collected stdout and stderr into events.

        Args:
            stdout_lines: List of stdout lines
            stderr_lines: List of stderr lines

        Yields:
            CagentEvent objects in chronological order (merged from both streams)
        """
        events = []

        # Parse stdout
        for line in stdout_lines:
            event = self.parse_line(line, is_stderr=False)
            if event:
                events.append(event)

        # Parse stderr
        for line in stderr_lines:
            event = self.parse_line(line, is_stderr=True)
            if event:
                events.append(event)

        # Sort by timestamp and yield
        events.sort(key=lambda e: e.timestamp)
        for event in events:
            yield event

    async def parse_async_stream(
        self, stdout_iter, stderr_iter
    ):
        """
        Parse asynchronous streams of stdout/stderr.

        Args:
            stdout_iter: Async iterator over stdout lines
            stderr_iter: Async iterator over stderr lines

        Yields:
            CagentEvent objects as they are available
        """
        # Collect lines first (for merging)
        stdout_lines = []
        stderr_lines = []

        try:
            async for line in stdout_iter:
                if line:
                    stdout_lines.append(line)
        except Exception as e:
            logger.error(f"Error reading stdout: {e}")

        try:
            async for line in stderr_iter:
                if line:
                    stderr_lines.append(line)
        except Exception as e:
            logger.error(f"Error reading stderr: {e}")

        # Parse collected lines
        for event in self.parse_stream(stdout_lines, stderr_lines):
            yield event
