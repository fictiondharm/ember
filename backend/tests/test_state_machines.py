import pytest
from app.models.truck import Truck
from app.models.shipment import Shipment, ShipmentEvent
from app.models.incident import Incident, RecoveryPlan
from app.services.event_service import generate_canonical_hash, record_shipment_event
from app.services.recovery_agent import RecoveryAgentTools

def test_canonical_hash_determinism():
    h1 = generate_canonical_hash("SHP-001", "CARGO_HANDOFF", '{"weight": 1.0}', "OPERATOR", "USR-01", "2026-09-27T10:00:00")
    h2 = generate_canonical_hash("SHP-001", "CARGO_HANDOFF", '{"weight": 1.0}', "OPERATOR", "USR-01", "2026-09-27T10:00:00")
    h3 = generate_canonical_hash("SHP-001", "CARGO_HANDOFF", '{"weight": 2.0}', "OPERATOR", "USR-01", "2026-09-27T10:00:00")
    
    assert h1 == h2, "Identical events must produce identical canonical SHA-256 hashes"
    assert h1 != h3, "Different payloads must produce different hashes"
    assert len(h1) == 64, "SHA-256 hex digest must be 64 characters"

def test_approval_gate_enforcement(db_session):
    """
    Contract Non-Negotiable #4:
    Recovery/payment/cargo reassignment requires approval in MVP.
    Cannot execute an unapproved plan.
    """
    incident = Incident(
        id="INC-TEST-01",
        truck_id="FG-027",
        type="BREAKDOWN",
        location="Hosur",
        status="OPEN"
    )
    db_session.add(incident)
    
    shipment = Shipment(
        id="SHP-TEST-01",
        shipper_id="ORG-SHIP-01",
        origin="Bengaluru",
        destination="Chennai",
        weight_t=1.0,
        status="AT_RISK",
        truck_id="FG-027"
    )
    db_session.add(shipment)
    db_session.commit()

    options = RecoveryAgentTools.find_nearby_capacity(db_session, "Bengaluru", "Chennai", 1.0)
    plan = RecoveryAgentTools.create_recovery_plan(db_session, incident.id, [shipment], options)
    
    assert plan.status == "PENDING_APPROVAL"

    # Attempting to execute unapproved plan must fail
    with pytest.raises(ValueError, match="Must be APPROVED first"):
        RecoveryAgentTools.execute_recovery(db_session, plan.id, "USR-OPERATOR-01")

def test_recovery_execution_state_transitions(db_session):
    """
    Tests full execution of approved recovery plan:
    - Cargo reassignments
    - Capacity updates
    - CARGO_HANDOFF event generation
    """
    truck_27 = db_session.query(Truck).filter(Truck.id == "FG-027").first()
    truck_41 = db_session.query(Truck).filter(Truck.id == "FG-041").first()
    
    initial_spare_41 = truck_41.available_t

    incident = Incident(
        id="INC-EXEC-01",
        truck_id="FG-027",
        type="ENGINE_BREAKDOWN",
        location="Hosur",
        status="OPEN"
    )
    db_session.add(incident)

    shipment = Shipment(
        id="SHP-EXEC-01",
        shipper_id="ORG-SHIP-01",
        origin="Bengaluru",
        destination="Chennai",
        weight_t=1.0,
        status="AT_RISK",
        truck_id="FG-027"
    )
    db_session.add(shipment)
    db_session.commit()

    options = RecoveryAgentTools.find_nearby_capacity(db_session, "Bengaluru", "Chennai", 1.0)
    plan = RecoveryAgentTools.create_recovery_plan(db_session, incident.id, [shipment], options)
    
    # Approve plan
    plan.status = "APPROVED"
    plan.selected_truck_id = "FG-041"
    db_session.commit()

    # Execute
    res = RecoveryAgentTools.execute_recovery(db_session, plan.id, "USR-OPERATOR-01")
    assert res["status"] == "COMPLETED"

    # Verify state changes
    db_session.refresh(shipment)
    db_session.refresh(truck_41)
    db_session.refresh(plan)

    assert shipment.truck_id == "FG-041"
    assert shipment.status == "IN_TRANSIT"
    assert truck_41.available_t == initial_spare_41 - 1.0
    assert plan.status == "COMPLETED"

    # Verify CARGO_HANDOFF event exists
    events = db_session.query(ShipmentEvent).filter(
        ShipmentEvent.shipment_id == shipment.id,
        ShipmentEvent.event_type == "CARGO_HANDOFF"
    ).all()
    assert len(events) == 1
    assert events[0].actor_type == "OPERATOR"
    assert events[0].hash is not None
    assert events[0].proof_status in ["PENDING", "CONFIRMED"]
