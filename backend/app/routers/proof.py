from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas.all_schemas import ProofAnchorRequest, ProofAnchorResponse
from app.services.proof_service import anchor_event_proof
from app.websocket_manager import ws_manager

router = APIRouter(prefix="/proof", tags=["Proof"])

@router.post("/anchor", response_model=ProofAnchorResponse)
async def anchor_proof(req: ProofAnchorRequest, db: Session = Depends(get_db)):
    """
    Computes/anchors SHA-256 canonical hash of critical event on EVM testnet.
    Per Non-Negotiable #7: Status is explicitly PENDING if block confirmation is not finalized.
    """
    try:
        result = anchor_event_proof(
            db=db,
            shipment_id=req.shipment_id,
            event_id=req.event_id
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

    await ws_manager.broadcast({
        "event": "proof.anchored",
        "shipment_id": req.shipment_id,
        "hash": result["hash"],
        "proof_status": result["proof_status"],
        "blockchain_tx": result["blockchain_tx"]
    })

    return ProofAnchorResponse(**result)
