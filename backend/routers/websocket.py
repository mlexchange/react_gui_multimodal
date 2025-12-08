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


async def send_progress_update(progress_percentage, message=""):
    """Send progress updates to all connected clients."""
    for connection in active_connections:
        try:
            await connection.send_json(
                {"progress": progress_percentage, "message": message}
            )
        except Exception:
            pass
