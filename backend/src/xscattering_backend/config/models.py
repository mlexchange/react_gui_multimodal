"""
Shared Pydantic models used across routers.

This module centralizes model definitions that are used in multiple places
to ensure consistency and avoid duplication.
"""

from typing import Literal, TypedDict

import numpy as np
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
    position: float | None = None  # q_y position
    width: float | None = None  # Width in q-space

    # For inclined linecuts
    q_x_position: float | None = None
    q_y_position: float | None = None
    angle: float | None = None  # Degrees
    q_width: float | None = None

    # Optional mask
    mask_uri: str | None = None


# =============================================================================
# Azimuthal Integration Models
# =============================================================================


class AzimuthalParams(BaseModel):
    """Parameters for azimuthal integration."""

    azimuth_range: tuple[float, float] = (-180, 180)
    q_range: tuple[float, float] | None = None


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
    mask_uri: str | None = None  # Optional detector mask URI or mask_id


# =============================================================================
# TypedDicts for Response Structures
# =============================================================================


class LinecutResult(TypedDict):
    """Result structure for a single linecut extraction."""

    q_values: list[float]
    intensities: list[float]
    success: bool
    error_message: str | None


class ScanResult(TypedDict):
    """Result structure for a single scan in batch processing."""

    scan_uri: str
    scan_name: str
    horizontal: dict[int, LinecutResult]
    vertical: dict[int, LinecutResult]
    inclined: dict[int, LinecutResult]
    azimuthal: dict[int, LinecutResult]
    success: bool
    error_message: str | None


# =============================================================================
# Helper Functions
# =============================================================================


def create_linecut_result(
    q_values: np.ndarray | list[float],
    intensities: np.ndarray | list[float],
    success: bool = True,
    error_message: str | None = None,
) -> LinecutResult:
    """
    Create a standardized linecut result dictionary.

    Args:
        q_values: Q-values array or list
        intensities: Intensity values array or list
        success: Whether the extraction was successful
        error_message: Error message if extraction failed

    Returns:
        LinecutResult dictionary
    """
    return {
        "q_values": q_values.tolist() if hasattr(q_values, "tolist") else q_values,
        "intensities": intensities.tolist() if hasattr(intensities, "tolist") else intensities,
        "success": success,
        "error_message": error_message,
    }


def create_error_linecut_result(error_message: str) -> LinecutResult:
    """
    Create a linecut result for a failed extraction.

    Args:
        error_message: Error message describing the failure

    Returns:
        LinecutResult dictionary with empty data and error
    """
    return {
        "q_values": [],
        "intensities": [],
        "success": False,
        "error_message": error_message,
    }


# =============================================================================
# Save to Tiled Models
# =============================================================================


class SaveLinecutParams(BaseModel):
    """Linecut parameters included in save metadata."""

    type: Literal["horizontal", "vertical", "inclined", "azimuthal"]
    # Horizontal/vertical
    position: float | None = None
    width: float | None = None
    # Inclined
    q_x_position: float | None = None
    q_y_position: float | None = None
    angle: float | None = None
    q_width: float | None = None
    # Azimuthal
    q_range: tuple[float, float] | None = None
    azimuth_range: tuple[float, float] | None = None


class LinecutDataEntry(BaseModel):
    """Data for a single linecut (both image sides)."""

    index: int
    linecut_params: SaveLinecutParams
    left_intensities: list[float] | None = None
    right_intensities: list[float] | None = None


class SaveLinecutsRequest(BaseModel):
    """Request to save all linecuts from a graph card to Tiled."""

    scan_uris: list[str] = []
    scan_names: list[str] = []
    calibration: CalibrationParams
    q_values: list[float]
    linecuts: list[LinecutDataEntry]


class BatchResultItem(BaseModel):
    """A single scan result within a batch save request."""

    scan_uri: str
    scan_name: str
    q_values: list[float]
    intensities: list[float]
    success: bool


class SaveBatchResultsRequest(BaseModel):
    """Request to save batch processing results to Tiled."""

    calibration: CalibrationParams
    linecut_parameters: SaveLinecutParams
    results: list[BatchResultItem]
