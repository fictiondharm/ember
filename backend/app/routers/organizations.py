import uuid
from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.user import Organization
from app.schemas.all_schemas import OrganizationCreate, OrganizationResponse

router = APIRouter(prefix="/organizations", tags=["Organizations"])

@router.post("", response_model=OrganizationResponse)
def create_organization(req: OrganizationCreate, db: Session = Depends(get_db)):
    org_id = f"ORG-{uuid.uuid4().hex[:8].upper()}"
    org = Organization(
        id=org_id,
        name=req.name,
        type=req.type.upper(),
        status="ACTIVE"
    )
    db.add(org)
    db.commit()
    db.refresh(org)
    return org

@router.get("", response_model=List[OrganizationResponse])
def list_organizations(db: Session = Depends(get_db)):
    return db.query(Organization).all()
