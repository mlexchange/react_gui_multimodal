"""
Mask management endpoints.

Handles mask resolution from PONI files and mask uploads.
"""

import os
from typing import Optional

from fastapi import APIRouter, File, HTTPException, Query, UploadFile
from pydantic import BaseModel

from utils.mask_manager import (
    load_mask_from_bytes,
    load_mask_from_tiled,
)
from utils.tiled_client import get_tiled_base_uri, get_tiled_client_for_uri

router = APIRouter()


class MaskResolutionResponse(BaseModel):
    found: bool
    mask_uri: Optional[str] = None
    mask_name: Optional[str] = None
    message: str


class MaskUploadResponse(BaseModel):
    mask_id: str
    shape: list[int]
    message: str


@router.get("/resolve-mask", response_model=MaskResolutionResponse)
async def resolve_mask(
    poni_uri: str = Query(..., description="URI of the PONI calibration file"),
) -> MaskResolutionResponse:
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
    MaskResolutionResponse
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
            return MaskResolutionResponse(
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

            return MaskResolutionResponse(
                found=True,
                mask_uri=mask_uri,
                mask_name=mask_name,
                message=f"Mask '{mask_name}' found",
            )

        except Exception:
            return MaskResolutionResponse(
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


@router.post("/upload-mask", response_model=MaskUploadResponse)
async def upload_mask(
    file: UploadFile = File(..., description="Mask file (.npy, .tiff, .edf, .cbf, .csv)"),
) -> MaskUploadResponse:
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

    Returns
    -------
    MaskUploadResponse
        Contains mask_id (for referencing in other endpoints) and shape.
    """
    if not file.filename:
        raise HTTPException(status_code=400, detail="No filename provided")

    try:
        content = await file.read()
        mask_array, mask_id = load_mask_from_bytes(content, file.filename)

        return MaskUploadResponse(
            mask_id=mask_id,
            shape=list(mask_array.shape),
            message=f"Mask uploaded successfully ({mask_array.shape[0]}x{mask_array.shape[1]})",
        )

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
) -> dict:
    """
    Load a mask from Tiled and cache it.

    Parameters
    ----------
    mask_uri : str
        URI path to the mask in Tiled.

    Returns
    -------
    dict
        Contains mask_id and shape.
    """
    mask_uri = mask_uri.lstrip("/")

    try:
        tiled_base_uri = get_tiled_base_uri()
        mask_array = load_mask_from_tiled(mask_uri, tiled_base_uri)

        # Use the full URI as the mask_id for Tiled masks
        mask_id = f"{tiled_base_uri}:{mask_uri}"

        return {
            "mask_id": mask_id,
            "mask_uri": mask_uri,
            "shape": list(mask_array.shape),
            "message": f"Mask loaded ({mask_array.shape[0]}x{mask_array.shape[1]})",
        }

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error loading mask from Tiled: {str(e)}",
        )
