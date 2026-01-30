"""
Infrastructure endpoint.

Provides a unified feature/capability check that tells the frontend
which optional services are configured and available.
"""

from fastapi import APIRouter
from xscattering_backend.cache.tiled_cache import is_tiled_calibration_enabled, is_tiled_results_enabled

router = APIRouter()


@router.get("/infrastructure")
async def get_infrastructure():
    """
    Return feature flags for optional infrastructure.

    The frontend calls this once on mount to discover which
    features are available (e.g., calibration Tiled, results Tiled).
    """
    return {
        "tiled_calibration_enabled": is_tiled_calibration_enabled(),
        "tiled_results_enabled": is_tiled_results_enabled(),
    }
