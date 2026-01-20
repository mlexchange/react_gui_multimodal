from typing import Optional, Tuple

import msgpack
import numpy as np
from fastapi import APIRouter, Query
from fastapi.responses import Response
from xscattering_backend.cache.image_cache import get_cached_processed_image
from xscattering_backend.utils.azimuthal_integration import (
    create_azimuthal_integrator,
    integrate_1d,
)

router = APIRouter()


@router.get("/azimuthal-integrator")
async def azimuthal_integration(
    left_scan_uri: str = Query(..., description="Tiled URI for the first scan (e.g., 'rawdata/scan_1')"),
    right_scan_uri: str = Query(..., description="Tiled URI for the second scan (e.g., 'rawdata/scan_2')"),
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
    azimuth_start_deg: float = Query(default=-180.0, description="Start of azimuthal range in degrees"),
    azimuth_end_deg: float = Query(default=180.0, description="End of azimuthal range in degrees"),
    q_range_start: Optional[float] = Query(None, description="Start of Q-range (nm^-1). If None, uses 0."),
    q_range_end: Optional[float] = Query(None, description="End of Q-range (nm^-1). If None, uses max Q."),
    mask_uri: Optional[str] = Query(None, description="Optional mask URI or mask_id"),
):
    """
    Performs azimuthal integration on two scatter images to convert 2D detector images
    into 1D intensity vs. q plots. This process averages the intensity around circles
    centered on the beam position, accounting for the experimental geometry.

    Now uses direct scan URIs instead of folder_url + indices for more efficient access.
    """

    # Get images from cache
    # This reuses cached images if the user previously viewed them in the scatter subplot
    # Masked pixels are set to NaN, which pyFAI handles during integration
    processed_1 = get_cached_processed_image(left_scan_uri.lstrip("/"), mask_uri=mask_uri)
    processed_2 = get_cached_processed_image(right_scan_uri.lstrip("/"), mask_uri=mask_uri)

    scatter_image_array_1 = processed_1.array
    scatter_image_array_2 = processed_2.array

    # Build range tuples from individual parameters
    azimuth_range: Tuple[float, float] = (azimuth_start_deg, azimuth_end_deg)
    q_range_tuple: Optional[Tuple[float, float]] = None
    if q_range_start is not None and q_range_end is not None:
        q_range_tuple = (q_range_start, q_range_end)

    ai = create_azimuthal_integrator(
        sample_detector_distance=sample_detector_distance,
        beam_center_x=beam_center_x,
        beam_center_y=beam_center_y,
        pixel_size_x=pixel_size_x,
        pixel_size_y=pixel_size_y,
        wavelength=wavelength,
        tilt=tilt,
        tilt_plan_rotation=tilt_plan_rotation,
    )

    q_1, intensity_1 = integrate_1d(ai, scatter_image_array_1, azimuth_range=azimuth_range, q_range=q_range_tuple)
    q_2, intensity_2 = integrate_1d(ai, scatter_image_array_2, azimuth_range=azimuth_range, q_range=q_range_tuple)

    q_max = max(q_1.max(), q_2.max())

    q_array_initial_1 = ai.qArray(scatter_image_array_1.shape)
    chi_array_1 = ai.center_array(scatter_image_array_1.shape, unit="chi_rad")

    q_array_initial_2 = ai.qArray(scatter_image_array_2.shape)
    chi_array_2 = ai.center_array(scatter_image_array_2.shape, unit="chi_rad")

    # Convert azimuthal range to radians for the chi array calculations
    azimuth_range_rad = np.radians(azimuth_range)

    # Create masks for both images based on the azimuthal range
    # Create a boolean mask that selects only the pixels within our desired azimuthal range
    # True values in the mask indicate pixels to keep
    # False values indicate pixels outside the angular region of interest
    mask_1 = (chi_array_1 >= azimuth_range_rad[0]) & (chi_array_1 <= azimuth_range_rad[1])
    mask_2 = (chi_array_2 >= azimuth_range_rad[0]) & (chi_array_2 <= azimuth_range_rad[1])

    # Apply the mask to our q-array. This creates an array where:
    # - Pixels within our desired angular range maintain their q-values
    # - Pixels outside our range are set to NaN (Not a Number)
    # This filtered array can be used for subsequent analysis or visualization
    q_array_filtered_1 = np.where(mask_1, q_array_initial_1, np.nan)
    q_array_filtered_2 = np.where(mask_2, q_array_initial_2, np.nan)

    # Package the results for frontend using msgpack
    # Convert NumPy arrays to lists for serialization
    result_data = {
        "q_1": q_1.tolist(),
        "q_2": q_2.tolist(),
        "intensity_1": intensity_1.tolist(),
        "intensity_2": intensity_2.tolist(),
        "q_array_filtered_1": q_array_filtered_1.tolist(),
        "q_array_filtered_2": q_array_filtered_2.tolist(),
        "q_max": q_max,
    }

    # Serialize the data using msgpack
    packed_data = msgpack.packb(result_data)

    # Return the packed data with appropriate media type
    return Response(content=packed_data, media_type="application/x-msgpack")
