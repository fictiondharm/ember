from datetime import datetime
from sqlalchemy import Column, String, Float, Integer, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from app.database import Base
from app.utils.time import utc_now

class Incident(Base):
    __tablename__ = "incidents"

    id = Column(String, primary_key=True, index=True)
    truck_id = Column(String, ForeignKey("trucks.id"), nullable=False)
    type = Column(String, nullable=False)  # BREAKDOWN, ACCIDENT, DELAY, etc.
    location = Column(String, nullable=False)
    severity = Column(String, default="HIGH")  # LOW, MEDIUM, HIGH, CRITICAL
    transcript = Column(Text, nullable=True)  # Voice transcript from ElevenLabs
    structured_summary = Column(Text, nullable=True)
    # State machine: OPEN -> ANALYZING -> PLAN_READY -> RESOLVED / ESCALATED
    status = Column(String, default="OPEN")
    created_at = Column(DateTime, default=utc_now)

    truck = relationship("Truck", back_populates="incidents")
    recovery_plans = relationship("RecoveryPlan", back_populates="incident")

class RecoveryPlan(Base):
    __tablename__ = "recovery_plans"

    id = Column(String, primary_key=True, index=True)
    incident_id = Column(String, ForeignKey("incidents.id"), nullable=False)
    affected_shipment_ids = Column(Text, default="[]")  # JSON serialized list of IDs
    options_json = Column(Text, default="[]")  # JSON serialized recovery options (FG-041, FG-052)
    selected_truck_id = Column(String, ForeignKey("trucks.id"), nullable=True)
    cost = Column(Float, default=0.0)
    eta_delta_minutes = Column(Integer, default=0)
    # State machine: DRAFT -> PROPOSED -> PENDING_APPROVAL -> APPROVED -> EXECUTING -> COMPLETED; PENDING_APPROVAL -> REJECTED
    status = Column(String, default="DRAFT")
    approved_by = Column(String, nullable=True)
    approved_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=utc_now)

    incident = relationship("Incident", back_populates="recovery_plans")
