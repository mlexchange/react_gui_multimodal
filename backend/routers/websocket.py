from typing import Optional

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

router = APIRouter()

# Store active WebSocket connections
active_connections = []


@router.websocket("/progress")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    active_connections.append(websocket)
    try:
        while True:
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_text("pong")
    except WebSocketDisconnect:
        active_connections.remove(websocket)


async def send_progress_update(
    progress_percentage: float,
    message: str = "",
    batch_id: Optional[str] = None,
    current_scan: Optional[str] = None,
):
    """
    Send progress updates to all connected clients.

    Args:
        progress_percentage: Progress from 0-100
        message: Human-readable status message
        batch_id: Optional ID for batch operations (None for non-batch ops)
        current_scan: Optional name of scan currently being processed
    """
    payload = {
        "progress": progress_percentage,
        "message": message,
    }

    # Add batch-specific fields if this is a batch operation
    if batch_id is not None:
        payload["batch_id"] = batch_id
        payload["type"] = "batch"

    if current_scan is not None:
        payload["current_scan"] = current_scan

    for connection in active_connections:
        try:
            await connection.send_json(payload)
        except Exception:
            pass
