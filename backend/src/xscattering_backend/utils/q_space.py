"""
Q-space computation utilities for SAXS and GISAXS experiments.

SAXS:
  - compute_saxs_q_matrices(): Computes qx/qy matrices using AzimuthalIntegrator
  - Used by /api/q-space endpoint and saxs_q_cache

GISAXS:
  - transform_gisaxs_to_qspace(): Transforms detector image to regular Q-space
    grid and computes qip/qoop matrices using FiberIntegrator
  - Used by /api/fetch-scan-image (returns both pixel and Q-space images)
  - GISAXS Q matrices come bundled with the image fetch, not from /api/q-space
"""

from dataclasses import dataclass
from typing import Tuple

import numpy as np
from pyFAI import units
from pyFAI.integrator.azimuthal import AzimuthalIntegrator
from pyFAI.integrator.fiber import FiberIntegrator
from xscattering_backend.config.logging import get_logger

logger = get_logger(__name__)


# =============================================================================
# SAXS Q-space computation
# =============================================================================


def compute_saxs_q_matrices(
    image_shape: Tuple[int, int],
    calibration: dict,
    invert_qy: bool = True,
) -> Tuple[np.ndarray, np.ndarray]:
    """
    Compute Q-value matrices (qx, qy) for a SAXS image using pyFAI.

    This function is for SAXS only. For GISAXS, use transform_gisaxs_to_qspace()
    which computes qip/qoop matrices as part of the image transformation.

    Args:
        image_shape: (height, width) of the image
        calibration: Dictionary with calibration parameters:
            - sample_detector_distance: Distance in mm
            - beam_center_x, beam_center_y: Beam center in pixels
            - pixel_size_x, pixel_size_y: Pixel size in micrometers
            - wavelength: X-ray wavelength in Angstroms
            - tilt, tilt_plan_rotation: Tilt parameters in degrees
        invert_qy: Whether to negate q_y to match image display convention
            (default True). pyFAI's qy follows image coords where y increases
            downward, but we display with positive qy at top.

    Returns:
        (q_x_matrix, q_y_matrix) as 2D numpy arrays
    """
    ai = AzimuthalIntegrator()
    ai.setFit2D(
        directDist=calibration["sample_detector_distance"],
        centerX=calibration["beam_center_x"],
        centerY=calibration["beam_center_y"],
        tilt=calibration.get("tilt", 0.0),
        tiltPlanRotation=calibration.get("tilt_plan_rotation", 0.0),
        pixelX=calibration["pixel_size_x"],
        pixelY=calibration["pixel_size_y"],
        wavelength=calibration["wavelength"],
    )
    q_x = ai.array_from_unit(shape=image_shape, unit="qx_nm^-1")
    q_y = ai.array_from_unit(shape=image_shape, unit="qy_nm^-1")

    if invert_qy:
        # Negate qy to match image display convention:
        # pyFAI's qy follows image coords (y increases downward)
        # We want positive qy at top of image
        q_y = -q_y

    return q_x, q_y


# =============================================================================
# GISAXS Q-space computation and image transformation
# =============================================================================


@dataclass
class GISAXSTransformResult:
    """Result of GISAXS transformation to Q-space.

    Attributes:
        transformed_image: 2D array on regular (qip, qoop) grid, shape (npt_oop, npt_ip)
        qip_values: 1D array of in-plane Q values for X axis (npt_ip,)
        qoop_values: 1D array of out-of-plane Q values for Y axis (npt_oop,)
        qip_pixel_matrix: qip value at each detector pixel, shape (height, width)
        qoop_pixel_matrix: qoop value at each detector pixel, shape (height, width)
    """

    transformed_image: np.ndarray
    qip_values: np.ndarray
    qoop_values: np.ndarray
    qip_pixel_matrix: np.ndarray
    qoop_pixel_matrix: np.ndarray


def _create_fiber_integrator(calibration: dict) -> FiberIntegrator:
    """
    Create and configure a FiberIntegrator from calibration parameters.

    Args:
        calibration: Dict with sample_detector_distance (mm), beam_center_x/y (pixels),
                     pixel_size_x/y (micrometers), wavelength (Angstroms),
                     tilt (degrees), tilt_plan_rotation (degrees).

    Returns:
        Configured FiberIntegrator instance
    """
    fi = FiberIntegrator()
    fi.setFit2D(
        directDist=calibration["sample_detector_distance"],
        centerX=calibration["beam_center_x"],
        centerY=calibration["beam_center_y"],
        pixelX=calibration["pixel_size_x"],
        pixelY=calibration["pixel_size_y"],
        wavelength=calibration["wavelength"],
        tilt=calibration.get("tilt", 0.0),
        tiltPlanRotation=calibration.get("tilt_plan_rotation", 0.0),
    )
    return fi


