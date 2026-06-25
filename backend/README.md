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
| `SCATTERING_TILED_URL` | Tiled data server URL |
| `SCATTERING_TILED_API_KEY` | Tiled API key |

Optional (Tiled services):

| Variable | Description |
|----------|-------------|
| `SCATTERING_TILED_RESULTS_URL` | Writable Tiled container URL for saving analysis results. Feature disabled if unset. |
| `SCATTERING_TILED_RESULTS_API_KEY` | API key for the results Tiled server |
| `SCATTERING_TILED_CALIBRATION_URL` | Tiled server URL for calibration data (PONI files and masks). Feature disabled if unset. |
| `SCATTERING_TILED_CALIBRATION_API_KEY` | API key for the calibration Tiled server |

Optional (server):

| Variable | Default | Description |
|----------|---------|-------------|
| `SCATTERING_BACKEND_DEVELOPMENT` | false | Enable development mode with hot reload |
| `SCATTERING_BACKEND_HOST` | 0.0.0.0 | Server host |
| `SCATTERING_BACKEND_PORT` | 8000 | Server port |
| `SCATTERING_BACKEND_LOG_LEVEL` | INFO | DEBUG/INFO/WARNING/ERROR/CRITICAL |
| `SCATTERING_BACKEND_BATCH_MAX_WORKERS` | 16 | Thread pool size for batch processing |

Optional (cache sizes):

| Variable | Default | Description |
|----------|---------|-------------|
| `SCATTERING_BACKEND_CACHE_IMAGE_SIZE` | 50 | Image cache entries |
| `SCATTERING_BACKEND_CACHE_QSPACE_SIZE` | 20 | Q-matrix cache entries |
| `SCATTERING_BACKEND_CACHE_GISAXS_SIZE` | 20 | GISAXS transform cache entries |
| `SCATTERING_BACKEND_CACHE_MASK_SIZE` | 50 | Mask cache entries (per type) |
| `SCATTERING_BACKEND_CACHE_TILED_URIS` | 4 | Tiled URI client connection cache entries |

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
| `/api/health` | GET | Unified health status for all services |
| `/api/summary` | GET | Scan metadata for folder |
| `/api/fetch-scan-image` | GET | Detector image with optional GISAXS transform |
| `/api/q-space` | GET | Q-matrix computation (SAXS) |
| `/api/extract-linecut` | POST | Single linecut extraction |
| `/api/azimuthal-integrator` | GET | 1D azimuthal integration |
| `/api/batch-all` | POST | Parallel batch processing across scans |
| `/api/batch-cancel/{batch_id}` | POST | Cancel an active batch job |
| `/api/get-mask` | GET | Retrieve cached mask data |
| `/api/upload-mask` | POST | Upload a detector mask file |
| `/api/load-mask-from-tiled` | GET | Load a mask from Tiled |
| `/api/load-calibration` | GET | Load calibration parameters and mask from a PONI file in Tiled |
| `/api/save-linecuts` | POST | Save linecut results to Tiled |
| `/api/save-batch-results` | POST | Save batch results to Tiled |
| `/ws/progress` | WS | Real-time progress updates |
