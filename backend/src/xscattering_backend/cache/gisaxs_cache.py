"""
GISAXS transform caching utilities.

Provides cached GISAXS transformation to avoid redundant computations
when only linecut parameters change but the image and calibration stay the same.
The transformation (using pyFAI FiberIntegrator) is expensive, so caching
is critical for responsive UI updates.
"""

import hashlib
import json
import threading
from typing import Dict, List, Optional

from xscattering_backend.cache.image_cache import get_cached_processed_image
from xscattering_backend.config.logging import get_logger
from xscattering_backend.config.settings import get_config
from xscattering_backend.utils.q_space import (
    GISAXSTransformResult,
    transform_gisaxs_to_qspace,
)

logger = get_logger(__name__)

# Cache for GISAXS transforms
# Key: hash of (scan_uri, calibration, mask_uri)
# Value: GISAXSTransformResult
_gisaxs_cache: Dict[str, GISAXSTransformResult] = {}
_gisaxs_order: List[str] = []  # LRU tracking - most recent at end
_gisaxs_lock = threading.Lock()


def _get_max_cache_size() -> int:
    """Get the maximum cache size from configuration."""
    config = get_config()
    # Use dedicated GISAXS cache size or fall back to Q-space cache size
    return config.get("cache_gisaxs_size", config.get("cache_qspace_size", 20))


def _compute_cache_key(
    scan_uri: str,
    calibration: dict,
    mask_uri: Optional[str] = None,
) -> str:
    """
    Compute a cache key from scan URI, calibration, and mask.

    Args:
        scan_uri: Scan URI for the image
        calibration: Calibration parameters dict
        mask_uri: Optional mask URI

    Returns:
        Hash string suitable for use as a cache key
    """
    # Create a deterministic string representation
    # Only include calibration params that affect the transform
    relevant_calibration = {
        "sample_detector_distance": calibration.get("sample_detector_distance"),
        "beam_center_x": calibration.get("beam_center_x"),
        "beam_center_y": calibration.get("beam_center_y"),
        "pixel_size_x": calibration.get("pixel_size_x"),
        "pixel_size_y": calibration.get("pixel_size_y"),
        "wavelength": calibration.get("wavelength"),
        "incident_angle": calibration.get("incident_angle"),
        "tilt": calibration.get("tilt", 0.0),
        "tilt_plan_rotation": calibration.get("tilt_plan_rotation", 0.0),
    }

    key_data = {
        "scan_uri": scan_uri,
        "calibration": {k: v for k, v in sorted(relevant_calibration.items()) if v is not None},
        "mask_uri": mask_uri,
    }
    key_str = json.dumps(key_data, sort_keys=True)
    return hashlib.sha256(key_str.encode()).hexdigest()[:16]


def get_or_compute_gisaxs_transform(
    scan_uri: str,
    calibration: dict,
    mask_uri: Optional[str] = None,
) -> GISAXSTransformResult:
    """
    Get GISAXS transform from cache or compute and cache it.

    This function is thread-safe and uses LRU-style eviction
    when the cache exceeds the maximum size.

    Args:
        scan_uri: Scan URI for the image
        calibration: Calibration parameters dict with keys:
            - sample_detector_distance (mm)
            - beam_center_x, beam_center_y (pixels)
            - pixel_size_x, pixel_size_y (micrometers)
            - wavelength (Angstroms)
            - incident_angle (degrees)
            - tilt, tilt_plan_rotation (degrees, optional)
        mask_uri: Optional mask URI

    Returns:
        GISAXSTransformResult with transformed image and Q-coordinate arrays
    """
    cache_key = _compute_cache_key(scan_uri, calibration, mask_uri)
    max_cache_size = _get_max_cache_size()

    with _gisaxs_lock:
        if cache_key in _gisaxs_cache:
            # Move to end for LRU tracking
            if cache_key in _gisaxs_order:
                _gisaxs_order.remove(cache_key)
            _gisaxs_order.append(cache_key)
            logger.debug(f"GISAXS cache hit: {cache_key}")
            return _gisaxs_cache[cache_key]

    logger.debug(f"GISAXS cache miss: {cache_key}")

    # Get the original image from cache
    # Note: The image already has masked pixels set to NaN, so we don't need
    # to pass the mask to the transform - NaN values propagate naturally
    processed = get_cached_processed_image(scan_uri.lstrip("/"), mask_uri=mask_uri)
    image_array = processed.array

    # Compute GISAXS transform (outside lock to allow parallel computation)
    # No mask passed - the NaN values in the image handle masking
    result = transform_gisaxs_to_qspace(image_array, calibration)

    with _gisaxs_lock:
        # Check if another thread added it while we were computing
        if cache_key not in _gisaxs_cache:
            # Enforce cache size limit with proper LRU eviction
            while len(_gisaxs_order) >= max_cache_size:
                oldest_key = _gisaxs_order.pop(0)
                if oldest_key in _gisaxs_cache:
                    del _gisaxs_cache[oldest_key]
                    logger.debug(f"GISAXS cache evict: {oldest_key}")

            _gisaxs_cache[cache_key] = result
            _gisaxs_order.append(cache_key)
        else:
            # Another thread added it - update LRU order and use their result
            if cache_key in _gisaxs_order:
                _gisaxs_order.remove(cache_key)
            _gisaxs_order.append(cache_key)
            result = _gisaxs_cache[cache_key]

    return result


def invalidate_gisaxs_cache(scan_uri: Optional[str] = None) -> int:
    """
    Invalidate GISAXS transform cache entries.

    Args:
        scan_uri: If provided, only invalidate entries for this scan.
                  If None, clear the entire cache.

    Returns:
        Number of entries invalidated
    """
    with _gisaxs_lock:
        if scan_uri is None:
            count = len(_gisaxs_cache)
            _gisaxs_cache.clear()
            _gisaxs_order.clear()
            logger.info(f"GISAXS cache cleared: {count} entries")
            return count

        # Find keys matching the scan_uri
        keys_to_remove = [k for k in _gisaxs_cache if scan_uri in k]
        for key in keys_to_remove:
            del _gisaxs_cache[key]
            if key in _gisaxs_order:
                _gisaxs_order.remove(key)

        if keys_to_remove:
            logger.info(f"GISAXS cache invalidated {len(keys_to_remove)} entries for {scan_uri}")
        return len(keys_to_remove)
