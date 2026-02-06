"""Extended unit tests for runtime module - edge cases and regressions."""

import asyncio
import pytest
import pathlib
from unittest.mock import Mock, patch, MagicMock

from runtime import CagentRuntime, CagentRuntimeError, EventType


class TestRuntimeEdgeCases:
    """Tests for edge cases in runtime execution."""

    @pytest.mark.asyncio
    async def test_execute_agent_with_nonzero_exit_code(self, tmp_path):
        """Test handling of nonzero exit code."""
        team_yaml = tmp_path / "team.yaml"
        team_yaml.write_text("metadata:\n  author: test\n")

        with patch("subprocess.run") as mock_run:
            mock_run.return_value = Mock(returncode=0, stdout="cagent version v1.0.0\n")
            runtime = CagentRuntime(str(team_yaml))

        with patch("asyncio.create_subprocess_exec") as mock_exec:
            mock_proc = MagicMock()
            mock_proc.pid = 12345
            mock_proc.returncode = 1  # Non-zero exit code
            mock_proc.stdin = MagicMock()

            async def mock_stdout_read():
                return ""
            async def mock_stderr_read():
                return "Agent execution failed"
            async def mock_wait():
                return 1

            mock_proc.stdout.read = mock_stdout_read
            mock_proc.stderr.read = mock_stderr_read
            mock_proc.wait = mock_wait

            mock_exec.return_value = mock_proc

            events = []
            async for event in runtime.execute_agent("test", "input"):
                events.append(event)

            # Should still yield events and surface stderr as an error event
            error_events = [e for e in events if e.event_type == EventType.ERROR]
            assert error_events, "Expected ERROR event from stderr on non-zero exit"

    @pytest.mark.asyncio
    async def test_execute_agent_with_empty_input(self, tmp_path):
        """Test execution with empty input string."""
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

            events = []
            async for event in runtime.execute_agent("test", ""):
                events.append(event)

            # Should handle empty input gracefully
            mock_proc.stdin.write.assert_called()

    @pytest.mark.asyncio
    async def test_execute_agent_very_long_input(self, tmp_path):
        """Test execution with very long input."""
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

            # Create very long input
            long_input = "x" * 100000

            events = []
            async for event in runtime.execute_agent("test", long_input):
                events.append(event)

            # Should handle large input
            mock_proc.stdin.write.assert_called()

    @pytest.mark.asyncio
    async def test_process_cleanup_when_already_terminated(self, tmp_path):
        """Test cleanup of already terminated process."""
        team_yaml = tmp_path / "team.yaml"
        team_yaml.write_text("metadata:\n  author: test\n")

        with patch("subprocess.run") as mock_run:
            mock_run.return_value = Mock(returncode=0, stdout="cagent version v1.0.0\n")
            runtime = CagentRuntime(str(team_yaml))

        with patch("psutil.Process") as mock_process_class:
            import psutil
            mock_process_class.side_effect = psutil.NoSuchProcess(12345)

            # Should not raise error
            runtime._kill_process_tree(12345)

    @pytest.mark.asyncio
    async def test_shutdown_with_active_processes(self, tmp_path):
        """Test shutdown with active processes."""
        team_yaml = tmp_path / "team.yaml"
        team_yaml.write_text("metadata:\n  author: test\n")

        with patch("subprocess.run") as mock_run:
            mock_run.return_value = Mock(returncode=0, stdout="cagent version v1.0.0\n")
            runtime = CagentRuntime(str(team_yaml))

        # Add mock active process
        mock_proc = MagicMock()
        mock_proc.pid = 12345
        mock_proc.returncode = None
        runtime.active_processes["test"] = mock_proc

        with patch.object(runtime, '_kill_process_tree') as mock_kill:
            await runtime.shutdown()
            # Should call kill on active process
            mock_kill.assert_called_with(12345)

    @pytest.mark.asyncio
    async def test_concurrent_executions(self, tmp_path):
        """Test concurrent agent executions."""
        team_yaml = tmp_path / "team.yaml"
        team_yaml.write_text("metadata:\n  author: test\n")

        with patch("subprocess.run") as mock_run:
            mock_run.return_value = Mock(returncode=0, stdout="cagent version v1.0.0\n")
            runtime = CagentRuntime(str(team_yaml))

        with patch("asyncio.create_subprocess_exec") as mock_exec:
            call_count = [0]

            async def create_mock_proc(*args, **kwargs):
                call_count[0] += 1
                mock_proc = MagicMock()
                mock_proc.pid = 12345 + call_count[0]
                mock_proc.returncode = 0
                mock_proc.stdin = MagicMock()

                async def mock_stdout_read():
                    await asyncio.sleep(0.1)
                    return "[OUTPUT] Result\n"
                async def mock_stderr_read():
                    return ""
                async def mock_wait():
                    return 0

                mock_proc.stdout.read = mock_stdout_read
                mock_proc.stderr.read = mock_stderr_read
                mock_proc.wait = mock_wait
                return mock_proc

            mock_exec.side_effect = create_mock_proc

            # Helper to collect events
            async def collect_events(generator):
                events = []
                async for event in generator:
                    events.append(event)
                return events

            # Run multiple agents concurrently
            tasks = [
                collect_events(runtime.execute_agent("agent1", "input1")),
                collect_events(runtime.execute_agent("agent2", "input2")),
            ]

            results = await asyncio.gather(*tasks)

            # Both should complete successfully
            assert len(results) == 2
            assert all(len(r) > 0 for r in results)


