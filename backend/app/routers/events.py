import json
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.shipment import Shipment
from app.schemas.all_schemas import EventCreate, EventResponse
from app.services.event_service import record_shipment_event
from app.websocket_manager import ws_manager

router = APIRouter(prefix="/events", tags=["Events"])

@router.post("", response_model=EventResponse)
async def record_event(req: EventCreate, db: Session = Depends(get_db)):
    """
    Appends an immutable, hashed shipment event.
    """
    shipment = db.query(Shipment).filter(Shipment.id == req.shipment_id).first()
    if not shipment:
        raise HTTPException(status_code=404, detail=f"Shipment '{req.shipment_id}' not found")

    evt = record_shipment_event(
        db=db,
        shipment_id=req.shipment_id,
        event_type=req.event_type,
        payload=req.payload or {},
        actor_type=req.actor_type or "SYSTEM",
        actor_id=req.actor_id
    )

    payload_dict = {}
    try:
        payload_dict = json.loads(evt.payload_json) if evt.payload_json else {}
    except Exception:
        pass

    resp = EventResponse(
        id=evt.id,
        shipment_id=evt.shipment_id,
        event_type=evt.event_type,
        payload=payload_dict,
        actor_type=evt.actor_type,
        actor_id=evt.actor_id,
        timestamp=evt.timestamp,
        hash=evt.hash,
        blockchain_tx=evt.blockchain_tx,
        proof_status=evt.proof_status
    )

    await ws_manager.broadcast({
        "event": "shipment.event_recorded",
        "shipment_id": evt.shipment_id,
        "event_id": evt.id,
        "event_type": evt.event_type,
        "hash": evt.hash
    })

    return resp
