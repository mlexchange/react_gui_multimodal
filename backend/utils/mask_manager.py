"""
Mask loading and caching utilities.

Handles loading detector masks from Tiled or uploaded files,
with thread-safe caching.
"""

import hashlib
import io
import tempfile
import threading
from typing import Optional

import numpy as np

from utils.tiled_client import get_tiled_client_for_uri


# Thread-safe mask cache
_mask_cache: dict[str, np.ndarray] = {}
_mask_cache_lock = threading.Lock()

# Cache for uploaded masks (keyed by content hash)
_uploaded_mask_cache: dict[str, np.ndarray] = {}


def load_mask_from_tiled(mask_uri: str, tiled_base_uri: str) -> np.ndarray:
    """
    Load a mask from Tiled.

    Parameters
    ----------
    mask_uri : str
        Relative URI path to the mask in Tiled.
    tiled_base_uri : str
        Base Tiled URI.

    Returns
    -------
    np.ndarray
        2D boolean-like array where 1 = masked, 0 = unmasked.
    """
    cache_key = f"{tiled_base_uri}:{mask_uri}"

    with _mask_cache_lock:
        if cache_key in _mask_cache:
            return _mask_cache[cache_key]

    # Construct full URI
    full_uri = tiled_base_uri.rstrip("/") + "/" + mask_uri.lstrip("/")
    mask_client = get_tiled_client_for_uri(full_uri)
    mask_array = mask_client.read()

    # Ensure 2D
    mask_array = np.squeeze(mask_array)
    if mask_array.ndim != 2:
        raise ValueError(f"Mask must be 2D, got shape {mask_array.shape}")

    # Normalize to 0/1 (some masks use 255 for masked)
    mask_array = normalize_mask(mask_array)

    with _mask_cache_lock:
        _mask_cache[cache_key] = mask_array

    return mask_array


def load_mask_from_bytes(
    file_content: bytes,
    filename: str,
) -> tuple[np.ndarray, str]:
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
    # Generate content hash for caching
    content_hash = hashlib.sha256(file_content).hexdigest()[:16]
    mask_id = f"uploaded_{content_hash}"

    with _mask_cache_lock:
        if mask_id in _uploaded_mask_cache:
            return _uploaded_mask_cache[mask_id], mask_id

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
        raise ValueError(
            f"Unsupported mask format: {ext}. "
            "Use .npy, .tiff, .tif, .edf, .cbf, or .csv"
        )

    # Ensure 2D
    mask_array = np.squeeze(mask_array)
    if mask_array.ndim != 2:
        raise ValueError(f"Mask must be 2D, got shape {mask_array.shape}")

    # Normalize to 0/1
    mask_array = normalize_mask(mask_array)

    with _mask_cache_lock:
        _uploaded_mask_cache[mask_id] = mask_array

    return mask_array, mask_id


def get_cached_mask(mask_id: str) -> Optional[np.ndarray]:
    """
    Get a mask from cache by its ID.

    Parameters
    ----------
    mask_id : str
        Either a Tiled URI cache key or an uploaded mask ID.

    Returns
    -------
    np.ndarray or None
        The cached mask, or None if not found.
    """
    with _mask_cache_lock:
        if mask_id in _mask_cache:
            return _mask_cache[mask_id]
        if mask_id in _uploaded_mask_cache:
            return _uploaded_mask_cache[mask_id]
    return None


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
