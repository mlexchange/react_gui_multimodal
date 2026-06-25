"""
Health check endpoint.

Provides a unified health check that tells the frontend which optional
services are configured and available, along with live status for each.
"""

from datetime import datetime, timezone

from fastapi import APIRouter
from xscattering_backend.cache.tiled_cache import get_tiled_calibration_client, get_tiled_client, get_tiled_results_client

router = APIRouter()


def _check_tiled_data() -> dict:
    """Check the main Tiled data server."""
    try:
        client = get_tiled_client()
        _ = client.uri
        return {"status": "ok"}
    except Exception as e:
        return {"status": "error", "message": str(e)}


def _check_tiled_calibration() -> dict:
    """Check the Tiled calibration server."""
    try:
        client = get_tiled_calibration_client()
        if client is None:
            return {"status": "not_configured"}
        _ = client.uri
        return {"status": "ok"}
    except Exception as e:
        return {"status": "error", "message": str(e)}


def _check_tiled_results() -> dict:
    """Check the Tiled results server."""
    try:
        client = get_tiled_results_client()
        if client is None:
            return {"status": "not_configured"}
        _ = client.uri
        return {"status": "ok"}
    except Exception as e:
        return {"status": "error", "message": str(e)}


@router.get("/health")
async def get_health():
    """
    Return unified health status for all services.

    The frontend calls this on mount and polls periodically to discover
    which features are available and monitor service health.
    """
    return {
        "backend": {"status": "ok"},
        "tiled_data": _check_tiled_data(),
        "tiled_calibration": _check_tiled_calibration(),
        "tiled_results": _check_tiled_results(),
        "checked_at": datetime.now(timezone.utc).isoformat(),
    }
