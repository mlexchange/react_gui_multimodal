from typing import Optional

import msgpack
from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import Response

from xscattering_backend.cache.image_cache import get_cached_processed_image
from xscattering_backend.config.logging import get_logger

logger = get_logger(__name__)
router = APIRouter()


@router.get("/fetch-scan-image")
async def fetch_scan_image(
    scan_uri: str,
    mask_uri: Optional[str] = Query(None, description="Optional mask URI or mask_id"),
):
    """
    Get the processed image for a single scan.

    Args:
        scan_uri: The scan URI like "rawdata/NaCl_small/NaCl_1_10_sample_2_2m"
        mask_uri: Optional mask URI or mask_id for detector mask

    Returns:
        msgpack binary containing:
        - image: bytes (float32 array data)
        - shape: [height, width]
        - dtype: str
        - scan_uri: string
        - mask_uri: string | null
    """
    scan_uri = scan_uri.lstrip("/")

    try:
        # Get from cache (will fetch from Tiled and process if not cached)
        processed = get_cached_processed_image(scan_uri, mask_uri=mask_uri)

        # Pack image data
        packed_data = msgpack.packb({
            "image": processed.array.tobytes(),
            "shape": list(processed.shape),
            "dtype": str(processed.array.dtype),
            "scan_uri": scan_uri,
            "mask_uri": mask_uri,
        })

        return Response(content=packed_data, media_type="application/x-msgpack")

    except ValueError as e:
        logger.warning(f"Invalid request for scan {scan_uri}: {e}")
        raise HTTPException(status_code=400, detail=str(e))
    except FileNotFoundError as e:
        logger.warning(f"Scan not found {scan_uri}: {e}")
        raise HTTPException(status_code=404, detail=f"Scan not found: {scan_uri}")
    except Exception as e:
        error_msg = f"Failed to load scan {scan_uri}: {str(e)}"
        logger.error(error_msg)
        raise HTTPException(status_code=500, detail=error_msg)
