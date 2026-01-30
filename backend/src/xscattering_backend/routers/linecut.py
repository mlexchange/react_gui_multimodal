"""
Single linecut extraction router for real-time frontend updates.

This module provides a lightweight endpoint for extracting individual linecuts,
designed for low-latency responses when the user adjusts linecut parameters.
The frontend should debounce calls to this endpoint (300ms recommended).

For batch processing across multiple scans, use the /batch-all endpoint instead.
"""

import msgpack
import numpy as np
from fastapi import APIRouter
from fastapi.responses import Response
from xscattering_backend.cache.image_cache import get_cached_processed_image
from xscattering_backend.cache.saxs_q_cache import get_or_compute_saxs_q_matrices
from xscattering_backend.config.models import SingleLinecutRequest
from xscattering_backend.utils.linecut_extraction import (
    extract_gisaxs_horizontal_linecut_pyfai,
    extract_gisaxs_inclined_linecut,
    extract_gisaxs_vertical_linecut_pyfai,
    extract_horizontal_linecut,
    extract_inclined_linecut,
    extract_vertical_linecut,
)

router = APIRouter()


@router.post("/extract-linecut")
async def extract_linecut(request: SingleLinecutRequest) -> Response:
    """
    Extract a single linecut from a scan image.

    This endpoint is designed for real-time use with frontend debounce (300ms).
    It uses cached Q-matrices to avoid recomputation when only linecut parameters
    change (position, width, angle).

    For GISAXS experiments, linecuts are extracted from the transformed Q-space
    image using the GISAXS-specific extraction functions.

    For batch processing, use /batch-all instead.

    Parameters
    ----------
    request : SingleLinecutRequest
        Contains scan_uri, calibration, linecut type, and linecut parameters.

    Returns
    -------
    Response
        msgpack-encoded dict with:
        - q_values: list[float] - Q values along the linecut
        - intensities: list[float] - Intensity values
        - success: bool
        - error_message: str | None
    """
    try:
        calibration_dict = request.calibration.model_dump()
        experiment_type = calibration_dict.get("experiment_type", "SAXS")

        if experiment_type == "GISAXS":
            # Use GISAXS-specific extraction from transformed Q-space image
            q_values, intensities = _extract_gisaxs_linecut(request, calibration_dict)
        else:
            # Use standard SAXS extraction from pixel-space image
            q_values, intensities = _extract_saxs_linecut(request, calibration_dict)

        # Convert numpy arrays to lists
        result = {
            "q_values": (q_values.tolist() if isinstance(q_values, np.ndarray) else q_values),
            "intensities": (intensities.tolist() if isinstance(intensities, np.ndarray) else intensities),
            "success": True,
            "error_message": None,
        }

    except Exception as e:
        result = {
            "q_values": [],
            "intensities": [],
            "success": False,
            "error_message": str(e),
        }

    packed_data = msgpack.packb(result, use_bin_type=True)
    return Response(content=packed_data, media_type="application/x-msgpack")


def _extract_saxs_linecut(request: SingleLinecutRequest, calibration_dict: dict) -> tuple[np.ndarray, np.ndarray]:
    """
    Extract linecut from SAXS pixel-space image.

    Args:
        request: The linecut request
        calibration_dict: Calibration parameters

    Returns:
        (q_values, intensities) tuple
    """
    # Get cached image (mask applied during fetch)
    processed_image = get_cached_processed_image(
        request.scan_uri.lstrip("/"),
        mask_uri=request.mask_uri,
    )
    image_array = processed_image.array

    # Get SAXS Q-matrices (cached based on image shape + calibration)
    q_x_matrix, q_y_matrix = get_or_compute_saxs_q_matrices(
        image_array.shape,
        calibration_dict,
    )

    # Extract linecut based on type
    if request.linecut_type == "horizontal":
        if request.position is None:
            raise ValueError("position is required for horizontal linecuts")
        return extract_horizontal_linecut(
            image_array,
            q_x_matrix,
            q_y_matrix,
            request.position,
            request.width or 0.0,
        )
    elif request.linecut_type == "vertical":
        if request.position is None:
            raise ValueError("position is required for vertical linecuts")
        return extract_vertical_linecut(
            image_array,
            q_x_matrix,
            q_y_matrix,
            request.position,
            request.width or 0.0,
        )
    elif request.linecut_type == "inclined":
        if request.q_x_position is None or request.q_y_position is None:
            raise ValueError("q_x_position and q_y_position are required for inclined linecuts")
        if request.angle is None:
            raise ValueError("angle is required for inclined linecuts")
        return extract_inclined_linecut(
            image_array,
            q_x_matrix,
            q_y_matrix,
            request.q_x_position,
            request.q_y_position,
            request.angle,
            request.q_width or 0.0,
        )
    else:
        raise ValueError(f"Unknown linecut type: {request.linecut_type}")


def _extract_gisaxs_linecut(request: SingleLinecutRequest, calibration_dict: dict) -> tuple[np.ndarray, np.ndarray]:
    """
    Extract linecut from GISAXS experiment.

    For horizontal and vertical linecuts, uses pyFAI direct integration from
    detector pixels (single-pass, avoiding double-binning artifacts).

    For inclined linecuts, uses the cached GISAXS 2D transform (pyFAI has
    no native inclined integration).

    Args:
        request: The linecut request
        calibration_dict: Calibration parameters (must include incident_angle)

    Returns:
        (q_values, intensities) tuple
    """
    # For horizontal and vertical: use pyFAI direct integration from raw detector image
    if request.linecut_type in ("horizontal", "vertical"):
        processed = get_cached_processed_image(
            request.scan_uri.lstrip("/"),
            mask_uri=request.mask_uri,
        )

        if request.linecut_type == "horizontal":
            if request.position is None:
                raise ValueError("position (qoop) is required for horizontal linecuts")
            return extract_gisaxs_horizontal_linecut_pyfai(
                processed.array,
                processed.mask,
                calibration_dict,
                request.position,  # qoop position (display convention)
                request.width or 0.0,
                npt=request.npt,
            )
        else:  # vertical
            if request.position is None:
                raise ValueError("position (qip) is required for vertical linecuts")
            return extract_gisaxs_vertical_linecut_pyfai(
                processed.array,
                processed.mask,
                calibration_dict,
                request.position,  # qip position
                request.width or 0.0,
                npt=request.npt,
            )

    elif request.linecut_type == "inclined":
        # Inclined linecuts still use cached 2D transform (no pyFAI native support)
        from xscattering_backend.cache.gisaxs_cache import get_or_compute_gisaxs_transform

        gisaxs_result = get_or_compute_gisaxs_transform(
            request.scan_uri.lstrip("/"),
            calibration_dict,
            mask_uri=request.mask_uri,
        )

        if request.q_x_position is None or request.q_y_position is None:
            raise ValueError("q_x_position (qip) and q_y_position (qoop) are required for inclined linecuts")
        if request.angle is None:
            raise ValueError("angle is required for inclined linecuts")
        return extract_gisaxs_inclined_linecut(
            gisaxs_result.transformed_image,
            gisaxs_result.qip_values,
            gisaxs_result.qoop_values,
            request.q_x_position,  # qip position
            request.q_y_position,  # qoop position
            request.angle,
            request.q_width or 0.0,
        )
    else:
        raise ValueError(f"Unknown linecut type: {request.linecut_type}")
