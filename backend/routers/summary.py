import asyncio
import concurrent.futures
import re

import msgpack
import numpy as np
from fastapi import APIRouter
from fastapi.responses import Response

from utils.scans import get_scans_from_folder
from utils.tiled_client import get_tiled_client, get_tiled_base_uri, get_tiled_client_for_uri
from routers.websocket import send_progress_update

router = APIRouter()


def natural_sort_key(uri: str):
    """Sort key for natural/human sorting"""
    name = uri.split('/')[-1].lower()
    # Split into text and number parts, convert numbers to int for proper sorting
    return [int(part) if part.isdigit() else part for part in re.split(r'(\d+)', name)]


def process_single_image(args):
    """Process a single scan to get its max/avg intensity."""
    index, scan_uri, tiled_base_uri = args
    try:
        full_uri = f"{tiled_base_uri}{scan_uri}" if not scan_uri.startswith("http") else scan_uri

        image_client = get_tiled_client_for_uri(full_uri)
        image_array = image_client.read()

        max_intensity = np.nanmax(image_array)
        avg_intensity = np.nanmean(image_array)
        scan_name = scan_uri.split('/')[-1]

        return index, max_intensity, avg_intensity, scan_name, scan_uri, True
    except Exception as e:
        print(f"Error processing scan {index} ({scan_uri}): {str(e)}")
        return index, 0.0, 0.0, f"Error: {scan_uri}", scan_uri, False


@router.get("/summary")
async def create_summary(container_path: str):
    """
    Get metadata for all scans in a folder.

    Args:
        container_path: The Tiled container path (e.g., 'path/to/folder')
                       without the base URL or '/metadata/' prefix

    Returns scan URIs, names, and intensity statistics for the Summary view.
    Does NOT return actual image arrays.
    """
    tiled_client = get_tiled_client()
    tiled_base_uri = get_tiled_base_uri()

    scan_uris = get_scans_from_folder(tiled_client, container_path, tiled_base_uri)
    scan_uris = [uri.lstrip('/') for uri in scan_uris]
    scan_uris.sort(key=natural_sort_key)
    num_of_files = len(scan_uris)

    asyncio.create_task(send_progress_update(0, f"Initializing processing for {num_of_files} scans"))

    max_intensities = np.zeros(num_of_files, dtype=float)
    avg_intensities = np.zeros(num_of_files, dtype=float)
    scan_names = [""] * num_of_files

    args_list = [(i, scan_uris[i], tiled_base_uri) for i in range(num_of_files)]

    # Process images with a thread pool
    processed_count = 0
    max_workers = 16  # Adjust based on your server capabilities

    with concurrent.futures.ThreadPoolExecutor(max_workers=max_workers) as executor:
        # Submit all tasks
        future_to_index = {
            executor.submit(process_single_image, args): args[0] for args in args_list
        }

        for future in concurrent.futures.as_completed(future_to_index):
            index, max_intensity, avg_intensity, scan_name, scan_uri, success = future.result()

            if success:
                max_intensities[index] = max_intensity
                avg_intensities[index] = avg_intensity
                scan_names[index] = scan_name

            processed_count += 1
            progress = (processed_count / num_of_files) * 100
            asyncio.create_task(send_progress_update(
                progress, f"Processing {processed_count}/{num_of_files} images"
            ))
            # Yield to event loop to allow progress updates to be sent
            await asyncio.sleep(0)

    # Prepare serializable data
    serializable_data = {
        "num_scans": num_of_files,
        "scan_uris": scan_uris,
        "scan_names": scan_names,
        "max_intensities": max_intensities.tolist(),
        "avg_intensities": avg_intensities.tolist(),
    }

    # Send completion notification
    await send_progress_update(100, "Data processing complete")

    # Pack data using msgpack
    packed_data = msgpack.packb(serializable_data, use_bin_type=True)

    return Response(content=packed_data, media_type="application/octet-stream")
