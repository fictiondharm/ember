import json
from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.incident import Incident, RecoveryPlan
from app.models.shipment import Shipment
from app.schemas.all_schemas import (
    RecoveryPlanCreate,
    RecoveryPlanResponse,
    RecoveryOption,
    RecoveryApproveRequest,
    RecoveryExecuteRequest
)
from app.services.recovery_agent import RecoveryAgentTools
from app.services.event_service import record_shipment_event
from app.websocket_manager import ws_manager

router = APIRouter(prefix="/recovery-plans", tags=["Recovery Plans"])

def _format_recovery_plan(plan: RecoveryPlan) -> RecoveryPlanResponse:
    affected_ids = []
    if plan.affected_shipment_ids:
        try:
            affected_ids = json.loads(plan.affected_shipment_ids)
        except Exception:
            affected_ids = []

    options = []
    if plan.options_json:
        try:
            raw_options = json.loads(plan.options_json)
            for opt in raw_options:
                options.append(RecoveryOption(**opt))
        except Exception:
            pass

    return RecoveryPlanResponse(
        id=plan.id,
        incident_id=plan.incident_id,
        affected_shipment_ids=affected_ids,
        options=options,
        selected_truck_id=plan.selected_truck_id,
        cost=plan.cost,
        eta_delta_minutes=plan.eta_delta_minutes,
        status=plan.status,
        approved_by=plan.approved_by,
        approved_at=plan.approved_at,
        created_at=plan.created_at
    )

@router.post("", response_model=RecoveryPlanResponse)
async def create_recovery_plan(req: RecoveryPlanCreate, db: Session = Depends(get_db)):
    """
    Agent creates a structured recovery proposal comparing feasible options.
    Initial state: PENDING_APPROVAL (Human approval gate).
    """
    incident = db.query(Incident).filter(Incident.id == req.incident_id).first()
    if not incident:
        raise HTTPException(status_code=404, detail=f"Incident '{req.incident_id}' not found")

    affected_shipments = db.query(Shipment).filter(Shipment.truck_id == incident.truck_id).all()
    total_req_t = sum(s.weight_t for s in affected_shipments) if affected_shipments else 1.0

    options = RecoveryAgentTools.find_nearby_capacity(
        db=db,
        origin="Bengaluru",
        destination="Chennai",
        required_capacity_t=total_req_t
    )

    plan = RecoveryAgentTools.create_recovery_plan(
        db=db,
        incident_id=incident.id,
        affected_shipments=affected_shipments,
        options=options
    )

    if req.selected_truck_id:
        plan.selected_truck_id = req.selected_truck_id
        db.commit()
        db.refresh(plan)

    formatted = _format_recovery_plan(plan)
    await ws_manager.broadcast({
        "event": "recovery.plan_created",
        "plan_id": plan.id,
        "incident_id": incident.id,
        "selected_truck_id": plan.selected_truck_id,
        "status": plan.status
    })
    return formatted

@router.get("/{id}", response_model=RecoveryPlanResponse)
def get_recovery_plan(id: str, db: Session = Depends(get_db)):
    plan = db.query(RecoveryPlan).filter(RecoveryPlan.id == id).first()
    if not plan:
        raise HTTPException(status_code=404, detail=f"Recovery plan '{id}' not found")
    return _format_recovery_plan(plan)

@router.get("", response_model=List[RecoveryPlanResponse])
def list_recovery_plans(status: Optional[str] = None, db: Session = Depends(get_db)):
    query = db.query(RecoveryPlan)
    if status:
        query = query.filter(RecoveryPlan.status == status.upper())
    plans = query.all()
    return [_format_recovery_plan(p) for p in plans]

@router.post("/{id}/approve", response_model=RecoveryPlanResponse)
async def approve_recovery_plan(id: str, req: RecoveryApproveRequest, db: Session = Depends(get_db)):
    """
    Operator human approval gate per PRD Rule #4.
    Advances status: PENDING_APPROVAL -> APPROVED.
    """
    plan = db.query(RecoveryPlan).filter(RecoveryPlan.id == id).first()
    if not plan:
        raise HTTPException(status_code=404, detail=f"Recovery plan '{id}' not found")
    if plan.status not in ["DRAFT", "PROPOSED", "PENDING_APPROVAL"]:
        raise HTTPException(status_code=400, detail=f"Plan is in '{plan.status}' status, cannot approve")

    plan.status = "APPROVED"
    plan.selected_truck_id = req.selected_truck_id
    plan.approved_by = req.approved_by
    plan.approved_at = datetime.utcnow()
    db.commit()
    db.refresh(plan)

    # Record event on affected shipments
    affected_ids = json.loads(plan.affected_shipment_ids)
    for shp_id in affected_ids:
        record_shipment_event(
            db=db,
            shipment_id=shp_id,
            event_type="RECOVERY_PLAN_APPROVED",
            payload={
                "recovery_plan_id": plan.id,
                "selected_truck_id": plan.selected_truck_id,
                "approved_by": plan.approved_by
            },
            actor_type="OPERATOR",
            actor_id=req.approved_by
        )

    await ws_manager.broadcast({
        "event": "recovery.approved",
        "plan_id": plan.id,
        "selected_truck_id": plan.selected_truck_id,
        "approved_by": plan.approved_by
    })

    return _format_recovery_plan(plan)

@router.post("/{id}/execute")
async def execute_recovery_plan(id: str, req: Optional[RecoveryExecuteRequest] = None, db: Session = Depends(get_db)):
    """
    Executes approved recovery plan.
    Transfers cargo, updates truck capacity, generates CARGO_HANDOFF event, and anchors proof.
    """
    plan = db.query(RecoveryPlan).filter(RecoveryPlan.id == id).first()
    if not plan:
        raise HTTPException(status_code=404, detail=f"Recovery plan '{id}' not found")

    try:
        result = RecoveryAgentTools.execute_recovery(
            db=db,
            plan_id=plan.id,
            approved_by=plan.approved_by or "USR-OPERATOR-01"
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    await ws_manager.broadcast({
        "event": "recovery.executed",
        "plan_id": plan.id,
        "replacement_truck_id": result["replacement_truck_id"],
        "reassigned_shipments": result["reassigned_shipments"],
        "proof_events": result["proof_events"]
    })

    return result
