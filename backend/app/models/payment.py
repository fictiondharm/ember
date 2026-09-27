from datetime import datetime
from sqlalchemy import Column, String, Float, DateTime, ForeignKey
from app.database import Base
from app.utils.time import utc_now

class Payment(Base):
    __tablename__ = "payments"

    id = Column(String, primary_key=True, index=True)
    shipment_id = Column(String, ForeignKey("shipments.id"), nullable=True)
    recovery_plan_id = Column(String, ForeignKey("recovery_plans.id"), nullable=True)
    provider = Column(String, default="Dodo Payments")
    amount = Column(Float, nullable=False)
    currency = Column(String, default="INR")
    # State machine: CREATED -> PENDING -> PAID; PENDING -> FAILED
    status = Column(String, default="CREATED")
    provider_reference = Column(String, nullable=True)
    created_at = Column(DateTime, default=utc_now)
