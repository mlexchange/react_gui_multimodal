"""
Linecut extraction utilities for batch processing.

This module provides pure Python functions for extracting linecuts from
scattering images. These functions are thread-safe (no shared state) and
designed for parallel execution via ThreadPoolExecutor.
"""

from typing import Literal

import numpy as np
from xscattering_backend.config.logging import get_logger
from xscattering_backend.utils.q_space import create_fiber_integrator

logger = get_logger(__name__)


def find_pixel_position_for_q_value(
    target_q: float,
    q_matrix: np.ndarray,
    direction: Literal["horizontal", "vertical"],
    reference_index: int | None = None,
) -> int:
    """
    Find the pixel index corresponding to a q-value.

    For horizontal linecuts: searches rows using a column of q_y_matrix
    For vertical linecuts: searches columns using a row of q_x_matrix

    Args:
        target_q: The q-value to find
        q_matrix: 2D array of q-values
        direction: "horizontal" or "vertical"
        reference_index: Optional index of the reference row/column to search.
            For horizontal: column index (default: center column).
            For vertical: row index (default: center row).
            Using center is more accurate than first row/column for tilted detectors.

    Returns:
        Pixel index (row for horizontal, column for vertical)
    """
    if q_matrix.size == 0:
        return 0

    if direction == "horizontal":
        # Use specified or center column for q_y (searches rows)
        col = reference_index if reference_index is not None else q_matrix.shape[1] // 2
        q_vector = q_matrix[:, col]
    else:
        # Use specified or center row for q_x (searches columns)
        row = reference_index if reference_index is not None else q_matrix.shape[0] // 2
        q_vector = q_matrix[row, :]

    # Find index of closest q-value
    differences = np.abs(q_vector - target_q)
    return int(np.argmin(differences))


def calculate_q_to_pixel_width(
    q_position: float,
    q_width: float,
    q_matrix: np.ndarray,
    direction: Literal["horizontal", "vertical"],
) -> int:
    """
    Convert a q-space width to pixel width.

    Args:
        q_position: Center position in q-space
        q_width: Width in q-space units
        q_matrix: 2D array of q-values
        direction: "horizontal" or "vertical"

    Returns:
        Width in pixels
    """
    if q_width <= 0 or q_matrix.size == 0:
        return 0

    upper_q = q_position + q_width / 2
    lower_q = q_position - q_width / 2

    upper_pixel = find_pixel_position_for_q_value(upper_q, q_matrix, direction)
    lower_pixel = find_pixel_position_for_q_value(lower_q, q_matrix, direction)

    return abs(upper_pixel - lower_pixel)


def q_to_pixel(
    q_x: float,
    q_y: float,
    q_x_vector: np.ndarray,
    q_y_vector: np.ndarray,
) -> tuple[int, int]:
    """
    Convert q-space coordinates to pixel coordinates.

    Args:
        q_x: X position in q-space
        q_y: Y position in q-space
        q_x_vector: 1D array of q_x values (first row of q_x_matrix)
        q_y_vector: 1D array of q_y values (first column of q_y_matrix)

    Returns:
        (x_pixel, y_pixel) tuple
    """
    x_pixel = int(np.argmin(np.abs(q_x_vector - q_x)))
    y_pixel = int(np.argmin(np.abs(q_y_vector - q_y)))
    return x_pixel, y_pixel


