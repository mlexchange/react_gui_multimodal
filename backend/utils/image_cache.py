"""
In-memory LRU cache for processed scan images with resolution levels.

This module provides a centralized cache that:
1. Caches processed images with all resolution levels pre-computed
2. Allows azimuthal integration to reuse cached images instead of re-fetching
3. Uses functools.lru_cache for simple, efficient in-memory caching
4. Thread-safe for concurrent access from batch processing
5. Supports optional mask application (mask_uri parameter)
"""

import threading
import urllib.parse as urlparse
from dataclasses import dataclass
from typing import Optional, Tuple

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


def _load_mask_array(mask_uri: str) -> Optional[np.ndarray]:
    """
    Load a mask array from cache or Tiled.

    Args:
        mask_uri: Mask URI or mask_id

    Returns:
        Mask array or None if not found
    """
    # Import here to avoid circular imports
    from utils.mask_manager import get_cached_mask, load_mask_from_tiled

    # Check if it's already cached (uploaded or previously loaded)
    mask = get_cached_mask(mask_uri)
    if mask is not None:
        return mask

    # Try loading from Tiled
    try:
        tiled_base_uri = get_tiled_base_uri()
        return load_mask_from_tiled(mask_uri, tiled_base_uri)
    except Exception as e:
        print(f"[WARN] Could not load mask '{mask_uri}': {e}")
        return None


def _fetch_and_process_image(
    scan_uri: str,
    mask_uri: Optional[str] = None,
) -> ProcessedImageData:
    """
    Fetch an image from Tiled and process it into resolution levels.
    This is the internal function that does the actual work.

    Args:
        scan_uri: Scan URI like "rawdata/NaCl_small/NaCl_1_10_sample_2_2m"
        mask_uri: Optional mask URI or mask_id for detector mask

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

    # Load mask if provided
    mask_array = None
    if mask_uri:
        mask_array = _load_mask_array(mask_uri)
        if mask_array is not None:
            # Validate mask shape matches image shape
            img_shape = np.squeeze(image_array).shape
            if mask_array.shape != img_shape:
                print(f"[WARN] Mask shape {mask_array.shape} doesn't match image shape {img_shape}")
                mask_array = None

    # Apply processing (converts to float32, masks negatives/NaN, applies detector mask)
    processed_image = get_processed_image(image_array, mask_detector=mask_array)

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
    mask_uri: Optional[str] = None,
    bypass_cache: bool = False,
) -> ProcessedImageData:
    """
    Get processed image from cache or compute and cache it.
    This is the main entry point for all image access.
    Thread-safe for concurrent access from batch processing.

    Args:
        scan_uri: Scan URI like "rawdata/NaCl_small/NaCl_1_10_sample_2_2m"
        mask_uri: Optional mask URI or mask_id for detector mask
        bypass_cache: If True, skip cache entirely (useful for batch processing
                      large datasets where cache thrashing would occur)

    Returns:
        ProcessedImageData with all resolution levels
    """
    global _image_cache, _cache_order

    # Normalize the scan_uri
    scan_uri = scan_uri.lstrip("/")

    # Create cache key that includes mask (different mask = different result)
    cache_key = f"{scan_uri}|mask={mask_uri or 'none'}"

    # If bypassing cache, just fetch and return without caching
    if bypass_cache:
        return _fetch_and_process_image(scan_uri, mask_uri)

    # Check cache with lock
    with _cache_lock:
        if cache_key in _image_cache:
            # Move to end of order list (most recently used)
            if cache_key in _cache_order:
                _cache_order.remove(cache_key)
            _cache_order.append(cache_key)
            print(f"[CACHE HIT] {cache_key}")
            return _image_cache[cache_key]

    print(f"[CACHE MISS] {cache_key}")

    # Cache miss - fetch and process (outside lock to allow concurrent fetches)
    processed = _fetch_and_process_image(scan_uri, mask_uri)

    # Add to cache with lock
    with _cache_lock:
        # Check again in case another thread added it while we were fetching
        if cache_key not in _image_cache:
            _image_cache[cache_key] = processed
            _cache_order.append(cache_key)

            # Enforce cache size limit (LRU eviction)
            while len(_cache_order) > _max_cache_size:
                oldest_key = _cache_order.pop(0)
                if oldest_key in _image_cache:
                    del _image_cache[oldest_key]
                print(f"[CACHE EVICT] {oldest_key}")

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
