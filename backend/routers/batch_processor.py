"""
Batch processing router for parallel linecut and azimuthal integration operations.

This module provides endpoints for processing multiple scans in parallel using
ThreadPoolExecutor, with real-time progress updates via WebSocket.
"""

import asyncio
import concurrent.futures
import uuid
from typing import Optional

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
# Batch Job Tracking
# ============================================================================

# Track active batch jobs for cancellation
# Maps batch_id -> cancelled flag
ACTIVE_BATCHES: dict[str, bool] = {}


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


class BatchAllRequest(BaseModel):
    """Request body for unified batch processing of all linecut types."""

    scan_uris: list[str]
    calibration: CalibrationParams
    horizontal_linecuts: list[HorizontalLinecutParams] = []
    vertical_linecuts: list[VerticalLinecutParams] = []
    inclined_linecuts: list[InclinedLinecutParams] = []
    azimuthal_integrations: list[AzimuthalParams] = []
    mask_uri: Optional[str] = None  # Optional detector mask URI or mask_id


# ============================================================================
# Worker Functions (run in thread pool)
# ============================================================================


def process_scan_all_linecuts(
    scan_uri: str,
    calibration: dict,
    horizontal_linecuts: list[dict],
    vertical_linecuts: list[dict],
    inclined_linecuts: list[dict],
    azimuthal_integrations: list[dict],
    bypass_cache: bool = False,
    mask_uri: Optional[str] = None,
) -> dict:
    """
    Process a single scan for ALL linecut types and integrations.

    This function fetches the image ONCE and applies all linecut operations,
    optimizing I/O by avoiding redundant image fetches.

    Args:
        scan_uri: URI of the scan to process
        calibration: Calibration parameters dict
        horizontal_linecuts: List of horizontal linecut params (with 'id' key)
        vertical_linecuts: List of vertical linecut params (with 'id' key)
        inclined_linecuts: List of inclined linecut params (with 'id' key)
        azimuthal_integrations: List of azimuthal params (with 'id' key)
        bypass_cache: If True, skip image cache (for large batch processing)
        mask_uri: Optional detector mask URI or mask_id

    Returns:
        Dict with results organized by type and linecut ID
    """
    scan_name = scan_uri.split("/")[-1]
    results = {
        "scan_uri": scan_uri,
        "scan_name": scan_name,
        "horizontal": {},
        "vertical": {},
        "inclined": {},
        "azimuthal": {},
    }

    try:
        # Fetch image (bypass cache for batch processing to avoid thrashing)
        # Mask is applied during processing - masked pixels become NaN
        processed_image = get_cached_processed_image(
            scan_uri.lstrip("/"),
            mask_uri=mask_uri,
            bypass_cache=bypass_cache,
        )
        image_array = processed_image.full.array

        # Compute Q matrices ONCE (for linecuts)
        q_x_matrix, q_y_matrix = compute_q_matrices(image_array.shape, calibration)

        # Process horizontal linecuts
        for linecut in horizontal_linecuts:
            linecut_id = linecut["id"]
            try:
                q_values, intensities = extract_horizontal_linecut(
                    image_array,
                    q_x_matrix,
                    q_y_matrix,
                    linecut["position"],
                    linecut.get("width", 0.0),
                )
                results["horizontal"][linecut_id] = {
                    "q_values": q_values.tolist(),
                    "intensities": intensities.tolist(),
                    "success": True,
                    "error_message": None,
                }
            except Exception as e:
                results["horizontal"][linecut_id] = {
                    "q_values": [],
                    "intensities": [],
                    "success": False,
                    "error_message": str(e),
                }

        # Process vertical linecuts
        for linecut in vertical_linecuts:
            linecut_id = linecut["id"]
            try:
                q_values, intensities = extract_vertical_linecut(
                    image_array,
                    q_x_matrix,
                    q_y_matrix,
                    linecut["position"],
                    linecut.get("width", 0.0),
                )
                results["vertical"][linecut_id] = {
                    "q_values": q_values.tolist(),
                    "intensities": intensities.tolist(),
                    "success": True,
                    "error_message": None,
                }
            except Exception as e:
                results["vertical"][linecut_id] = {
                    "q_values": [],
                    "intensities": [],
                    "success": False,
                    "error_message": str(e),
                }

        # Process inclined linecuts
        for linecut in inclined_linecuts:
            linecut_id = linecut["id"]
            try:
                q_values, intensities = extract_inclined_linecut(
                    image_array,
                    q_x_matrix,
                    q_y_matrix,
                    linecut["q_x_position"],
                    linecut["q_y_position"],
                    linecut["angle"],
                    linecut.get("q_width", 0.0),
                )
                results["inclined"][linecut_id] = {
                    "q_values": q_values.tolist(),
                    "intensities": intensities.tolist(),
                    "success": True,
                    "error_message": None,
                }
            except Exception as e:
                results["inclined"][linecut_id] = {
                    "q_values": [],
                    "intensities": [],
                    "success": False,
                    "error_message": str(e),
                }

        # Process azimuthal integrations
        # Create integrator ONCE (if needed)
        ai = None
        for integration in azimuthal_integrations:
            integration_id = integration["id"]
            try:
                # Lazy create integrator
                if ai is None:
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

                azimuth_range = integration.get("azimuth_range", (-180, 180))
                q_range = integration.get("q_range")

                q_values, intensities = integrate_1d(
                    ai, image_array, azimuth_range=azimuth_range, q_range=q_range
                )
                results["azimuthal"][integration_id] = {
                    "q_values": q_values.tolist(),
                    "intensities": intensities.tolist(),
                    "success": True,
                    "error_message": None,
                }
            except Exception as e:
                results["azimuthal"][integration_id] = {
                    "q_values": [],
                    "intensities": [],
                    "success": False,
                    "error_message": str(e),
                }

        results["success"] = True
        results["error_message"] = None

    except Exception as e:
        # Image fetch failed - mark all linecuts as failed
        results["success"] = False
        results["error_message"] = str(e)

    return results


