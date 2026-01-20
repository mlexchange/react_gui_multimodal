"""Utils module for xscattering_backend."""

from xscattering_backend.utils.azimuthal_integration import (
    create_azimuthal_integrator,
    integrate_1d,
)
from xscattering_backend.utils.linecut_extraction import (
    extract_horizontal_linecut,
    extract_inclined_linecut,
    extract_vertical_linecut,
)
from xscattering_backend.utils.mask_loader import (
    load_mask_from_bytes,
    load_mask_from_tiled,
    normalize_mask,
)
from xscattering_backend.utils.q_space import (
    GISAXSTransformResult,
    compute_saxs_q_matrices,
    transform_gisaxs_to_qspace,
)
from xscattering_backend.utils.scans import (
    ensure_2d_image,
    get_processed_image,
    get_scans_from_folder,
)

__all__ = [
    # Azimuthal integration
    "create_azimuthal_integrator",
    "integrate_1d",
    # Linecut extraction
    "extract_horizontal_linecut",
    "extract_vertical_linecut",
    "extract_inclined_linecut",
    # Mask loading
    "load_mask_from_bytes",
    "load_mask_from_tiled",
    "normalize_mask",
    # Q-space (SAXS and GISAXS)
    "compute_saxs_q_matrices",
    "transform_gisaxs_to_qspace",
    "GISAXSTransformResult",
    # Scans
    "get_scans_from_folder",
    "get_processed_image",
    "ensure_2d_image",
]
