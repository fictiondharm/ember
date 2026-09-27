from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.truck import Truck
from app.models.shipment import Shipment
from app.schemas.all_schemas import TruckCreate, TruckResponse, TruckDepartRequest
from app.services.event_service import record_shipment_event
from app.websocket_manager import ws_manager

router = APIRouter(prefix="/trucks", tags=["Trucks"])

@router.post("", response_model=TruckResponse)
def register_truck(req: TruckCreate, db: Session = Depends(get_db)):
    existing = db.query(Truck).filter(Truck.id == req.id).first()
    if existing:
        raise HTTPException(status_code=400, detail=f"Truck with ID '{req.id}' already exists")

    truck = Truck(
        id=req.id,
        organization_id=req.organization_id,
        registration_no=req.registration_no,
        capacity_t=req.capacity_t,
        available_t=req.available_t,
        status=req.status or "AVAILABLE",
        lat=req.lat,
        lng=req.lng,
        origin=req.origin,
        destination=req.destination,
        departure_at=req.departure_at,
        driver_id=req.driver_id
    )
    db.add(truck)
    db.commit()
    db.refresh(truck)
    return truck

@router.get("", response_model=List[TruckResponse])
def list_trucks(status: Optional[str] = None, db: Session = Depends(get_db)):
    query = db.query(Truck)
    if status:
        query = query.filter(Truck.status == status.upper())
    return query.all()

@router.get("/{id}", response_model=TruckResponse)
def get_truck(id: str, db: Session = Depends(get_db)):
    truck = db.query(Truck).filter(Truck.id == id).first()
    if not truck:
        raise HTTPException(status_code=404, detail=f"Truck '{id}' not found")
    return truck

@router.post("/{id}/depart", response_model=TruckResponse)
async def truck_depart(id: str, req: Optional[TruckDepartRequest] = None, db: Session = Depends(get_db)):
    """
    Driver starts journey.
    Truck status advances to IN_TRANSIT.
    Assigned shipments advance to IN_TRANSIT.
    Creates immutable JOURNEY_STARTED event.
    """
    truck = db.query(Truck).filter(Truck.id == id).first()
    if not truck:
        raise HTTPException(status_code=404, detail=f"Truck '{id}' not found")

    truck.status = "IN_TRANSIT"
    if req and req.departure_at:
        truck.departure_at = req.departure_at
    else:
        truck.departure_at = datetime.utcnow()

    # Move assigned shipments to IN_TRANSIT
    shipments = db.query(Shipment).filter(Shipment.truck_id == truck.id).all()
    events = []
    for shp in shipments:
        shp.status = "IN_TRANSIT"
        evt = record_shipment_event(
            db=db,
            shipment_id=shp.id,
            event_type="JOURNEY_STARTED",
            payload={"truck_id": truck.id, "origin": truck.origin, "destination": truck.destination},
            actor_type="DRIVER",
            actor_id=truck.driver_id
        )
        events.append(evt)

    db.commit()
    db.refresh(truck)

    # Realtime notification
    await ws_manager.broadcast({
        "event": "truck.departed",
        "truck_id": truck.id,
        "status": truck.status,
        "affected_shipments": [s.id for s in shipments]
    })

    return truck
