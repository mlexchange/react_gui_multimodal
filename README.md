# XScattering - GISAXS/SAXS Data Analysis

Full-stack scientific application for X-ray scattering data visualization and analysis.

**Stack:** React 18 + TypeScript + Vite | FastAPI + Python 3.13 | Docker Compose

## Features

- **Dual image comparison** with synchronized panning/zooming
- **Linecut extraction** (horizontal, vertical, inclined) in Q-space
- **Azimuthal integration** using pyFAI
- **GISAXS and SAXS modes** with proper Q-space transformations
- **Batch processing** across multiple scans with real-time progress
- **Detector mask support** (upload or load from Tiled)
- **Session persistence** for analysis state

## Quick Start (Docker)

```bash
# 1. Set environment variables
export SCATTERING_TILED_URL="http://your-tiled-server:8000/api/v1"
export SCATTERING_TILED_API_KEY="your-api-key"

# 2. Build and run
docker-compose up --build

# 3. Access at http://localhost:3000
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SCATTERING_TILED_URL` | Yes | Tiled server URL (e.g., `http://localhost:8000/api/v1`) |
| `SCATTERING_TILED_API_KEY` | Yes | Tiled API authentication token |
| `SCATTERING_BACKEND_DEVELOPMENT` | No | Enable hot reload (default: `false`) |
| `SCATTERING_BACKEND_HOST` | No | Server bind address (default: `0.0.0.0`) |
| `SCATTERING_BACKEND_PORT` | No | Server port (default: `8000`) |
| `SCATTERING_BACKEND_LOG_LEVEL` | No | Logging level (default: `INFO`) |

See `.env.example` for all available configuration options.

## Development (without Docker)

### Backend

```bash
cd backend
uv sync                                                  # Install dependencies
SCATTERING_BACKEND_DEVELOPMENT=true uv run xscattering-backend  # Dev server with hot reload
```

### Frontend

```bash
cd frontend
npm install          # Install dependencies
npm run dev          # Runs on http://localhost:4000
```

## Project Structure

```
├── frontend/           # React app (Vite + TypeScript)
│   └── src/
│       └── components/
│           └── Scattering/  # Main analysis component
├── backend/            # FastAPI server
│   └── src/
│       └── xscattering_backend/
│           ├── routers/     # API endpoints
│           ├── cache/       # LRU caches
│           ├── config/      # Settings and models
│           └── utils/       # Q-space, linecut extraction
├── docker-compose.yml
└── .env.example
```

## License
