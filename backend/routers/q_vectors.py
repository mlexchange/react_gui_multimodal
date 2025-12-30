import msgpack
import numpy as np
from fastapi import APIRouter, Query
from fastapi.responses import Response
from pyFAI.integrator.azimuthal import AzimuthalIntegrator

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
    # GISAXS-specific parameters
    experiment_type: str = Query(
        default="SAXS", description="Experiment type: 'SAXS' or 'GISAXS'"
    ),
    incident_angle: float = Query(
        default=0.16, description="Incident angle in degrees (for GISAXS)"
    ),
    # Image dimensions
    image_height: int = Query(description="Height of the image in pixels"),
    image_width: int = Query(description="Width of the image in pixels"),
):
    # Use the image dimensions passed as parameters
    image_shape = (image_height, image_width)

    if experiment_type == "GISAXS":
        # Direct GISAXS calculation
        # Reference: DESY P03 beamline + pyFAI units.py

        # Convert units to SI
        wavelength_nm = wavelength / 10.0  # Å to nm
        det_dist_m = sample_detector_distance / 1000.0  # mm to m
        pixel_size_x_m = pixel_size_x / 1e6  # μm to m
        pixel_size_y_m = pixel_size_y / 1e6  # μm to m
        alpha_i = np.radians(incident_angle)

        # Wavevector magnitude k = 2π/λ
        k = 2 * np.pi / wavelength_nm

        # Pixel grid relative to beam center (in meters)
        x = (np.arange(image_width) - beam_center_x) * pixel_size_x_m
        y = (beam_center_y - np.arange(image_height)) * pixel_size_y_m  # Y inverted for image coords
        X, Y = np.meshgrid(x, y)

        # Scattering angles
        alpha_f = np.arctan2(Y, det_dist_m)  # Exit angle (vertical)
        psi = np.arctan2(X, det_dist_m)  # Azimuthal angle (horizontal)

        # Q-vector components (elastic scattering: |k_i| = |k_f| = k)
        # k_i = k * (cos(alpha_i), 0, -sin(alpha_i))  incident beam
        # k_f = k * (cos(alpha_f)*cos(psi), cos(alpha_f)*sin(psi), sin(alpha_f))  scattered beam
        # Q = k_f - k_i
        q_x_comp = k * (np.cos(alpha_f) * np.cos(psi) - np.cos(alpha_i))
        q_y_comp = k * np.cos(alpha_f) * np.sin(psi)
        q_z_comp = k * (np.sin(alpha_f) + np.sin(alpha_i))

        # qip (in-plane) and qoop (out-of-plane)
        # qip = sqrt(qx² + qy²) with sign from qy (lateral direction)
        # qoop = qz (vertical direction)
        q_x = np.sqrt(q_x_comp**2 + q_y_comp**2) * np.sign(q_y_comp)
        q_y = q_z_comp
    else:
        # SAXS uses pyFAI AzimuthalIntegrator for standard qx/qy coordinates
        ai = AzimuthalIntegrator()
        ai.setFit2D(
            directDist=sample_detector_distance,
            centerX=beam_center_x,
            centerY=beam_center_y,
            tilt=tilt,
            tiltPlanRotation=tilt_plan_rotation,
            pixelX=pixel_size_x,
            pixelY=pixel_size_y,
            wavelength=wavelength,
        )
        q_x = ai.array_from_unit(shape=image_shape, unit="qx_nm^-1")
        q_y = ai.array_from_unit(shape=image_shape, unit="qy_nm^-1")

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
