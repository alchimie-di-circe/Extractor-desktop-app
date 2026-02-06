"""
Path Whitelist - Validates export paths against allowed directories.

Enforces strict whitelisting to prevent directory traversal or symlink escapes:
- ~/Exports/ (primary export directory)
- ~/Documents/TraeExports/ (secondary export directory)

Any attempt to write outside these directories is rejected.
"""

from pathlib import Path
from typing import Optional


class SecurityError(Exception):
    """Raised when a path validation fails security checks."""

    pass


def validate_export_path(user_path: str) -> str:
    """
    Validate and normalize an export path.

    Args:
        user_path: The path to validate

    Returns:
        Normalized, validated path as string

    Raises:
        SecurityError: If path fails any validation check
    """
    if not user_path:
        raise SecurityError("Path cannot be empty")

    if "\x00" in user_path:
        raise SecurityError("Path contains invalid null bytes")

    # Check for obvious traversal attempts BEFORE normalization
    segments = user_path.split("/")
    if any(seg == ".." for seg in segments):
        raise SecurityError("Path contains traversal sequences (..)")

    # Resolve to absolute path
    try:
        resolved = Path(user_path).resolve()
    except (ValueError, RuntimeError) as e:
        raise SecurityError(f"Failed to resolve path: {e}")

    # Must be absolute
    if not resolved.is_absolute():
        raise SecurityError("Path must be absolute")

    # Define whitelist directories
    home = Path.home()
    whitelist = [
        home / "Exports",
        home / "Documents" / "TraeExports",
    ]

    # Check if the resolved path is within one of the whitelisted directories
    is_allowed = False
    for allowed_dir in whitelist:
        try:
            # Resolve the whitelist dir too (in case it contains symlinks)
            allowed_resolved = allowed_dir.resolve()
            # Check if resolved path is under allowed directory
            resolved.relative_to(allowed_resolved)
            is_allowed = True
            break
        except ValueError:
            # Not under this whitelist dir, continue checking
            continue

    if not is_allowed:
        raise SecurityError(
            f"Path {resolved} is outside allowed directories: "
            f"{', '.join(str(d) for d in whitelist)}"
        )

    return str(resolved)


def validate_photo_export_path(album: str, photo_id: str) -> str:
    """
    Generate and validate a safe export path for a photo.

    Args:
        album: Album name (sanitized)
        photo_id: Photo ID

    Returns:
        Safe export path

    Raises:
        SecurityError: If album/photo_id are empty or contain invalid characters
    """
    # Validate non-empty
    if not album:
        raise SecurityError("Album name cannot be empty")
    if not photo_id:
        raise SecurityError("Photo ID cannot be empty")

    # Sanitize album name (alphanumeric, dash, underscore only)
    if not all(c.isalnum() or c in "-_" for c in album):
        raise SecurityError(f"Invalid characters in album name: {album}")

    # Sanitize photo_id (must be numeric/hex-like)
    if not all(c.isalnum() or c in "-_" for c in photo_id):
        raise SecurityError(f"Invalid characters in photo_id: {photo_id}")

    # Build safe path: ~/Exports/{album}/{photo_id}.jpg
    export_path = Path.home() / "Exports" / album / f"{photo_id}.jpg"

    # Validate before returning
    return validate_export_path(str(export_path))
