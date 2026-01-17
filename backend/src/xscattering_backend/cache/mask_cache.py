"""
Mask caching utilities.

Provides thread-safe LRU caching for detector masks loaded from Tiled
or uploaded files.
"""

import hashlib
import threading
from typing import List, Optional

import numpy as np

from xscattering_backend.config.logging import get_logger
from xscattering_backend.config.settings import get_config

logger = get_logger(__name__)


# Thread-safe mask cache for Tiled masks
_mask_cache: dict[str, np.ndarray] = {}
_mask_cache_order: List[str] = []  # LRU tracking
_mask_cache_lock = threading.Lock()

# Cache for uploaded masks (keyed by content hash)
_uploaded_mask_cache: dict[str, np.ndarray] = {}
_uploaded_mask_order: List[str] = []  # LRU tracking


def _get_max_cache_size() -> int:
    """Get the maximum mask cache size from configuration."""
    return get_config()["cache_mask_size"]


def _evict_lru_if_needed(
    cache: dict,
    order: List[str],
    max_size: int,
    cache_name: str,
) -> None:
    """
    Evict least recently used items if cache exceeds max size.

    Must be called while holding the cache lock.

    Args:
        cache: The cache dictionary
        order: The LRU order list
        max_size: Maximum cache size
        cache_name: Name for logging
    """
    while len(order) >= max_size:
        oldest_key = order.pop(0)
        if oldest_key in cache:
            del cache[oldest_key]
            logger.debug(f"{cache_name} cache evict: {oldest_key}")


def _update_lru_order(key: str, order: List[str]) -> None:
    """
    Update LRU order by moving key to the end (most recently used).

    Must be called while holding the cache lock.
    """
    if key in order:
        order.remove(key)
    order.append(key)


def get_cached_mask(mask_id: str) -> Optional[np.ndarray]:
    """
    Get a mask from cache by its ID.

    Parameters
    ----------
    mask_id : str
        Either a Tiled URI cache key or an uploaded mask ID.

    Returns
    -------
    np.ndarray or None
        The cached mask, or None if not found.
    """
    with _mask_cache_lock:
        if mask_id in _mask_cache:
            _update_lru_order(mask_id, _mask_cache_order)
            return _mask_cache[mask_id]
        if mask_id in _uploaded_mask_cache:
            _update_lru_order(mask_id, _uploaded_mask_order)
            return _uploaded_mask_cache[mask_id]
    return None


def cache_tiled_mask(cache_key: str, mask_array: np.ndarray) -> None:
    """
    Cache a mask loaded from Tiled.

    Parameters
    ----------
    cache_key : str
        Cache key (typically f"{tiled_base_uri}:{mask_uri}")
    mask_array : np.ndarray
        The mask array to cache
    """
    max_size = _get_max_cache_size()

    with _mask_cache_lock:
        if cache_key not in _mask_cache:
            _evict_lru_if_needed(_mask_cache, _mask_cache_order, max_size, "Tiled mask")
            _mask_cache[cache_key] = mask_array
            _mask_cache_order.append(cache_key)
        else:
            _update_lru_order(cache_key, _mask_cache_order)


def get_tiled_mask_from_cache(cache_key: str) -> Optional[np.ndarray]:
    """
    Get a Tiled mask from cache.

    Parameters
    ----------
    cache_key : str
        Cache key (typically f"{tiled_base_uri}:{mask_uri}")

    Returns
    -------
    np.ndarray or None
        The cached mask, or None if not found
    """
    with _mask_cache_lock:
        if cache_key in _mask_cache:
            _update_lru_order(cache_key, _mask_cache_order)
            logger.debug(f"Tiled mask cache hit: {cache_key}")
            return _mask_cache[cache_key]
    return None


def cache_uploaded_mask(mask_array: np.ndarray, file_content: bytes) -> str:
    """
    Cache an uploaded mask and return its ID.

    Parameters
    ----------
    mask_array : np.ndarray
        The mask array to cache
    file_content : bytes
        Raw file content (used for hash-based ID)

    Returns
    -------
    str
        The mask_id for this cached mask
    """
    content_hash = hashlib.sha256(file_content).hexdigest()[:16]
    mask_id = f"uploaded_{content_hash}"
    max_size = _get_max_cache_size()

    with _mask_cache_lock:
        if mask_id not in _uploaded_mask_cache:
            _evict_lru_if_needed(
                _uploaded_mask_cache, _uploaded_mask_order, max_size, "Uploaded mask"
            )
            _uploaded_mask_cache[mask_id] = mask_array
            _uploaded_mask_order.append(mask_id)
        else:
            _update_lru_order(mask_id, _uploaded_mask_order)

    return mask_id


def get_uploaded_mask_from_cache(file_content: bytes) -> Optional[tuple[np.ndarray, str]]:
    """
    Check if an uploaded mask is already cached.

    Parameters
    ----------
    file_content : bytes
        Raw file content

    Returns
    -------
    tuple[np.ndarray, str] or None
        (mask_array, mask_id) if cached, None otherwise
    """
    content_hash = hashlib.sha256(file_content).hexdigest()[:16]
    mask_id = f"uploaded_{content_hash}"

    with _mask_cache_lock:
        if mask_id in _uploaded_mask_cache:
            _update_lru_order(mask_id, _uploaded_mask_order)
            logger.debug(f"Uploaded mask cache hit: {mask_id}")
            return _uploaded_mask_cache[mask_id], mask_id
    return None
