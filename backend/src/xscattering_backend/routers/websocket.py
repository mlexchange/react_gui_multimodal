"""
WebSocket router for real-time progress updates.

Provides a WebSocket endpoint for clients to receive progress updates
during long-running operations like batch processing.
"""

import asyncio

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

router = APIRouter()

# Store active WebSocket connections with asyncio lock for thread safety
_connections: set[WebSocket] = set()
_connections_lock = asyncio.Lock()


@router.websocket("/progress")
async def websocket_endpoint(websocket: WebSocket) -> None:
    """
    WebSocket endpoint for progress updates.

    Clients connect to receive real-time progress updates during batch processing
    and other long-running operations. Supports ping/pong for connection keepalive.

    Message format (received by client):
        {
            "progress": float,      # 0-100, or -1 for cancellation
            "message": str,         # Human-readable status
            "batch_id": str | None, # Batch operation ID (if applicable)
            "type": str | None,     # Operation type (e.g., "batch")
            "current_scan": str | None  # Currently processing scan name
        }
    """
    await websocket.accept()
    async with _connections_lock:
        _connections.add(websocket)
    try:
        while True:
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_text("pong")
    except WebSocketDisconnect:
        pass  # Connection closed normally
    except Exception:
        pass  # Handle any other exceptions gracefully
    finally:
        async with _connections_lock:
            _connections.discard(websocket)


async def send_progress_update(
    progress_percentage: float,
    message: str = "",
    batch_id: str | None = None,
    current_scan: str | None = None,
) -> None:
    """
    Send progress updates to all connected clients.

    Dead connections are automatically cleaned up.

    Args:
        progress_percentage: Progress from 0-100, or -1 for cancellation
        message: Human-readable status message
        batch_id: Optional ID for batch operations (None for non-batch ops)
        current_scan: Optional name of scan currently being processed
    """
    payload: dict[str, float | str] = {
        "progress": progress_percentage,
        "message": message,
    }

    # Add batch-specific fields if this is a batch operation
    if batch_id is not None:
        payload["batch_id"] = batch_id
        payload["type"] = "batch"

    if current_scan is not None:
        payload["current_scan"] = current_scan

    # Track failed connections for cleanup
    failed_connections: list[WebSocket] = []

    async with _connections_lock:
        for connection in _connections:
            try:
                await connection.send_json(payload)
            except Exception:
                failed_connections.append(connection)

        # Remove dead connections
        for connection in failed_connections:
            _connections.discard(connection)
