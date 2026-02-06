"""Unit tests for runtime module."""

import asyncio
import pytest
import pathlib
import tempfile
from unittest.mock import Mock, patch, MagicMock

from runtime import CagentRuntime, CagentRuntimeError, EventType


class TestCagentRuntimeInitialization:
    """Tests for runtime initialization."""

    def test_runtime_initialization_success(self, tmp_path):
        """Test successful runtime initialization."""
        # Create a temporary team.yaml
        team_yaml = tmp_path / "team.yaml"
        team_yaml.write_text("metadata:\n  author: test\n")

        with patch("subprocess.run") as mock_run:
            mock_run.return_value = Mock(returncode=0, stdout="cagent version v1.0.0\n")
            runtime = CagentRuntime(str(team_yaml))

            assert runtime.team_yaml_path == str(team_yaml)
            assert runtime.active_processes == {}
            assert runtime.shutdown_flag is False

    def test_runtime_initialization_missing_team_yaml(self):
        """Test initialization fails when team.yaml doesn't exist."""
        with patch("subprocess.run") as mock_run:
            mock_run.return_value = Mock(returncode=0, stdout="cagent version v1.0.0\n")

            with pytest.raises(CagentRuntimeError, match=r"team\.yaml not found"):
                CagentRuntime("nonexistent/team.yaml")

    def test_runtime_initialization_cagent_not_found(self, tmp_path):
        """Test initialization fails when cagent is not available."""
        team_yaml = tmp_path / "team.yaml"
        team_yaml.write_text("metadata:\n  author: test\n")

        with patch("subprocess.run") as mock_run:
            mock_run.side_effect = FileNotFoundError("cagent not found")

            with pytest.raises(CagentRuntimeError, match="Cannot execute cagent"):
                CagentRuntime(str(team_yaml))

    def test_runtime_initialization_preserves_cagent_error_cause(self, tmp_path):
        """Test initialization chains underlying cagent invocation errors."""
        team_yaml = tmp_path / "team.yaml"
        team_yaml.write_text("metadata:\n  author: test\n")

        original_error = FileNotFoundError("cagent not found")
        with patch("subprocess.run", side_effect=original_error):
            with pytest.raises(CagentRuntimeError, match="Cannot execute cagent") as exc_info:
                CagentRuntime(str(team_yaml))

        assert exc_info.value.__cause__ is original_error

    def test_runtime_initialization_cagent_version_fails(self, tmp_path):
        """Test initialization fails when cagent version check fails."""
        team_yaml = tmp_path / "team.yaml"
        team_yaml.write_text("metadata:\n  author: test\n")

        with patch("subprocess.run") as mock_run:
            mock_run.return_value = Mock(returncode=1, stdout="error")

            with pytest.raises(CagentRuntimeError, match="cagent not available"):
                CagentRuntime(str(team_yaml))


