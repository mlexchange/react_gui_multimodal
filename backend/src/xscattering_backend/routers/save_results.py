"""
Save results to Tiled router.

Provides endpoints for writing linecut and batch processing results
to a writable Tiled container.
Only functional when SCATTERING_TILED_RESULTS_URL is configured.
"""

import pandas as pd
from fastapi import APIRouter, HTTPException
from xscattering_backend.cache.tiled_cache import get_tiled_results_client
from xscattering_backend.config.logging import get_logger
from xscattering_backend.config.models import SaveBatchResultsRequest, SaveLinecutsRequest

logger = get_logger(__name__)
router = APIRouter()


@router.post("/save-linecuts")
async def save_linecuts(request: SaveLinecutsRequest):
    """
    Save all linecuts from a graph card to the writable Tiled container.

    Writes a single pandas DataFrame with one q column and intensity columns
    named ``Linecut N (scan_name)`` for each linecut/side combination.
    Metadata includes both scan URIs/names and all numbered linecut parameters.
    """

    try:
        client = get_tiled_results_client()
        if client is None:
            raise HTTPException(status_code=404, detail="Tiled results saving not configured")

        if not request.linecuts:
            raise HTTPException(status_code=400, detail="No linecut data to save")

        # Determine column naming based on linecut type
        linecut_type = request.linecuts[0].linecut_params.type
        is_azimuthal = linecut_type == "azimuthal"
        is_inclined = linecut_type == "inclined"

        q_col = "path_distance" if is_inclined else "q"
        prefix = "Integration" if is_azimuthal else "Linecut"

        # Build DataFrame: q column + "Linecut N (scan_name)" per linecut per side
        data = {q_col: request.q_values}
        for entry in request.linecuts:
            idx = entry.index
            if entry.left_intensities is not None and len(request.scan_names) > 0:
                data[f"{prefix} {idx} ({request.scan_names[0]})"] = entry.left_intensities
            if entry.right_intensities is not None and len(request.scan_names) > 1:
                data[f"{prefix} {idx} ({request.scan_names[1]})"] = entry.right_intensities

        df = pd.DataFrame(data)

        # Build metadata with scans and numbered linecut params
        metadata: dict = {
            "calibration": request.calibration.model_dump(),
            "linecut_parameters": {
                str(entry.index): entry.linecut_params.model_dump(exclude_none=True) for entry in request.linecuts
            },
            "scan_uris": request.scan_uris,
            "scan_names": request.scan_names,
        }

        result = client.write_dataframe(df, metadata=metadata, specs=["xscattering_linecut"])

        n = len(request.linecuts)
        tiled_id = result.item["id"]
        tiled_uri = result.uri
        logger.info("Saved %d %s linecut(s) to Tiled (id=%s)", n, linecut_type, tiled_id)

        return {
            "success": True,
            "message": f"Saved {n} {linecut_type} linecut(s)",
            "tiled_id": tiled_id,
            "tiled_uri": tiled_uri,
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error("Failed to save linecuts to Tiled: %s", e)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/save-batch-results")
async def save_batch_results(request: SaveBatchResultsRequest):
    """
    Save batch processing results to the writable Tiled container.

    Writes a pandas DataFrame with q values as the first column and
    one column per successful scan (matching CSV export structure).
    Metadata includes calibration, linecut parameters, and scan info.
    """
    try:
        client = get_tiled_results_client()
        if client is None:
            raise HTTPException(status_code=404, detail="Tiled results saving not configured")

        successful = [r for r in request.results if r.success]
        if not successful:
            raise HTTPException(status_code=400, detail="No successful results to save")

        # Build DataFrame: first column is q, then one column per scan
        data = {"q": successful[0].q_values}
        for result in successful:
            data[result.scan_name] = result.intensities

        df = pd.DataFrame(data)

        metadata = {
            "calibration": request.calibration.model_dump(),
            "linecut_parameters": request.linecut_parameters.model_dump(exclude_none=True),
            "scan_uris": [r.scan_uri for r in successful],
            "scan_names": [r.scan_name for r in successful],
            "num_scans": len(successful),
        }

        result = client.write_dataframe(df, metadata=metadata, specs=["xscattering_batch"])

        label = request.linecut_parameters.type
        tiled_id = result.item["id"]
        tiled_uri = result.uri
        logger.info("Saved batch %s results to Tiled (%d scans, id=%s)", label, len(successful), tiled_id)

        return {
            "success": True,
            "message": f"Saved {label} batch results ({len(successful)} scans)",
            "tiled_id": tiled_id,
            "tiled_uri": tiled_uri,
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error("Failed to save batch results to Tiled: %s", e)
        raise HTTPException(status_code=500, detail=str(e))
