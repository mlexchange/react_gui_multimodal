import msgpack
import numpy as np
from fastapi import APIRouter, HTTPException
from fastapi.responses import Response

from utils.scans import get_processed_image
from utils.tiled_client import get_tiled_base_uri, get_tiled_client_for_uri

router = APIRouter()


@router.get("/fetch-scan-image")
async def fetch_scan_image(scan_uri: str):
    """
    Get the image array for a single scan.

    Args:
        scan_uri: The scan URI like "rawdata/NaCl_small/NaCl_1_10_sample_2_2m"

    Returns:
        msgpack binary containing the image array and metadata
    """
    # Construct full URI for the scan
    scan_uri = scan_uri.lstrip('/')
    full_uri = f"{get_tiled_base_uri()}{scan_uri}"

    try:
        # Load image from Tiled
        image_client = get_tiled_client_for_uri(full_uri)
        image_array = image_client.read()

        # Apply preprocessing (masking, etc.)
        processed_image = get_processed_image(image_array, mask_detector=None)

        # Convert to float32
        processed_image = processed_image.astype(np.float32)

        # Serialize to bytes
        image_bytes = processed_image.tobytes()

        # Prepare metadata
        metadata = {
            "shape": processed_image.shape,
            "dtype": str(processed_image.dtype),
            "scan_uri": scan_uri,
        }

        # Pack data
        packed_data = msgpack.packb(
            {
                "metadata": metadata,
                "image": image_bytes,
            }
        )
        
        return Response(content=packed_data, media_type="application/octet-stream")

    except Exception as e:
        error_msg = f"Failed to load scan {scan_uri}: {str(e)}"
        print(f"[ERROR] {error_msg}")
        raise HTTPException(status_code=500, detail=error_msg)