def extract_horizontal_linecut(
    image_array: np.ndarray,
    q_x_matrix: np.ndarray,
    q_y_matrix: np.ndarray,
    position: float,
    width: float = 0.0,
) -> tuple[np.ndarray, np.ndarray]:
    """
    Extract a horizontal linecut (intensity vs q_x at fixed q_y).

    Args:
        image_array: 2D intensity array
        q_x_matrix: 2D array of q_x values
        q_y_matrix: 2D array of q_y values
        position: q_y position for the linecut
        width: Width in q-space units (0 = single row)

    Returns:
        (q_values, intensities) tuple
    """
    # Find the pixel row for this q_y position
    pixel_row = find_pixel_position_for_q_value(position, q_y_matrix, "horizontal")

    # Get q_x values from the actual extracted row (not first row)
    # This is important for tilted detectors where qx varies across rows
    q_values = q_x_matrix[pixel_row, :].copy()

    if width <= 0:
        # Single row
        intensities = np.nan_to_num(image_array[pixel_row, :], nan=0.0)
    else:
        # Calculate pixel width and average over it
        pixel_width = calculate_q_to_pixel_width(position, width, q_y_matrix, "horizontal")
        half_width = pixel_width // 2

        start_row = max(0, pixel_row - half_width)
        end_row = min(image_array.shape[0], pixel_row + half_width + 1)

        slice_data = image_array[start_row:end_row, :]
        intensities = np.nanmean(slice_data, axis=0)
        intensities = np.nan_to_num(intensities, nan=0.0)

    return q_values, intensities


def extract_vertical_linecut(
    image_array: np.ndarray,
    q_x_matrix: np.ndarray,
    q_y_matrix: np.ndarray,
    position: float,
    width: float = 0.0,
) -> tuple[np.ndarray, np.ndarray]:
    """
    Extract a vertical linecut (intensity vs q_y at fixed q_x).

    Args:
        image_array: 2D intensity array
        q_x_matrix: 2D array of q_x values
        q_y_matrix: 2D array of q_y values
        position: q_x position for the linecut
        width: Width in q-space units (0 = single column)

    Returns:
        (q_values, intensities) tuple
    """
    # Find the pixel column for this q_x position
    pixel_col = find_pixel_position_for_q_value(position, q_x_matrix, "vertical")

    # Get q_y values from the actual extracted column (not first column)
    # This is important for tilted detectors where qy varies across columns
    q_values = q_y_matrix[:, pixel_col].copy()

    if width <= 0:
        # Single column
        intensities = np.nan_to_num(image_array[:, pixel_col], nan=0.0)
    else:
        # Calculate pixel width and average over it
        pixel_width = calculate_q_to_pixel_width(position, width, q_x_matrix, "vertical")
        half_width = pixel_width // 2

        start_col = max(0, pixel_col - half_width)
        end_col = min(image_array.shape[1], pixel_col + half_width + 1)

        slice_data = image_array[:, start_col:end_col]
        intensities = np.nanmean(slice_data, axis=1)
        intensities = np.nan_to_num(intensities, nan=0.0)

    return q_values, intensities


def calculate_inclined_pixel_width(
    q_x_position: float,
    q_y_position: float,
    angle: float,
    q_width: float,
    q_x_vector: np.ndarray,
    q_y_vector: np.ndarray,
) -> float:
    """
    Calculate pixel width for an inclined linecut.

    Args:
        q_x_position: Center X position in q-space
        q_y_position: Center Y position in q-space
        angle: Angle in degrees
        q_width: Width in q-space units
        q_x_vector: 1D array of q_x values
        q_y_vector: 1D array of q_y values

    Returns:
        Width in pixels
    """
    if q_width <= 0 or len(q_x_vector) == 0 or len(q_y_vector) == 0:
        return 0.0

    # Convert central position to pixel coordinates
    center_pixel_x, center_pixel_y = q_to_pixel(q_x_position, q_y_position, q_x_vector, q_y_vector)

    # Calculate direction vectors based on angle
    angle_rad = np.radians(angle)
    dir_x = np.cos(angle_rad)
    dir_y = -np.sin(angle_rad)  # Y-axis points downward in image coordinates

    # Perpendicular vector for width calculations
    perp_x = -dir_y
    perp_y = dir_x

    # Calculate point at half-width distance in q-space along perpendicular
    half_width = q_width / 2
    q_point_x = q_x_position + perp_x * half_width
    q_point_y = q_y_position + perp_y * half_width

    # Find pixel position for this q-space point
    pixel_x, pixel_y = q_to_pixel(q_point_x, q_point_y, q_x_vector, q_y_vector)

    # Calculate pixel distance between center and half-width point
    pixel_distance_half = np.sqrt((pixel_x - center_pixel_x) ** 2 + (pixel_y - center_pixel_y) ** 2)

    return pixel_distance_half * 2


