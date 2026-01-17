import numpy as np
from fastapi import HTTPException
from tiled.client.container import Container
from tiled.structures.core import StructureFamily

from xscattering_backend.cache.tiled_cache import get_tiled_client_for_uri


def trim_base_from_uri(uri_to_trim: str, tiled_base_uri: str) -> str:
    """Trim the base Tiled URI from a full URI pointing to a dataset."""
    return uri_to_trim.replace(tiled_base_uri, "")


def is_valid_scan(node_client) -> bool:
    """Check if a node is a valid scan we can read.

    A valid scan is either:
    1. Has structure_family == 'array' (image/array data)
    2. Has specs with name 'edf' or 'gb'
    """
    # Check for array structure family (covers images without specific specs)
    if hasattr(node_client, "structure_family"):
        if node_client.structure_family == StructureFamily.array:
            return True

    # Check for specific specs (legacy check)
    if hasattr(node_client, "specs"):
        specs = node_client.specs
        if any(spec.name in ("edf", "gb") for spec in specs):
            return True

    return False


def get_scans_from_folder(tiled_client, folder_path: str, tiled_base_uri: str) -> list:
    """
    Get all scan URIs from a specific folder in Tiled.

    Args:
        tiled_client: Tiled client instance
        folder_path: Path to folder like 'path/to/folder'
        tiled_base_uri: Base Tiled URI

    Returns:
        List of scan URIs
    """
    scan_uri_list = []

    # Navigate to the folder
    path_parts = folder_path.split("/")
    current_client = tiled_client

    for part in path_parts:
        if part:  # Skip empty parts
            try:
                current_client = current_client[part]
            except KeyError:
                raise HTTPException(
                    status_code=404, detail=f"Folder path '{folder_path}' not found in Tiled. Failed at part '{part}'"
                )

    # Get all scans from this folder
    if isinstance(current_client, Container):
        for key in current_client.keys():
            node_client = current_client[key]

            if is_valid_scan(node_client):
                scan_uri_list.append(trim_base_from_uri(node_client.uri, tiled_base_uri))

            # Check for detector-specific folders (nested containers)
            if isinstance(node_client, Container):
                for child_key in node_client.keys():
                    child_client = node_client[child_key]
                    if is_valid_scan(child_client):
                        scan_uri_list.append(trim_base_from_uri(child_client.uri, tiled_base_uri))
    else:
        # If it's not a container, it might be a single scan
        if is_valid_scan(current_client):
            scan_uri_list.append(trim_base_from_uri(current_client.uri, tiled_base_uri))

    return scan_uri_list


def ensure_2d_image(image: np.ndarray) -> np.ndarray:
    """Ensure image array is 2D (height, width).

    Handles common cases:
    - (height, width) -> unchanged
    - (1, height, width) -> squeeze to (height, width)
    - (1, 1, height, width) -> squeeze to (height, width)
    """
    # Squeeze out any singleton dimensions
    squeezed = np.squeeze(image)

    if squeezed.ndim != 2:
        raise ValueError(
            f"Image must be 2D after squeezing, got shape {image.shape} -> {squeezed.shape}"
        )

    return squeezed


def get_processed_image(image, mask_detector):
    """Process the image using the detector mask.

    Always masks:
    - NaN values
    - Negative values (including -1, which indicates invalid/masked pixels)

    If mask_detector is provided:
    - Original mask_detector has: 1 = masked area (beam stop etc), 0 = unmasked area
    - We invert it so that: 0 = masked area, 1 = unmasked area
    """
    # Ensure 2D and convert to float32
    image_2d = ensure_2d_image(image)
    processed_image = image_2d.astype(np.float32)

    # Always mask NaN and negative values (including -1 sentinel values)
    mask_neg = processed_image < 0.0
    mask_nan = np.isnan(processed_image)
    mask = mask_nan | mask_neg

    # Add detector mask if provided
    if mask_detector is not None:
        # Invert the mask: original has 1=masked, 0=unmasked
        # We want True where we should mask
        mask = mask | (mask_detector == 1)

    # Apply mask by setting masked values to NaN
    processed_image[mask] = np.nan

    return processed_image
