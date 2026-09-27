from app.routers.auth import router as auth_router
from app.routers.organizations import router as org_router
from app.routers.trucks import router as trucks_router
from app.routers.shipments import router as shipments_router
from app.routers.capacity import router as capacity_router
from app.routers.payments import router as payments_router, webhook_router
from app.routers.incidents import router as incidents_router
from app.routers.recovery import router as recovery_router
from app.routers.events import router as events_router
from app.routers.proof import router as proof_router
from app.routers.demo import router as demo_router
from app.routers.health import router as health_router
from app.routers.websocket import router as ws_router

__all__ = [
    "auth_router",
    "org_router",
    "trucks_router",
    "shipments_router",
    "capacity_router",
    "payments_router",
    "webhook_router",
    "incidents_router",
    "recovery_router",
    "events_router",
    "proof_router",
    "demo_router",
    "health_router",
    "ws_router",
]
