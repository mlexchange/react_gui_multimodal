"""
GISAXS transform caching utilities.

Provides cached GISAXS transformation to avoid redundant computations
when only linecut parameters change but the image and calibration stay the same.
The transformation (using pyFAI FiberIntegrator) is expensive, so caching
is critical for responsive UI updates.
"""

import hashlib
import json

from xscattering_backend.cache.base import LRUCache
from xscattering_backend.cache.image_cache import get_cached_processed_image
from xscattering_backend.config.logging import get_logger
from xscattering_backend.config.settings import get_config
from xscattering_backend.utils.q_space import (
    GISAXSTransformResult,
    transform_gisaxs_to_qspace,
)

logger = get_logger(__name__)


def _get_max_cache_size() -> int:
    """Get the maximum cache size from configuration."""
    config = get_config()
    return config.get("cache_gisaxs_size", config.get("cache_qspace_size", 20))


# Initialize cache lazily to allow config to be loaded first
_gisaxs_cache: LRUCache[str, GISAXSTransformResult] | None = None


def _get_cache() -> LRUCache[str, GISAXSTransformResult]:
    """Get or create the GISAXS cache instance."""
    global _gisaxs_cache
    if _gisaxs_cache is None:
        _gisaxs_cache = LRUCache(max_size=_get_max_cache_size(), name="GISAXS")
    return _gisaxs_cache


def _compute_cache_key(
    scan_uri: str,
    calibration: dict,
    mask_uri: str | None = None,
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
    mask_uri: str | None = None,
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

    def compute() -> GISAXSTransformResult:
        # Get the original image from cache
        # Note: The image already has masked pixels set to NaN, so we don't need
        # to pass the mask to the transform - NaN values propagate naturally
        processed = get_cached_processed_image(scan_uri.lstrip("/"), mask_uri=mask_uri)
        image_array = processed.array

        # Compute GISAXS transform
        # No mask passed - the NaN values in the image handle masking
        return transform_gisaxs_to_qspace(image_array, calibration)

    return _get_cache().get_or_compute(cache_key, compute)


def invalidate_gisaxs_cache(scan_uri: str | None = None) -> int:
    """
    Invalidate GISAXS transform cache entries.

    Args:
        scan_uri: If provided, only invalidate entries for this scan.
                  If None, clear the entire cache.

    Returns:
        Number of entries invalidated
    """
    cache = _get_cache()

    if scan_uri is None:
        return cache.invalidate()

    # Invalidate by predicate (matching scan_uri substring)
    return cache.invalidate(predicate=lambda k: scan_uri in k)
