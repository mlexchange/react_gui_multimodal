"""
Mask loading utilities.

Handles loading detector masks from Tiled or uploaded files,
with parsing for various file formats.
"""

import io
import tempfile
from typing import Tuple

import numpy as np
from xscattering_backend.cache.mask_cache import (
    cache_tiled_mask,
    cache_uploaded_mask,
    get_tiled_mask_from_cache,
    get_uploaded_mask_from_cache,
)
from xscattering_backend.cache.tiled_cache import (
    get_tiled_calibration_base_uri,
    get_tiled_calibration_client_for_uri,
)
from xscattering_backend.config.logging import get_logger

logger = get_logger(__name__)


def normalize_mask(mask_array: np.ndarray) -> np.ndarray:
    """
    Normalize mask to 0/1 values.

    Handles various conventions:
    - Boolean arrays
    - 0/1 integer arrays
    - 0/255 arrays (from image files)

    Parameters
    ----------
    mask_array : np.ndarray
        Input mask array.

    Returns
    -------
    np.ndarray
        Normalized mask with dtype uint8, values 0 or 1.
    """
    # Convert to float for processing
    mask = mask_array.astype(np.float64)

    # If max value > 1, assume it's 0/255 or similar
    max_val = np.nanmax(mask)
    if max_val > 1:
        mask = mask / max_val

    # Round to 0/1 and convert to uint8
    mask = np.round(mask).astype(np.uint8)

    return mask


def _parse_fabio(content: bytes, suffix: str) -> np.ndarray:
    """
    Parse image file using fabio.

    Supports formats: .edf, .tiff, .tif, .cbf, and other fabio-supported formats.

    Parameters
    ----------
    content : bytes
        Raw file content.
    suffix : str
        File suffix (e.g., ".tiff", ".edf", ".cbf").

    Returns
    -------
    np.ndarray
        2D array from the image file.
    """
    import os

    import fabio

    # fabio works best with file paths, so write to temp file
    with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
        tmp.write(content)
        tmp_path = tmp.name

    try:
        img = fabio.open(tmp_path)
        return img.data
    finally:
        os.unlink(tmp_path)


def _parse_csv(content: bytes) -> np.ndarray:
    """
    Parse CSV file as a mask array.

    Supports:
    - Comma-separated values
    - Space-separated values
    - Tab-separated values

    Parameters
    ----------
    content : bytes
        Raw CSV file content.

    Returns
    -------
    np.ndarray
        2D array from the CSV file.

    Raises
    ------
    ValueError
        If the CSV file cannot be parsed.
    """
    text = content.decode("utf-8", errors="ignore")

    # Try to detect delimiter
    first_line = text.split("\n")[0].strip()

    if "," in first_line:
        delimiter = ","
    elif "\t" in first_line:
        delimiter = "\t"
    else:
        delimiter = None  # Let numpy figure it out (whitespace)

    try:
        # Use genfromtxt which handles various formats well
        mask_array = np.genfromtxt(
            io.StringIO(text),
            delimiter=delimiter,
            filling_values=0,
        )
        return mask_array
    except Exception as e:
        raise ValueError(f"Could not parse CSV file: {e}")


def load_mask_from_tiled(mask_uri: str) -> np.ndarray:
    """
    Load a mask from the calibration Tiled server.

    Masks live alongside calibrations on the calibration server.
    Raises ``ValueError`` if the calibration server is not configured.

    Parameters
    ----------
    mask_uri : str
        Relative URI path to the mask in Tiled.

    Returns
    -------
    np.ndarray
        2D boolean-like array where 1 = masked, 0 = unmasked.
    """
    tiled_base_uri = get_tiled_calibration_base_uri()
    if tiled_base_uri is None:
        raise ValueError("Calibration Tiled server not configured")

    cache_key = f"{tiled_base_uri}:{mask_uri}"

    # Check cache first
    cached = get_tiled_mask_from_cache(cache_key)
    if cached is not None:
        return cached

    logger.debug(f"Tiled mask cache miss: {cache_key}")

    # Construct full URI
    full_uri = tiled_base_uri.rstrip("/") + "/" + mask_uri.lstrip("/")
    mask_client = get_tiled_calibration_client_for_uri(full_uri)
    mask_array = mask_client.read()

    # Ensure 2D
    mask_array = np.squeeze(mask_array)
    if mask_array.ndim != 2:
        raise ValueError(f"Mask must be 2D, got shape {mask_array.shape}")

    # Normalize to 0/1
    mask_array = normalize_mask(mask_array)

    # Cache the result
    cache_tiled_mask(cache_key, mask_array)

    return mask_array


def load_mask_from_bytes(
    file_content: bytes,
    filename: str,
) -> Tuple[np.ndarray, str]:
    """
    Load a mask from uploaded file content.

    Parameters
    ----------
    file_content : bytes
        Raw file content.
    filename : str
        Original filename (used to determine format).

    Returns
    -------
    tuple[np.ndarray, str]
        (mask_array, mask_id) where mask_id is a hash of the content.
    """
    # Check cache first
    cached = get_uploaded_mask_from_cache(file_content)
    if cached is not None:
        return cached

    # Parse based on file extension
    ext = filename.lower().split(".")[-1]

    if ext == "npy":
        mask_array = np.load(io.BytesIO(file_content))
    elif ext in ("tiff", "tif"):
        mask_array = _parse_fabio(file_content, ".tiff")
    elif ext == "edf":
        mask_array = _parse_fabio(file_content, ".edf")
    elif ext == "cbf":
        mask_array = _parse_fabio(file_content, ".cbf")
    elif ext == "csv":
        mask_array = _parse_csv(file_content)
    else:
        raise ValueError(f"Unsupported mask format: {ext}. " "Use .npy, .tiff, .tif, .edf, .cbf, or .csv")

    # Ensure 2D
    mask_array = np.squeeze(mask_array)
    if mask_array.ndim != 2:
        raise ValueError(f"Mask must be 2D, got shape {mask_array.shape}")

    # Normalize to 0/1
    mask_array = normalize_mask(mask_array)

    # Cache and get ID
    mask_id = cache_uploaded_mask(mask_array, file_content)

    return mask_array, mask_id
