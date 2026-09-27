import json
import hashlib
import uuid
from datetime import datetime
from typing import Dict, Any, Optional
from sqlalchemy.orm import Session

from app.models.shipment import ShipmentEvent
from app.websocket_manager import ws_manager

def generate_canonical_hash(
    shipment_id: str,
    event_type: str,
    payload_str: str,
    actor_type: str,
    actor_id: Optional[str],
    timestamp_str: str
) -> str:
    """Generate SHA-256 hash from canonical representation of event fields."""
    canonical = f"{shipment_id}|{event_type}|{payload_str}|{actor_type}|{actor_id or ''}|{timestamp_str}"
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()

def record_shipment_event(
    db: Session,
    shipment_id: str,
    event_type: str,
    payload: Optional[Dict[str, Any]] = None,
    actor_type: str = "SYSTEM",
    actor_id: Optional[str] = None,
    proof_status: str = "PENDING"
) -> ShipmentEvent:
    """Record an immutable, append-only shipment event with canonical SHA-256 hash."""
    now = datetime.utcnow()
    payload_dict = payload or {}
    payload_str = json.dumps(payload_dict, sort_keys=True)
    
    event_hash = generate_canonical_hash(
        shipment_id=shipment_id,
        event_type=event_type,
        payload_str=payload_str,
        actor_type=actor_type,
        actor_id=actor_id,
        timestamp_str=now.isoformat()
    )

    event_id = f"EVT-{uuid.uuid4().hex[:8].upper()}"
    event = ShipmentEvent(
        id=event_id,
        shipment_id=shipment_id,
        event_type=event_type,
        payload_json=payload_str,
        actor_type=actor_type,
        actor_id=actor_id,
        timestamp=now,
        hash=event_hash,
        proof_status=proof_status
    )
    db.add(event)
    db.commit()
    db.refresh(event)

    # Note: caller or background task broadcasts over ws_manager
    return event
