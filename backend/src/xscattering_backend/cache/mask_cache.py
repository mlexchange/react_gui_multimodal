"""
Mask caching utilities.

Provides thread-safe LRU caching for detector masks loaded from Tiled
or uploaded files.
"""

import hashlib

import numpy as np
from xscattering_backend.cache.base import LRUCache
from xscattering_backend.config.logging import get_logger
from xscattering_backend.config.settings import get_config

logger = get_logger(__name__)


def _get_max_cache_size() -> int:
    """Get the maximum mask cache size from configuration."""
    return get_config()["cache_mask_size"]


# Initialize caches lazily to allow config to be loaded first
_tiled_mask_cache: LRUCache[str, np.ndarray] | None = None
_uploaded_mask_cache: LRUCache[str, np.ndarray] | None = None


def _get_tiled_cache() -> LRUCache[str, np.ndarray]:
    """Get or create the Tiled mask cache instance."""
    global _tiled_mask_cache
    if _tiled_mask_cache is None:
        _tiled_mask_cache = LRUCache(max_size=_get_max_cache_size(), name="Tiled mask")
    return _tiled_mask_cache


def _get_uploaded_cache() -> LRUCache[str, np.ndarray]:
    """Get or create the uploaded mask cache instance."""
    global _uploaded_mask_cache
    if _uploaded_mask_cache is None:
        _uploaded_mask_cache = LRUCache(max_size=_get_max_cache_size(), name="Uploaded mask")
    return _uploaded_mask_cache


def get_cached_mask(mask_id: str) -> np.ndarray | None:
    """
    Get a mask from cache by its ID.

    Checks both Tiled and uploaded mask caches.

    Args:
        mask_id: Either a Tiled URI cache key or an uploaded mask ID.

    Returns:
        The cached mask, or None if not found.
    """
    # Check Tiled cache first
    mask = _get_tiled_cache().get(mask_id)
    if mask is not None:
        return mask

    # Check uploaded cache
    return _get_uploaded_cache().get(mask_id)


def cache_tiled_mask(cache_key: str, mask_array: np.ndarray) -> None:
    """
    Cache a mask loaded from Tiled.

    Args:
        cache_key: Cache key (typically f"{tiled_base_uri}:{mask_uri}")
        mask_array: The mask array to cache
    """
    _get_tiled_cache().put(cache_key, mask_array)


def get_tiled_mask_from_cache(cache_key: str) -> np.ndarray | None:
    """
    Get a Tiled mask from cache.

    Args:
        cache_key: Cache key (typically f"{tiled_base_uri}:{mask_uri}")

    Returns:
        The cached mask, or None if not found
    """
    return _get_tiled_cache().get(cache_key)


def cache_uploaded_mask(mask_array: np.ndarray, file_content: bytes) -> str:
    """
    Cache an uploaded mask and return its ID.

    Args:
        mask_array: The mask array to cache
        file_content: Raw file content (used for hash-based ID)

    Returns:
        The mask_id for this cached mask
    """
    content_hash = hashlib.sha256(file_content).hexdigest()[:16]
    mask_id = f"uploaded_{content_hash}"

    _get_uploaded_cache().put(mask_id, mask_array)
    return mask_id


def get_uploaded_mask_from_cache(
    file_content: bytes,
) -> tuple[np.ndarray, str] | None:
    """
    Check if an uploaded mask is already cached.

    Args:
        file_content: Raw file content

    Returns:
        (mask_array, mask_id) if cached, None otherwise
    """
    content_hash = hashlib.sha256(file_content).hexdigest()[:16]
    mask_id = f"uploaded_{content_hash}"

    mask = _get_uploaded_cache().get(mask_id)
    if mask is not None:
        return mask, mask_id
    return None
