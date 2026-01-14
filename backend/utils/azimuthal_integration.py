"""Azimuthal integration utilities using pyFAI."""

from typing import Optional, Tuple

import numpy as np
from pyFAI.integrator.azimuthal import AzimuthalIntegrator


def create_azimuthal_integrator(
    sample_detector_distance: float,
    beam_center_x: float,
    beam_center_y: float,
    pixel_size_x: float,
    pixel_size_y: float,
    wavelength: float,
    tilt: float = 0.0,
    tilt_plan_rotation: float = 0.0,
) -> AzimuthalIntegrator:
    """Create and configure an AzimuthalIntegrator with calibration parameters."""
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
    return ai


def integrate_1d(
    ai: AzimuthalIntegrator,
    image_array: np.ndarray,
    azimuth_range: Optional[Tuple[float, float]] = None,
    q_range: Optional[Tuple[float, float]] = None,
    npt: int = 500,
) -> Tuple[np.ndarray, np.ndarray]:
    """Perform 1D azimuthal integration. Returns (q_values, intensities)."""
    method = ("full", "csr", "cython")

    result = ai.integrate1d(
        image_array,
        npt,
        method=method,
        azimuth_range=azimuth_range,
        radial_range=q_range,
    )

    # Return the result directly from integrate1d which respects the radial_range
    return result.radial, result.intensity
