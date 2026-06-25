# X-ray Scattering Analysis Frontend

React visualization tool for SAXS/GISAXS data analysis.

## Quick Start

```bash
npm install
npm run dev
```

## Architecture

```
src/
├── components/
│   ├── Scattering/       # Main analysis module
│   │   ├── hooks/        # State management
│   │   ├── services/     # API communication
│   │   ├── utils/        # Utilities
│   │   └── types.ts      # Type definitions
│   ├── shared/           # Reusable components
│   └── ui/               # UI primitives
└── app/                  # Entry point
```

## Environment Variables

Injected at build time via Vite (`import.meta.env`). Changes require a rebuild.

| Variable | Default | Description |
|----------|---------|-------------|
| `SCATTERING_TILED_URL` | `http://localhost:8000` | Tiled data server URL |
| `SCATTERING_TILED_API_KEY` | `""` | Tiled API key |
| `SCATTERING_TILED_CALIBRATION_URL` | `""` | Tiled calibration server URL (for PONI files and masks) |
| `SCATTERING_TILED_CALIBRATION_API_KEY` | `""` | Tiled calibration server API key |

## Scattering Component Props

When consuming the library build, the `<Scattering>` component accepts:

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `standalone` | `boolean` | `false` | Show an ALS header and use full viewport height |
| `enableTiledCalibration` | `boolean` | `true` | When `false`, disables Tiled calibration loading. When `true`, enabled if the backend supports it. |
| `enableTiledResults` | `boolean` | `true` | When `false`, disables save-to-Tiled buttons. When `true`, enabled if the backend supports it. |

## Build

```bash
npm run build       # Library build
npm run build:app   # Standalone app build
```
