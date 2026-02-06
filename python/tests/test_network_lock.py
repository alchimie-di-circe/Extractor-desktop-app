"""
Test network_lock.py - Verify socket family restriction to AF_UNIX only.

RED phase: These tests fail before network_lock is implemented.
"""

import socket
import pytest


def test_af_inet_blocked_after_import():
    """Attempting AF_INET after importing network_lock should raise PermissionError."""
    # Import network_lock to install the monkey patch
    import python.sandboxed.network_lock  # noqa: F401

    # Now attempt to create an AF_INET socket
    with pytest.raises(PermissionError, match="network operations"):
        socket.socket(socket.AF_INET, socket.SOCK_STREAM)


def test_af_unix_allowed_after_import():
    """AF_UNIX sockets must still work after network_lock patch."""
    import python.sandboxed.network_lock  # noqa: F401

    # AF_UNIX should still work (but won't connect without a real socket)
    sock = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
    assert sock.family == socket.AF_UNIX
    sock.close()


def test_af_inet6_blocked():
    """IPv6 (AF_INET6) should also be blocked."""
    import python.sandboxed.network_lock  # noqa: F401

    with pytest.raises(PermissionError, match="network operations"):
        socket.socket(socket.AF_INET6, socket.SOCK_STREAM)


def test_blocking_happens_on_import():
    """The block should be in place immediately after import."""
    # Fresh import in this test function scope
    import importlib
    import sys

    # Clear any cached import
    if "python.sandboxed.network_lock" in sys.modules:
        del sys.modules["python.sandboxed.network_lock"]

    import python.sandboxed.network_lock  # noqa: F401

    # Immediately test
    with pytest.raises(PermissionError):
        socket.socket(socket.AF_INET, socket.SOCK_STREAM)


def test_fileno_parameter_blocked():
    """Fileno parameter should be blocked to prevent socket descriptor wrapping."""
    import python.sandboxed.network_lock  # noqa: F401

    # Even AF_UNIX with fileno should be blocked
    with pytest.raises(PermissionError, match="file descriptors"):
        socket.socket(socket.AF_UNIX, socket.SOCK_STREAM, fileno=3)
