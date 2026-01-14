from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers import (
    azimuthal_integrator,
    batch_processor,
    fetch_scan_image,
    linecut,
    mask,
    q_vectors,
    summary,
    websocket,
)

app = FastAPI()

# Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Main API routers (/api)
app.include_router(summary.router, prefix="/api", tags=["Summary"])
app.include_router(fetch_scan_image.router, prefix="/api", tags=["Scan Image"])
app.include_router(azimuthal_integrator.router, prefix="/api", tags=["Azimuthal Integrator"])
app.include_router(q_vectors.router, prefix="/api", tags=["Q Vectors"])
app.include_router(batch_processor.router, prefix="/api", tags=["Batch Processor"])
app.include_router(linecut.router, prefix="/api", tags=["Linecut"])
app.include_router(mask.router, prefix="/api", tags=["Mask"])

# WebSocket router (/ws)
app.include_router(websocket.router, prefix="/ws", tags=["WebSocket"])


@app.get("/")
def root():
    return {"message": "Welcome to the FastAPI Backend"}


def main():
    """CLI entry point to run the server."""
    import uvicorn

    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)


if __name__ == "__main__":
    main()
