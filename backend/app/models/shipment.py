from datetime import datetime
from sqlalchemy import Column, String, Float, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from app.database import Base
from app.utils.time import utc_now

class Shipment(Base):
    __tablename__ = "shipments"

    id = Column(String, primary_key=True, index=True)
    shipper_id = Column(String, ForeignKey("organizations.id"), nullable=False)
    origin = Column(String, nullable=False)
    destination = Column(String, nullable=False)
    weight_t = Column(Float, nullable=False)
    deadline_at = Column(DateTime, nullable=True)
    # State machine: DRAFT -> CAPACITY_RESERVED -> CONFIRMED -> IN_TRANSIT -> AT_RISK -> RECOVERY -> IN_TRANSIT -> DELIVERED
    status = Column(String, default="DRAFT")
    truck_id = Column(String, ForeignKey("trucks.id"), nullable=True)
    price = Column(Float, default=0.0)
    currency = Column(String, default="INR")
    created_at = Column(DateTime, default=utc_now)

    truck = relationship("Truck", back_populates="shipments")
    events = relationship("ShipmentEvent", back_populates="shipment", order_by="ShipmentEvent.timestamp.asc()")

class ShipmentEvent(Base):
    __tablename__ = "shipment_events"

    id = Column(String, primary_key=True, index=True)
    shipment_id = Column(String, ForeignKey("shipments.id"), nullable=False)
    event_type = Column(String, nullable=False)
    payload_json = Column(Text, default="{}")
    actor_type = Column(String, default="SYSTEM")  # SYSTEM, AGENT, OPERATOR, DRIVER, SHIPPER
    actor_id = Column(String, nullable=True)
    timestamp = Column(DateTime, default=utc_now)
    hash = Column(String, nullable=False)  # Canonical SHA-256 hash
    blockchain_tx = Column(String, nullable=True)
    proof_status = Column(String, default="PENDING")  # PENDING, CONFIRMED, FAILED, FALLBACK_RECORDED

    shipment = relationship("Shipment", back_populates="events")
