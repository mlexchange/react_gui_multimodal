"""
X-ray Scattering Backend

FastAPI backend for X-ray scattering analysis (GISAXS/SAXS).
"""

__version__ = "0.1.0"

from xscattering_backend.main import app, main

__all__ = ["app", "main", "__version__"]
