import msgpack
import numpy as np
from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import Response
from xscattering_backend.cache.image_cache import get_cached_processed_image
from xscattering_backend.config.logging import get_logger

logger = get_logger(__name__)
router = APIRouter()


@router.get("/fetch-scan-image")
async def fetch_scan_image(
    scan_uri: str,
    mask_uri: str | None = Query(None, description="Optional mask URI or mask_id"),
    # Experiment type determines whether to include GISAXS transform
    experiment_type: str = Query("SAXS", description="SAXS or GISAXS"),
    # Calibration params (required for GISAXS transform)
    sample_detector_distance: float | None = Query(None, description="Distance in mm"),
    beam_center_x: float | None = Query(None, description="Beam center X in pixels"),
    beam_center_y: float | None = Query(None, description="Beam center Y in pixels"),
    pixel_size_x: float | None = Query(None, description="Pixel size X in micrometers"),
    pixel_size_y: float | None = Query(None, description="Pixel size Y in micrometers"),
    wavelength: float | None = Query(None, description="Wavelength in Angstroms"),
    incident_angle: float | None = Query(None, description="Incident angle in degrees"),
    tilt: float = Query(0.0, description="Tilt angle in degrees"),
    tilt_plan_rotation: float = Query(0.0, description="Tilt plane rotation in degrees"),
):
    """
    Get the processed image for a single scan.

    For GISAXS experiments with calibration parameters provided, also returns
    the transformed Q-space image and pixel-space Q matrices.

    Args:
        scan_uri: The scan URI like "rawdata/NaCl_small/NaCl_1_10_sample_2_2m"
        mask_uri: Optional mask URI or mask_id for detector mask
        experiment_type: "SAXS" or "GISAXS"
        sample_detector_distance: Sample-detector distance in mm (GISAXS)
        beam_center_x, beam_center_y: Beam center in pixels (GISAXS)
        pixel_size_x, pixel_size_y: Pixel size in micrometers (GISAXS)
        wavelength: X-ray wavelength in Angstroms (GISAXS)
        incident_angle: Incident angle in degrees (GISAXS)
        tilt: Detector tilt in degrees (GISAXS, optional)
        tilt_plan_rotation: Tilt plane rotation in degrees (GISAXS, optional)

    Returns:
        msgpack binary containing:
        - image: bytes (float32 array data)
        - shape: [height, width]
        - dtype: str
        - scan_uri: string
        - mask_uri: string | null

        For GISAXS with calibration (additional fields):
        - gisaxs_transformed: dict with:
            - image: bytes (transformed Q-space image)
            - shape: [npt_oop, npt_ip]
            - qip_values: list (1D array for X axis)
            - qoop_values: list (1D array for Y axis)
        - gisaxs_pixel_q: dict with:
            - qip_matrix: bytes (qip at each pixel)
            - qoop_matrix: bytes (qoop at each pixel)
    """
    scan_uri = scan_uri.lstrip("/")

    try:
        # Get from cache (will fetch from Tiled and process if not cached)
        processed = get_cached_processed_image(scan_uri, mask_uri=mask_uri)

        # Base response data
        response_data = {
            "image": processed.array.tobytes(),
            "shape": list(processed.shape),
            "dtype": str(processed.array.dtype),
            "scan_uri": scan_uri,
            "mask_uri": mask_uri,
        }

        # For GISAXS, compute and include transformed image if calibration is provided
        if experiment_type == "GISAXS" and _has_required_calibration(
            sample_detector_distance,
            beam_center_x,
            beam_center_y,
            pixel_size_x,
            pixel_size_y,
            wavelength,
            incident_angle,
        ):
            calibration = {
                "sample_detector_distance": sample_detector_distance,
                "beam_center_x": beam_center_x,
                "beam_center_y": beam_center_y,
                "pixel_size_x": pixel_size_x,
                "pixel_size_y": pixel_size_y,
                "wavelength": wavelength,
                "incident_angle": incident_angle,
                "tilt": tilt,
                "tilt_plan_rotation": tilt_plan_rotation,
            }

            try:
                from xscattering_backend.cache.gisaxs_cache import (
                    get_or_compute_gisaxs_transform,
                )

                gisaxs_result = get_or_compute_gisaxs_transform(scan_uri, calibration, mask_uri=mask_uri)

                # Include GISAXS-specific data
                response_data["gisaxs_transformed"] = {
                    "image": gisaxs_result.transformed_image.astype(np.float32).tobytes(),
                    "shape": list(gisaxs_result.transformed_image.shape),
                    "qip_values": gisaxs_result.qip_values.tolist(),
                    "qoop_values": gisaxs_result.qoop_values.tolist(),
                }
                response_data["gisaxs_pixel_q"] = {
                    "qip_matrix": gisaxs_result.qip_pixel_matrix.astype(np.float32).tobytes(),
                    "qoop_matrix": gisaxs_result.qoop_pixel_matrix.astype(np.float32).tobytes(),
                    "shape": list(gisaxs_result.qip_pixel_matrix.shape),
                }

                logger.debug(
                    f"GISAXS transform included for {scan_uri}: "
                    f"qip=[{gisaxs_result.qip_values.min():.4f}, {gisaxs_result.qip_values.max():.4f}], "
                    f"qoop=[{gisaxs_result.qoop_values.min():.4f}, {gisaxs_result.qoop_values.max():.4f}]"
                )
            except Exception as e:
                logger.warning(f"GISAXS transform failed for {scan_uri}: {e}")
                # Continue without GISAXS data - frontend will handle missing data

        # Pack and return
        packed_data = msgpack.packb(response_data)
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


def _has_required_calibration(
    sample_detector_distance: float | None,
    beam_center_x: float | None,
    beam_center_y: float | None,
    pixel_size_x: float | None,
    pixel_size_y: float | None,
    wavelength: float | None,
    incident_angle: float | None,
) -> bool:
    """Check if all required calibration parameters are provided."""
    return all(
        v is not None
        for v in [
            sample_detector_distance,
            beam_center_x,
            beam_center_y,
            pixel_size_x,
            pixel_size_y,
            wavelength,
            incident_angle,
        ]
    )
