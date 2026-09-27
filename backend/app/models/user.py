from datetime import datetime
from sqlalchemy import Column, String, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from app.database import Base
from app.utils.time import utc_now

class Organization(Base):
    __tablename__ = "organizations"

    id = Column(String, primary_key=True, index=True)
    name = Column(String, nullable=False)
    type = Column(String, nullable=False)  # FLEET_OPERATOR, SHIPPER
    status = Column(String, default="ACTIVE")

    users = relationship("User", back_populates="organization")
    trucks = relationship("Truck", back_populates="organization")

class User(Base):
    __tablename__ = "users"

    id = Column(String, primary_key=True, index=True)
    name = Column(String, nullable=False)
    email = Column(String, unique=True, index=True, nullable=True)
    role = Column(String, nullable=False)  # OPERATOR, DRIVER, SHIPPER, AUDITOR
    organization_id = Column(String, ForeignKey("organizations.id"), nullable=True)
    contact = Column(String, nullable=True)
    created_at = Column(DateTime, default=utc_now)

    organization = relationship("Organization", back_populates="users")
    driver = relationship("Driver", back_populates="user", uselist=False)

class Driver(Base):
    __tablename__ = "drivers"

    id = Column(String, primary_key=True, index=True)
    organization_id = Column(String, ForeignKey("organizations.id"), nullable=False)
    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    assigned_truck_id = Column(String, nullable=True)
    status = Column(String, default="AVAILABLE")  # AVAILABLE, ON_TRIP, INCIDENT_REPORTED, OFF_DUTY

    user = relationship("User", back_populates="driver")
