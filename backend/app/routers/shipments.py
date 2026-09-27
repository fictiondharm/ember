import uuid
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.shipment import Shipment, ShipmentEvent
from app.schemas.all_schemas import ShipmentCreate, ShipmentResponse, EventResponse
from app.services.event_service import record_shipment_event
from app.websocket_manager import ws_manager

router = APIRouter(prefix="/shipments", tags=["Shipments"])

@router.post("", response_model=ShipmentResponse)
async def create_shipment(req: ShipmentCreate, db: Session = Depends(get_db)):
    """
    Business creates a shipment.
    Initial state: DRAFT.
    Creates immutable SHIPMENT_CREATED event.
    """
    shipment_id = f"SHP-{uuid.uuid4().hex[:8].upper()}"
    shipment = Shipment(
        id=shipment_id,
        shipper_id=req.shipper_id,
        origin=req.origin,
        destination=req.destination,
        weight_t=req.weight_t,
        deadline_at=req.deadline_at,
        status="DRAFT",
        price=req.price or (req.weight_t * 2500.0),
        currency=req.currency or "INR"
    )
    db.add(shipment)
    db.commit()
    db.refresh(shipment)

    # Record event
    record_shipment_event(
        db=db,
        shipment_id=shipment.id,
        event_type="SHIPMENT_CREATED",
        payload={
            "origin": shipment.origin,
            "destination": shipment.destination,
            "weight_t": shipment.weight_t,
            "price": shipment.price
        },
        actor_type="SHIPPER",
        actor_id=shipment.shipper_id
    )

    # Realtime notification
    await ws_manager.broadcast({
        "event": "shipment.created",
        "shipment": {
            "id": shipment.id,
            "shipper_id": shipment.shipper_id,
            "origin": shipment.origin,
            "destination": shipment.destination,
            "weight_t": shipment.weight_t,
            "status": shipment.status
        }
    })

    return shipment

@router.get("", response_model=List[ShipmentResponse])
def list_shipments(status: Optional[str] = None, shipper_id: Optional[str] = None, db: Session = Depends(get_db)):
    query = db.query(Shipment)
    if status:
        query = query.filter(Shipment.status == status.upper())
    if shipper_id:
        query = query.filter(Shipment.shipper_id == shipper_id)
    return query.all()

@router.get("/{id}", response_model=ShipmentResponse)
def get_shipment(id: str, db: Session = Depends(get_db)):
    shipment = db.query(Shipment).filter(Shipment.id == id).first()
    if not shipment:
        raise HTTPException(status_code=404, detail=f"Shipment '{id}' not found")
    return shipment

@router.get("/{id}/timeline", response_model=List[EventResponse])
def get_shipment_timeline(id: str, db: Session = Depends(get_db)):
    shipment = db.query(Shipment).filter(Shipment.id == id).first()
    if not shipment:
        raise HTTPException(status_code=404, detail=f"Shipment '{id}' not found")

    import json
    events = db.query(ShipmentEvent).filter(ShipmentEvent.shipment_id == id).order_by(ShipmentEvent.timestamp.asc()).all()
    results = []
    for evt in events:
        try:
            payload = json.loads(evt.payload_json) if evt.payload_json else {}
        except Exception:
            payload = {}
        results.append(EventResponse(
            id=evt.id,
            shipment_id=evt.shipment_id,
            event_type=evt.event_type,
            payload=payload,
            actor_type=evt.actor_type,
            actor_id=evt.actor_id,
            timestamp=evt.timestamp,
            hash=evt.hash,
            blockchain_tx=evt.blockchain_tx,
            proof_status=evt.proof_status
        ))
    return results
