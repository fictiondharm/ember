from datetime import datetime
from sqlalchemy import Column, String, DateTime
from app.database import Base
from app.utils.time import utc_now

class Notification(Base):
    __tablename__ = "notifications"

    id = Column(String, primary_key=True, index=True)
    recipient_id = Column(String, nullable=False)
    type = Column(String, nullable=False)  # INCIDENT_ALERT, RECOVERY_REQUIRED, RECOVERY_APPROVED, DELIVERY_UPDATE
    message = Column(String, nullable=False)
    status = Column(String, default="SENT")  # UNREAD, READ, SENT
    created_at = Column(DateTime, default=utc_now)
