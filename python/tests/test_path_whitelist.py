"""
Test path_whitelist.py - Verify export path validation and security.

RED phase: These tests define expected behavior before implementation.
"""

import os
import pytest
from pathlib import Path
from python.sandboxed.path_whitelist import validate_export_path, validate_photo_export_path, SecurityError


class TestPathWhitelist:
    """Path whitelist validation tests."""

    def test_allowed_exports_directory(self, tmp_path):
        """Paths under ~/Exports should be allowed."""
        # Create a test path under a mock home directory
        exports_dir = Path.home() / "Exports"
        test_file = exports_dir / "photo.jpg"
        
        # Should not raise
        result = validate_export_path(str(test_file))
        assert isinstance(result, str)

    def test_allowed_trae_exports_directory(self, tmp_path):
        """Paths under ~/Documents/TraeExports should be allowed."""
        trae_exports = Path.home() / "Documents" / "TraeExports"
        test_file = trae_exports / "photo.jpg"
        
        # Should not raise
        result = validate_export_path(str(test_file))
        assert isinstance(result, str)

    def test_block_traversal_sequences(self):
        """Paths with .. traversal should be blocked."""
        with pytest.raises(SecurityError, match="traversal"):
            validate_export_path(str(Path.home() / "Exports" / ".." / ".." / "etc" / "passwd"))

    def test_block_etc_passwd(self):
        """Attempting to write to /etc/passwd should be blocked."""
        with pytest.raises(SecurityError):
            validate_export_path("/etc/passwd")

    def test_block_outside_whitelist(self):
        """Paths outside whitelist directories should be blocked."""
        with pytest.raises(SecurityError):
            validate_export_path("/tmp/trae-photos")

    def test_block_symlink_escape(self, tmp_path):
        """Symlinks resolving outside whitelist should be blocked."""
        # Create a temporary symlink that points outside whitelist
        link_dir = tmp_path / "link"
        link_dir.symlink_to("/etc")
        
        with pytest.raises(SecurityError, match="symlink|outside"):
            validate_export_path(str(link_dir / "passwd"))

    def test_normalize_trailing_slashes(self):
        """Paths with trailing slashes should be normalized."""
        exports_dir = Path.home() / "Exports"
        path_with_slash = str(exports_dir) + "/"
        
        result = validate_export_path(path_with_slash)
        assert result.endswith("Exports")  # Normalized
        assert not result.endswith("/")

    def test_absolute_paths_only(self):
        """Relative paths should be rejected (resolved to cwd, then outside whitelist)."""
        with pytest.raises(SecurityError, match="outside allowed"):
            validate_export_path("relative/path/photo.jpg")

    def test_null_bytes_blocked(self):
        """Paths with null bytes should be blocked."""
        with pytest.raises(SecurityError, match="invalid"):
            validate_export_path("/tmp/photo\x00.jpg")

    def test_empty_path_raises_error(self):
        """Empty paths should raise an error."""
        with pytest.raises(SecurityError):
            validate_export_path("")

    def test_empty_album_name_blocked(self):
        """Empty album name should be blocked."""
        with pytest.raises(SecurityError, match="Album name cannot be empty"):
            validate_photo_export_path("", "photo-123")

    def test_empty_photo_id_blocked(self):
        """Empty photo ID should be blocked."""
        with pytest.raises(SecurityError, match="Photo ID cannot be empty"):
            validate_photo_export_path("MyAlbum", "")