class TestCagentRuntimeExecution:
    """Tests for agent execution."""

    @pytest.mark.asyncio
    async def test_execute_agent_simple(self, tmp_path):
        """Test simple agent execution."""
        team_yaml = tmp_path / "team.yaml"
        team_yaml.write_text("metadata:\n  author: test\n")

        with patch("subprocess.run") as mock_run:
            mock_run.return_value = Mock(returncode=0, stdout="cagent version v1.0.0\n")
            runtime = CagentRuntime(str(team_yaml))

        with patch("asyncio.create_subprocess_exec") as mock_exec:
            # Mock process with async methods
            mock_proc = MagicMock()
            mock_proc.pid = 12345
            mock_proc.returncode = 0
            mock_proc.stdin = MagicMock()
            mock_proc.stdin.write = Mock()
            mock_proc.stdin.close = Mock()

            # Create proper async functions
            async def mock_stdout_read():
                return '[OUTPUT] Result: test\n'

            async def mock_stderr_read():
                return ""

            async def mock_wait():
                return 0

            mock_proc.stdout.read = mock_stdout_read
            mock_proc.stderr.read = mock_stderr_read
            mock_proc.wait = mock_wait

            mock_exec.return_value = mock_proc

            # Execute agent
            events = []
            async for event in runtime.execute_agent("test_agent", "test input"):
                events.append(event)

            assert len(events) > 0
            # Check that result event was yielded
            result_events = [e for e in events if e.event_type == EventType.RESULT]
            assert len(result_events) > 0

    @pytest.mark.asyncio
    async def test_execute_agent_with_context(self, tmp_path):
        """Test execution with context."""
        team_yaml = tmp_path / "team.yaml"
        team_yaml.write_text("metadata:\n  author: test\n")

        with patch("subprocess.run") as mock_run:
            mock_run.return_value = Mock(returncode=0, stdout="cagent version v1.0.0\n")
            runtime = CagentRuntime(str(team_yaml))

        # Verify context is passed correctly
        context = {"brand": "slowfood", "platform": "instagram"}

        with patch("asyncio.create_subprocess_exec") as mock_exec:
            mock_proc = MagicMock()
            mock_proc.pid = 12345
            mock_proc.returncode = None
            mock_proc.stdin = MagicMock()
            async def mock_stdout_read():
                return ""
            async def mock_stderr_read():
                return ""
            async def mock_wait():
                mock_proc.returncode = 0
                return 0
            mock_proc.stdout.read = mock_stdout_read
            mock_proc.stderr.read = mock_stderr_read
            mock_proc.wait = mock_wait

            mock_exec.return_value = mock_proc

            async for _ in runtime.execute_agent(
                "test_agent", "test", context=context
            ):
                pass

            # Verify stdin.write was called with context included
            assert mock_proc.stdin.write.called

    @pytest.mark.asyncio
    async def test_execute_agent_error(self, tmp_path):
        """Test execution error handling."""
        team_yaml = tmp_path / "team.yaml"
        team_yaml.write_text("metadata:\n  author: test\n")

        with patch("subprocess.run") as mock_run:
            mock_run.return_value = Mock(returncode=0, stdout="cagent version v1.0.0\n")
            runtime = CagentRuntime(str(team_yaml))

        with patch("asyncio.create_subprocess_exec") as mock_exec:
            mock_exec.side_effect = Exception("Subprocess creation failed")

            events = []
            async for event in runtime.execute_agent("test_agent", "test"):
                events.append(event)

            # Check for error event
            error_events = [e for e in events if e.event_type == EventType.ERROR]
            assert len(error_events) > 0

    @pytest.mark.asyncio
    async def test_execute_agent_timeout(self, tmp_path):
        """Test execution timeout."""
        team_yaml = tmp_path / "team.yaml"
        team_yaml.write_text("metadata:\n  author: test\n")

        with patch("subprocess.run") as mock_run:
            mock_run.return_value = Mock(returncode=0, stdout="cagent version v1.0.0\n")
            runtime = CagentRuntime(str(team_yaml))

        with patch("asyncio.create_subprocess_exec") as mock_exec:
            mock_proc = MagicMock()
            mock_proc.pid = 12345
            mock_proc.returncode = None
            mock_proc.stdin = MagicMock()

            # Simulate timeout
            async def timeout_read():
                await asyncio.sleep(10)
                return ""

            mock_proc.stdout.read = timeout_read
            mock_proc.stderr.read = timeout_read

            with patch("runtime.CagentRuntime._kill_process_tree"):
                mock_exec.return_value = mock_proc

                events = []
                async for event in runtime.execute_agent(
                    "test_agent", "test", timeout=0.1
                ):
                    events.append(event)

                # Check for timeout error
                error_events = [e for e in events if e.event_type == EventType.ERROR]
                assert any("timeout" in str(e.data).lower() for e in error_events)

    @pytest.mark.asyncio
    async def test_runtime_shutdown_flag(self, tmp_path):
        """Test that shutdown sets flag."""
        team_yaml = tmp_path / "team.yaml"
        team_yaml.write_text("metadata:\n  author: test\n")

        with patch("subprocess.run") as mock_run:
            mock_run.return_value = Mock(returncode=0, stdout="cagent version v1.0.0\n")
            runtime = CagentRuntime(str(team_yaml))

        assert runtime.shutdown_flag is False

        await runtime.shutdown()

        assert runtime.shutdown_flag is True

    @pytest.mark.asyncio
    async def test_execute_agent_after_shutdown(self, tmp_path):
        """Test that execution fails after shutdown."""
        team_yaml = tmp_path / "team.yaml"
        team_yaml.write_text("metadata:\n  author: test\n")

        with patch("subprocess.run") as mock_run:
            mock_run.return_value = Mock(returncode=0, stdout="cagent version v1.0.0\n")
            runtime = CagentRuntime(str(team_yaml))

        await runtime.shutdown()

        # Should raise error on execution attempt
        with pytest.raises(CagentRuntimeError, match="shutting down"):
            async for _ in runtime.execute_agent("test", "input"):
                pass


