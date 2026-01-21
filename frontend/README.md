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

- `SCATTERING_TILED_URL` - Tiled data server URL
- `SCATTERING_TILED_API_KEY` - Tiled API key

## Build

```bash
npm run build       # Library build
npm run build:app   # Standalone app build
```
