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
    import sys

    # Clear any cached import
    if "python.sandboxed.network_lock" in sys.modules:
        del sys.modules["python.sandboxed.network_lock"]

    import python.sandboxed.network_lock  # noqa: F401

    # Immediately test
    with pytest.raises(PermissionError):
        socket.socket(socket.AF_INET, socket.SOCK_STREAM)


def test_fileno_allowed_for_af_unix():
    """Fileno parameter should be allowed for AF_UNIX (needed for asyncio.socketpair)."""
    import python.sandboxed.network_lock  # noqa: F401

    # AF_UNIX with fileno should be allowed (no actual fd needed for this test)
    # Just verify it doesn't raise PermissionError for AF_UNIX+fileno combination
    try:
        # This will fail with a different error (bad file descriptor) but NOT PermissionError
        socket.socket(socket.AF_UNIX, socket.SOCK_STREAM, fileno=999)
    except PermissionError:
        pytest.fail("AF_UNIX with fileno should not raise PermissionError")
    except (OSError, ValueError):
        # Expected: invalid file descriptor, but that's OK -- we're just testing it doesn't raise PermissionError
        pass


def test_fileno_blocked_for_non_af_unix():
    """Fileno parameter should be blocked for non-AF_UNIX sockets to prevent network wrapping."""
    import python.sandboxed.network_lock  # noqa: F401

    # AF_INET with fileno should be blocked
    with pytest.raises(PermissionError, match="non-AF_UNIX"):
        socket.socket(socket.AF_INET, socket.SOCK_STREAM, fileno=3)
