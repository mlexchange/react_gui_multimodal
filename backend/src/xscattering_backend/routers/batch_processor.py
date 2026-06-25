"""
Batch processing router for parallel linecut and azimuthal integration operations.

This module provides endpoints for processing multiple scans in parallel using
ThreadPoolExecutor, with real-time progress updates via WebSocket.
"""

import asyncio
import concurrent.futures
import uuid

import msgpack
from fastapi import APIRouter
from fastapi.responses import Response
from xscattering_backend.cache.image_cache import get_cached_processed_image
from xscattering_backend.config.logging import get_logger
from xscattering_backend.config.models import (
    BatchAllRequest,
    create_error_linecut_result,
    create_linecut_result,
)
from xscattering_backend.config.settings import get_config
from xscattering_backend.routers.websocket import send_progress_update
from xscattering_backend.utils.azimuthal_integration import (
    create_azimuthal_integrator,
    integrate_1d,
)
from xscattering_backend.utils.linecut_extraction import (
    extract_gisaxs_horizontal_linecut_pyfai,
    extract_gisaxs_inclined_linecut,
    extract_gisaxs_vertical_linecut_pyfai,
    extract_horizontal_linecut,
    extract_inclined_linecut,
    extract_vertical_linecut,
)
from xscattering_backend.utils.q_space import compute_saxs_q_matrices

logger = get_logger(__name__)
router = APIRouter()


# ============================================================================
# Batch Job Tracking
# ============================================================================

