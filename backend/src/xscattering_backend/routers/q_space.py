"""
SAXS Q-space endpoint.

This endpoint computes qx/qy matrices for SAXS experiments only.
For GISAXS, Q matrices (qip/qoop) are returned by the /fetch-scan-image
endpoint as part of the image transformation.
"""

import msgpack
from fastapi import APIRouter, Query
from fastapi.responses import Response
from xscattering_backend.utils.q_space import compute_saxs_q_matrices

router = APIRouter()


@router.get("/q-space")
def get_saxs_q_matrices(
    # Calibration parameters
    sample_detector_distance: float = Query(
        ...,
        description="Distance between sample and detector in millimeters",
    ),
    beam_center_x: float = Query(..., description="X-coordinate of beam center in pixels"),
    beam_center_y: float = Query(..., description="Y-coordinate of beam center in pixels"),
    pixel_size_x: float = Query(..., description="Pixel size in X direction (micrometers)"),
    pixel_size_y: float = Query(..., description="Pixel size in Y direction (micrometers)"),
    wavelength: float = Query(..., description="X-ray wavelength in Angstroms"),
    tilt: float = Query(default=0.0, description="Detector tilt angle in degrees"),
    tilt_plan_rotation: float = Query(default=0.0, description="Rotation of tilt plane in degrees"),
    # Image dimensions
    image_height: int = Query(..., description="Height of the image in pixels"),
    image_width: int = Query(..., description="Width of the image in pixels"),
):
    """
    Compute SAXS Q-matrices (qx, qy) for the given calibration and image dimensions.

    This endpoint is for SAXS experiments only. For GISAXS, use /fetch-scan-image
    which returns the transformed Q-space image along with qip/qoop matrices.
    """
    calibration = {
        "sample_detector_distance": sample_detector_distance,
        "beam_center_x": beam_center_x,
        "beam_center_y": beam_center_y,
        "pixel_size_x": pixel_size_x,
        "pixel_size_y": pixel_size_y,
        "wavelength": wavelength,
        "tilt": tilt,
        "tilt_plan_rotation": tilt_plan_rotation,
    }

    # Compute SAXS Q matrices
    q_x, q_y = compute_saxs_q_matrices(
        image_shape=(image_height, image_width),
        calibration=calibration,
        invert_qy=True,
    )

    # Package the results for frontend using msgpack
    # Convert NumPy arrays to lists for serialization
    result_data = {
        "q_x": q_x.tolist(),
        "q_y": q_y.tolist(),
    }

    # Serialize the data using msgpack
    packed_data = msgpack.packb(result_data)

    # Return the packed data with appropriate media type
    return Response(content=packed_data, media_type="application/x-msgpack")
