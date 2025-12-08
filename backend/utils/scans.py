import urllib.parse as urlparse

from utils.tiled_client import get_tiled_client_for_uri
from fastapi import HTTPException
from tiled.client.container import Container
import numpy as np


def trim_base_from_uri(uri_to_trim: str, tiled_base_uri: str) -> str:
    """Trim the base Tiled URI from a full URI pointing to a dataset."""
    return uri_to_trim.replace(tiled_base_uri, "")


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

            # Check if this is a scan we can read
            if hasattr(node_client, "specs"):
                specs = node_client.specs
                if any(spec.name == "edf" or spec.name == "gb" for spec in specs):
                    scan_uri = trim_base_from_uri(node_client.uri, tiled_base_uri)
                    scan_uri_list.append(scan_uri)

            # Check for detector-specific folders
            if isinstance(node_client, Container):
                for child_key in node_client.keys():
                    child_client = node_client[child_key]

                    if hasattr(child_client, "specs"):
                        specs = child_client.specs
                        if any(spec.name == "edf" or spec.name == "gb" for spec in specs):
                            scan_uri = trim_base_from_uri(child_client.uri, tiled_base_uri)
                            scan_uri_list.append(scan_uri)
    else:
        # If it's not a container, it might be a single scan
        if hasattr(current_client, "specs"):
            specs = current_client.specs
            if any(spec.name == "edf" or spec.name == "gb" for spec in specs):
                scan_uri = trim_base_from_uri(current_client.uri, tiled_base_uri)
                scan_uri_list.append(scan_uri)

    return scan_uri_list


def get_single_image_array_and_name(image_uri, mask_detector, tiled_uri):
    """Process a single image and return its array and name."""
    tiled_uri = tiled_uri if tiled_uri.endswith("/") else tiled_uri + "/"
    file_uri = urlparse.urljoin(tiled_uri, image_uri)

    image_client = get_tiled_client_for_uri(file_uri)
    image_array = image_client.read()

    processed_image = get_processed_image(image_array, mask_detector)

    return processed_image, image_uri


def get_processed_image(image, mask_detector):
    """Process the image using the detector mask.
    Original mask_detector has: 1 = masked area (beam stop etc), 0 = unmasked area
    We invert it so that: 0 = masked area, 1 = unmasked area
    """
    # Convert image to float32 first
    processed_image = image.copy().astype(np.float32)

    if mask_detector is None:
        return processed_image

    # Invert the mask first (1 - mask)
    inverted_mask = 1 - mask_detector

    # Create combined mask (True where we want to mask)
    mask_neg = np.array(processed_image < 0.0)
    mask_nan = np.isnan(processed_image)
    mask = mask_nan | mask_neg | (inverted_mask == 0)  # Now looking for nans, negatives, and zeros in inverted mask

    # Apply mask by setting masked values to NaN
    processed_image[mask] = np.nan  # 0

    return processed_image
