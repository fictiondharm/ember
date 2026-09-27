import uuid
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.truck import Truck
from app.models.shipment import Shipment
from app.models.incident import Incident
from app.schemas.all_schemas import IncidentCreate, IncidentResponse
from app.services.event_service import record_shipment_event
from app.services.voice_service import parse_voice_transcript
from app.services.recovery_agent import RecoveryAgentTools
from app.websocket_manager import ws_manager

router = APIRouter(prefix="/incidents", tags=["Incidents"])

@router.post("", response_model=IncidentResponse)
async def create_incident(req: IncidentCreate, db: Session = Depends(get_db)):
    """
    Creates a structured incident (from driver voice via ElevenLabs or manual input).
    - Truck moves to INCIDENT
    - Affected shipments move to AT_RISK
    - Creates immutable INCIDENT_DETECTED event
    - Pre-analyzes recovery options via Agent tools
    """
    truck = db.query(Truck).filter(Truck.id == req.truck_id).first()
    if not truck:
        raise HTTPException(status_code=404, detail=f"Truck '{req.truck_id}' not found")

    # If transcript is provided without summary, parse via voice service
    summary = req.structured_summary
    inc_type = req.type
    loc = req.location
    sev = req.severity or "HIGH"
    if req.transcript and not summary:
        parsed = parse_voice_transcript(req.transcript, default_truck_id=truck.id)
        inc_type = parsed["type"]
        loc = parsed["location"]
        sev = parsed["severity"]
        summary = parsed["structured_summary"]

    incident_id = f"INC-{uuid.uuid4().hex[:8].upper()}"
    incident = Incident(
        id=incident_id,
        truck_id=truck.id,
        type=inc_type,
        location=loc,
        severity=sev,
        transcript=req.transcript,
        structured_summary=summary or f"Incident reported on {truck.id} at {loc}",
        status="OPEN"
    )
    db.add(incident)

    # Move truck to INCIDENT state
    truck.status = "INCIDENT"

    # Identify affected shipments and move to AT_RISK
    affected_shipments = db.query(Shipment).filter(
        Shipment.truck_id == truck.id,
        Shipment.status.in_(["CONFIRMED", "IN_TRANSIT"])
    ).all()

    for shp in affected_shipments:
        shp.status = "AT_RISK"
        record_shipment_event(
            db=db,
            shipment_id=shp.id,
            event_type="INCIDENT_DETECTED",
            payload={
                "incident_id": incident.id,
                "incident_type": incident.type,
                "location": incident.location,
                "severity": incident.severity,
                "transcript": incident.transcript
            },
            actor_type="DRIVER",
            actor_id=truck.driver_id
        )

    db.commit()
    db.refresh(incident)
    db.refresh(truck)

    # Realtime broadcast to Control Tower, Driver UI, Shipper UI
    await ws_manager.broadcast({
        "event": "incident.created",
        "incident": {
            "id": incident.id,
            "truck_id": truck.id,
            "type": incident.type,
            "location": incident.location,
            "severity": incident.severity,
            "summary": incident.structured_summary,
            "affected_shipments": [s.id for s in affected_shipments]
        }
    })

    # Automatically run Agent evaluation to prepare RecoveryPlan in PENDING_APPROVAL
    if affected_shipments:
        total_req_t = sum(s.weight_t for s in affected_shipments)
        options = RecoveryAgentTools.find_nearby_capacity(
            db=db,
            origin=truck.origin or "Bengaluru",
            destination=truck.destination or "Chennai",
            required_capacity_t=total_req_t
        )
        plan = RecoveryAgentTools.create_recovery_plan(
            db=db,
            incident_id=incident.id,
            affected_shipments=affected_shipments,
            options=options
        )
        await ws_manager.broadcast({
            "event": "recovery.plan_ready",
            "incident_id": incident.id,
            "plan_id": plan.id,
            "options_count": len(options),
            "status": "PENDING_APPROVAL"
        })

    return incident

@router.get("", response_model=List[IncidentResponse])
def list_incidents(status: Optional[str] = None, db: Session = Depends(get_db)):
    query = db.query(Incident)
    if status:
        query = query.filter(Incident.status == status.upper())
    return query.all()

@router.get("/{id}", response_model=IncidentResponse)
def get_incident(id: str, db: Session = Depends(get_db)):
    incident = db.query(Incident).filter(Incident.id == id).first()
    if not incident:
        raise HTTPException(status_code=404, detail=f"Incident '{id}' not found")
    return incident
