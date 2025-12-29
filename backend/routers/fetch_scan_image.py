import msgpack
from fastapi import APIRouter, HTTPException
from fastapi.responses import Response

from utils.image_cache import get_cached_processed_image

router = APIRouter()


@router.get("/fetch-scan-image")
async def fetch_scan_image(scan_uri: str):
    """
    Get the processed image with all resolution levels for a single scan.

    Args:
        scan_uri: The scan URI like "rawdata/NaCl_small/NaCl_1_10_sample_2_2m"

    Returns:
        msgpack binary containing all resolution levels:
        - low: {image: bytes, shape: [h, w], factor: int, dtype: str}
        - medium: {image: bytes, shape: [h, w], factor: int, dtype: str}
        - full: {image: bytes, shape: [h, w], factor: int, dtype: str}
        - original_shape: [height, width]
        - scan_uri: string
    """
    scan_uri = scan_uri.lstrip('/')

    try:
        # Get from cache (will fetch from Tiled and process if not cached)
        processed = get_cached_processed_image(scan_uri)

        # Serialize each resolution level
        def serialize_level(level):
            return {
                "image": level.array.tobytes(),
                "shape": list(level.array.shape),
                "factor": level.factor,
                "dtype": str(level.array.dtype),
            }

        # Pack all data
        packed_data = msgpack.packb({
            "low": serialize_level(processed.low),
            "medium": serialize_level(processed.medium),
            "full": serialize_level(processed.full),
            "original_shape": list(processed.original_shape),
            "scan_uri": scan_uri,
        })

        return Response(content=packed_data, media_type="application/octet-stream")

    except Exception as e:
        error_msg = f"Failed to load scan {scan_uri}: {str(e)}"
        print(f"[ERROR] {error_msg}")
        raise HTTPException(status_code=500, detail=error_msg)
