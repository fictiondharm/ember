import json
import logging
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from app.websocket_manager import ws_manager

logger = logging.getLogger("fleetgrid.ws_router")
router = APIRouter(tags=["Realtime"])

@router.websocket("/realtime")
async def websocket_realtime_endpoint(websocket: WebSocket):
    await ws_manager.connect(websocket)
    try:
        # Send initial connected greeting
        await websocket.send_text(json.dumps({
            "event": "connected",
            "message": "Connected to FleetGrid authoritative realtime event stream."
        }))
        while True:
            # Handle incoming ping / client messages
            data = await websocket.receive_text()
            try:
                msg = json.loads(data)
                if msg.get("type") == "ping":
                    await websocket.send_text(json.dumps({"type": "pong"}))
            except Exception:
                pass
    except WebSocketDisconnect:
        ws_manager.disconnect(websocket)
    except Exception as e:
        logger.warning(f"WebSocket client error: {e}")
        ws_manager.disconnect(websocket)


@router.websocket("/ws/tracking")
async def websocket_tracking_endpoint(websocket: WebSocket):
    """
    Dedicated WebSocket for the live truck tracking map.
    Shares the same ws_manager as /realtime so POST /trucks/{id}/location
    broadcasts to all connected clients on both paths.
    """
    await ws_manager.connect(websocket)
    try:
        await websocket.send_text(json.dumps({
            "type": "connected",
            "message": "Connected to FleetGrid live truck tracking stream."
        }))
        while True:
            data = await websocket.receive_text()
            try:
                msg = json.loads(data)
                if msg.get("type") == "ping":
                    await websocket.send_text(json.dumps({"type": "pong"}))
            except Exception:
                pass
    except WebSocketDisconnect:
        ws_manager.disconnect(websocket)
    except Exception as e:
        logger.warning(f"Tracking WebSocket client error: {e}")
        ws_manager.disconnect(websocket)
