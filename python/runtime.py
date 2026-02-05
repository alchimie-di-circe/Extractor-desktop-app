"""
Cagent Runtime Manager: Subprocess lifecycle and execution orchestration.

Spawns and manages cagent execution processes, handles process cleanup,
and provides async generators for event streaming.
"""

import asyncio
import json
import logging
import os
import pathlib
import signal
import subprocess
import sys
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
        self.active_processes: dict[str, subprocess.Popen] = {}
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

        process_id = f"{agent_id}_{id(asyncio.current_task())}"
        logger.info(f"[{process_id}] Starting execution of agent: {agent_id}")

        proc = None
        stdout_lines = []
        stderr_lines = []

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
                encoding='utf-8',
                errors='ignore' # Or 'replace', to be even more robust
            )

            self.active_processes[process_id] = proc

            logger.debug(f"[{process_id}] Subprocess spawned: PID={proc.pid}")

            # Send input and close stdin
            proc.stdin.write(stdin_input)
            proc.stdin.close()

            # Read stdout/stderr concurrently with timeout
            try:
                stdout_data, stderr_data = await asyncio.wait_for(
                    asyncio.gather(
                        proc.stdout.read(),
                        proc.stderr.read(),
                    ),
                    timeout=timeout,
                )
            except asyncio.TimeoutError:
                logger.warning(f"[{process_id}] Execution timeout ({timeout}s)")
                self._kill_process_tree(proc.pid)
                import time  # at top of file

                yield CagentEvent(
                    event_type=EventType.ERROR,
                    data={"error": f"Execution timeout after {timeout}s"},
                    timestamp=time.time(),
                )
                return

            # Parse stdout/stderr
            stdout_lines = stdout_data.split("\n") if stdout_data else []
            stderr_lines = stderr_data.split("\n") if stderr_data else []

            logger.debug(
                f"[{process_id}] Stdout lines: {len(stdout_lines)}, "
                f"Stderr lines: {len(stderr_lines)}"
            )

            # Parse and yield events
            for event in self.parser.parse_stream(stdout_lines, stderr_lines):
                yield event

            # Wait for process exit
            await proc.wait()

            # Check exit code
            if proc.returncode != 0:
                logger.warning(
                    f"[{process_id}] Process exited with code {proc.returncode}"
                )

            logger.info(f"[{process_id}] Execution completed successfully")

        except Exception as e:
            logger.exception(f"[{process_id}] Execution error")
            yield CagentEvent(
                event_type=EventType.ERROR,
                data={"error": str(e)},
                timestamp=asyncio.get_event_loop().time(),
            )

        finally:
            # Cleanup
            if process_id in self.active_processes:
                del self.active_processes[process_id]

            if proc and proc.returncode is None:
                self._kill_process_tree(proc.pid)

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
            gone, alive = psutil.wait_procs(children + [parent], timeout=2)
            for proc in alive:
                try:
                    logger.warning(f"Force killing process: {proc.pid}")
                    proc.kill()
                except psutil.NoSuchProcess:
                    pass

        except psutil.NoSuchProcess:
            logger.debug(f"Process {pid} already terminated")
        except Exception as e:
            logger.error(f"Error killing process tree {pid}: {e}")

    async def shutdown(self) -> None:
        """Shutdown runtime and kill all active processes."""
        logger.info("CagentRuntime shutdown initiated")
        self.shutdown_flag = True

        # Kill all active processes
        for process_id, proc in list(self.active_processes.items()):
            logger.info(f"Killing process: {process_id}")
            if proc.returncode is None:
                self._kill_process_tree(proc.pid)

        # Wait for all processes to finish
        await asyncio.sleep(0.1)

        logger.info("CagentRuntime shutdown complete")