def extract_inclined_linecut(
    image_array: np.ndarray,
    q_x_matrix: np.ndarray,
    q_y_matrix: np.ndarray,
    q_x_position: float,
    q_y_position: float,
    angle: float,
    q_width: float = 0.0,
) -> tuple[np.ndarray, np.ndarray]:
    """
    Extract an inclined linecut along an angled path through the image.

    Uses vectorized NumPy operations for performance.

    Args:
        image_array: 2D intensity array
        q_x_matrix: 2D array of q_x values
        q_y_matrix: 2D array of q_y values
        q_x_position: Center X position in q-space
        q_y_position: Center Y position in q-space
        angle: Angle in degrees (0 = horizontal, 90 = vertical)
        q_width: Width in q-space units for averaging

    Returns:
        (path_distances, intensities) tuple where path_distances is
        the pixel distance along the linecut path from the start
    """
    image_height, image_width = image_array.shape

    # Get q vectors for coordinate conversion
    q_x_vector = q_x_matrix[0, :]
    q_y_vector = q_y_matrix[:, 0]

    # Convert q position to pixel position
    center_x, center_y = q_to_pixel(q_x_position, q_y_position, q_x_vector, q_y_vector)

    # Calculate direction vector based on angle
    angle_rad = np.radians(angle)
    dir_x = np.cos(angle_rad)
    dir_y = -np.sin(angle_rad)  # Y-axis points downward in image coordinates

    # Calculate line endpoints at image boundaries
    t_min = float("-inf")
    t_max = float("inf")

    # Intersection with x boundaries
    if dir_x != 0:
        t1 = -center_x / dir_x
        t2 = (image_width - 1 - center_x) / dir_x
        if dir_x > 0:
            t_min = max(t_min, t1)
            t_max = min(t_max, t2)
        else:
            t_min = max(t_min, t2)
            t_max = min(t_max, t1)

    # Intersection with y boundaries
    if dir_y != 0:
        t1 = -center_y / dir_y
        t2 = (image_height - 1 - center_y) / dir_y
        if dir_y > 0:
            t_min = max(t_min, t1)
            t_max = min(t_max, t2)
        else:
            t_min = max(t_min, t2)
            t_max = min(t_max, t1)

    # Check if line intersects the image
    if t_min > t_max:
        return np.array([]), np.array([])

    # Calculate endpoints
    x0 = center_x + t_min * dir_x
    y0 = center_y + t_min * dir_y
    x1 = center_x + t_max * dir_x
    y1 = center_y + t_max * dir_y

    # Calculate total line length
    dx = x1 - x0
    dy = y1 - y0
    length = np.sqrt(dx * dx + dy * dy)

    if length == 0:
        return np.array([]), np.array([])

    # Calculate pixel width for averaging
    pixel_width = calculate_inclined_pixel_width(q_x_position, q_y_position, angle, q_width, q_x_vector, q_y_vector)

    # Perpendicular vector for width averaging
    perp_x = -dir_y
    perp_y = dir_x

    # Sample points along the line
    num_points = int(np.ceil(length))
    path_distances = np.linspace(0, length, num_points)

    # Generate base positions along the line (vectorized)
    t_values = np.linspace(0, 1, num_points)
    base_x = x0 + t_values * dx
    base_y = y0 + t_values * dy

    # Width offsets for averaging
    half_width = pixel_width / 2
    if pixel_width > 0:
        w_offsets = np.arange(-half_width, half_width + 0.5, 0.5)
    else:
        w_offsets = np.array([0.0])

    # Create 2D grids of sample positions (num_points x num_offsets)
    # Broadcasting: base positions + perpendicular offsets
    sample_x = base_x[:, np.newaxis] + w_offsets[np.newaxis, :] * perp_x
    sample_y = base_y[:, np.newaxis] + w_offsets[np.newaxis, :] * perp_y

    # Round to integer pixel coordinates
    pixel_x = np.round(sample_x).astype(np.int32)
    pixel_y = np.round(sample_y).astype(np.int32)

    # Create mask for valid coordinates
    valid_mask = (pixel_x >= 0) & (pixel_x < image_width) & (pixel_y >= 0) & (pixel_y < image_height)

    # Clip coordinates to valid range for safe indexing
    pixel_x_clipped = np.clip(pixel_x, 0, image_width - 1)
    pixel_y_clipped = np.clip(pixel_y, 0, image_height - 1)

    # Extract all values at once using advanced indexing
    values = image_array[pixel_y_clipped, pixel_x_clipped]

    # Apply validity mask and NaN mask
    valid_values = valid_mask & ~np.isnan(values)
    values = np.where(valid_values, values, 0.0)

    # Compute mean along width axis (sum / count, avoiding division by zero)
    value_sum = np.sum(values, axis=1)
    value_count = np.sum(valid_values, axis=1)
    intensities = np.divide(value_sum, value_count, out=np.zeros_like(value_sum), where=value_count > 0)

    return path_distances, intensities


