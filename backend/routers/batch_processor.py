"""
Batch processing router for parallel linecut and azimuthal integration operations.

This module provides endpoints for processing multiple scans in parallel using
ThreadPoolExecutor, with real-time progress updates via WebSocket.
"""

import asyncio
import concurrent.futures
import uuid
from typing import Literal, Optional

import msgpack
from fastapi import APIRouter
from fastapi.responses import Response
from pydantic import BaseModel

from routers.websocket import send_progress_update
from utils.azimuthal_integration import create_azimuthal_integrator, integrate_1d
from utils.image_cache import get_cached_processed_image
from utils.linecut_extraction import (
    extract_horizontal_linecut,
    extract_inclined_linecut,
    extract_vertical_linecut,
)
from utils.q_space import compute_q_matrices

router = APIRouter()


# ============================================================================
# Pydantic Models
# ============================================================================


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


class AzimuthalParams(BaseModel):
    """Parameters for azimuthal integration."""

    azimuth_range: tuple[float, float] = (-180, 180)
    q_range: Optional[tuple[float, float]] = None


class BatchLinecutRequest(BaseModel):
    """Request body for batch linecut processing."""

    scan_uris: list[str]
    calibration: CalibrationParams
    linecut_type: Literal["horizontal", "vertical", "inclined"]
    linecut_params: dict  # Will be parsed based on linecut_type


class BatchAzimuthalRequest(BaseModel):
    """Request body for batch azimuthal integration."""

    scan_uris: list[str]
    calibration: CalibrationParams
    azimuthal_params: AzimuthalParams


# ============================================================================
# Worker Functions (run in thread pool)
# ============================================================================


def process_single_linecut(
    scan_uri: str,
    calibration: dict,
    linecut_type: str,
    linecut_params: dict,
) -> dict:
    """
    Process a single scan for linecut extraction.

    This function runs in a thread pool worker and is thread-safe.

    Args:
        scan_uri: URI of the scan to process
        calibration: Calibration parameters dict
        linecut_type: Type of linecut ("horizontal", "vertical", "inclined")
        linecut_params: Parameters specific to the linecut type

    Returns:
        Dict with scan_uri, scan_name, q_values, intensities, success, error_message
    """
    try:
        # Get image from cache
        processed_image = get_cached_processed_image(scan_uri.lstrip("/"))
        image_array = processed_image.full.array

        # Compute Q matrices for this image
        q_x_matrix, q_y_matrix = compute_q_matrices(image_array.shape, calibration)

        # Extract linecut based on type
        if linecut_type == "horizontal":
            q_values, intensities = extract_horizontal_linecut(
                image_array,
                q_x_matrix,
                q_y_matrix,
                linecut_params["position"],
                linecut_params.get("width", 0.0),
            )
        elif linecut_type == "vertical":
            q_values, intensities = extract_vertical_linecut(
                image_array,
                q_x_matrix,
                q_y_matrix,
                linecut_params["position"],
                linecut_params.get("width", 0.0),
            )
        elif linecut_type == "inclined":
            q_values, intensities = extract_inclined_linecut(
                image_array,
                q_x_matrix,
                q_y_matrix,
                linecut_params["q_x_position"],
                linecut_params["q_y_position"],
                linecut_params["angle"],
                linecut_params.get("q_width", 0.0),
            )
        else:
            raise ValueError(f"Unknown linecut type: {linecut_type}")

        return {
            "scan_uri": scan_uri,
            "scan_name": scan_uri.split("/")[-1],
            "q_values": q_values.tolist(),
            "intensities": intensities.tolist(),
            "success": True,
            "error_message": None,
        }

    except Exception as e:
        return {
            "scan_uri": scan_uri,
            "scan_name": scan_uri.split("/")[-1],
            "q_values": [],
            "intensities": [],
            "success": False,
            "error_message": str(e),
        }


def process_single_azimuthal(
    scan_uri: str,
    calibration: dict,
    azimuthal_params: dict,
) -> dict:
    """
    Process a single scan for azimuthal integration.

    Args:
        scan_uri: URI of the scan to process
        calibration: Calibration parameters dict
        azimuthal_params: Azimuthal integration parameters

    Returns:
        Dict with scan_uri, scan_name, q_values, intensities, success, error_message
    """
    try:
        # Get image from cache
        processed_image = get_cached_processed_image(scan_uri.lstrip("/"))
        image_array = processed_image.full.array

        ai = create_azimuthal_integrator(
            sample_detector_distance=calibration["sample_detector_distance"],
            beam_center_x=calibration["beam_center_x"],
            beam_center_y=calibration["beam_center_y"],
            pixel_size_x=calibration["pixel_size_x"],
            pixel_size_y=calibration["pixel_size_y"],
            wavelength=calibration["wavelength"],
            tilt=calibration.get("tilt", 0.0),
            tilt_plan_rotation=calibration.get("tilt_plan_rotation", 0.0),
        )

        azimuth_range = azimuthal_params.get("azimuth_range", (-180, 180))
        q_range = azimuthal_params.get("q_range")

        q_values, intensities = integrate_1d(
            ai, image_array, azimuth_range=azimuth_range, q_range=q_range
        )

        return {
            "scan_uri": scan_uri,
            "scan_name": scan_uri.split("/")[-1],
            "q_values": q_values.tolist(),
            "intensities": intensities.tolist(),
            "success": True,
            "error_message": None,
        }

    except Exception as e:
        return {
            "scan_uri": scan_uri,
            "scan_name": scan_uri.split("/")[-1],
            "q_values": [],
            "intensities": [],
            "success": False,
            "error_message": str(e),
        }


