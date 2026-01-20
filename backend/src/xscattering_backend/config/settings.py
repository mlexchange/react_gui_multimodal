"""
Centralized configuration management.

Provides environment variable-based configuration with defaults
for cache sizes, thread pool settings, and required service URLs.
"""

import os
from functools import lru_cache


class ConfigurationError(Exception):
    """Raised when required configuration is missing or invalid."""

    pass


@lru_cache(maxsize=1)
def get_config() -> dict:
    """
    Load and validate configuration from environment variables.

    Returns a cached configuration dict. Call once at startup to fail fast
    on missing required variables.

    Environment Variables
    ---------------------
    Required:
        SCATTERING_TILED_URL : str
            Base URL for the Tiled server.
        SCATTERING_TILED_API_KEY : str
            API key for Tiled authentication.

    Optional (with defaults):
        SCATTERING_BACKEND_DEVELOPMENT : bool
            Enable development mode with hot reload. Default: false.
        SCATTERING_BACKEND_HOST : str
            Host address to bind the server. Default: "0.0.0.0".
        SCATTERING_BACKEND_PORT : int
            Port number for the server. Default: 8000.
        SCATTERING_BACKEND_LOG_LEVEL : str
            Logging level (DEBUG/INFO/WARNING/ERROR). Default: INFO.
        SCATTERING_BACKEND_CACHE_IMAGE_SIZE : int
            Maximum number of processed images to cache. Default: 50.
        SCATTERING_BACKEND_CACHE_QSPACE_SIZE : int
            Maximum number of Q-space matrices to cache. Default: 20.
        SCATTERING_BACKEND_CACHE_GISAXS_SIZE : int
            Maximum number of GISAXS transforms to cache. Default: 20.
        SCATTERING_BACKEND_CACHE_MASK_SIZE : int
            Maximum number of masks to cache (per cache type). Default: 50.
        SCATTERING_BACKEND_CACHE_TILED_URIS : int
            Maximum number of Tiled URI clients to cache. Default: 4.
        SCATTERING_BACKEND_BATCH_MAX_WORKERS : int
            Maximum thread pool workers for batch processing. Default: 16.

    Returns
    -------
    dict
        Configuration values.

    Raises
    ------
    ConfigurationError
        If required environment variables are missing.
    """
    # Load required variables
    tiled_url = os.getenv("SCATTERING_TILED_URL")
    tiled_api_key = os.getenv("SCATTERING_TILED_API_KEY")

    # Validate required variables
    missing = []
    if not tiled_url:
        missing.append("SCATTERING_TILED_URL")
    if not tiled_api_key:
        missing.append("SCATTERING_TILED_API_KEY")

    if missing:
        raise ConfigurationError(
            f"Missing required environment variables: {', '.join(missing)}. "
            "Please set these variables before starting the server."
        )

    return {
        # Required
        "tiled_url": tiled_url,
        "tiled_api_key": tiled_api_key,
        # Server settings
        "development": os.getenv("SCATTERING_BACKEND_DEVELOPMENT", "false").lower() in ("true", "1", "yes"),
        "backend_host": os.getenv("SCATTERING_BACKEND_HOST", "0.0.0.0"),
        "backend_port": int(os.getenv("SCATTERING_BACKEND_PORT", "8000")),
        # Cache sizes
        "cache_image_size": int(os.getenv("SCATTERING_BACKEND_CACHE_IMAGE_SIZE", "50")),
        "cache_qspace_size": int(os.getenv("SCATTERING_BACKEND_CACHE_QSPACE_SIZE", "20")),
        "cache_gisaxs_size": int(os.getenv("SCATTERING_BACKEND_CACHE_GISAXS_SIZE", "20")),
        "cache_mask_size": int(os.getenv("SCATTERING_BACKEND_CACHE_MASK_SIZE", "50")),
        "cache_tiled_uris": int(os.getenv("SCATTERING_BACKEND_CACHE_TILED_URIS", "4")),
        # Thread pool
        "batch_max_workers": int(os.getenv("SCATTERING_BACKEND_BATCH_MAX_WORKERS", "16")),
    }


def validate_config_on_startup() -> None:
    """
    Validate configuration at application startup.

    Call this in main.py before starting the server to fail fast
    with a clear error message if configuration is invalid.
    """
    get_config()
