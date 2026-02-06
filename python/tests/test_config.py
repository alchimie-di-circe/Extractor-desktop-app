"""Unit tests for config module."""

import pytest
import os
from unittest.mock import patch
from pydantic import ValidationError
from config import Settings


class TestSettingsDefaults:
    """Tests for Settings default values."""

    def test_default_host(self):
        """Test default HOST value."""
        with patch.dict(os.environ, {}, clear=True):
            settings = Settings()
            assert settings.HOST == "127.0.0.1"

    def test_default_port(self):
        """Test default PORT value."""
        with patch.dict(os.environ, {}, clear=True):
            settings = Settings()
            assert settings.PORT == 8765

    def test_default_log_level(self):
        """Test default LOG_LEVEL value."""
        with patch.dict(os.environ, {}, clear=True):
            settings = Settings()
            assert settings.LOG_LEVEL == "INFO"


class TestSettingsEnvironmentOverrides:
    """Tests for environment variable overrides."""

    def test_host_from_environment(self):
        """Test HOST can be overridden by environment."""
        with patch.dict(os.environ, {"HOST": "127.0.0.2"}):
            settings = Settings()
            assert settings.HOST == "127.0.0.2"

    def test_port_from_environment(self):
        """Test PORT can be overridden by environment."""
        with patch.dict(os.environ, {"PORT": "9000"}):
            settings = Settings()
            assert settings.PORT == 9000

    def test_log_level_from_environment(self):
        """Test LOG_LEVEL can be overridden by environment."""
        with patch.dict(os.environ, {"LOG_LEVEL": "DEBUG"}):
            settings = Settings()
            assert settings.LOG_LEVEL == "DEBUG"

    def test_all_from_environment(self):
        """Test all settings can be overridden together."""
        with patch.dict(os.environ, {
            "HOST": "192.168.1.1",
            "PORT": "8080",
            "LOG_LEVEL": "WARNING"
        }):
            settings = Settings()
            assert settings.HOST == "192.168.1.1"
            assert settings.PORT == 8080
            assert settings.LOG_LEVEL == "WARNING"


class TestSettingsCaseSensitivity:
    """Tests for case sensitivity in environment variables."""

    def test_lowercase_env_var_ignored(self):
        """Test that lowercase env vars are ignored (case sensitive)."""
        with patch.dict(os.environ, {"host": "wrong", "HOST": "127.0.0.1"}):
            settings = Settings()
            # Should use the uppercase version
            assert settings.HOST == "127.0.0.1"

    def test_mixed_case_env_var_ignored(self):
        """Test that mixed case env vars are ignored."""
        with patch.dict(os.environ, {"Host": "wrong"}, clear=True):
            settings = Settings()
            # Should use default
            assert settings.HOST == "127.0.0.1"


class TestSettingsValidation:
    """Tests for settings validation."""

    def test_port_type_validation(self):
        """Test PORT must be integer."""
        with patch.dict(os.environ, {"PORT": "8765"}):
            settings = Settings()
            assert isinstance(settings.PORT, int)

    def test_invalid_port_raises_error(self):
        """Test invalid PORT value raises error."""
        with patch.dict(os.environ, {"PORT": "not_a_number"}):
            with pytest.raises(ValidationError):
                Settings()

    def test_host_type_validation(self):
        """Test HOST is string."""
        with patch.dict(os.environ, {}, clear=True):
            settings = Settings()
            assert isinstance(settings.HOST, str)

    def test_log_level_type_validation(self):
        """Test LOG_LEVEL is string."""
        with patch.dict(os.environ, {}, clear=True):
            settings = Settings()
            assert isinstance(settings.LOG_LEVEL, str)


class TestSettingsEdgeCases:
    """Tests for edge cases."""

    def test_empty_host_from_environment(self):
        """Test empty HOST value."""
        with patch.dict(os.environ, {"HOST": ""}):
            settings = Settings()
            assert settings.HOST == ""

    def test_very_high_port_number(self):
        """Test very high port number."""
        with patch.dict(os.environ, {"PORT": "65535"}):
            settings = Settings()
            assert settings.PORT == 65535

    def test_port_zero(self):
        """Test port 0 (OS assigns random port)."""
        with patch.dict(os.environ, {"PORT": "0"}):
            settings = Settings()
            assert settings.PORT == 0

    def test_log_level_variations(self):
        """Test various log level values."""
        log_levels = ["DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"]
        for level in log_levels:
            with patch.dict(os.environ, {"LOG_LEVEL": level}):
                settings = Settings()
                assert settings.LOG_LEVEL == level


class TestSettingsImmutability:
    """Tests for settings immutability."""

    def test_settings_can_be_created_multiple_times(self):
        """Test that multiple Settings instances can be created."""
        with patch.dict(os.environ, {}, clear=True):
            settings1 = Settings()
            settings2 = Settings()

            assert settings1.HOST == settings2.HOST
            assert settings1.PORT == settings2.PORT
            assert settings1.LOG_LEVEL == settings2.LOG_LEVEL

    def test_environment_changes_affect_new_instances(self):
        """Test that environment changes affect new instances."""
        with patch.dict(os.environ, {}, clear=True):
            settings1 = Settings()
            original_host = settings1.HOST

            with patch.dict(os.environ, {"HOST": "192.168.1.1"}):
                settings2 = Settings()
                assert settings2.HOST == "192.168.1.1"

            # Original instance unchanged
            assert settings1.HOST == original_host


class TestSettingsConfigClass:
    """Tests for Config inner class."""

    def test_config_has_env_file(self):
        """Test that Config specifies env_file."""
        assert hasattr(Settings.Config, 'env_file')
        assert Settings.Config.env_file == ".env"

    def test_config_case_sensitive(self):
        """Test that Config specifies case_sensitive."""
        assert hasattr(Settings.Config, 'case_sensitive')
        assert Settings.Config.case_sensitive is True


class TestSettingsIntegration:
    """Integration tests for Settings."""

    def test_settings_can_be_used_in_app_context(self):
        """Test Settings works in application context."""
        with patch.dict(os.environ, {}, clear=True):
            settings = Settings()

            # Simulate app usage
            host = settings.HOST
            port = settings.PORT
            log_level = settings.LOG_LEVEL.lower()

            assert isinstance(host, str)
            assert isinstance(port, int)
            assert log_level in ["debug", "info", "warning", "error", "critical"]

    def test_settings_default_suitable_for_development(self):
        """Test default settings are suitable for development."""
        with patch.dict(os.environ, {}, clear=True):
            settings = Settings()

            # Localhost for security
            assert settings.HOST == "127.0.0.1"

            # Non-privileged port
            assert settings.PORT > 1024

            # INFO level for development
            assert settings.LOG_LEVEL == "INFO"