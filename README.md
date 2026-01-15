# React GUI Multimodal

GISAXS/SAXS data visualization and analysis.

**Stack:** React + TypeScript + Vite | FastAPI + Python 3.13 | Docker Compose

## Quick Start (Docker)

```bash
# 1. Set environment variables
export SCATTERING_TILED_URL="http://127.0.0.1:8000/api/v1"
export SCATTERING_TILED_API_KEY="your-api-key"

# 2. Build and run
docker-compose up --build

# 3. Access at http://localhost:3000
```

## Environment Variables

| Variable | Description |
|----------|-------------|
| `SCATTERING_TILED_URL` | Tiled server URL (e.g., `http://localhost:8000/api/v1`) |
| `SCATTERING_TILED_API_KEY` | Tiled API authentication token |

Copy `.env.example` to `.env` and fill in your values.

## Development (without Docker)

### Backend

```bash
cd backend
uv sync               # Install dependencies
uv run fastapi dev    # Runs on http://localhost:8000
```

### Frontend

```bash
cd frontend
npm install          # Install dependencies
npm run dev          # Runs on http://localhost:4000
```

## Project Structure

```
├── frontend/        # React app (Vite)
├── backend/         # FastAPI server
├── docker-compose.yml
└── .env.example
```
