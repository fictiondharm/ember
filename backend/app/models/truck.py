from datetime import datetime
from sqlalchemy import Column, String, Float, DateTime, ForeignKey, Integer
from sqlalchemy.orm import relationship
from app.database import Base

class Truck(Base):
    __tablename__ = "trucks"

    id = Column(String, primary_key=True, index=True)  # e.g., FG-027, FG-041, FG-052
    organization_id = Column(String, ForeignKey("organizations.id"), nullable=False)
    registration_no = Column(String, nullable=False)
    capacity_t = Column(Float, nullable=False)
    available_t = Column(Float, nullable=False)
    # Status machine: AVAILABLE -> ASSIGNED -> LOADING -> IN_TRANSIT -> DELIVERED; IN_TRANSIT -> DELAYED / INCIDENT; INCIDENT -> RECOVERY -> IN_TRANSIT
    status = Column(String, default="AVAILABLE")
    lat = Column(Float, nullable=True)
    lng = Column(Float, nullable=True)
    origin = Column(String, nullable=True)
    destination = Column(String, nullable=True)
    departure_at = Column(DateTime, nullable=True)
    driver_id = Column(String, nullable=True)

    # ── Live location tracking fields ───────────────────────────────────────────
    speed_kmph = Column(Float, nullable=True, default=None)
    heading = Column(Integer, nullable=True, default=None)   # 0-360 degrees
    # ACTIVE | IDLE | OFFLINE | INCIDENT
    location_status = Column(String, nullable=True, default="OFFLINE")
    last_location_update = Column(DateTime, nullable=True, default=None)
    # ────────────────────────────────────────────────────────────────────────────

    organization = relationship("Organization", back_populates="trucks")
    capacity_offers = relationship("CapacityOffer", back_populates="truck")
    shipments = relationship("Shipment", back_populates="truck")
    incidents = relationship("Incident", back_populates="truck")

class CapacityOffer(Base):
    __tablename__ = "capacity_offers"

    id = Column(String, primary_key=True, index=True)
    truck_id = Column(String, ForeignKey("trucks.id"), nullable=False)
    route = Column(String, nullable=False)  # e.g., "Bengaluru -> Chennai"
    available_t = Column(Float, nullable=False)
    departure_at = Column(DateTime, nullable=True)
    status = Column(String, default="OPEN")  # OPEN, RESERVED, CLOSED
    price_rule = Column(String, default="INR 2500 per Ton")

    truck = relationship("Truck", back_populates="capacity_offers")