# =============================================================================
# GISAXS Linecut Extraction via pyFAI direct integration (single-pass)
# =============================================================================


def extract_gisaxs_horizontal_linecut_pyfai(
    image_array: np.ndarray,
    mask: np.ndarray | None,
    calibration: dict,
    qoop_position: float,
    qoop_width: float = 0.0,
    npt: int | None = None,
) -> tuple[np.ndarray, np.ndarray]:
    """
    Extract GISAXS horizontal linecut using pyFAI direct integration.

    Performs single-pass integration from detector pixels to 1D intensity vs qip
    at a fixed qoop band, avoiding the double-binning of the old approach
    (detector → 2D Q-grid → array slice).

    Args:
        image_array: 2D detector image (NaN-masked)
        mask: Binary mask (0=valid, 1=masked, pyFAI convention), or None
        calibration: Calibration dict with incident_angle, sample_detector_distance, etc.
        qoop_position: Out-of-plane Q position (in display convention, i.e. negated from pyFAI native)
        qoop_width: Width in Q-space units for the integration band (0 = minimum single-bin width)
        npt: Number of output points along the in-plane axis.
             Defaults to image width to match detector resolution.

    Returns:
        (qip_values, intensities) tuple
    """
    fi = create_fiber_integrator(calibration)
    incident_angle_rad = np.radians(calibration["incident_angle"])
    tilt_angle_rad = np.radians(calibration.get("tilt", 0.0))

    # Default npt to image width (in-plane axis matches detector columns)
    if npt is None:
        npt = image_array.shape[1]

    # Convert display qoop to pyFAI native convention.
    # Display convention negates pyFAI's qoop (see transform_gisaxs_to_qspace:
    # qoop_values = -result.outofplane), so we negate back for pyFAI.
    pyFAI_qoop_center = -qoop_position

    # Ensure minimum width (at least one bin) so oop_range spans a finite interval
    if qoop_width <= 0:
        # Use a small default width, pyFAI needs a finite range
        # Estimate from detector geometry: roughly pixel_size / distance * wavelength
        qoop_width = 0.01  # nm^-1, small enough for single-bin behavior

    half_w = qoop_width / 2
    oop_range = (pyFAI_qoop_center - half_w, pyFAI_qoop_center + half_w)

    integrate_kwargs = dict(
        data=image_array,
        npt_ip=npt,
        oop_range=oop_range,
        vertical_integration=False,
        sample_orientation=1,
        incident_angle=incident_angle_rad,
        tilt_angle=tilt_angle_rad,
        angle_unit="rad",
        correctSolidAngle=True,
    )
    if mask is not None:
        integrate_kwargs["mask"] = mask

    result = fi.integrate1d_grazing_incidence(**integrate_kwargs)

    qip_values = result.integrated
    intensities = np.nan_to_num(result.intensity, nan=0.0)

    return qip_values, intensities


