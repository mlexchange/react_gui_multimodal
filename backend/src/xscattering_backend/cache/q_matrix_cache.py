"""
Q-matrix caching utilities.

Provides cached Q-matrix computation to avoid redundant calculations
when only linecut parameters change but calibration stays the same.
"""

import hashlib
import json
import threading
from typing import Dict, List, Tuple

import numpy as np

from xscattering_backend.config.logging import get_logger
from xscattering_backend.config.settings import get_config
from xscattering_backend.utils.q_space import compute_q_matrices

logger = get_logger(__name__)

# Cache for Q-matrices
# Key: hash of (image_shape, calibration)
# Value: (q_x_matrix, q_y_matrix)
_q_matrix_cache: Dict[str, Tuple[np.ndarray, np.ndarray]] = {}
_q_matrix_order: List[str] = []  # LRU tracking - most recent at end
_q_matrix_lock = threading.Lock()


def _get_max_cache_size() -> int:
    """Get the maximum cache size from configuration."""
    return get_config()["cache_qspace_size"]


def _compute_cache_key(image_shape: Tuple[int, int], calibration: dict) -> str:
    """
    Compute a cache key from image shape and calibration parameters.

    Args:
        image_shape: (height, width) of the image
        calibration: Calibration parameters dict

    Returns:
        Hash string suitable for use as a cache key
    """
    # Create a deterministic string representation
    key_data = {
        "shape": list(image_shape),
        "calibration": {
            k: v for k, v in sorted(calibration.items())
            if v is not None
        },
    }
    key_str = json.dumps(key_data, sort_keys=True)
    return hashlib.sha256(key_str.encode()).hexdigest()[:16]


def get_or_compute_q_matrices(
    image_shape: Tuple[int, int],
    calibration: dict,
) -> Tuple[np.ndarray, np.ndarray]:
    """
    Get Q-matrices from cache or compute and cache them.

    This function is thread-safe and uses LRU-style eviction
    when the cache exceeds the maximum size.

    Args:
        image_shape: (height, width) of the image
        calibration: Calibration parameters dict with keys:
            - sample_detector_distance
            - beam_center_x, beam_center_y
            - pixel_size_x, pixel_size_y
            - wavelength
            - tilt, tilt_plan_rotation
            - experiment_type (SAXS or GISAXS)
            - incident_angle (for GISAXS)

    Returns:
        (q_x_matrix, q_y_matrix) as 2D numpy arrays
    """
    cache_key = _compute_cache_key(image_shape, calibration)
    max_cache_size = _get_max_cache_size()

    with _q_matrix_lock:
        if cache_key in _q_matrix_cache:
            # Move to end for LRU tracking
            if cache_key in _q_matrix_order:
                _q_matrix_order.remove(cache_key)
            _q_matrix_order.append(cache_key)
            logger.debug(f"Q-matrix cache hit: {cache_key}")
            return _q_matrix_cache[cache_key]

    logger.debug(f"Q-matrix cache miss: {cache_key}")

    # Compute Q-matrices (outside lock to allow parallel computation)
    q_x, q_y = compute_q_matrices(image_shape, calibration)

    with _q_matrix_lock:
        # Check if another thread added it while we were computing
        if cache_key not in _q_matrix_cache:
            # Enforce cache size limit with proper LRU eviction
            while len(_q_matrix_order) >= max_cache_size:
                oldest_key = _q_matrix_order.pop(0)
                if oldest_key in _q_matrix_cache:
                    del _q_matrix_cache[oldest_key]
                    logger.debug(f"Q-matrix cache evict: {oldest_key}")

            _q_matrix_cache[cache_key] = (q_x, q_y)
            _q_matrix_order.append(cache_key)
        else:
            # Another thread added it - update LRU order
            if cache_key in _q_matrix_order:
                _q_matrix_order.remove(cache_key)
            _q_matrix_order.append(cache_key)

    return q_x, q_y
