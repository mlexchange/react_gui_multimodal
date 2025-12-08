from fastapi import HTTPException
from tiled.client.container import Container


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
    path_parts = folder_path.split('/')
    current_client = tiled_client

    for part in path_parts:
        if part:  # Skip empty parts
            try:
                current_client = current_client[part]
            except KeyError:
                raise HTTPException(
                    status_code=404,
                    detail=f"Folder path '{folder_path}' not found in Tiled. Failed at part '{part}'"
                )

    # Get all scans from this folder
    if isinstance(current_client, Container):
        for key in current_client.keys():
            node_client = current_client[key]

            # Check if this is a scan we can read
            if hasattr(node_client, 'specs'):
                specs = node_client.specs
                if any(spec.name == "edf" or spec.name == "gb" for spec in specs):
                    scan_uri = trim_base_from_uri(node_client.uri, tiled_base_uri)
                    scan_uri_list.append(scan_uri)

            # Check for detector-specific folders
            if isinstance(node_client, Container):
                for child_key in node_client.keys():
                    child_client = node_client[child_key]

                    if hasattr(child_client, 'specs'):
                        specs = child_client.specs
                        if any(spec.name == "edf" or spec.name == "gb" for spec in specs):
                            scan_uri = trim_base_from_uri(child_client.uri, tiled_base_uri)
                            scan_uri_list.append(scan_uri)
    else:
        # If it's not a container, it might be a single scan
        if hasattr(current_client, 'specs'):
            specs = current_client.specs
            if any(spec.name == "edf" or spec.name == "gb" for spec in specs):
                scan_uri = trim_base_from_uri(current_client.uri, tiled_base_uri)
                scan_uri_list.append(scan_uri)

    return scan_uri_list
