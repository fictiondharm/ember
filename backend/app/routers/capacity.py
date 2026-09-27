from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.truck import Truck, CapacityOffer
from app.models.shipment import Shipment
from app.schemas.all_schemas import CapacityOfferResponse, ReserveCapacityRequest, ReserveCapacityResponse
from app.services.event_service import record_shipment_event
from app.websocket_manager import ws_manager

router = APIRouter(prefix="/capacity", tags=["Capacity"])

@router.get("", response_model=List[CapacityOfferResponse])
def find_compatible_capacity(
    origin: Optional[str] = None,
    destination: Optional[str] = None,
    weight_t: Optional[float] = None,
    db: Session = Depends(get_db)
):
    """
    Search compatible open truck capacity.
    Matches route and minimum available tonnage.
    """
    query = db.query(CapacityOffer).filter(CapacityOffer.status == "OPEN")
    offers = query.all()
    results = []

    for offer in offers:
        truck = db.query(Truck).filter(Truck.id == offer.truck_id).first()
        if not truck:
            continue

        # Filter by weight requirement if specified
        if weight_t is not None and offer.available_t < weight_t:
            continue

        # Filter by route if specified
        if origin and destination:
            req_route = f"{origin.lower()} -> {destination.lower()}"
            offer_route = offer.route.lower()
            if origin.lower() not in offer_route or destination.lower() not in offer_route:
                continue

        est_cost = None
        if weight_t:
            est_cost = weight_t * 2500.0

        results.append(CapacityOfferResponse(
            id=offer.id,
            truck_id=offer.truck_id,
            registration_no=truck.registration_no,
            route=offer.route,
            available_t=offer.available_t,
            departure_at=offer.departure_at,
            status=offer.status,
            price_rule=offer.price_rule,
            estimated_cost=est_cost
        ))

    return results

@router.post("/{id}/reserve", response_model=ReserveCapacityResponse)
async def reserve_capacity(id: str, req: ReserveCapacityRequest, db: Session = Depends(get_db)):
    """
    Reserves compatible capacity for a shipment.
    Advances Shipment status: DRAFT -> CAPACITY_RESERVED.
    Updates Truck available capacity.
    Records CAPACITY_RESERVED event.
    """
    offer = db.query(CapacityOffer).filter(CapacityOffer.id == id).first()
    if not offer:
        raise HTTPException(status_code=404, detail=f"Capacity offer '{id}' not found")
    if offer.status != "OPEN":
        raise HTTPException(status_code=400, detail=f"Capacity offer is in status '{offer.status}', not OPEN")

    shipment = db.query(Shipment).filter(Shipment.id == req.shipment_id).first()
    if not shipment:
        raise HTTPException(status_code=404, detail=f"Shipment '{req.shipment_id}' not found")
    if shipment.weight_t > offer.available_t:
        raise HTTPException(status_code=400, detail=f"Shipment weight ({shipment.weight_t}T) exceeds available capacity ({offer.available_t}T)")

    truck = db.query(Truck).filter(Truck.id == offer.truck_id).first()
    if not truck:
        raise HTTPException(status_code=404, detail=f"Truck '{offer.truck_id}' not found")

    # Update states
    shipment.truck_id = truck.id
    shipment.status = "CAPACITY_RESERVED"
    
    # Adjust capacities
    truck.available_t = max(0.0, truck.available_t - shipment.weight_t)
    offer.available_t = truck.available_t
    if offer.available_t <= 0.05:
        offer.status = "RESERVED"

    db.commit()
    db.refresh(shipment)
    db.refresh(truck)

    # Record event
    record_shipment_event(
        db=db,
        shipment_id=shipment.id,
        event_type="CAPACITY_RESERVED",
        payload={
            "capacity_offer_id": offer.id,
            "truck_id": truck.id,
            "reserved_weight_t": shipment.weight_t,
            "remaining_spare_t": truck.available_t
        },
        actor_type="SHIPPER",
        actor_id=shipment.shipper_id
    )

    # Realtime notification
    await ws_manager.broadcast({
        "event": "capacity.reserved",
        "offer_id": offer.id,
        "shipment_id": shipment.id,
        "truck_id": truck.id,
        "remaining_spare_t": truck.available_t
    })

    return ReserveCapacityResponse(
        capacity_offer_id=offer.id,
        shipment_id=shipment.id,
        truck_id=truck.id,
        status="CAPACITY_RESERVED",
        message=f"Successfully reserved {shipment.weight_t}T on truck {truck.id} ({truck.registration_no})"
    )
