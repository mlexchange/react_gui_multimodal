"""
Mask management endpoints.

Handles mask lookup from PONI files and mask uploads.
"""

import os
from typing import Optional

import msgpack
from fastapi import APIRouter, File, HTTPException, Query, UploadFile
from fastapi.responses import Response
from xscattering_backend.cache.mask_cache import get_cached_mask
from xscattering_backend.cache.tiled_cache import (
    get_tiled_base_uri,
    get_tiled_client_for_uri,
)
from xscattering_backend.config.models import MaskResponse
from xscattering_backend.utils.mask_loader import (
    load_mask_from_bytes,
    load_mask_from_tiled,
)

router = APIRouter()


@router.get("/resolve-mask", response_model=MaskResponse)
async def resolve_mask(
    poni_uri: str = Query(..., description="URI of the PONI calibration file"),
) -> MaskResponse:
    """
    Resolve the mask referenced by a PONI calibration file.

    The mask is expected to be in a sibling 'masks' folder (../masks/ from PONI).
    The mask filename is read from the "mask" key in the PONI metadata.

    Example:
        PONI at: calibration/results/AgB_test
        Mask name in PONI metadata: "detector_pilatus"
        Resolved mask at: calibration/masks/detector_pilatus

    Parameters
    ----------
    poni_uri : str
        URI path to the PONI file in Tiled (e.g., "rawdata/exp1/results/calib_1")

    Returns
    -------
    MaskResponse
        Contains found status, mask_uri if found, and mask_name.
    """
    poni_uri = poni_uri.lstrip("/")

    try:
        # Fetch PONI metadata to get mask name
        tiled_base_uri = get_tiled_base_uri()
        full_uri = tiled_base_uri.rstrip("/") + "/" + poni_uri
        poni_client = get_tiled_client_for_uri(full_uri)

        # Get mask name from metadata
        metadata = poni_client.metadata
        mask_name = metadata.get("mask")

        if not mask_name:
            return MaskResponse(
                found=False,
                mask_name=None,
                message="No mask reference found in PONI metadata",
            )

        # Extract just the filename if it's a full path
        if "/" in mask_name or "\\" in mask_name:
            mask_name = os.path.basename(mask_name)

        # Resolve mask path: sibling to 'results' folder
        # e.g., calibration/results/AgB_test -> calibration/masks/{mask_name}
        path_parts = poni_uri.split("/")
        parent_parts = path_parts[:-2]  # Remove PONI file and 'results' folder
        mask_path_parts = parent_parts + ["masks", mask_name]
        mask_uri = "/".join(mask_path_parts)

        # Check if mask exists in Tiled
        try:
            mask_full_uri = tiled_base_uri.rstrip("/") + "/" + mask_uri
            mask_client = get_tiled_client_for_uri(mask_full_uri)
            # Try to access it to verify existence
            _ = mask_client.metadata

            return MaskResponse(
                found=True,
                mask_uri=mask_uri,
                mask_name=mask_name,
                message=f"Mask '{mask_name}' found",
            )

        except Exception:
            return MaskResponse(
                found=False,
                mask_uri=None,
                mask_name=mask_name,
                message=f"Mask '{mask_name}' referenced but not found at '{mask_uri}'",
            )

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error resolving PONI mask: {str(e)}",
        )


@router.get("/get-mask")
async def get_mask(
    mask_id: str = Query(..., description="Mask ID (uploaded_xxx or Tiled URI)"),
) -> Response:
    """
    Get mask data from backend cache.

    This endpoint retrieves a previously loaded mask from the cache.
    Works for both uploaded masks (mask_id starts with 'uploaded_') and
    Tiled masks (mask_id is the Tiled URI path).

    Parameters
    ----------
    mask_id : str
        For uploaded masks: the mask ID returned from /upload-mask (e.g., 'uploaded_abc123')
        For Tiled masks: the mask URI path (e.g., 'calibration/masks/pilatus')

    Returns
    -------
    Response
        msgpack binary containing mask_id, shape, and data.
        Returns 404 if mask is not in cache.
    """
    # Try direct lookup (works for uploaded_xxx masks)
    mask_array = get_cached_mask(mask_id)

    # For Tiled masks, also try with full cache key (handles key mismatch)
    if mask_array is None and not mask_id.startswith("uploaded_"):
        tiled_base_uri = get_tiled_base_uri()
        full_key = f"{tiled_base_uri}:{mask_id}"
        mask_array = get_cached_mask(full_key)

    if mask_array is None:
        raise HTTPException(status_code=404, detail="Mask not in cache")

    packed_data = msgpack.packb(
        {
            "mask_id": mask_id,
            "shape": list(mask_array.shape),
            "data": mask_array.tobytes(),
        }
    )

    return Response(content=packed_data, media_type="application/x-msgpack")


