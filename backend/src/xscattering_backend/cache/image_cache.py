"""
In-memory LRU cache for processed scan images.

This module provides a centralized cache that:
1. Caches processed images for reuse across operations
2. Allows azimuthal integration to reuse cached images instead of re-fetching
3. Thread-safe for concurrent access from batch processing
4. Supports optional mask application (mask_uri parameter)
"""

import urllib.parse as urlparse
from dataclasses import dataclass

import numpy as np
from xscattering_backend.cache.base import LRUCache
from xscattering_backend.cache.tiled_cache import (
    get_tiled_base_uri,
    get_tiled_client_for_uri,
)
from xscattering_backend.config.logging import get_logger
from xscattering_backend.config.settings import get_config
from xscattering_backend.utils.scans import get_processed_image

logger = get_logger(__name__)


@dataclass
class ProcessedImageData:
    """Processed image data."""

    array: np.ndarray  # 2D float32 array
    shape: tuple[int, int]  # (height, width)


def _load_mask_array(mask_uri: str) -> np.ndarray | None:
    """
    Load a mask array from cache or Tiled.

    Args:
        mask_uri: Mask URI or mask_id

    Returns:
        Mask array or None if not found
    """
    # Import here to avoid circular imports
    from xscattering_backend.cache.mask_cache import get_cached_mask
    from xscattering_backend.utils.mask_loader import load_mask_from_tiled

    # Check if it's already cached (uploaded or previously loaded)
    mask = get_cached_mask(mask_uri)
    if mask is not None:
        return mask

    # Try loading from Tiled
    try:
        tiled_base_uri = get_tiled_base_uri()
        return load_mask_from_tiled(mask_uri, tiled_base_uri)
    except Exception as e:
        logger.warning(f"Could not load mask '{mask_uri}': {e}")
        return None


def _fetch_and_process_image(
    scan_uri: str,
    mask_uri: str | None = None,
) -> ProcessedImageData:
    """
    Fetch an image from Tiled and process it.

    Args:
        scan_uri: Scan URI like "rawdata/NaCl_small/NaCl_1_10_sample_2_2m"
        mask_uri: Optional mask URI or mask_id for detector mask

    Returns:
        ProcessedImageData with the processed image array
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
                logger.warning(f"Mask shape {mask_array.shape} doesn't match image shape {img_shape}")
                mask_array = None

    # Apply processing (converts to float32, masks negatives/NaN, applies detector mask)
    processed_image = get_processed_image(image_array, mask_detector=mask_array)

    # Ensure float32 (avoid redundant conversion if already float32)
    if processed_image.dtype != np.float32:
        processed_image = processed_image.astype(np.float32)

    return ProcessedImageData(
        array=processed_image,
        shape=processed_image.shape,
    )


def _get_max_cache_size() -> int:
    """Get the maximum image cache size from configuration."""
    return get_config()["cache_image_size"]


# Initialize cache lazily to allow config to be loaded first
_image_cache: LRUCache[str, ProcessedImageData] | None = None


def _get_cache() -> LRUCache[str, ProcessedImageData]:
    """Get or create the image cache instance."""
    global _image_cache
    if _image_cache is None:
        _image_cache = LRUCache(max_size=_get_max_cache_size(), name="Image")
    return _image_cache


def get_cached_processed_image(
    scan_uri: str,
    mask_uri: str | None = None,
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
        ProcessedImageData with the processed image array
    """
    # Normalize the scan_uri
    scan_uri = scan_uri.lstrip("/")

    # Create cache key that includes mask (different mask = different result)
    cache_key = f"{scan_uri}|mask={mask_uri or 'none'}"

    # If bypassing cache, just fetch and return without caching
    if bypass_cache:
        return _fetch_and_process_image(scan_uri, mask_uri)

    def compute() -> ProcessedImageData:
        return _fetch_and_process_image(scan_uri, mask_uri)

    return _get_cache().get_or_compute(cache_key, compute)