def transform_gisaxs_to_qspace(
    image_array: np.ndarray,
    calibration: dict,
) -> GISAXSTransformResult:
    """
    Transform GISAXS detector image to regular Q-space grid.

    Uses pyFAI FiberIntegrator.integrate2d_grazing_incidence() to bin detector
    pixels into a regular qip/qoop grid. Also computes pixel-space Q matrices
    for overlay mapping in pixel view.

    Unlike SAXS where the same image can be shown with different axis labels,
    GISAXS requires actual image transformation because Q-space is curved
    relative to pixel space. The transformation creates a characteristic
    "wedge" of missing data (NaN) where the detector doesn't cover certain
    Q-space regions.

    Note: Masking should be applied to image_array before calling this function
    (masked pixels as NaN). The NaN values propagate through the transformation.

    Args:
        image_array: Detector image with masked pixels as NaN, shape (height, width)
        calibration: Dict with:
            - sample_detector_distance: Distance in mm
            - beam_center_x, beam_center_y: Beam center in pixels
            - pixel_size_x, pixel_size_y: Pixel size in micrometers
            - wavelength: X-ray wavelength in Angstroms
            - incident_angle: Incident angle in degrees (required)
            - tilt, tilt_plan_rotation: Optional tilt parameters in degrees

    Returns:
        GISAXSTransformResult with transformed image and Q-coordinate arrays

    Raises:
        ValueError: If incident_angle is not provided in calibration
    """
    fi = _create_fiber_integrator(calibration)

    # Get incident angle in degrees (required for GISAXS)
    incident_angle_deg = calibration.get("incident_angle")
    if incident_angle_deg is None:
        raise ValueError("incident_angle is required for GISAXS transformation")

    # Match output resolution to detector dimensions for 1:1 mapping
    height, width = image_array.shape
    npt_ip = width
    npt_oop = height

    logger.debug(
        f"GISAXS transform: {height}x{width} -> npt_oop={npt_oop}, npt_ip={npt_ip}, " f"incident_angle={incident_angle_deg}°"
    )

    # Perform grazing incidence integration (2D transformation)
    # sample_orientation=1: horizontal sample, detector above sample
    # Note: No mask passed - masked pixels should already be NaN in image_array
    result = fi.integrate2d_grazing_incidence(
        data=image_array,
        npt_ip=npt_ip,
        npt_oop=npt_oop,
        unit_ip="qip_nm^-1",
        unit_oop="qoop_nm^-1",
        incident_angle=incident_angle_deg,
        tilt_angle=0.0,
        sample_orientation=1,
        angle_unit="deg",
    )

    # Compute pixel-space Q matrices for overlay mapping
    # These give qip/qoop value at each detector pixel
    # Configure unit objects with incident angle and sample orientation
    incident_angle_rad = np.radians(incident_angle_deg)

    qip_unit = units.get_unit_fiber("qip_nm^-1")
    qip_unit.incident_angle = incident_angle_rad
    qip_unit.sample_orientation = 1
    qip_pixel_matrix = fi.array_from_unit(shape=image_array.shape, unit=qip_unit)

    qoop_unit = units.get_unit_fiber("qoop_nm^-1")
    qoop_unit.incident_angle = incident_angle_rad
    qoop_unit.sample_orientation = 1
    qoop_pixel_matrix = fi.array_from_unit(shape=image_array.shape, unit=qoop_unit)

    # Result from integrate2d_grazing_incidence:
    # - result.intensity: 2D transformed image (npt_oop, npt_ip)
    # - result.inplane: 1D array of in-plane Q values (qip)
    # - result.outofplane: 1D array of out-of-plane Q values (qoop)
    #
    # Negate qoop to match image display convention (same as SAXS qy inversion):
    # pyFAI's qoop follows detector coords where y increases downward,
    # but we want positive qoop at top of image (Q increases going up).
    qoop_values = -result.outofplane
    qoop_pixel_matrix_inverted = -qoop_pixel_matrix

    logger.debug(
        f"GISAXS transform complete: qip=[{result.inplane.min():.4f}, {result.inplane.max():.4f}], "
        f"qoop=[{qoop_values.min():.4f}, {qoop_values.max():.4f}] (sign inverted for display)"
    )

    return GISAXSTransformResult(
        transformed_image=result.intensity,
        qip_values=result.inplane,
        qoop_values=qoop_values,
        qip_pixel_matrix=qip_pixel_matrix,
        qoop_pixel_matrix=qoop_pixel_matrix_inverted,
    )
