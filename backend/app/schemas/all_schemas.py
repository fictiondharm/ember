from typing import Optional, List, Any, Dict
from datetime import datetime
from pydantic import BaseModel, ConfigDict

# --- Auth Schemas ---
class DemoLoginRequest(BaseModel):
    role: str  # OPERATOR, DRIVER, SHIPPER, AUDITOR
    email: Optional[str] = None

class DemoLoginResponse(BaseModel):
    user_id: str
    name: str
    role: str
    organization_id: Optional[str]
    organization_name: Optional[str]
    assigned_truck_id: Optional[str] = None
    token: str

# --- Organization Schemas ---
class OrganizationCreate(BaseModel):
    name: str
    type: str  # FLEET_OPERATOR, SHIPPER

class OrganizationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    name: str
    type: str
    status: str

# --- Truck Schemas ---
class TruckCreate(BaseModel):
    id: str
    organization_id: str
    registration_no: str
    capacity_t: float
    available_t: float
    status: Optional[str] = "AVAILABLE"
    lat: Optional[float] = None
    lng: Optional[float] = None
    origin: Optional[str] = None
    destination: Optional[str] = None
    departure_at: Optional[datetime] = None
    driver_id: Optional[str] = None

class TruckResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    organization_id: str
    registration_no: str
    capacity_t: float
    available_t: float
    status: str
    lat: Optional[float] = None
    lng: Optional[float] = None
    origin: Optional[str] = None
    destination: Optional[str] = None
    departure_at: Optional[datetime] = None
    driver_id: Optional[str] = None

class TruckDepartRequest(BaseModel):
    departure_at: Optional[datetime] = None

# --- Shipment Schemas ---
class ShipmentCreate(BaseModel):
    shipper_id: str
    origin: str
    destination: str
    weight_t: float
    deadline_at: Optional[datetime] = None
    price: Optional[float] = 2500.0
    currency: Optional[str] = "INR"

class ShipmentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    shipper_id: str
    origin: str
    destination: str
    weight_t: float
    deadline_at: Optional[datetime] = None
    status: str
    truck_id: Optional[str] = None
    price: float
    currency: str
    created_at: datetime

# --- Capacity Schemas ---
class CapacityOfferResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    truck_id: str
    registration_no: str
    route: str
    available_t: float
    departure_at: Optional[datetime] = None
    status: str
    price_rule: str
    estimated_cost: Optional[float] = None

class ReserveCapacityRequest(BaseModel):
    shipment_id: str

class ReserveCapacityResponse(BaseModel):
    capacity_offer_id: str
    shipment_id: str
    truck_id: str
    status: str
    message: str

# --- Payment Schemas ---
class PaymentCreateRequest(BaseModel):
    shipment_id: Optional[str] = None
    recovery_plan_id: Optional[str] = None
    amount: float
    currency: Optional[str] = "INR"
    provider: Optional[str] = "Dodo Payments"

class PaymentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    shipment_id: Optional[str] = None
    recovery_plan_id: Optional[str] = None
    provider: str
    amount: float
    currency: str
    status: str
    provider_reference: Optional[str] = None
    checkout_url: Optional[str] = None
    created_at: datetime

class DodoWebhookPayload(BaseModel):
    event_type: str
    payment_id: str
    status: str
    provider_reference: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None

# --- Incident Schemas ---
class IncidentCreate(BaseModel):
    truck_id: str
    type: str  # BREAKDOWN, ACCIDENT, DELAY, etc.
    location: str
    severity: Optional[str] = "HIGH"
    transcript: Optional[str] = None
    structured_summary: Optional[str] = None

class IncidentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    truck_id: str
    type: str
    location: str
    severity: str
    transcript: Optional[str] = None
    structured_summary: Optional[str] = None
    status: str
    created_at: datetime

# --- Recovery Plan Schemas ---
class RecoveryOption(BaseModel):
    truck_id: str
    registration_no: str
    spare_capacity_t: float
    distance_km: float
    eta_minutes: int
    cost: float
    route_compatible: bool
    recommendation_score: float
    reason: str

