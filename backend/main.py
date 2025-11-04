from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers import (
    azimuthal_integrator,
    q_vectors,
    raw_data_overview,
    fetch_scan_image,
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


# Include Routers
app.include_router(raw_data_overview.router, tags=["Raw Data Overview"])
app.include_router(fetch_scan_image.router, tags=["Scan Image"])
app.include_router(
    azimuthal_integrator.router, prefix="/api", tags=["Azimuthal Integrator"]
)
app.include_router(q_vectors.router, prefix="/api", tags=["Q Vectors"])


@app.get("/")
def root():
    return {"message": "Welcome to the FastAPI Backend"}
