"""
In-memory LRU cache for processed scan images with resolution levels.

This module provides a centralized cache that:
1. Caches processed images with all resolution levels pre-computed
2. Allows azimuthal integration to reuse cached images instead of re-fetching
3. Uses functools.lru_cache for simple, efficient in-memory caching
4. Thread-safe for concurrent access from batch processing
"""

import threading
import urllib.parse as urlparse
from dataclasses import dataclass
from typing import Tuple

import numpy as np

from utils.scans import get_processed_image
from utils.tiled_client import get_tiled_base_uri, get_tiled_client_for_uri


@dataclass
class ResolutionLevel:
    """Single resolution level of an image."""
    array: np.ndarray  # 2D float32 array
    factor: int  # Downsampling factor (1=full, 2/4/8=downsampled)


@dataclass
class ProcessedImageData:
    """Processed image with all resolution levels."""
    low: ResolutionLevel
    medium: ResolutionLevel
    full: ResolutionLevel
    original_shape: Tuple[int, int]  # (height, width)


def downsample_array(array: np.ndarray, factor: int) -> np.ndarray:
    """
    Downsample a 2D array by selecting every nth pixel.
    Mirrors frontend downsampleArray.ts logic exactly.

    Args:
        array: 2D numpy array to downsample
        factor: Downsampling factor (e.g., 2 = select every 2nd pixel)

    Returns:
        Downsampled array
    """
    if factor <= 1:
        return array
    return array[::factor, ::factor]


def compute_resolution_levels(image_array: np.ndarray) -> ProcessedImageData:
    """
    Compute all resolution levels for an image.
    Logic mirrors frontend processImageToResolutions().

    Args:
        image_array: 2D numpy array (float32)

    Returns:
        ProcessedImageData with low, medium, and full resolution levels
    """
    height, width = image_array.shape
    is_large_image = width > 2000 or height > 2000

    low_factor = 8 if is_large_image else 4
    medium_factor = 4 if is_large_image else 2

    return ProcessedImageData(
        low=ResolutionLevel(
            array=downsample_array(image_array, low_factor),
            factor=low_factor
        ),
        medium=ResolutionLevel(
            array=downsample_array(image_array, medium_factor),
            factor=medium_factor
        ),
        full=ResolutionLevel(
            array=image_array.copy(),
            factor=1
        ),
        original_shape=(height, width)
    )


def _fetch_and_process_image(scan_uri: str) -> ProcessedImageData:
    """
    Fetch an image from Tiled and process it into resolution levels.
    This is the internal function that does the actual work.

    Args:
        scan_uri: Scan URI like "rawdata/NaCl_small/NaCl_1_10_sample_2_2m"

    Returns:
        ProcessedImageData with all resolution levels
    """
    # Construct full URI
    tiled_base_uri = get_tiled_base_uri()
    tiled_uri = tiled_base_uri if tiled_base_uri.endswith("/") else tiled_base_uri + "/"
    full_uri = urlparse.urljoin(tiled_uri, scan_uri)

    # Fetch from Tiled
    image_client = get_tiled_client_for_uri(full_uri)
    image_array = image_client.read()

    # Apply processing (converts to float32, handles masks if any)
    processed_image = get_processed_image(image_array, mask_detector=None)

    # Ensure float32
    processed_image = np.array(processed_image, dtype=np.float32)

    # Compute all resolution levels
    return compute_resolution_levels(processed_image)


# Cache for processed images - keyed by scan_uri
# maxsize=50 balances memory usage with cache hits
# Using a wrapper because lru_cache doesn't work well with dataclasses as return values
_image_cache: dict[str, ProcessedImageData] = {}
_cache_order: list[str] = []  # For LRU tracking
_max_cache_size = 50
_cache_lock = threading.Lock()  # Thread safety for concurrent access


def get_cached_processed_image(
    scan_uri: str,
    bypass_cache: bool = False,
) -> ProcessedImageData:
    """
    Get processed image from cache or compute and cache it.
    This is the main entry point for all image access.
    Thread-safe for concurrent access from batch processing.

    Args:
        scan_uri: Scan URI like "rawdata/NaCl_small/NaCl_1_10_sample_2_2m"
        bypass_cache: If True, skip cache entirely (useful for batch processing
                      large datasets where cache thrashing would occur)

    Returns:
        ProcessedImageData with all resolution levels
    """
    global _image_cache, _cache_order

    # Normalize the scan_uri
    scan_uri = scan_uri.lstrip('/')

    # If bypassing cache, just fetch and return without caching
    if bypass_cache:
        return _fetch_and_process_image(scan_uri)

    # Check cache with lock
    with _cache_lock:
        if scan_uri in _image_cache:
            # Move to end of order list (most recently used)
            if scan_uri in _cache_order:
                _cache_order.remove(scan_uri)
            _cache_order.append(scan_uri)
            print(f"[CACHE HIT] {scan_uri}")
            return _image_cache[scan_uri]

    print(f"[CACHE MISS] {scan_uri}")

    # Cache miss - fetch and process (outside lock to allow concurrent fetches)
    processed = _fetch_and_process_image(scan_uri)

    # Add to cache with lock
    with _cache_lock:
        # Check again in case another thread added it while we were fetching
        if scan_uri not in _image_cache:
            _image_cache[scan_uri] = processed
            _cache_order.append(scan_uri)

            # Enforce cache size limit (LRU eviction)
            while len(_cache_order) > _max_cache_size:
                oldest_uri = _cache_order.pop(0)
                if oldest_uri in _image_cache:
                    del _image_cache[oldest_uri]
                print(f"[CACHE EVICT] {oldest_uri}")

    return processed


def clear_image_cache():
    """Clear the image cache. Useful for testing or memory management."""
    global _image_cache, _cache_order
    with _cache_lock:
        _image_cache = {}
        _cache_order = []
    print("[CACHE] Cleared")


def get_cache_info() -> dict:
    """Get cache statistics."""
    with _cache_lock:
        return {
            "size": len(_image_cache),
            "max_size": _max_cache_size,
            "cached_uris": list(_cache_order),
        }
