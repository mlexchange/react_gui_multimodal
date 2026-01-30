"""Azimuthal integration utilities using pyFAI."""

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
    azimuth_range: tuple[float, float] | None = None,
    q_range: tuple[float, float] | None = None,
    npt: int | None = None,
    mask: np.ndarray | None = None,
) -> tuple[np.ndarray, np.ndarray]:
    """Perform 1D azimuthal integration. Returns (q_values, intensities).

    Args:
        ai: Configured AzimuthalIntegrator instance
        image_array: 2D detector image
        azimuth_range: Optional (start, end) azimuthal range in degrees
        q_range: Optional (start, end) Q-range in nm^-1
        npt: Number of output points. Defaults to max(image_array.shape)
             to match detector resolution.
        mask: Optional binary mask (0=valid, 1=masked, pyFAI convention)
    """
    if npt is None:
        npt = max(image_array.shape)

    method = ("full", "csr", "cython")

    integrate_kwargs = dict(
        npt=npt,
        method=method,
        azimuth_range=azimuth_range,
        radial_range=q_range,
    )
    if mask is not None:
        integrate_kwargs["mask"] = mask

    result = ai.integrate1d(image_array, **integrate_kwargs)

    # Return the result directly from integrate1d which respects the radial_range
    return result.radial, result.intensity
