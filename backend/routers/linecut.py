"""
Single linecut extraction router for real-time frontend updates.

This module provides a lightweight endpoint for extracting individual linecuts,
designed for low-latency responses when the user adjusts linecut parameters.
The frontend should debounce calls to this endpoint (300ms recommended).

For batch processing across multiple scans, use the /batch-all endpoint instead.
"""

from typing import Literal, Optional

import msgpack
import numpy as np
from fastapi import APIRouter
from fastapi.responses import Response
from pydantic import BaseModel

from utils.image_cache import get_cached_processed_image
from utils.linecut_extraction import (
    extract_horizontal_linecut,
    extract_inclined_linecut,
    extract_vertical_linecut,
)
from utils.q_matrix_cache import get_or_compute_q_matrices

router = APIRouter()


class CalibrationParams(BaseModel):
    """Calibration parameters for q-space calculations."""

    sample_detector_distance: float
    beam_center_x: float
    beam_center_y: float
    pixel_size_x: float
    pixel_size_y: float
    wavelength: float
    tilt: float = 0.0
    tilt_plan_rotation: float = 0.0
    experiment_type: str = "SAXS"
    incident_angle: float = 0.0


class SingleLinecutRequest(BaseModel):
    """Request body for single linecut extraction."""

    scan_uri: str
    calibration: CalibrationParams
    linecut_type: Literal["horizontal", "vertical", "inclined"]

    # For horizontal linecuts
    position: Optional[float] = None  # q_y position
    width: Optional[float] = None  # Width in q-space

    # For inclined linecuts
    q_x_position: Optional[float] = None
    q_y_position: Optional[float] = None
    angle: Optional[float] = None  # Degrees
    q_width: Optional[float] = None

    # Optional mask
    mask_uri: Optional[str] = None


@router.post("/extract-linecut")
async def extract_linecut(request: SingleLinecutRequest) -> Response:
    """
    Extract a single linecut from a scan image.

    This endpoint is designed for real-time use with frontend debounce (300ms).
    It uses cached Q-matrices to avoid recomputation when only linecut parameters
    change (position, width, angle).

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
        # Get cached image (mask applied during fetch)
        processed_image = get_cached_processed_image(
            request.scan_uri.lstrip("/"),
            mask_uri=request.mask_uri,
        )
        image_array = processed_image.full.array

        # Get Q-matrices (cached based on image shape + calibration)
        calibration_dict = request.calibration.model_dump()
        q_x_matrix, q_y_matrix = get_or_compute_q_matrices(
            image_array.shape,
            calibration_dict,
        )

        # Extract linecut based on type
        if request.linecut_type == "horizontal":
            if request.position is None:
                raise ValueError("position is required for horizontal linecuts")
            q_values, intensities = extract_horizontal_linecut(
                image_array,
                q_x_matrix,
                q_y_matrix,
                request.position,
                request.width or 0.0,
            )
        elif request.linecut_type == "vertical":
            if request.position is None:
                raise ValueError("position is required for vertical linecuts")
            q_values, intensities = extract_vertical_linecut(
                image_array,
                q_x_matrix,
                q_y_matrix,
                request.position,
                request.width or 0.0,
            )
        elif request.linecut_type == "inclined":
            if request.q_x_position is None or request.q_y_position is None:
                raise ValueError(
                    "q_x_position and q_y_position are required for inclined linecuts"
                )
            if request.angle is None:
                raise ValueError("angle is required for inclined linecuts")
            q_values, intensities = extract_inclined_linecut(
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

        # Convert numpy arrays to lists
        result = {
            "q_values": q_values.tolist() if isinstance(q_values, np.ndarray) else q_values,
            "intensities": intensities.tolist() if isinstance(intensities, np.ndarray) else intensities,
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
