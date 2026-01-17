# ------------------------------------------------------------------------------
# BACKEND DOCKERFILE
# This file defines how to build the Python FastAPI backend container
# ------------------------------------------------------------------------------

# Start with the official Python image
# python:3.13-slim provides Python 3.13 with minimal OS dependencies
# Using slim reduces the image size compared to the full Python image
FROM python:3.13-slim

# Set the working directory inside the container
# All subsequent commands will be run from this directory
WORKDIR /app

# Install uv
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

# Copy dependency files first for better layer caching
# This takes advantage of Docker's layer caching
# If pyproject.toml and uv.lock don't change, Docker will reuse the cached dependencies
COPY pyproject.toml uv.lock ./

# Install Python dependencies using uv
# --system installs packages into the system Python rather than creating a virtual environment
# --locked ensures the exact versions from uv.lock are used
# --no-cache reduces the image size by not storing the uv cache
RUN uv sync --no-cache --no-dev

# Copy the rest of the application code
# This step is done after installing dependencies for better caching
# When you change your code but not pyproject.toml/uv.lock, only this layer is rebuilt
COPY . .

# Inform Docker/Podman that the container will listen on port 8000
# This is for documentation - it doesn't actually publish the port
EXPOSE 8000

# Define the command to run the FastAPI application
# uv run executes the command in the environment with installed dependencies
# uvicorn is the ASGI server that will run your FastAPI app
# --host 0.0.0.0 makes the server available to all network interfaces
# --port 8000 specifies the port the server will listen on
CMD ["uv", "run", "uvicorn", "xscattering_backend.main:app", "--host", "0.0.0.0", "--port", "8000"]
