from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.truck import Truck
from app.models.shipment import Shipment
from app.schemas.all_schemas import (
    TruckCreate, TruckResponse, TruckDepartRequest,
    TruckLocationUpdate, TruckLocationResponse,
)
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

@router.get("/locations", response_model=List[TruckLocationResponse])
def get_truck_locations(db: Session = Depends(get_db)):
    """
    Return all trucks with valid location data for the live tracking map.
    Called once on page load; subsequent updates come via WebSocket /ws/tracking.
    """
    trucks = db.query(Truck).filter(Truck.lat.isnot(None), Truck.lng.isnot(None)).all()
    return [TruckLocationResponse.from_truck(t) for t in trucks]

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


# ── Location Tracking Endpoints ──────────────────────────────────────────────



@router.post("/{truck_id}/location", response_model=TruckLocationResponse)
async def update_truck_location(
    truck_id: str,
    req: TruckLocationUpdate,
    db: Session = Depends(get_db),
):
    """
    Update a truck's live location.
    Called by the driver app or the development location simulator.
    Persists to DB and broadcasts TRUCK_LOCATION_UPDATE to all WebSocket clients.
    """
    truck = db.query(Truck).filter(Truck.id == truck_id).first()
    if not truck:
        raise HTTPException(status_code=404, detail=f"Truck '{truck_id}' not found")

    now = datetime.now(timezone.utc).replace(tzinfo=None)  # store naive UTC

    truck.lat = req.latitude
    truck.lng = req.longitude
    truck.speed_kmph = req.speed_kmph
    truck.heading = req.heading
    truck.location_status = "ACTIVE" if req.speed_kmph > 0 else "IDLE"
    truck.last_location_update = now

    db.commit()
    db.refresh(truck)

    effective_status = truck.location_status or "ACTIVE"

    # Broadcast to all connected tracking WebSocket clients (/ws/tracking & /realtime)
    await ws_manager.broadcast({
        "type": "TRUCK_LOCATION_UPDATE",
        "truck_id": truck.id,
        "latitude": truck.lat,
        "longitude": truck.lng,
        "speed_kmph": truck.speed_kmph,
        "heading": truck.heading,
        "status": effective_status,
        "location_status": truck.location_status,
        "registration_no": truck.registration_no,
        "registration_number": truck.registration_no,
        "origin": truck.origin,
        "destination": truck.destination,
        "timestamp": now.isoformat() + "Z",
    })

    return TruckLocationResponse.from_truck(truck)