def extract_gisaxs_vertical_linecut_pyfai(
    image_array: np.ndarray,
    mask: np.ndarray | None,
    calibration: dict,
    qip_position: float,
    qip_width: float = 0.0,
    npt: int | None = None,
) -> tuple[np.ndarray, np.ndarray]:
    """
    Extract GISAXS vertical linecut using pyFAI direct integration.

    Performs single-pass integration from detector pixels to 1D intensity vs qoop
    at a fixed qip band, avoiding the double-binning of the old approach.

    Args:
        image_array: 2D detector image (NaN-masked)
        mask: Binary mask (0=valid, 1=masked, pyFAI convention), or None
        calibration: Calibration dict with incident_angle, sample_detector_distance, etc.
        qip_position: In-plane Q position
        qip_width: Width in Q-space units for the integration band (0 = minimum single-bin width)
        npt: Number of output points along the out-of-plane axis.
             Defaults to image height to match detector resolution.

    Returns:
        (qoop_values, intensities) tuple - qoop in display convention (negated from pyFAI)
    """
    fi = create_fiber_integrator(calibration)
    incident_angle_rad = np.radians(calibration["incident_angle"])
    tilt_angle_rad = np.radians(calibration.get("tilt", 0.0))

    # Default npt to image height (out-of-plane axis matches detector rows)
    if npt is None:
        npt = image_array.shape[0]

    # qip is not sign-inverted between pyFAI and display convention
    if qip_width <= 0:
        qip_width = 0.01  # nm^-1, small default for single-bin behavior

    half_w = qip_width / 2
    ip_range = (qip_position - half_w, qip_position + half_w)

    integrate_kwargs = dict(
        data=image_array,
        npt_oop=npt,
        ip_range=ip_range,
        vertical_integration=True,
        sample_orientation=1,
        incident_angle=incident_angle_rad,
        tilt_angle=tilt_angle_rad,
        angle_unit="rad",
        correctSolidAngle=True,
    )
    if mask is not None:
        integrate_kwargs["mask"] = mask

    result = fi.integrate1d_grazing_incidence(**integrate_kwargs)

    # Negate qoop to match display convention (same as transform_gisaxs_to_qspace)
    qoop_values = -result.integrated
    intensities = np.nan_to_num(result.intensity, nan=0.0)

    return qoop_values, intensities


# =============================================================================
# GISAXS Inclined Linecut Extraction (from transformed Q-space grid)
# =============================================================================


