"""
Shared Pydantic models used across routers.

This module centralizes model definitions that are used in multiple places
to ensure consistency and avoid duplication.
"""

from typing import Literal, Optional

from pydantic import BaseModel


# =============================================================================
# Calibration Models
# =============================================================================


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


# =============================================================================
# Linecut Models
# =============================================================================


class HorizontalLinecutParams(BaseModel):
    """Parameters for horizontal linecut extraction."""

    position: float  # q_y position
    width: float = 0.0  # Width in q-space


class VerticalLinecutParams(BaseModel):
    """Parameters for vertical linecut extraction."""

    position: float  # q_x position
    width: float = 0.0  # Width in q-space


class InclinedLinecutParams(BaseModel):
    """Parameters for inclined linecut extraction."""

    q_x_position: float
    q_y_position: float
    angle: float  # Degrees
    q_width: float = 0.0


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


# =============================================================================
# Azimuthal Integration Models
# =============================================================================


class AzimuthalParams(BaseModel):
    """Parameters for azimuthal integration."""

    azimuth_range: tuple[float, float] = (-180, 180)
    q_range: Optional[tuple[float, float]] = None


# =============================================================================
# Batch Processing Models
# =============================================================================


class BatchAllRequest(BaseModel):
    """Request body for unified batch processing of all linecut types."""

    scan_uris: list[str]
    calibration: CalibrationParams
    horizontal_linecuts: list[HorizontalLinecutParams] = []
    vertical_linecuts: list[VerticalLinecutParams] = []
    inclined_linecuts: list[InclinedLinecutParams] = []
    azimuthal_integrations: list[AzimuthalParams] = []
    mask_uri: Optional[str] = None  # Optional detector mask URI or mask_id


# =============================================================================
# Mask Models
# =============================================================================


class MaskResponse(BaseModel):
    """Response model for mask lookup endpoint."""

    found: bool
    mask_uri: Optional[str] = None
    mask_name: Optional[str] = None
    message: str
