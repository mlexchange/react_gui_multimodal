"""
SAXS Q-matrix caching utilities.

Provides cached Q-matrix computation for SAXS experiments to avoid redundant
calculations when only linecut parameters change but calibration stays the same.

Note: For GISAXS, Q matrices are computed as part of the image transformation
and cached in gisaxs_cache.py.
"""

import hashlib
import json

import numpy as np
from xscattering_backend.cache.base import LRUCache
from xscattering_backend.config.logging import get_logger
from xscattering_backend.config.settings import get_config
from xscattering_backend.utils.q_space import compute_saxs_q_matrices

logger = get_logger(__name__)


def _get_max_cache_size() -> int:
    """Get the maximum cache size from configuration."""
    return get_config()["cache_qspace_size"]


# Initialize cache lazily to allow config to be loaded first
_saxs_q_cache: LRUCache[str, tuple[np.ndarray, np.ndarray]] | None = None


def _get_cache() -> LRUCache[str, tuple[np.ndarray, np.ndarray]]:
    """Get or create the SAXS Q-matrix cache instance."""
    global _saxs_q_cache
    if _saxs_q_cache is None:
        _saxs_q_cache = LRUCache(max_size=_get_max_cache_size(), name="SAXS Q-matrix")
    return _saxs_q_cache


def _compute_cache_key(image_shape: tuple[int, int], calibration: dict) -> str:
    """
    Compute a cache key from image shape and calibration parameters.

    Args:
        image_shape: (height, width) of the image
        calibration: Calibration parameters dict

    Returns:
        Hash string suitable for use as a cache key
    """
    key_data = {
        "shape": list(image_shape),
        "calibration": {k: v for k, v in sorted(calibration.items()) if v is not None},
    }
    key_str = json.dumps(key_data, sort_keys=True)
    return hashlib.sha256(key_str.encode()).hexdigest()[:16]


def get_or_compute_saxs_q_matrices(
    image_shape: tuple[int, int],
    calibration: dict,
) -> tuple[np.ndarray, np.ndarray]:
    """
    Get SAXS Q-matrices from cache or compute and cache them.

    This function is thread-safe and uses LRU-style eviction
    when the cache exceeds the maximum size.

    Note: This is for SAXS only. For GISAXS, Q matrices come from the
    GISAXS transform cache (gisaxs_cache.py).

    Args:
        image_shape: (height, width) of the image
        calibration: Calibration parameters dict with keys:
            - sample_detector_distance
            - beam_center_x, beam_center_y
            - pixel_size_x, pixel_size_y
            - wavelength
            - tilt, tilt_plan_rotation

    Returns:
        (q_x_matrix, q_y_matrix) as 2D numpy arrays
    """
    cache_key = _compute_cache_key(image_shape, calibration)

    def compute() -> tuple[np.ndarray, np.ndarray]:
        return compute_saxs_q_matrices(image_shape, calibration)

    return _get_cache().get_or_compute(cache_key, compute)