def process_scan_for_batch(
    scan_uri: str,
    calibration: dict,
    horizontal_linecuts: list[dict],
    vertical_linecuts: list[dict],
    inclined_linecuts: list[dict],
    azimuthal_integrations: list[dict],
    batch_id: str,
    mask_uri: Optional[str] = None,
) -> dict:
    """
    Process a single scan for batch processing with cancellation support.

    Bypasses the image cache to allow full parallelism for large batches.
    Each image is fetched, processed, and discarded immediately.
    """
    scan_name = scan_uri.split("/")[-1]

    # Check if batch was cancelled before processing
    if ACTIVE_BATCHES.get(batch_id, False):
        print(f"[BATCH {batch_id[:8]}] Skipping {scan_name} - batch cancelled")
        return {
            "scan_uri": scan_uri,
            "scan_name": scan_name,
            "horizontal": {},
            "vertical": {},
            "inclined": {},
            "azimuthal": {},
            "success": False,
            "error_message": "Batch cancelled",
        }

    print(f"[BATCH {batch_id[:8]}] Processing {scan_name}...")
    result = process_scan_all_linecuts(
        scan_uri,
        calibration,
        horizontal_linecuts,
        vertical_linecuts,
        inclined_linecuts,
        azimuthal_integrations,
        bypass_cache=True,  # Bypass cache for batch processing
        mask_uri=mask_uri,
    )
    status = "OK" if result.get("success", False) else "FAILED"
    print(f"[BATCH {batch_id[:8]}] Completed {scan_name} - {status}")
    return result


# ============================================================================
# API Endpoints
# ============================================================================


@router.post("/batch-cancel/{batch_id}")
async def cancel_batch(batch_id: str):
    """
    Cancel an active batch processing job.

    Sets the cancellation flag for the batch, which workers check before
    and after acquiring the semaphore. Already-running scans will complete,
    but no new scans will start processing.
    """
    if batch_id in ACTIVE_BATCHES:
        print(f"[BATCH {batch_id[:8]}] Cancel requested by user")
        ACTIVE_BATCHES[batch_id] = True
        await send_progress_update(
            -1,  # Special value indicating cancellation
            "Batch cancelled by user",
            batch_id=batch_id,
        )
        return {"status": "cancelled", "batch_id": batch_id}
    print(f"[BATCH {batch_id[:8]}] Cancel requested but batch not found")
    return {"status": "not_found", "batch_id": batch_id}


