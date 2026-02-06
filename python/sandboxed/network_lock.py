"""
Network Lock - Restricts socket creation to AF_UNIX only.

CRITICAL: Must be imported FIRST in any sandboxed process to install
the monkey patch before any network libraries load.

This prevents the sandboxed process from making network calls,
enforcing strict privacy/security boundary.
"""

import socket as _socket


# Store the original socket class
_OriginalSocket = _socket.socket


class _RestrictedSocket(_OriginalSocket):
    """Socket subclass that only allows AF_UNIX sockets."""

    def __init__(self, family=_socket.AF_UNIX, type=_socket.SOCK_STREAM, proto=0, fileno=None):
        """
        Override socket creation to restrict to AF_UNIX only.

        Raises:
            PermissionError: If family is anything other than AF_UNIX, or if fileno is provided.
        """
        # Block fileno to prevent wrapping existing network sockets
        if fileno is not None:
            raise PermissionError(
                "wrapping existing file descriptors is not allowed in sandboxed context."
            )

        if family != _socket.AF_UNIX:
            raise PermissionError(
                f"network operations not allowed: attempted socket family {family}. "
                "Only AF_UNIX sockets are permitted in sandboxed context."
            )

        # Call original socket constructor with AF_UNIX
        super().__init__(family, type, proto, fileno)


# Monkey-patch the socket class
_socket.socket = _RestrictedSocket
