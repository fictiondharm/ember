import uuid
import logging
from typing import Dict, Any, Optional
from sqlalchemy.orm import Session

from app.config import settings
from app.models.payment import Payment
from app.models.shipment import Shipment
from app.services.event_service import record_shipment_event

logger = logging.getLogger("fleetgrid.payment")

def create_payment(
    db: Session,
    amount: float,
    currency: str = "INR",
    shipment_id: Optional[str] = None,
    recovery_plan_id: Optional[str] = None,
    provider: str = "Dodo Payments"
) -> Payment:
    payment_id = f"PAY-{uuid.uuid4().hex[:8].upper()}"
    payment = Payment(
        id=payment_id,
        shipment_id=shipment_id,
        recovery_plan_id=recovery_plan_id,
        provider=provider,
        amount=amount,
        currency=currency,
        status="PENDING",
        provider_reference=f"dodo_ref_{uuid.uuid4().hex[:10]}"
    )
    db.add(payment)
    db.commit()
    db.refresh(payment)

    if shipment_id:
        record_shipment_event(
            db=db,
            shipment_id=shipment_id,
            event_type="PAYMENT_INITIATED",
            payload={"payment_id": payment_id, "amount": amount, "currency": currency, "provider": provider},
            actor_type="SHIPPER"
        )

    return payment

def process_payment_confirmation(
    db: Session,
    payment_id: str,
    status: str = "PAID",
    provider_reference: Optional[str] = None
) -> Payment:
    payment = db.query(Payment).filter(Payment.id == payment_id).first()
    if not payment:
        raise ValueError(f"Payment {payment_id} not found")

    payment.status = status
    if provider_reference:
        payment.provider_reference = provider_reference
    
    # If linked to a shipment, advance status to CONFIRMED
    if payment.shipment_id and status == "PAID":
        shipment = db.query(Shipment).filter(Shipment.id == payment.shipment_id).first()
        if shipment and shipment.status == "CAPACITY_RESERVED":
            shipment.status = "CONFIRMED"
        
        record_shipment_event(
            db=db,
            shipment_id=payment.shipment_id,
            event_type="PAYMENT_COMPLETED",
            payload={"payment_id": payment.id, "amount": payment.amount, "status": status},
            actor_type="SYSTEM"
        )

    db.commit()
    db.refresh(payment)
    return payment
