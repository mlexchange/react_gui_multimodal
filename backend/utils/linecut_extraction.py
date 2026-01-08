"""
Linecut extraction utilities for batch processing.

This module provides pure Python functions for extracting linecuts from
scattering images. These functions are thread-safe (no shared state) and
designed for parallel execution via ThreadPoolExecutor.

The logic mirrors the frontend TypeScript implementation in:
- frontend/src/components/Scattering/utils/findPixelPositionForQValue.ts
- frontend/src/components/Scattering/utils/calculateQSpaceToPixelWidth.ts
- frontend/src/components/Scattering/hooks/useInclinedLinecut.ts
"""

from typing import Literal, Tuple

import numpy as np


def find_pixel_position_for_q_value(
    target_q: float,
    q_matrix: np.ndarray,
    direction: Literal["horizontal", "vertical"],
) -> int:
    """
    Find the pixel index corresponding to a q-value.

    For horizontal linecuts: searches rows using first column of q_y_matrix
    For vertical linecuts: searches columns using first row of q_x_matrix

    Args:
        target_q: The q-value to find
        q_matrix: 2D array of q-values
        direction: "horizontal" or "vertical"

    Returns:
        Pixel index (row for horizontal, column for vertical)
    """
    if q_matrix.size == 0:
        return 0

    if direction == "horizontal":
        # Use first column for q_y (searches rows)
        q_vector = q_matrix[:, 0]
    else:
        # Use first row for q_x (searches columns)
        q_vector = q_matrix[0, :]

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
) -> Tuple[int, int]:
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
) -> Tuple[np.ndarray, np.ndarray]:
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

    # Get q_x values from first row of q_x_matrix
    q_values = q_x_matrix[0, :].copy()

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
        slice_data = np.nan_to_num(slice_data, nan=0.0)
        intensities = np.mean(slice_data, axis=0)

    return q_values, intensities


def extract_vertical_linecut(
    image_array: np.ndarray,
    q_x_matrix: np.ndarray,
    q_y_matrix: np.ndarray,
    position: float,
    width: float = 0.0,
) -> Tuple[np.ndarray, np.ndarray]:
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

    # Get q_y values from first column of q_y_matrix
    q_values = q_y_matrix[:, 0].copy()

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
        slice_data = np.nan_to_num(slice_data, nan=0.0)
        intensities = np.mean(slice_data, axis=1)

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
) -> Tuple[np.ndarray, np.ndarray]:
    """
    Extract an inclined linecut along an angled path through the image.

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
    intensities = np.zeros(num_points)
    half_width = pixel_width / 2

    for i in range(num_points):
        # Base position along the line
        base_x = x0 + (i / num_points) * dx
        base_y = y0 + (i / num_points) * dy

        sum_val = 0.0
        count = 0

        # Sample perpendicular to the line for width averaging
        if pixel_width > 0:
            w_range = np.arange(-half_width, half_width + 0.5, 0.5)
        else:
            w_range = [0.0]

        for w in w_range:
            x = int(round(base_x + w * perp_x))
            y = int(round(base_y + w * perp_y))

            # Check if point is within bounds
            if 0 <= x < image_width and 0 <= y < image_height:
                val = image_array[y, x]
                if not np.isnan(val):
                    sum_val += val
                    count += 1

        intensities[i] = sum_val / count if count > 0 else 0.0

    return path_distances, intensities
