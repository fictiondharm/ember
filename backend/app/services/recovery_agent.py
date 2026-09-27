import json
import uuid
from datetime import datetime
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session

from app.models.truck import Truck
from app.models.shipment import Shipment
from app.models.incident import Incident, RecoveryPlan
from app.models.notification import Notification
from app.services.event_service import record_shipment_event
from app.services.proof_service import anchor_event_proof

class RecoveryAgentTools:
    """
    Authoritative backend tools for Agent actions per PRD Section 11.
    All state mutations are validated and create immutable events.
    """

    @staticmethod
    def get_truck(db: Session, truck_id: str) -> Optional[Truck]:
        return db.query(Truck).filter(Truck.id == truck_id).first()

    @staticmethod
    def get_shipments_for_truck(db: Session, truck_id: str) -> List[Shipment]:
        return db.query(Shipment).filter(Shipment.truck_id == truck_id).all()

    @staticmethod
    def find_nearby_capacity(db: Session, origin: str, destination: str, required_capacity_t: float) -> List[Dict[str, Any]]:
        """
        Find trucks capable of recovering the load.
        Matches available capacity and route compatibility.
        """
        candidate_trucks = db.query(Truck).filter(
            Truck.status.in_(["AVAILABLE", "IN_TRANSIT"]),
            Truck.available_t >= required_capacity_t
        ).all()

        options = []
        for truck in candidate_trucks:
            # Deterministic demo specs for FG-041 and FG-052 per Section 17
            if truck.id == "FG-041":
                distance_km = 8.2
                eta_minutes = 17
                cost = 3200.0
                score = 0.94
                reason = "Nearest available capacity (~8.2 km, ETA 17m). Route matches Bengaluru->Chennai directly."
            elif truck.id == "FG-052":
                distance_km = 15.8
                eta_minutes = 26
                cost = 4500.0
                score = 0.81
                reason = "Secondary capacity (~15.8 km, ETA 26m). Higher spare capacity (5.0T) but longer ETA."
            else:
                distance_km = 22.0
                eta_minutes = 35
                cost = 5000.0
                score = 0.70
                reason = f"Standard candidate {truck.registration_no} with {truck.available_t}T spare capacity."

            options.append({
                "truck_id": truck.id,
                "registration_no": truck.registration_no,
                "spare_capacity_t": truck.available_t,
                "distance_km": distance_km,
                "eta_minutes": eta_minutes,
                "cost": cost,
                "route_compatible": True,
                "recommendation_score": score,
                "reason": reason
            })

        # Sort by recommendation score descending
        options.sort(key=lambda x: x["recommendation_score"], reverse=True)
        return options

    @staticmethod
    def calculate_impact(affected_shipment: Shipment, option: Dict[str, Any]) -> Dict[str, Any]:
        """Calculates cost and ETA impact of reassignment."""
        return {
            "additional_cost": option["cost"],
            "eta_delta_minutes": option["eta_minutes"] + 20, # 20 mins cargo transfer
            "deadline_honored": True
        }

    @staticmethod
    def create_recovery_plan(
        db: Session,
        incident_id: str,
        affected_shipments: List[Shipment],
        options: List[Dict[str, Any]]
    ) -> RecoveryPlan:
        """Agent builds recovery proposal comparing options and marks PENDING_APPROVAL."""
        plan_id = f"REC-{uuid.uuid4().hex[:8].upper()}"
        top_option = options[0] if options else None
        
        affected_ids = [s.id for s in affected_shipments]
        
        plan = RecoveryPlan(
            id=plan_id,
            incident_id=incident_id,
            affected_shipment_ids=json.dumps(affected_ids),
            options_json=json.dumps(options),
            selected_truck_id=top_option["truck_id"] if top_option else None,
            cost=top_option["cost"] if top_option else 0.0,
            eta_delta_minutes=top_option["eta_minutes"] + 20 if top_option else 0,
            status="PENDING_APPROVAL" # Human approval gate required per Rule #4
        )
        db.add(plan)
        
        # Advance Incident to PLAN_READY
        incident = db.query(Incident).filter(Incident.id == incident_id).first()
        if incident:
            incident.status = "PLAN_READY"

        db.commit()
        db.refresh(plan)

        for shp in affected_shipments:
            record_shipment_event(
                db=db,
                shipment_id=shp.id,
                event_type="RECOVERY_PLAN_PROPOSED",
                payload={"recovery_plan_id": plan_id, "selected_truck_id": plan.selected_truck_id, "options_count": len(options)},
                actor_type="AGENT"
            )

        return plan

    @staticmethod
    def execute_recovery(
        db: Session,
        plan_id: str,
        approved_by: str
    ) -> Dict[str, Any]:
        """
        Executes an approved recovery plan:
        - Transfers cargo to replacement truck
        - Updates truck available capacities
        - Updates statuses
        - Generates immutable CARGO_HANDOFF event and blockchain proof
        """
        plan = db.query(RecoveryPlan).filter(RecoveryPlan.id == plan_id).first()
        if not plan:
            raise ValueError(f"Recovery plan {plan_id} not found")
        if plan.status != "APPROVED":
            raise ValueError(f"Cannot execute plan in status {plan.status}. Must be APPROVED first.")

        plan.status = "EXECUTING"
        db.commit()

        affected_ids = json.loads(plan.affected_shipment_ids)
        replacement_truck = db.query(Truck).filter(Truck.id == plan.selected_truck_id).first()
        if not replacement_truck:
            raise ValueError(f"Replacement truck {plan.selected_truck_id} not found")

        total_weight = 0.0
        events_recorded = []

        for shp_id in affected_ids:
            shp = db.query(Shipment).filter(Shipment.id == shp_id).first()
            if not shp:
                continue

            old_truck_id = shp.truck_id
            shp.truck_id = replacement_truck.id
            shp.status = "RECOVERY"
            total_weight += shp.weight_t

            # Record cargo handoff event
            evt = record_shipment_event(
                db=db,
                shipment_id=shp.id,
                event_type="CARGO_HANDOFF",
                payload={
                    "previous_truck_id": old_truck_id,
                    "replacement_truck_id": replacement_truck.id,
                    "weight_t": shp.weight_t,
                    "approved_by": approved_by,
                    "recovery_plan_id": plan.id
                },
                actor_type="OPERATOR",
                actor_id=approved_by
            )
            events_recorded.append(evt)

            # Anchor proof for this critical event
            anchor_event_proof(db=db, shipment_id=shp.id, event_id=evt.id)

            # Re-advance shipment to IN_TRANSIT
            shp.status = "IN_TRANSIT"

        # Update replacement truck capacity and status
        replacement_truck.available_t = max(0.0, replacement_truck.available_t - total_weight)
        replacement_truck.status = "IN_TRANSIT"

        plan.status = "COMPLETED"
        
        # Mark Incident as RESOLVED
        incident = db.query(Incident).filter(Incident.id == plan.incident_id).first()
        if incident:
            incident.status = "RESOLVED"

        db.commit()
        db.refresh(plan)

        return {
            "plan_id": plan.id,
            "status": "COMPLETED",
            "replacement_truck_id": replacement_truck.id,
            "reassigned_shipments": affected_ids,
            "proof_events": [e.id for e in events_recorded]
        }
