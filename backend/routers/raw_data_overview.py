import os
import concurrent.futures
import asyncio

import msgpack
import numpy as np
from dotenv import load_dotenv
from fastapi import APIRouter, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.responses import Response
from tiled.client import from_uri
from src.get_scans import get_scans_from_folder

router = APIRouter()

# Store active WebSocket connections
active_connections = []


@router.websocket("/ws/progress")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    active_connections.append(websocket)
    try:
        while True:
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_text("pong")
    except WebSocketDisconnect:
        active_connections.remove(websocket)


async def send_progress_update(progress_percentage, message=""):
    """Send progress updates to all connected clients"""
    if active_connections:
        for connection in active_connections:
            try:
                await connection.send_json(
                    {"progress": progress_percentage, "message": message}
                )
            except Exception:
                pass


def process_single_image(args):
    """Process a single scan to get its max/avg intensity"""
    index, scan_uri, tiled_base_uri, tiled_api_key = args
    try:
        # Construct full URI
        full_uri = f"{tiled_base_uri}{scan_uri}" if not scan_uri.startswith("http") else scan_uri

        # Load image from Tiled
        image_client = from_uri(full_uri, api_key=tiled_api_key)
        image_array = image_client.read()

        # Calculate metrics
        max_intensity = np.nanmax(image_array)
        avg_intensity = np.nanmean(image_array)

        # Extract scan name from URI (last part)
        scan_name = scan_uri.split('/')[-1]

        return index, max_intensity, avg_intensity, scan_name, scan_uri, True
    except Exception as e:
        print(f"Error processing scan {index} ({scan_uri}): {str(e)}")
        return index, 0.0, 0.0, f"Error: {scan_uri}", scan_uri, False


@router.get("/api/raw-data-overview")
async def create_raw_data_overview(container_path: str):
    """
    Get metadata for all scans in a folder.

    Args:
        container_path: The Tiled container path (e.g., 'path/to/folder')
                       without the base URL or '/metadata/' prefix

    Returns scan URIs, names, and intensity statistics for the Raw Data Overview.
    Does NOT return actual image arrays.
    """
    # Load environment variables
    load_dotenv("../.env")
    TILED_URL = os.getenv("SCATTERING_TILED_URL")
    TILED_API_KEY = os.getenv("SCATTERING_TILED_API_KEY")

    if not TILED_URL or not TILED_API_KEY:
        raise HTTPException(
            status_code=500, detail="Environment variables not set correctly"
        )

    # Connect to Tiled
    tiled_client = from_uri(TILED_URL, api_key=TILED_API_KEY)
    TILED_BASE_URI = tiled_client.uri

    # Get scans using the container path directly (no URL extraction needed)
    scan_uris = get_scans_from_folder(tiled_client, container_path, TILED_BASE_URI)

    # Remove leading slashes
    scan_uris = [uri.lstrip('/') for uri in scan_uris]
    
    num_of_files = len(scan_uris)

    # Send initial progress
    asyncio.create_task(send_progress_update(0, f"Initializing processing for {num_of_files} scans"))

    # Preallocate arrays for efficiency
    max_intensities = np.zeros(num_of_files, dtype=float)
    avg_intensities = np.zeros(num_of_files, dtype=float)
    scan_names = [""] * num_of_files

    # Prepare arguments for the worker function
    args_list = [
        (i, scan_uris[i], TILED_BASE_URI, TILED_API_KEY)
        for i in range(num_of_files)
    ]

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