class TestProcessManagement:
    """Tests for process lifecycle management."""

    @pytest.mark.asyncio
    async def test_process_tracking(self, tmp_path):
        """Test that processes are tracked."""
        team_yaml = tmp_path / "team.yaml"
        team_yaml.write_text("metadata:\n  author: test\n")

        with patch("subprocess.run") as mock_run:
            mock_run.return_value = Mock(returncode=0, stdout="cagent version v1.0.0\n")
            runtime = CagentRuntime(str(team_yaml))

        with patch("asyncio.create_subprocess_exec") as mock_exec:
            mock_proc = MagicMock()
            mock_proc.pid = 12345
            mock_proc.returncode = 0
            mock_proc.stdin = MagicMock()
            async def mock_stdout_read():
                return ""
            async def mock_stderr_read():
                return ""
            async def mock_wait():
                return 0
            mock_proc.stdout.read = mock_stdout_read
            mock_proc.stderr.read = mock_stderr_read
            mock_proc.wait = mock_wait

            mock_exec.return_value = mock_proc

            # Process should be tracked during execution
            async for _ in runtime.execute_agent("test", "input"):
                pass

            # Process should be removed after completion
            assert len(runtime.active_processes) == 0

    def test_kill_process_tree_simple(self, tmp_path):
        """Test killing a process tree."""
        team_yaml = tmp_path / "team.yaml"
        team_yaml.write_text("metadata:\n  author: test\n")

        with patch("subprocess.run") as mock_run:
            mock_run.return_value = Mock(returncode=0, stdout="cagent version v1.0.0\n")
            runtime = CagentRuntime(str(team_yaml))

        with patch("psutil.Process") as mock_process_class:
            mock_proc = MagicMock()
            mock_proc.children.return_value = []
            mock_proc.terminate = Mock()
            mock_process_class.return_value = mock_proc

            with patch("psutil.wait_procs", return_value=([], [])):
                runtime._kill_process_tree(12345)

                mock_proc.terminate.assert_called()

    def test_kill_process_tree_with_children(self, tmp_path):
        """Test killing a process tree with children."""
        team_yaml = tmp_path / "team.yaml"
        team_yaml.write_text("metadata:\n  author: test\n")

        with patch("subprocess.run") as mock_run:
            mock_run.return_value = Mock(returncode=0, stdout="cagent version v1.0.0\n")
            runtime = CagentRuntime(str(team_yaml))

        with patch("psutil.Process") as mock_process_class:
            mock_parent = MagicMock()
            mock_child1 = MagicMock()
            mock_child2 = MagicMock()

            mock_parent.children.return_value = [mock_child1, mock_child2]
            mock_process_class.return_value = mock_parent

            with patch("psutil.wait_procs") as mock_wait:
                mock_wait.return_value = ([], [])  # All gone

                runtime._kill_process_tree(12345)

                # Children should be terminated first
                mock_child1.terminate.assert_called()
                mock_child2.terminate.assert_called()
                mock_parent.terminate.assert_called()


class TestIntegration:
    """Integration tests."""

    @pytest.mark.asyncio
    async def test_multiple_sequential_executions(self, tmp_path):
        """Test multiple sequential agent executions."""
        team_yaml = tmp_path / "team.yaml"
        team_yaml.write_text("metadata:\n  author: test\n")

        with patch("subprocess.run") as mock_run:
            mock_run.return_value = Mock(returncode=0, stdout="cagent version v1.0.0\n")
            runtime = CagentRuntime(str(team_yaml))

        with patch("asyncio.create_subprocess_exec") as mock_exec:
            mock_proc = MagicMock()
            mock_proc.pid = 12345
            mock_proc.returncode = 0
            mock_proc.stdin = MagicMock()

            async def mock_stdout_read():
                return "[OUTPUT] Result\n"

            async def mock_stderr_read():
                return ""

            async def mock_wait():
                return 0

            mock_proc.stdout.read = mock_stdout_read
            mock_proc.stderr.read = mock_stderr_read
            mock_proc.wait = mock_wait

            mock_exec.return_value = mock_proc

            # Execute multiple times
            for i in range(3):
                events = []
                async for event in runtime.execute_agent("agent", f"input {i}"):
                    events.append(event)

                assert len(events) > 0

            # All processes should be cleaned up
            assert len(runtime.active_processes) == 0

        # Cleanup
        await runtime.shutdown()