@router.post("/upload-mask")
async def upload_mask(
    file: UploadFile = File(..., description="Mask file (.npy, .tiff, .edf, .cbf, .csv)"),
    expected_width: Optional[int] = Query(None, description="Expected image width for validation"),
    expected_height: Optional[int] = Query(None, description="Expected image height for validation"),
) -> Response:
    """
    Upload a mask file.

    Supported formats:
    - .npy (NumPy array)
    - .tiff/.tif (TIFF image)
    - .edf (ESRF Data Format)
    - .cbf (Crystallographic Binary File, Pilatus detector)
    - .csv (CSV with comma, tab, or space delimiters)

    The mask should use convention: 1 = masked (bad pixel), 0 = unmasked (good pixel)

    Parameters
    ----------
    file : UploadFile
        The mask file to upload.
    expected_width : int, optional
        Expected image width for dimension validation.
    expected_height : int, optional
        Expected image height for dimension validation.

    Returns
    -------
    Response
        msgpack binary containing mask_id, shape, data, message, and status.
    """
    if not file.filename:
        raise HTTPException(status_code=400, detail="No filename provided")

    try:
        content = await file.read()
        mask_array, mask_id = load_mask_from_bytes(content, file.filename)

        mask_height, mask_width = mask_array.shape

        # Validate dimensions if expected values are provided
        status = "success"
        message = f"Mask uploaded successfully ({mask_height}×{mask_width})"
        if expected_width is not None and expected_height is not None:
            if mask_width != expected_width or mask_height != expected_height:
                status = "warning"
                message = (
                    f"Mask size ({mask_height}×{mask_width}) doesn't match " f"image size ({expected_height}×{expected_width})"
                )

        packed_data = msgpack.packb(
            {
                "mask_id": mask_id,
                "shape": list(mask_array.shape),
                "data": mask_array.tobytes(),
                "message": message,
                "status": status,
            }
        )

        return Response(content=packed_data, media_type="application/x-msgpack")

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error uploading mask: {str(e)}",
        )


@router.get("/load-mask-from-tiled")
async def load_mask_from_tiled_endpoint(
    mask_uri: str = Query(..., description="URI of the mask in Tiled"),
    expected_width: Optional[int] = Query(None, description="Expected image width for validation"),
    expected_height: Optional[int] = Query(None, description="Expected image height for validation"),
) -> Response:
    """
    Load a mask from Tiled and cache it.

    Parameters
    ----------
    mask_uri : str
        URI path to the mask in Tiled.
    expected_width : int, optional
        Expected image width for dimension validation.
    expected_height : int, optional
        Expected image height for dimension validation.

    Returns
    -------
    Response
        msgpack binary containing mask_id, mask_uri, shape, data, message, and status.
    """
    mask_uri = mask_uri.lstrip("/")

    try:
        tiled_base_uri = get_tiled_base_uri()
        mask_array = load_mask_from_tiled(mask_uri, tiled_base_uri)

        # Use the full URI as the mask_id for Tiled masks
        mask_id = f"{tiled_base_uri}:{mask_uri}"
        mask_height, mask_width = mask_array.shape

        # Extract mask name from URI (last path segment)
        mask_name = mask_uri.split("/")[-1]

        # Validate dimensions if expected values are provided
        status = "success"
        message = f"Loaded: {mask_name} ({mask_height}×{mask_width})"
        if expected_width is not None and expected_height is not None:
            if mask_width != expected_width or mask_height != expected_height:
                status = "warning"
                message = (
                    f"Mask size ({mask_height}×{mask_width}) doesn't match " f"image size ({expected_height}×{expected_width})"
                )

        packed_data = msgpack.packb(
            {
                "mask_id": mask_id,
                "mask_uri": mask_uri,
                "shape": list(mask_array.shape),
                "data": mask_array.tobytes(),
                "message": message,
                "status": status,
            }
        )

        return Response(content=packed_data, media_type="application/x-msgpack")

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error loading mask from Tiled: {str(e)}",
        )
