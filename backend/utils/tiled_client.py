"""
Centralized Tiled client module.

Provides cached connections to the Tiled server that can be reused
across all routes, avoiding repeated client initialization.
"""

import os
from functools import lru_cache

from dotenv import load_dotenv
from tiled.client import from_uri


@lru_cache(maxsize=1)
def _load_config() -> dict:
    """Load and cache tiled configuration from environment."""
    load_dotenv("../.env")
    return {
        "url": os.getenv("SCATTERING_TILED_URL"),
        "api_key": os.getenv("SCATTERING_TILED_API_KEY"),
    }


@lru_cache(maxsize=1)
def get_tiled_client():
    """Get cached tiled client instance for the base server."""
    config = _load_config()
    return from_uri(config["url"], api_key=config["api_key"])


@lru_cache(maxsize=4)
def get_tiled_client_for_uri(uri: str):
    """Get cached tiled client for a specific URI (e.g., image URIs)."""
    config = _load_config()
    return from_uri(uri, api_key=config["api_key"])


def get_tiled_base_uri() -> str:
    """Get the base URI from the tiled client."""
    return get_tiled_client().uri


def get_tiled_api_key() -> str:
    """Get the tiled API key."""
    return _load_config()["api_key"]