def extract_gisaxs_inclined_linecut(
    transformed_image: np.ndarray,
    qip_values: np.ndarray,
    qoop_values: np.ndarray,
    qip_position: float,
    qoop_position: float,
    angle: float,
    q_width: float = 0.0,
) -> tuple[np.ndarray, np.ndarray]:
    """
    Extract inclined linecut from GISAXS Q-space image.

    Uses bilinear interpolation along the line through (qip_position, qoop_position)
    at the given angle. Returns (q_path, intensities) where q_path is the distance
    along the linecut path in Q-space units.

    Since the Q-space grid is uniform, this is simpler than the pixel-space version.

    Args:
        transformed_image: 2D intensity array on Q-grid (npt_oop, npt_ip)
        qip_values: 1D array of in-plane Q values (length npt_ip)
        qoop_values: 1D array of out-of-plane Q values (length npt_oop)
        qip_position: Center in-plane Q position
        qoop_position: Center out-of-plane Q position
        angle: Angle in degrees (0 = horizontal along qip, 90 = vertical along qoop)
        q_width: Width in Q-space units for averaging

    Returns:
        (q_path, intensities) tuple - q_path is distance along the linecut
    """
    if len(qoop_values) == 0 or len(qip_values) == 0:
        return np.array([]), np.array([])

    npt_oop, npt_ip = transformed_image.shape

    # Q-space step sizes
    dq_ip = np.abs(qip_values[1] - qip_values[0]) if len(qip_values) > 1 else 1.0
    dq_oop = np.abs(qoop_values[1] - qoop_values[0]) if len(qoop_values) > 1 else 1.0

    # Q-space bounds
    qip_min, qip_max = qip_values.min(), qip_values.max()
    qoop_min, qoop_max = qoop_values.min(), qoop_values.max()

    # Direction vector in Q-space
    angle_rad = np.radians(angle)
    dir_qip = np.cos(angle_rad)
    dir_qoop = np.sin(angle_rad)

    # Find line extent within Q-space bounds
    t_min = float("-inf")
    t_max = float("inf")

    # Intersection with qip boundaries
    if dir_qip != 0:
        t1 = (qip_min - qip_position) / dir_qip
        t2 = (qip_max - qip_position) / dir_qip
        if dir_qip > 0:
            t_min = max(t_min, t1)
            t_max = min(t_max, t2)
        else:
            t_min = max(t_min, t2)
            t_max = min(t_max, t1)

    # Intersection with qoop boundaries
    if dir_qoop != 0:
        t1 = (qoop_min - qoop_position) / dir_qoop
        t2 = (qoop_max - qoop_position) / dir_qoop
        if dir_qoop > 0:
            t_min = max(t_min, t1)
            t_max = min(t_max, t2)
        else:
            t_min = max(t_min, t2)
            t_max = min(t_max, t1)

    if t_min > t_max:
        return np.array([]), np.array([])

    # Sample along the line in Q-space
    # Use step size as the smaller of the two Q-space resolutions
    step_size = min(dq_ip, dq_oop)
    total_length = t_max - t_min
    num_points = max(2, int(np.ceil(total_length / step_size)))

    t_values = np.linspace(t_min, t_max, num_points)
    q_path = t_values - t_min  # Distance from start

    # Q-space coordinates along the line
    sample_qip = qip_position + t_values * dir_qip
    sample_qoop = qoop_position + t_values * dir_qoop

    # Convert Q-space coordinates to array indices
    # qip_values might be increasing or decreasing, handle both cases
    qip_increasing = qip_values[-1] > qip_values[0] if len(qip_values) > 1 else True
    qoop_increasing = qoop_values[-1] > qoop_values[0] if len(qoop_values) > 1 else True

    if qip_increasing:
        idx_ip = (sample_qip - qip_values[0]) / dq_ip
    else:
        idx_ip = (qip_values[0] - sample_qip) / dq_ip

    if qoop_increasing:
        idx_oop = (sample_qoop - qoop_values[0]) / dq_oop
    else:
        idx_oop = (qoop_values[0] - sample_qoop) / dq_oop

    # Perpendicular direction for width averaging
    perp_qip = -dir_qoop
    perp_qoop = dir_qip

    # Width averaging
    if q_width > 0:
        half_width = q_width / 2
        w_offsets = np.arange(-half_width, half_width + step_size / 2, step_size / 2)
    else:
        w_offsets = np.array([0.0])

    # Create 2D grids of sample indices (num_points x num_offsets)
    offset_qip = perp_qip * w_offsets[np.newaxis, :]
    offset_qoop = perp_qoop * w_offsets[np.newaxis, :]

    sample_idx_ip = idx_ip[:, np.newaxis] + offset_qip / dq_ip
    sample_idx_oop = idx_oop[:, np.newaxis] + offset_qoop / dq_oop

    # Round to integer indices for sampling
    pixel_ip = np.round(sample_idx_ip).astype(np.int32)
    pixel_oop = np.round(sample_idx_oop).astype(np.int32)

    # Create mask for valid coordinates
    valid_mask = (pixel_ip >= 0) & (pixel_ip < npt_ip) & (pixel_oop >= 0) & (pixel_oop < npt_oop)

    # Clip coordinates for safe indexing
    pixel_ip_clipped = np.clip(pixel_ip, 0, npt_ip - 1)
    pixel_oop_clipped = np.clip(pixel_oop, 0, npt_oop - 1)

    # Extract values
    values = transformed_image[pixel_oop_clipped, pixel_ip_clipped]

    # Apply validity mask and NaN mask
    valid_values = valid_mask & ~np.isnan(values)
    values = np.where(valid_values, values, 0.0)

    # Compute mean along width axis
    value_sum = np.sum(values, axis=1)
    value_count = np.sum(valid_values, axis=1)
    intensities = np.divide(value_sum, value_count, out=np.zeros_like(value_sum), where=value_count > 0)

    return q_path, intensities
