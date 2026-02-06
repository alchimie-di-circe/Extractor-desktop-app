"""
Cagent Runtime Manager: Subprocess lifecycle and execution orchestration.

Spawns and manages cagent execution processes, handles process cleanup,
and provides async generators for event streaming.
"""

import asyncio
import json
import logging
import pathlib
import subprocess
import time
import uuid
from typing import AsyncGenerator, Optional

import psutil

from event_parser import CagentEvent, EventParser, EventType

logger = logging.getLogger(__name__)


class CagentRuntimeError(Exception):
    """Cagent runtime execution error."""

    pass


class CagentRuntime:
    """Manage cagent agent execution via subprocess."""

    def __init__(self, team_yaml_path: str = "team.yaml"):
        """
        Initialize runtime with team configuration.

        Args:
            team_yaml_path: Path to team.yaml configuration file

        Raises:
            CagentRuntimeError: If team.yaml doesn't exist or cagent is not available
        """
        self.team_yaml_path = team_yaml_path
        self.parser = EventParser(json_mode=True)
        self.active_processes: dict[str, asyncio.subprocess.Process] = {}
        self.shutdown_flag = False

        # Verify cagent is available
        try:
            result = subprocess.run(
                ["cagent", "version"],
                capture_output=True,
                text=True,
                timeout=5,
            )
            if result.returncode != 0:
                raise CagentRuntimeError("cagent not available in PATH")
            logger.info(f"Cagent available: {result.stdout.strip()}")
        except (FileNotFoundError, subprocess.TimeoutExpired) as e:
            raise CagentRuntimeError(f"Cannot execute cagent: {e}")

        # Verify team.yaml exists
        team_path = pathlib.Path(team_yaml_path)
        if not team_path.exists():
            raise CagentRuntimeError(f"team.yaml not found: {team_yaml_path}")

        logger.info(f"CagentRuntime initialized with {team_yaml_path}")

    @staticmethod
    def _decode_output(raw_data: object) -> str:
        """Decode subprocess output from bytes to string safely."""
        if raw_data is None:
            return ""
        if isinstance(raw_data, bytes):
            return raw_data.decode("utf-8", errors="ignore")
        return str(raw_data)

    async def _await_stream_method(self, stream: object, method_name: str) -> None:
        """Call an async stream method when available, no-op for sync test doubles."""
        method = getattr(stream, method_name, None)
        if not callable(method):
            return

        result = method()
        if asyncio.iscoroutine(result) or isinstance(result, asyncio.Future):
            await result

    async def _stream_lines(self, stream: object) -> AsyncGenerator[str, None]:
        """Read subprocess stream incrementally when possible."""
        readline = getattr(stream, "readline", None)
        if callable(readline) and asyncio.iscoroutinefunction(readline):
            while True:
                raw_line = await readline()
                if not raw_line:
                    return
                yield self._decode_output(raw_line).rstrip("\r\n")

        read = getattr(stream, "read", None)
        if callable(read):
            raw_data = read()
            if asyncio.iscoroutine(raw_data) or isinstance(raw_data, asyncio.Future):
                raw_data = await raw_data
            text = self._decode_output(raw_data)
            for line in text.splitlines():
                yield line

    @staticmethod
    def _remaining_timeout(deadline: float) -> float:
        """Return remaining timeout budget in seconds."""
        return max(0.0, deadline - asyncio.get_running_loop().time())

    async def execute_agent(
        self,
        agent_id: str,
        user_input: str,
        context: Optional[dict] = None,
        timeout: float = 300.0,
    ) -> AsyncGenerator[CagentEvent, None]:
        """
        Execute a cagent agent and stream events.

        Args:
            agent_id: ID of agent to execute (e.g., "orchestrator")
            user_input: User input/prompt for the agent
            context: Optional context dictionary
            timeout: Execution timeout in seconds (default 300s = 5min)

        Yields:
            CagentEvent objects as agent executes

        Raises:
            CagentRuntimeError: If execution fails
        """
        if self.shutdown_flag:
            raise CagentRuntimeError("Runtime is shutting down")

        process_id = f"{agent_id}_{uuid.uuid4().hex[:8]}"
        logger.info(f"[{process_id}] Starting execution of agent: {agent_id}")

        proc: Optional[asyncio.subprocess.Process] = None
        reader_tasks: list[asyncio.Task] = []

        try:
            # Build command
            cmd = [
                "cagent",
                "exec",
                self.team_yaml_path,
                "--agent",
                agent_id,
                "--json",
                "-",
            ]

            logger.debug(f"[{process_id}] Command: {' '.join(cmd)}")

            # Prepare input
            stdin_input = json.dumps(
                {
                    "input": user_input,
                    "context": context or {},
                }
            )

            # Spawn subprocess
            proc = await asyncio.create_subprocess_exec(
                *cmd,
                stdin=asyncio.subprocess.PIPE,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )

            self.active_processes[process_id] = proc

            logger.debug(f"[{process_id}] Subprocess spawned: PID={proc.pid}")

            # Send input and close stdin
            if proc.stdin:
                proc.stdin.write(stdin_input.encode("utf-8"))
                await self._await_stream_method(proc.stdin, "drain")
                proc.stdin.close()
                await self._await_stream_method(proc.stdin, "wait_closed")

            deadline = asyncio.get_running_loop().time() + timeout
            line_queue: asyncio.Queue[tuple[bool, Optional[str]]] = asyncio.Queue()

            async def _pump_stream(stream: object, is_stderr: bool) -> None:
                try:
                    async for line in self._stream_lines(stream):
                        await line_queue.put((is_stderr, line))
                finally:
                    await line_queue.put((is_stderr, None))

            if proc.stdout:
                reader_tasks.append(asyncio.create_task(_pump_stream(proc.stdout, False)))
            if proc.stderr:
                reader_tasks.append(asyncio.create_task(_pump_stream(proc.stderr, True)))

            closed_streams = 0
            while closed_streams < len(reader_tasks):
                remaining = self._remaining_timeout(deadline)
                if remaining <= 0:
                    raise asyncio.TimeoutError

                is_stderr, line = await asyncio.wait_for(line_queue.get(), timeout=remaining)
                if line is None:
                    closed_streams += 1
                    continue

                event = self.parser.parse_line(line, is_stderr=is_stderr)
                if event is not None:
                    yield event

            reader_results = await asyncio.gather(*reader_tasks, return_exceptions=True)
            for result in reader_results:
                if isinstance(result, Exception) and not isinstance(result, asyncio.CancelledError):
                    raise result

            remaining = self._remaining_timeout(deadline)
            if remaining <= 0:
                raise asyncio.TimeoutError
            await asyncio.wait_for(proc.wait(), timeout=remaining)

            # Check exit code
            if proc.returncode != 0:
                logger.warning(
                    f"[{process_id}] Process exited with code {proc.returncode}"
                )

            logger.info(f"[{process_id}] Execution completed successfully")

        except asyncio.TimeoutError:
            logger.warning(f"[{process_id}] Execution timeout ({timeout}s)")
            if proc:
                await self._kill_process_tree_async(proc.pid)
            yield CagentEvent(
                event_type=EventType.ERROR,
                data={"error": f"Execution timeout after {timeout}s"},
                timestamp=time.time(),
            )
            return

        except Exception as e:
            logger.exception(f"[{process_id}] Execution error")
            yield CagentEvent(
                event_type=EventType.ERROR,
                data={"error": str(e)},
                timestamp=time.time(),
            )

        finally:
            # Cleanup
            if process_id in self.active_processes:
                del self.active_processes[process_id]

            for task in reader_tasks:
                if not task.done():
                    task.cancel()
            if reader_tasks:
                await asyncio.gather(*reader_tasks, return_exceptions=True)

            if proc and proc.returncode is None:
                await self._kill_process_tree_async(proc.pid)

            logger.debug(f"[{process_id}] Cleanup complete")

    def _kill_process_tree(self, pid: int) -> None:
        """
        Kill a process and all its children.

        Args:
            pid: Process ID to kill
        """
        try:
            parent = psutil.Process(pid)
            children = parent.children(recursive=True)

            # Kill children first
            for child in children:
                try:
                    logger.debug(f"Killing child process: {child.pid}")
                    child.terminate()
                except psutil.NoSuchProcess:
                    pass

            # Kill parent
            try:
                logger.debug(f"Killing parent process: {pid}")
                parent.terminate()
            except psutil.NoSuchProcess:
                pass

            # Wait a bit and force kill if still alive
            _, alive = psutil.wait_procs([*children, parent], timeout=2)
            for proc in alive:
                try:
                    logger.warning(f"Force killing process: {proc.pid}")
                    proc.kill()
                except psutil.NoSuchProcess:
                    pass

        except psutil.NoSuchProcess:
            logger.debug(f"Process {pid} already terminated")
        except Exception:
            logger.exception(f"Error killing process tree {pid}")

    async def _kill_process_tree_async(self, pid: int) -> None:
        """Run potentially blocking process tree cleanup off the event loop."""
        await asyncio.to_thread(self._kill_process_tree, pid)

    async def shutdown(self) -> None:
        """Shutdown runtime and kill all active processes."""
        logger.info("CagentRuntime shutdown initiated")
        self.shutdown_flag = True

        # Kill all active processes
        for process_id, proc in list(self.active_processes.items()):
            logger.info(f"Killing process: {process_id}")
            if proc.returncode is None:
                await self._kill_process_tree_async(proc.pid)

        # Wait for all processes to finish
        await asyncio.sleep(0.1)

        logger.info("CagentRuntime shutdown complete")
