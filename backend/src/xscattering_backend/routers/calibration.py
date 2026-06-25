"""
Calibration loading endpoint.

Reads PONI calibration metadata from the Tiled calibration server
and returns extracted calibration parameters, including any associated mask.
"""

import os

from fastapi import APIRouter, HTTPException, Query
from xscattering_backend.cache.tiled_cache import (
    get_tiled_calibration_base_uri,
    get_tiled_calibration_client_for_uri,
)
from xscattering_backend.config.logging import get_logger

router = APIRouter()
logger = get_logger(__name__)


@router.get("/load-calibration")
async def load_calibration(
    path: str = Query(..., description="Container path to the calibration file in Tiled"),
):
    """
    Load calibration parameters from a PONI file in Tiled.

    Connects to the calibration Tiled server, validates that the item
    has a 'poni' spec, extracts calibration parameters from metadata,
    and resolves any associated mask.

    Parameters
    ----------
    path : str
        Path to the calibration file in Tiled (e.g., "rawdata/exp1/results/AgB_test").

    Returns
    -------
    dict
        JSON with params dict (null if not a valid PONI), name, mask, and message.
    """
    path = path.lstrip("/")
    name = path.split("/")[-1] or "calibration"

    try:
        tiled_base_uri = get_tiled_calibration_base_uri()
        if tiled_base_uri is None:
            raise HTTPException(
                status_code=404,
                detail="Calibration Tiled server not configured",
            )

        full_uri = tiled_base_uri.rstrip("/") + "/" + path
        client = get_tiled_calibration_client_for_uri(full_uri)

        # Validate poni spec
        specs = client.specs
        is_poni = any(spec.name == "poni" for spec in specs)

        if not is_poni:
            return {
                "params": None,
                "name": name,
                "mask": None,
                "message": "Selected item is not a PONI calibration file",
            }

        # Extract calibration parameters from metadata
        metadata = client.metadata
        if not metadata:
            return {
                "params": None,
                "name": name,
                "mask": None,
                "message": "No metadata found in calibration file",
            }

        params = {
            "sample_detector_distance": metadata.get("directDist"),
            "beam_center_x": metadata.get("centerX"),
            "beam_center_y": metadata.get("centerY"),
            "pixel_size_x": metadata.get("pixelX"),
            "pixel_size_y": metadata.get("pixelY"),
            "wavelength": metadata.get("wavelength"),
            "tilt": metadata.get("tilt", 0),
            "tilt_plan_rotation": metadata.get("tiltPlanRotation", 0),
        }

        # Resolve associated mask
        mask = _resolve_mask(path, metadata, tiled_base_uri)

        return {
            "params": params,
            "name": name,
            "mask": mask,
            "message": f"Loaded: {name}",
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error loading calibration: {str(e)}",
        )


def _resolve_mask(poni_path: str, metadata: dict, tiled_base_uri: str) -> dict | None:
    """
    Resolve the mask referenced by PONI metadata.

    Looks for a ``mask`` key in the metadata, resolves the sibling
    ``masks/`` folder, and checks if the mask exists in Tiled.

    Returns a dict with ``mask_uri`` and ``mask_name`` if the mask
    is found, or None otherwise.
    """
    mask_name = metadata.get("mask")
    if not mask_name:
        return None

    # Extract just the filename if it's a full path
    if "/" in mask_name or "\\" in mask_name:
        mask_name = os.path.basename(mask_name)

    # Resolve mask path: sibling to 'results' folder
    # e.g., calibration/results/AgB_test -> calibration/masks/{mask_name}
    path_parts = poni_path.split("/")
    parent_parts = path_parts[:-2]  # Remove PONI file and 'results' folder
    mask_uri = "/".join(parent_parts + ["masks", mask_name])

    try:
        mask_full_uri = tiled_base_uri.rstrip("/") + "/" + mask_uri
        mask_client = get_tiled_calibration_client_for_uri(mask_full_uri)
        _ = mask_client.metadata  # Verify existence

        return {"mask_uri": mask_uri, "mask_name": mask_name}
    except Exception:
        logger.debug("Mask '%s' referenced but not found at '%s'", mask_name, mask_uri)
        return None
