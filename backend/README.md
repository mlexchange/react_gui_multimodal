# XScattering Backend

FastAPI backend for SAXS/GISAXS X-ray scattering analysis.

## Requirements

- Python 3.13+
- [uv](https://github.com/astral-sh/uv) package manager

## Setup

```bash
cd backend
uv sync
```

## Configuration

Required environment variables:

| Variable | Description |
|----------|-------------|
| `SCATTERING_TILED_URL` | Tiled server URL |
| `SCATTERING_TILED_API_KEY` | Tiled API key |

Optional:

| Variable | Default | Description |
|----------|---------|-------------|
| `SCATTERING_BACKEND_PORT` | 8000 | Server port |
| `SCATTERING_BACKEND_HOST` | 0.0.0.0 | Server host |
| `SCATTERING_BACKEND_LOG_LEVEL` | INFO | DEBUG/INFO/WARNING/ERROR |
| `SCATTERING_BACKEND_BATCH_MAX_WORKERS` | 16 | Thread pool size |
| `SCATTERING_BACKEND_CACHE_IMAGE_SIZE` | 50 | Image cache size |
| `SCATTERING_BACKEND_CACHE_QSPACE_SIZE` | 20 | Q-matrix cache size |
| `SCATTERING_BACKEND_CACHE_GISAXS_SIZE` | 20 | GISAXS transform cache |
| `SCATTERING_BACKEND_CACHE_MASK_SIZE` | 50 | Mask cache size |

## Run

```bash
uv run xscattering-backend
```

Or with uvicorn directly:

```bash
uv run uvicorn xscattering_backend.main:app --reload
```

## Docker

```bash
docker build -t xscattering-backend .
docker run -p 8000:8000 \
  -e SCATTERING_TILED_URL=... \
  -e SCATTERING_TILED_API_KEY=... \
  xscattering-backend
```

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/summary` | GET | Scan metadata for folder |
| `/api/fetch-scan-image` | GET | Detector image with optional GISAXS transform |
| `/api/extract-linecut` | POST | Single linecut extraction |
| `/api/batch-all` | POST | Parallel batch processing |
| `/api/azimuthal-integrator` | GET | 1D azimuthal integration |
| `/api/q-space` | GET | Q-matrix computation |
| `/api/resolve-mask` | GET | Mask lookup from PONI |
| `/api/upload-mask` | POST | Upload detector mask |
| `/ws/progress` | WS | Real-time progress updates |
