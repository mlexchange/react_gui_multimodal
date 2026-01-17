import msgpack
from fastapi import APIRouter, Query
from fastapi.responses import Response

from xscattering_backend.utils.q_space import compute_q_matrices

router = APIRouter()


@router.get("/q-space")
def q_space(
    # Calibration parameters
    sample_detector_distance: float = Query(
        ...,
        description="Distance between sample and detector in millimeters",
    ),
    beam_center_x: float = Query(
        ..., description="X-coordinate of beam center in pixels"
    ),
    beam_center_y: float = Query(
        ..., description="Y-coordinate of beam center in pixels"
    ),
    pixel_size_x: float = Query(
        ..., description="Pixel size in X direction (micrometers)"
    ),
    pixel_size_y: float = Query(
        ..., description="Pixel size in Y direction (micrometers)"
    ),
    wavelength: float = Query(
        ..., description="X-ray wavelength in Angstroms"
    ),
    tilt: float = Query(default=0.0, description="Detector tilt angle in degrees"),
    tilt_plan_rotation: float = Query(
        default=0.0, description="Rotation of tilt plane in degrees"
    ),
    # GISAXS-specific parameters
    experiment_type: str = Query(
        default="SAXS", description="Experiment type: 'SAXS' or 'GISAXS'"
    ),
    incident_angle: float = Query(
        default=0.0, description="Incident angle in degrees (for GISAXS)"
    ),
    # Image dimensions
    image_height: int = Query(..., description="Height of the image in pixels"),
    image_width: int = Query(..., description="Width of the image in pixels"),
):
    # Build calibration dict from query parameters
    calibration = {
        "sample_detector_distance": sample_detector_distance,
        "beam_center_x": beam_center_x,
        "beam_center_y": beam_center_y,
        "pixel_size_x": pixel_size_x,
        "pixel_size_y": pixel_size_y,
        "wavelength": wavelength,
        "tilt": tilt,
        "tilt_plan_rotation": tilt_plan_rotation,
        "experiment_type": experiment_type,
        "incident_angle": incident_angle,
    }

    # Compute Q matrices using shared utility
    q_x, q_y = compute_q_matrices(
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