class TestRuntimeRegressionTests:
    """Regression tests for previously discovered bugs."""

    @pytest.mark.asyncio
    async def test_process_not_cleaned_up_on_exception(self, tmp_path):
        """Regression: Ensure process cleanup happens even on exception."""
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

            async def mock_stdout_read():
                raise Exception("Read error")
            async def mock_stderr_read():
                return ""

            mock_proc.stdout.read = mock_stdout_read
            mock_proc.stderr.read = mock_stderr_read

            mock_exec.return_value = mock_proc

            with patch.object(runtime, '_kill_process_tree') as mock_kill:
                events = []
                async for event in runtime.execute_agent("test", "input"):
                    events.append(event)

                # Process should be cleaned up
                mock_kill.assert_called_once_with(12345)

    @pytest.mark.asyncio
    async def test_stdin_write_exception_handling(self, tmp_path):
        """Regression: Handle stdin write errors gracefully."""
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
            mock_proc.stdin.write.side_effect = Exception("Pipe broken")

            mock_exec.return_value = mock_proc

            events = []
            async for event in runtime.execute_agent("test", "input"):
                events.append(event)

            # Should yield error event
            error_events = [e for e in events if e.event_type == EventType.ERROR]
            assert len(error_events) > 0

    @pytest.mark.asyncio
    async def test_parser_initialization_persists(self, tmp_path):
        """Regression: Ensure parser instance is created and reused."""
        team_yaml = tmp_path / "team.yaml"
        team_yaml.write_text("metadata:\n  author: test\n")

        with patch("subprocess.run") as mock_run:
            mock_run.return_value = Mock(returncode=0, stdout="cagent version v1.0.0\n")
            runtime = CagentRuntime(str(team_yaml))

        # Parser should be initialized
        assert runtime.parser is not None
        assert runtime.parser.json_mode is True

        # Should be the same instance across calls
        parser1 = runtime.parser
        parser2 = runtime.parser
        assert parser1 is parser2

    @pytest.mark.asyncio
    async def test_timeout_kills_child_processes(self, tmp_path):
        """Regression: Ensure timeout kills entire process tree, not just parent."""
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

            async def timeout_read():
                await asyncio.sleep(10)
                return ""

            mock_proc.stdout.read = timeout_read
            mock_proc.stderr.read = timeout_read

            mock_exec.return_value = mock_proc

            with patch.object(runtime, '_kill_process_tree') as mock_kill:
                events = []
                async for event in runtime.execute_agent("test", "input", timeout=0.1):
                    events.append(event)

                # Should have called kill_process_tree (may be called multiple times in cleanup)
                assert mock_kill.called
                assert mock_kill.call_args[0][0] == 12345


class TestRuntimeStressTests:
    """Stress tests for runtime reliability."""

    @pytest.mark.asyncio
    async def test_rapid_sequential_executions(self, tmp_path):
        """Test rapid sequential executions without cleanup issues."""
        team_yaml = tmp_path / "team.yaml"
        team_yaml.write_text("metadata:\n  author: test\n")

        with patch("subprocess.run") as mock_run:
            mock_run.return_value = Mock(returncode=0, stdout="cagent version v1.0.0\n")
            runtime = CagentRuntime(str(team_yaml))

        with patch("asyncio.create_subprocess_exec") as mock_exec:
            call_count = [0]

            async def create_mock_proc(*args, **kwargs):
                call_count[0] += 1
                mock_proc = MagicMock()
                mock_proc.pid = 10000 + call_count[0]
                mock_proc.returncode = 0
                mock_proc.stdin = MagicMock()

                async def mock_stdout_read():
                    return "[OUTPUT] Fast result\n"
                async def mock_stderr_read():
                    return ""
                async def mock_wait():
                    return 0

                mock_proc.stdout.read = mock_stdout_read
                mock_proc.stderr.read = mock_stderr_read
                mock_proc.wait = mock_wait
                return mock_proc

            mock_exec.side_effect = create_mock_proc

            # Execute rapidly 10 times
            for i in range(10):
                events = []
                async for event in runtime.execute_agent("agent", f"input{i}"):
                    events.append(event)

            # All should be cleaned up
            assert len(runtime.active_processes) == 0

    @pytest.mark.asyncio
    async def test_execution_with_special_characters_in_context(self, tmp_path):
        """Test execution with special characters in context."""
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

            # Context with special characters
            context = {
                "unicode": "Hello 世界 🌍",
                "quotes": 'Quote: "test" and \'test\'',
                "newlines": "line1\nline2\nline3",
                "special": "\t\r\n\x00",
            }

            events = []
            async for event in runtime.execute_agent("test", "input", context=context):
                events.append(event)

            # Should handle special characters
            mock_proc.stdin.write.assert_called()