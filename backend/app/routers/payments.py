from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.payment import Payment
from app.schemas.all_schemas import PaymentCreateRequest, PaymentResponse, DodoWebhookPayload
from app.services.payment_service import create_payment, process_payment_confirmation
from app.websocket_manager import ws_manager

router = APIRouter(prefix="/payments", tags=["Payments"])

@router.post("/create", response_model=PaymentResponse)
async def create_payment_intent(req: PaymentCreateRequest, db: Session = Depends(get_db)):
    """
    Creates a payment intent (Dodo Payments flow with demo fallback).
    Initial state: PENDING.
    """
    payment = create_payment(
        db=db,
        amount=req.amount,
        currency=req.currency or "INR",
        shipment_id=req.shipment_id,
        recovery_plan_id=req.recovery_plan_id,
        provider=req.provider or "Dodo Payments"
    )

    checkout_url = f"https://checkout.dodopayments.com/pay/{payment.id}"
    
    await ws_manager.broadcast({
        "event": "payment.created",
        "payment_id": payment.id,
        "amount": payment.amount,
        "currency": payment.currency,
        "status": payment.status,
        "shipment_id": payment.shipment_id
    })

    return PaymentResponse(
        id=payment.id,
        shipment_id=payment.shipment_id,
        recovery_plan_id=payment.recovery_plan_id,
        provider=payment.provider,
        amount=payment.amount,
        currency=payment.currency,
        status=payment.status,
        provider_reference=payment.provider_reference,
        checkout_url=checkout_url,
        created_at=payment.created_at
    )

@router.get("/{id}", response_model=PaymentResponse)
def get_payment(id: str, db: Session = Depends(get_db)):
    payment = db.query(Payment).filter(Payment.id == id).first()
    if not payment:
        raise HTTPException(status_code=404, detail=f"Payment '{id}' not found")
    return PaymentResponse(
        id=payment.id,
        shipment_id=payment.shipment_id,
        recovery_plan_id=payment.recovery_plan_id,
        provider=payment.provider,
        amount=payment.amount,
        currency=payment.currency,
        status=payment.status,
        provider_reference=payment.provider_reference,
        checkout_url=f"https://checkout.dodopayments.com/pay/{payment.id}",
        created_at=payment.created_at
    )

webhook_router = APIRouter(tags=["Webhooks"])

@router.post("/webhook/dodo")
@webhook_router.post("/webhooks/dodo")
async def dodo_webhook(payload: DodoWebhookPayload, db: Session = Depends(get_db)):
    """
    Dodo Payments Webhook receiver.
    Authoritatively confirms payment and advances linked shipment to CONFIRMED.
    """
    try:
        updated_payment = process_payment_confirmation(
            db=db,
            payment_id=payload.payment_id,
            status=payload.status.upper(),
            provider_reference=payload.provider_reference
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

    await ws_manager.broadcast({
        "event": "payment.confirmed",
        "payment_id": updated_payment.id,
        "status": updated_payment.status,
        "shipment_id": updated_payment.shipment_id
    })

    return {
        "status": "PROCESSED",
        "payment_id": updated_payment.id,
        "payment_status": updated_payment.status
    }