@router.post("/batch-all")
async def batch_all(request: BatchAllRequest):
    """
    Process all linecut types and integrations across multiple scans in parallel.

    This endpoint is optimized to fetch each image only ONCE and apply all
    linecut operations (horizontal, vertical, inclined) and azimuthal integrations.

    For N scans with H horizontal, V vertical, I inclined linecuts, and A azimuthal
    integrations, this endpoint fetches N images instead of N*(H+V+I+A) fetches
    that would be required by calling individual batch endpoints.

    Uses ThreadPoolExecutor with 16 workers for parallel I/O-bound operations.
    Progress updates are sent via WebSocket with batch_id for client filtering.
    """
    import time

    batch_id = uuid.uuid4().hex
    total = len(request.scan_uris)

    # Register batch for cancellation tracking
    ACTIVE_BATCHES[batch_id] = False

    # Count total operations for summary
    total_linecuts = (
        len(request.horizontal_linecuts)
        + len(request.vertical_linecuts)
        + len(request.inclined_linecuts)
        + len(request.azimuthal_integrations)
    )

    print(f"\n{'='*60}")
    print(f"[BATCH {batch_id[:8]}] === BATCH PROCESSING STARTED ===")
    print(f"[BATCH {batch_id[:8]}] Scans: {total}")
    print(f"[BATCH {batch_id[:8]}] Horizontal linecuts: {len(request.horizontal_linecuts)}")
    print(f"[BATCH {batch_id[:8]}] Vertical linecuts: {len(request.vertical_linecuts)}")
    print(f"[BATCH {batch_id[:8]}] Inclined linecuts: {len(request.inclined_linecuts)}")
    print(f"[BATCH {batch_id[:8]}] Azimuthal integrations: {len(request.azimuthal_integrations)}")
    print(f"[BATCH {batch_id[:8]}] Total operations per scan: {total_linecuts}")
    print(f"{'='*60}")

    batch_start_time = time.time()

    await send_progress_update(
        0,
        f"Starting batch processing for {total} scans × {total_linecuts} linecuts",
        batch_id=batch_id,
    )

    # Convert Pydantic models to dicts with IDs
    calibration = request.calibration.model_dump()

    horizontal_linecuts = [
        {"id": i, **lc.model_dump()} for i, lc in enumerate(request.horizontal_linecuts)
    ]
    vertical_linecuts = [
        {"id": i, **lc.model_dump()} for i, lc in enumerate(request.vertical_linecuts)
    ]
    inclined_linecuts = [
        {"id": i, **lc.model_dump()} for i, lc in enumerate(request.inclined_linecuts)
    ]
    azimuthal_integrations = [
        {"id": i, **lc.model_dump()} for i, lc in enumerate(request.azimuthal_integrations)
    ]

    # Collect results per scan
    scan_results = []
    successful_scans = 0
    failed_scans = 0
    processed_count = 0
    was_cancelled = False

    max_workers = 16

    # Get mask_uri from request
    mask_uri = request.mask_uri

    try:
        with concurrent.futures.ThreadPoolExecutor(max_workers=max_workers) as executor:
            # Submit all tasks - cache is bypassed for full parallelism
            future_to_uri = {
                executor.submit(
                    process_scan_for_batch,
                    uri,
                    calibration,
                    horizontal_linecuts,
                    vertical_linecuts,
                    inclined_linecuts,
                    azimuthal_integrations,
                    batch_id,
                    mask_uri,
                ): uri
                for uri in request.scan_uris
            }

            # Process results as they complete
            for future in concurrent.futures.as_completed(future_to_uri):
                # Check if batch was cancelled
                if ACTIVE_BATCHES.get(batch_id, False):
                    # Cancel remaining futures
                    for f in future_to_uri:
                        f.cancel()
                    break

                result = future.result()
                scan_results.append(result)

                if result.get("success", False):
                    successful_scans += 1
                else:
                    failed_scans += 1

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

        # Check if cancelled
        was_cancelled = ACTIVE_BATCHES.get(batch_id, False)
        processing_time = time.time() - batch_start_time

        if was_cancelled:
            print(f"[BATCH {batch_id[:8]}] Batch CANCELLED after {processed_count}/{total} scans")
            print(f"[BATCH {batch_id[:8]}] Processing time before cancel: {processing_time:.2f}s")
            await send_progress_update(
                progress,
                f"Batch cancelled after {processed_count}/{total} scans",
                batch_id=batch_id,
            )
        else:
            print(f"[BATCH {batch_id[:8]}] All scans processed: {successful_scans} OK, {failed_scans} failed")
            print(f"[BATCH {batch_id[:8]}] Processing time: {processing_time:.2f}s")
            await send_progress_update(
                100,
                f"Batch complete: {successful_scans} scans successful, {failed_scans} failed",
                batch_id=batch_id,
            )
    finally:
        # Cleanup: remove batch from active tracking
        ACTIVE_BATCHES.pop(batch_id, None)

    # Sort results to match input order (only include URIs that were processed)
    # When cancelled, not all URIs will have results
    uri_to_result = {r["scan_uri"]: r for r in scan_results}
    ordered_results = [uri_to_result[uri] for uri in request.scan_uris if uri in uri_to_result]

    print(f"[BATCH {batch_id[:8]}] Reorganizing results...")
    reorg_start_time = time.time()

    # Reorganize results by linecut type and ID
    # Structure: results[type][linecut_id] = list of per-scan results
    # Optimized: Pre-allocate lists and use direct assignment instead of append

    num_scans = len(ordered_results)

    # Build linecut ID lists for each type
    h_ids = [lc["id"] for lc in horizontal_linecuts]
    v_ids = [lc["id"] for lc in vertical_linecuts]
    i_ids = [lc["id"] for lc in inclined_linecuts]
    a_ids = [lc["id"] for lc in azimuthal_integrations]

    # Pre-allocate result lists
    organized_results = {
        "horizontal": {lc_id: [None] * num_scans for lc_id in h_ids},
        "vertical": {lc_id: [None] * num_scans for lc_id in v_ids},
        "inclined": {lc_id: [None] * num_scans for lc_id in i_ids},
        "azimuthal": {lc_id: [None] * num_scans for lc_id in a_ids},
    }

    # Empty dict for missing data lookups
    empty_dict = {}
    empty_list = []

    # Populate results using index-based assignment (faster than append)
    for scan_idx, scan_result in enumerate(ordered_results):
        scan_uri = scan_result["scan_uri"]
        scan_name = scan_result["scan_name"]

        # Cache type dicts from scan_result to avoid repeated lookups
        h_data = scan_result.get("horizontal", empty_dict)
        v_data = scan_result.get("vertical", empty_dict)
        i_data = scan_result.get("inclined", empty_dict)
        a_data = scan_result.get("azimuthal", empty_dict)

        for lc_id in h_ids:
            lc_result = h_data.get(lc_id, empty_dict)
            organized_results["horizontal"][lc_id][scan_idx] = {
                "scan_uri": scan_uri,
                "scan_name": scan_name,
                "q_values": lc_result.get("q_values", empty_list),
                "intensities": lc_result.get("intensities", empty_list),
                "success": lc_result.get("success", False),
                "error_message": lc_result.get("error_message"),
            }

        for lc_id in v_ids:
            lc_result = v_data.get(lc_id, empty_dict)
            organized_results["vertical"][lc_id][scan_idx] = {
                "scan_uri": scan_uri,
                "scan_name": scan_name,
                "q_values": lc_result.get("q_values", empty_list),
                "intensities": lc_result.get("intensities", empty_list),
                "success": lc_result.get("success", False),
                "error_message": lc_result.get("error_message"),
            }

        for lc_id in i_ids:
            lc_result = i_data.get(lc_id, empty_dict)
            organized_results["inclined"][lc_id][scan_idx] = {
                "scan_uri": scan_uri,
                "scan_name": scan_name,
                "q_values": lc_result.get("q_values", empty_list),
                "intensities": lc_result.get("intensities", empty_list),
                "success": lc_result.get("success", False),
                "error_message": lc_result.get("error_message"),
            }

        for lc_id in a_ids:
            lc_result = a_data.get(lc_id, empty_dict)
            organized_results["azimuthal"][lc_id][scan_idx] = {
                "scan_uri": scan_uri,
                "scan_name": scan_name,
                "q_values": lc_result.get("q_values", empty_list),
                "intensities": lc_result.get("intensities", empty_list),
                "success": lc_result.get("success", False),
                "error_message": lc_result.get("error_message"),
            }

    reorg_time = time.time() - reorg_start_time
    print(f"[BATCH {batch_id[:8]}] Result reorganization: {reorg_time:.2f}s")

    # Report actual processed count (may be less than total if cancelled)
    actual_processed = len(ordered_results)

    response_data = {
        "batch_id": batch_id,
        "total_scans": actual_processed,  # Actual processed, not requested
        "requested_scans": total,  # Original request count
        "successful_scans": successful_scans,
        "failed_scans": failed_scans,
        "cancelled": was_cancelled,
        "results": organized_results,
    }

    packed_data = msgpack.packb(response_data, use_bin_type=True)
    total_time = time.time() - batch_start_time
    response_size_kb = len(packed_data) / 1024

    print(f"[BATCH {batch_id[:8]}] Response size: {response_size_kb:.1f} KB")
    print(f"[BATCH {batch_id[:8]}] Total batch time: {total_time:.2f}s")
    if was_cancelled:
        print(f"[BATCH {batch_id[:8]}] === BATCH CANCELLED ({actual_processed}/{total} scans) ===")
    else:
        print(f"[BATCH {batch_id[:8]}] === BATCH PROCESSING COMPLETE ===")
    print(f"{'='*60}\n")

    return Response(content=packed_data, media_type="application/x-msgpack")
