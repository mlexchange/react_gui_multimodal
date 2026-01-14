"""
Shared Pydantic models used across routers.

This module centralizes model definitions that are used in multiple places
to ensure consistency and avoid duplication.
"""

from pydantic import BaseModel


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
