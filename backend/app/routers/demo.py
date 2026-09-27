from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.services.seed_service import seed_demo_database
from app.websocket_manager import ws_manager

router = APIRouter(prefix="/demo", tags=["Demo"])

@router.post("/reset")
async def reset_demo_state(db: Session = Depends(get_db)):
    """
    Resets deterministic demo state per PRD Section 17 & 18.
    Re-establishes:
    - FG-027 (10T, 3.8T spare, Bengaluru -> Chennai)
    - FG-041 (Recovery truck, 3.1T spare, 8.2 km away)
    - FG-052 (Recovery truck, 5.0T spare, 15.8 km away)
    - Seeded accounts (Operator, Driver, Shipper, Auditor)
    """
    summary = seed_demo_database(db)

    # Broadcast reset to all 3 connected laptops
    await ws_manager.broadcast({
        "event": "demo.reset",
        "message": "Demo state has been reset to baseline scenario."
    })

    return summary