# Track active batch jobs for cancellation
# Maps batch_id -> cancelled flag
ACTIVE_BATCHES: dict[str, bool] = {}


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
    mask_uri: str | None = None,
    npt_ip: int | None = None,
    npt_oop: int | None = None,
) -> dict:
    """
    Process a single scan for ALL linecut types and integrations.

    This function fetches the image ONCE and applies all linecut operations,
    optimizing I/O by avoiding redundant image fetches.

    For GISAXS experiments, linecuts are extracted from the transformed Q-space
    image. Azimuthal integration is skipped for GISAXS.

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
    experiment_type = calibration.get("experiment_type", "SAXS")

    results = {
        "scan_uri": scan_uri,
        "scan_name": scan_name,
        "horizontal": {},
        "vertical": {},
        "inclined": {},
        "azimuthal": {},
    }

    try:
        if experiment_type == "GISAXS":
            # Use GISAXS-specific processing
            _process_gisaxs_linecuts(
                results,
                scan_uri,
                calibration,
                horizontal_linecuts,
                vertical_linecuts,
                inclined_linecuts,
                mask_uri,
                npt_ip=npt_ip,
                npt_oop=npt_oop,
            )
            # Skip azimuthal integration for GISAXS
            for integration in azimuthal_integrations:
                results["azimuthal"][integration["id"]] = create_error_linecut_result(
                    "Azimuthal integration not supported for GISAXS"
                )
        else:
            # Use standard SAXS processing
            _process_saxs_linecuts(
                results,
                scan_uri,
                calibration,
                horizontal_linecuts,
                vertical_linecuts,
                inclined_linecuts,
                azimuthal_integrations,
                bypass_cache,
                mask_uri,
            )

        results["success"] = True
        results["error_message"] = None

    except Exception as e:
        # Image fetch or transform failed - mark all linecuts as failed
        results["success"] = False
        results["error_message"] = str(e)

    return results


def _process_saxs_linecuts(
    results: dict,
    scan_uri: str,
    calibration: dict,
    horizontal_linecuts: list[dict],
    vertical_linecuts: list[dict],
    inclined_linecuts: list[dict],
    azimuthal_integrations: list[dict],
    bypass_cache: bool,
    mask_uri: str | None,
) -> None:
    """Process linecuts for SAXS experiment from pixel-space image."""
    # Fetch image (bypass cache for batch processing to avoid thrashing)
    processed_image = get_cached_processed_image(
        scan_uri.lstrip("/"),
        mask_uri=mask_uri,
        bypass_cache=bypass_cache,
    )
    image_array = processed_image.array
    image_mask = processed_image.mask

    # Compute SAXS Q matrices ONCE
    q_x_matrix, q_y_matrix = compute_saxs_q_matrices(image_array.shape, calibration)

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
            results["horizontal"][linecut_id] = create_linecut_result(q_values, intensities)
        except Exception as e:
            results["horizontal"][linecut_id] = create_error_linecut_result(str(e))

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
            results["vertical"][linecut_id] = create_linecut_result(q_values, intensities)
        except Exception as e:
            results["vertical"][linecut_id] = create_error_linecut_result(str(e))

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
            results["inclined"][linecut_id] = create_linecut_result(q_values, intensities)
        except Exception as e:
            results["inclined"][linecut_id] = create_error_linecut_result(str(e))

    # Process azimuthal integrations
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
                ai, image_array, azimuth_range=azimuth_range, q_range=q_range, mask=image_mask
            )
            results["azimuthal"][integration_id] = create_linecut_result(q_values, intensities)
        except Exception as e:
            results["azimuthal"][integration_id] = create_error_linecut_result(str(e))


def _process_gisaxs_linecuts(
    results: dict,
    scan_uri: str,
    calibration: dict,
    horizontal_linecuts: list[dict],
    vertical_linecuts: list[dict],
    inclined_linecuts: list[dict],
    mask_uri: str | None,
    npt_ip: int | None = None,
    npt_oop: int | None = None,
) -> None:
    """
    Process linecuts for GISAXS experiment.

    Horizontal and vertical linecuts use pyFAI direct integration from
    detector pixels (single-pass, no double-binning). Inclined linecuts
    use the cached 2D GISAXS transform (pyFAI has no native inclined integration).
    """
    # Get the raw detector image + mask for direct pyFAI integration
    processed = get_cached_processed_image(
        scan_uri.lstrip("/"),
        mask_uri=mask_uri,
    )
    image_array = processed.array
    image_mask = processed.mask

    # Process horizontal linecuts via pyFAI (constant qoop, returns qip vs intensity)
    for linecut in horizontal_linecuts:
        linecut_id = linecut["id"]
        try:
            q_values, intensities = extract_gisaxs_horizontal_linecut_pyfai(
                image_array,
                image_mask,
                calibration,
                linecut["position"],  # qoop position (display convention)
                linecut.get("width", 0.0),
                npt=npt_ip,
            )
            results["horizontal"][linecut_id] = create_linecut_result(q_values, intensities)
        except Exception as e:
            results["horizontal"][linecut_id] = create_error_linecut_result(str(e))

    # Process vertical linecuts via pyFAI (constant qip, returns qoop vs intensity)
    for linecut in vertical_linecuts:
        linecut_id = linecut["id"]
        try:
            q_values, intensities = extract_gisaxs_vertical_linecut_pyfai(
                image_array,
                image_mask,
                calibration,
                linecut["position"],  # qip position
                linecut.get("width", 0.0),
                npt=npt_oop,
            )
            results["vertical"][linecut_id] = create_linecut_result(q_values, intensities)
        except Exception as e:
            results["vertical"][linecut_id] = create_error_linecut_result(str(e))

    # Process inclined linecuts from cached 2D transform (no pyFAI native support)
    if inclined_linecuts:
        from xscattering_backend.cache.gisaxs_cache import get_or_compute_gisaxs_transform

        gisaxs_result = get_or_compute_gisaxs_transform(
            scan_uri.lstrip("/"),
            calibration,
            mask_uri=mask_uri,
        )

        for linecut in inclined_linecuts:
            linecut_id = linecut["id"]
            try:
                q_values, intensities = extract_gisaxs_inclined_linecut(
                    gisaxs_result.transformed_image,
                    gisaxs_result.qip_values,
                    gisaxs_result.qoop_values,
                    linecut["q_x_position"],  # qip position
                    linecut["q_y_position"],  # qoop position
                    linecut["angle"],
                    linecut.get("q_width", 0.0),
                )
                results["inclined"][linecut_id] = create_linecut_result(q_values, intensities)
            except Exception as e:
                results["inclined"][linecut_id] = create_error_linecut_result(str(e))


def process_scan_for_batch(
    scan_uri: str,
    calibration: dict,
    horizontal_linecuts: list[dict],
    vertical_linecuts: list[dict],
    inclined_linecuts: list[dict],
    azimuthal_integrations: list[dict],
    batch_id: str,
    mask_uri: str | None = None,
    npt_ip: int | None = None,
    npt_oop: int | None = None,
) -> dict:
    """
    Process a single scan for batch processing with cancellation support.

    Bypasses the image cache to allow full parallelism for large batches.
    Each image is fetched, processed, and discarded immediately.
    """
    scan_name = scan_uri.split("/")[-1]

    # Check if batch was cancelled before processing
    if ACTIVE_BATCHES.get(batch_id, False):
        logger.info(f"Batch {batch_id[:8]}: Skipping {scan_name} - batch cancelled")
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

    logger.debug(f"Batch {batch_id[:8]}: Processing {scan_name}...")
    result = process_scan_all_linecuts(
        scan_uri,
        calibration,
        horizontal_linecuts,
        vertical_linecuts,
        inclined_linecuts,
        azimuthal_integrations,
        bypass_cache=True,  # Bypass cache for batch processing
        mask_uri=mask_uri,
        npt_ip=npt_ip,
        npt_oop=npt_oop,
    )
    status = "OK" if result.get("success", False) else "FAILED"
    logger.debug(f"Batch {batch_id[:8]}: Completed {scan_name} - {status}")
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
        logger.info(f"Batch {batch_id[:8]}: Cancel requested by user")
        ACTIVE_BATCHES[batch_id] = True
        await send_progress_update(
            -1,  # Special value indicating cancellation
            "Batch cancelled by user",
            batch_id=batch_id,
        )
        return {"status": "cancelled", "batch_id": batch_id}
    logger.warning(f"Batch {batch_id[:8]}: Cancel requested but batch not found")
    return {"status": "not_found", "batch_id": batch_id}


@router.post("/batch-all")
async def batch_all(request: BatchAllRequest):
    """
    Process all linecut types and integrations across multiple scans in parallel.

    This endpoint is optimized to fetch each image only ONCE and apply all
    linecut operations (horizontal, vertical, inclined) and azimuthal integrations.

    For GISAXS experiments, linecuts are extracted from the transformed Q-space
    image. Inclined linecuts are enabled for GISAXS. Azimuthal integration is
    skipped for GISAXS.

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

    logger.info(
        f"Batch {batch_id[:8]}: STARTED - {total} scans, "
        f"{len(request.horizontal_linecuts)} horizontal, "
        f"{len(request.vertical_linecuts)} vertical, "
        f"{len(request.inclined_linecuts)} inclined, "
        f"{len(request.azimuthal_integrations)} azimuthal"
    )

    batch_start_time = time.time()

    await send_progress_update(
        0,
        f"Starting batch processing for {total} scans × {total_linecuts} linecuts",
        batch_id=batch_id,
    )

    # Convert Pydantic models to dicts with IDs
    calibration = request.calibration.model_dump()

    horizontal_linecuts = [{"id": i, **lc.model_dump()} for i, lc in enumerate(request.horizontal_linecuts)]
    vertical_linecuts = [{"id": i, **lc.model_dump()} for i, lc in enumerate(request.vertical_linecuts)]
    inclined_linecuts = [{"id": i, **lc.model_dump()} for i, lc in enumerate(request.inclined_linecuts)]
    azimuthal_integrations = [{"id": i, **lc.model_dump()} for i, lc in enumerate(request.azimuthal_integrations)]

    # Collect results per scan
    scan_results = []
    successful_scans = 0
    failed_scans = 0
    processed_count = 0
    was_cancelled = False

    config = get_config()
    max_workers = config["batch_max_workers"]

    # Get mask_uri and npt params from request
    mask_uri = request.mask_uri
    npt_ip = request.npt_ip
    npt_oop = request.npt_oop

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
                    npt_ip,
                    npt_oop,
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
            logger.info(f"Batch {batch_id[:8]}: CANCELLED after {processed_count}/{total} scans " f"({processing_time:.2f}s)")
            await send_progress_update(
                progress,
                f"Batch cancelled after {processed_count}/{total} scans",
                batch_id=batch_id,
            )
        else:
            logger.info(
                f"Batch {batch_id[:8]}: COMPLETE - {successful_scans} OK, " f"{failed_scans} failed ({processing_time:.2f}s)"
            )
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

    logger.debug(f"Batch {batch_id[:8]}: Reorganizing results...")
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
    logger.debug(f"Batch {batch_id[:8]}: Result reorganization: {reorg_time:.2f}s")

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

    logger.debug(f"Batch {batch_id[:8]}: Response {response_size_kb:.1f} KB, " f"total time {total_time:.2f}s")

    return Response(content=packed_data, media_type="application/x-msgpack")
