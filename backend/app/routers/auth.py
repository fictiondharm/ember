from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.user import User, Organization, Driver
from app.schemas.all_schemas import DemoLoginRequest, DemoLoginResponse

router = APIRouter(prefix="/auth", tags=["Auth"])

@router.post("/demo-login", response_model=DemoLoginResponse)
def demo_login(req: DemoLoginRequest, db: Session = Depends(get_db)):
    role = req.role.upper()
    query = db.query(User).filter(User.role == role)
    if req.email:
        query = query.filter(User.email == req.email)
    
    user = query.first()
    if not user:
        raise HTTPException(status_code=404, detail=f"No seeded user found for role '{role}'")

    org_name = None
    if user.organization_id:
        org = db.query(Organization).filter(Organization.id == user.organization_id).first()
        if org:
            org_name = org.name

    assigned_truck = None
    driver = db.query(Driver).filter(Driver.user_id == user.id).first()
    if driver:
        assigned_truck = driver.assigned_truck_id

    # Fast demo bearer token
    token = f"demo_token_{user.role.lower()}_{user.id}"

    return DemoLoginResponse(
        user_id=user.id,
        name=user.name,
        role=user.role,
        organization_id=user.organization_id,
        organization_name=org_name,
        assigned_truck_id=assigned_truck,
        token=token
    )