# ============================================================================
# API Endpoints
# ============================================================================


@router.post("/batch-linecut")
async def batch_linecut(request: BatchLinecutRequest):
    """
    Process linecut extraction across multiple scans in parallel.

    Uses ThreadPoolExecutor with 16 workers for parallel I/O-bound operations.
    Progress updates are sent via WebSocket with batch_id for client filtering.
    """
    batch_id = uuid.uuid4().hex
    total = len(request.scan_uris)

    await send_progress_update(
        0, f"Starting batch {request.linecut_type} linecut for {total} scans", batch_id=batch_id
    )

    # Convert Pydantic model to dict
    calibration = request.calibration.model_dump()

    # Collect results
    results = []
    successful = 0
    failed = 0
    processed_count = 0

    max_workers = 16

    with concurrent.futures.ThreadPoolExecutor(max_workers=max_workers) as executor:
        # Submit all tasks
        future_to_uri = {
            executor.submit(
                process_single_linecut,
                uri,
                calibration,
                request.linecut_type,
                request.linecut_params,
            ): uri
            for uri in request.scan_uris
        }

        # Process results as they complete
        for future in concurrent.futures.as_completed(future_to_uri):
            result = future.result()
            results.append(result)

            if result["success"]:
                successful += 1
            else:
                failed += 1

            processed_count += 1
            progress = (processed_count / total) * 100

            await send_progress_update(
                progress,
                f"Processed {processed_count}/{total} scans",
                batch_id=batch_id,
                current_scan=result["scan_name"],
            )

            # Yield to event loop to allow progress updates to be sent
            await asyncio.sleep(0)

    await send_progress_update(
        100,
        f"Batch complete: {successful} successful, {failed} failed",
        batch_id=batch_id,
    )

    # Sort results to match input order
    uri_to_result = {r["scan_uri"]: r for r in results}
    ordered_results = [uri_to_result[uri] for uri in request.scan_uris]

    response_data = {
        "batch_id": batch_id,
        "operation_type": request.linecut_type,
        "total_scans": total,
        "successful": successful,
        "failed": failed,
        "results": ordered_results,
    }

    packed_data = msgpack.packb(response_data, use_bin_type=True)
    return Response(content=packed_data, media_type="application/x-msgpack")


@router.post("/batch-azimuthal")
async def batch_azimuthal(request: BatchAzimuthalRequest):
    """
    Process azimuthal integration across multiple scans in parallel.

    Uses ThreadPoolExecutor with 16 workers for parallel I/O-bound operations.
    Progress updates are sent via WebSocket with batch_id for client filtering.
    """
    batch_id = uuid.uuid4().hex
    total = len(request.scan_uris)

    await send_progress_update(
        0, f"Starting batch azimuthal integration for {total} scans", batch_id=batch_id
    )

    # Convert Pydantic models to dicts
    calibration = request.calibration.model_dump()
    azimuthal_params = request.azimuthal_params.model_dump()

    # Collect results
    results = []
    successful = 0
    failed = 0
    processed_count = 0

    max_workers = 16

    with concurrent.futures.ThreadPoolExecutor(max_workers=max_workers) as executor:
        # Submit all tasks
        future_to_uri = {
            executor.submit(
                process_single_azimuthal,
                uri,
                calibration,
                azimuthal_params,
            ): uri
            for uri in request.scan_uris
        }

        # Process results as they complete
        for future in concurrent.futures.as_completed(future_to_uri):
            result = future.result()
            results.append(result)

            if result["success"]:
                successful += 1
            else:
                failed += 1

            processed_count += 1
            progress = (processed_count / total) * 100

            await send_progress_update(
                progress,
                f"Processed {processed_count}/{total} scans",
                batch_id=batch_id,
                current_scan=result["scan_name"],
            )

            # Yield to event loop
            await asyncio.sleep(0)

    await send_progress_update(
        100,
        f"Batch complete: {successful} successful, {failed} failed",
        batch_id=batch_id,
    )

    # Sort results to match input order
    uri_to_result = {r["scan_uri"]: r for r in results}
    ordered_results = [uri_to_result[uri] for uri in request.scan_uris]

    response_data = {
        "batch_id": batch_id,
        "operation_type": "azimuthal",
        "total_scans": total,
        "successful": successful,
        "failed": failed,
        "results": ordered_results,
    }

    packed_data = msgpack.packb(response_data, use_bin_type=True)
    return Response(content=packed_data, media_type="application/x-msgpack")
