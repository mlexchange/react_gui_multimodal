import msgpack
import numpy as np
from fastapi import APIRouter, Query
from fastapi.responses import Response
from pydantic import BaseModel
from pyFAI.integrator.azimuthal import AzimuthalIntegrator

# import pyFAI
# from pyFAI.units import get_unit_fiber


class CalibrationParameters(BaseModel):
    sample_detector_distance: float
    beam_center_x: float
    beam_center_y: float
    pixel_size_x: float
    pixel_size_y: float
    wavelength: float
    tilt: float = 0.0
    tilt_plan_rotation: float = 0.0


router = APIRouter()


@router.get("/q-vectors")
def q_vectors(
    # Calibration parameters as query parameters with defaults
    sample_detector_distance: float = Query(
        default=274.83,
        description="Distance between sample and detector in millimeters",
    ),
    beam_center_x: float = Query(
        default=317.8, description="X-coordinate of beam center in pixels"
    ),
    beam_center_y: float = Query(
        default=1245.28, description="Y-coordinate of beam center in pixels"
    ),
    pixel_size_x: float = Query(
        default=172, description="Pixel size in X direction (micrometers)"
    ),
    pixel_size_y: float = Query(
        default=172, description="Pixel size in Y direction (micrometers)"
    ),
    wavelength: float = Query(
        default=1.2398, description="X-ray wavelength in Angstroms"
    ),
    tilt: float = Query(default=0.0, description="Detector tilt angle in degrees"),
    tilt_plan_rotation: float = Query(
        default=0.0, description="Rotation of tilt plane in degrees"
    ),
    # Image dimensions
    image_height: int = Query(description="Height of the image in pixels"),
    image_width: int = Query(description="Width of the image in pixels"),
):
    # Package all calibration parameters into a dictionary for easier handling
    azimuthal_integration_calibration_params = {
        "sample_detector_distance": sample_detector_distance,
        "beam_center_x": beam_center_x,
        "beam_center_y": beam_center_y,
        "pixel_size_x": pixel_size_x,
        "pixel_size_y": pixel_size_y,
        "wavelength": wavelength,
        "tilt": tilt,
        "tilt_plan_rotation": tilt_plan_rotation,
    }

    # # Initialize the azimuthal integrator with our experimental geometry
    ai = AzimuthalIntegrator()
    ai.setFit2D(
        directDist=azimuthal_integration_calibration_params["sample_detector_distance"],
        centerX=azimuthal_integration_calibration_params["beam_center_x"],
        centerY=azimuthal_integration_calibration_params["beam_center_y"],
        tilt=azimuthal_integration_calibration_params["tilt"],
        tiltPlanRotation=azimuthal_integration_calibration_params["tilt_plan_rotation"],
        pixelX=azimuthal_integration_calibration_params["pixel_size_x"],
        pixelY=azimuthal_integration_calibration_params["pixel_size_y"],
        wavelength=azimuthal_integration_calibration_params["wavelength"],
    )

    # unit_qx = "qxgi_nm^-1"
    # unit_qy = "qygi_nm^-1"
    unit_qx = "qx_nm^-1"
    unit_qy = "qy_nm^-1"

    # Use the image dimensions passed as parameters
    image_shape = (image_height, image_width)

    # Compute q arrays with the specified units
    q_x = ai.array_from_unit(shape=image_shape, unit=unit_qx)  # [0, :]
    q_y = ai.array_from_unit(shape=image_shape, unit=unit_qy)  # [:, 0]

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
