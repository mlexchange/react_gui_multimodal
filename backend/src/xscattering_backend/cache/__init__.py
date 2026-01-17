"""Cache module for xscattering_backend."""

from xscattering_backend.cache.image_cache import (
    ProcessedImageData,
    ResolutionLevel,
    get_cached_processed_image,
)
from xscattering_backend.cache.mask_cache import (
    cache_tiled_mask,
    cache_uploaded_mask,
    get_cached_mask,
    get_tiled_mask_from_cache,
    get_uploaded_mask_from_cache,
)
from xscattering_backend.cache.q_matrix_cache import get_or_compute_q_matrices
from xscattering_backend.cache.tiled_cache import (
    get_tiled_base_uri,
    get_tiled_client,
    get_tiled_client_for_uri,
)

__all__ = [
    # Image cache
    "get_cached_processed_image",
    "ProcessedImageData",
    "ResolutionLevel",
    # Mask cache
    "get_cached_mask",
    "cache_tiled_mask",
    "cache_uploaded_mask",
    "get_tiled_mask_from_cache",
    "get_uploaded_mask_from_cache",
    # Q-matrix cache
    "get_or_compute_q_matrices",
    # Tiled cache
    "get_tiled_client",
    "get_tiled_client_for_uri",
    "get_tiled_base_uri",
]
