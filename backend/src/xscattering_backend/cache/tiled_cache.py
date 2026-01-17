"""
Centralized Tiled client module.

Provides cached connections to the Tiled server that can be reused
across all routes, avoiding repeated client initialization.
"""

from functools import lru_cache

from dotenv import load_dotenv
from tiled.client import from_uri

from xscattering_backend.config.settings import get_config

# Load .env file (auto-discovers from current and parent directories)
load_dotenv()


@lru_cache(maxsize=1)
def get_tiled_client():
    """Get cached tiled client instance for the base server."""
    config = get_config()
    return from_uri(config["tiled_url"], api_key=config["tiled_api_key"])


def get_tiled_client_for_uri(uri: str):
    """
    Get cached tiled client for a specific URI (e.g., image URIs).

    Uses dynamic LRU cache size from configuration.
    """
    config = get_config()
    return _get_tiled_client_for_uri_cached(uri, config["tiled_api_key"])


@lru_cache(maxsize=4)
def _get_tiled_client_for_uri_cached(uri: str, api_key: str):
    """Internal cached function for URI-specific clients."""
    return from_uri(uri, api_key=api_key)


def get_tiled_base_uri() -> str:
    """Get the base URI from the tiled client."""
    return get_tiled_client().uri