class RecoveryPlanCreate(BaseModel):
    incident_id: str
    selected_truck_id: Optional[str] = None

class RecoveryPlanResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    incident_id: str
    affected_shipment_ids: List[str]
    options: List[RecoveryOption]
    selected_truck_id: Optional[str] = None
    cost: float
    eta_delta_minutes: int
    status: str
    approved_by: Optional[str] = None
    approved_at: Optional[datetime] = None
    created_at: datetime

class RecoveryApproveRequest(BaseModel):
    selected_truck_id: str
    approved_by: str

class RecoveryExecuteRequest(BaseModel):
    notes: Optional[str] = None

# --- Event and Proof Schemas ---
class EventCreate(BaseModel):
    shipment_id: str
    event_type: str
    payload: Optional[Dict[str, Any]] = None
    actor_type: Optional[str] = "SYSTEM"
    actor_id: Optional[str] = None

class EventResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    shipment_id: str
    event_type: str
    payload: Dict[str, Any]
    actor_type: str
    actor_id: Optional[str] = None
    timestamp: datetime
    hash: str
    blockchain_tx: Optional[str] = None
    proof_status: str

class ProofAnchorRequest(BaseModel):
    shipment_id: str
    event_id: Optional[str] = None

class ProofAnchorResponse(BaseModel):
    hash: str
    blockchain_tx: Optional[str] = None
    proof_status: str  # CONFIRMED or PENDING
    network: str
    contract_address: Optional[str] = None
    verified_at: datetime
    message: str

# ── Live Truck Location Schemas ─────────────────────────────────────────────

class TruckLocationUpdate(BaseModel):
    """Body for POST /trucks/{id}/location"""
    latitude: float    # validated: -90 to 90
    longitude: float   # validated: -180 to 180
    speed_kmph: float = 0.0  # validated: >= 0
    heading: int = 0         # validated: 0 to 360

    from pydantic import field_validator

    @field_validator("latitude")
    @classmethod
    def validate_latitude(cls, v: float) -> float:
        if not (-90 <= v <= 90):
            raise ValueError("latitude must be between -90 and 90")
        return v

    @field_validator("longitude")
    @classmethod
    def validate_longitude(cls, v: float) -> float:
        if not (-180 <= v <= 180):
            raise ValueError("longitude must be between -180 and 180")
        return v

    @field_validator("speed_kmph")
    @classmethod
    def validate_speed(cls, v: float) -> float:
        if v < 0:
            raise ValueError("speed_kmph must be >= 0")
        return v

    @field_validator("heading")
    @classmethod
    def validate_heading(cls, v: int) -> int:
        if not (0 <= v <= 360):
            raise ValueError("heading must be between 0 and 360")
        return v


class TruckLocationResponse(BaseModel):
    """Response for GET /trucks/locations and POST /trucks/{truck_id}/location"""
    model_config = ConfigDict(from_attributes=True)
    id: str
    registration_no: Optional[str] = None
    registration_number: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    speed_kmph: Optional[float] = None
    heading: Optional[int] = None
    location_status: Optional[str] = None
    last_location_update: Optional[datetime] = None
    status: Optional[str] = "ACTIVE"
    origin: Optional[str] = None
    destination: Optional[str] = None
    organization_id: Optional[str] = None

    @classmethod
    def from_truck(cls, truck) -> "TruckLocationResponse":
        effective_status = truck.location_status or truck.status or "ACTIVE"
        return cls(
            id=truck.id,
            registration_no=truck.registration_no,
            registration_number=truck.registration_no,
            latitude=truck.lat,
            longitude=truck.lng,
            speed_kmph=truck.speed_kmph if truck.speed_kmph is not None else 0.0,
            heading=truck.heading if truck.heading is not None else 0,
            location_status=truck.location_status or "ACTIVE",
            last_location_update=truck.last_location_update,
            status=effective_status,
            origin=truck.origin,
            destination=truck.destination,
            organization_id=truck.organization_id,
        )

