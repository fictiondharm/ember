from datetime import datetime, timedelta
from sqlalchemy.orm import Session

from app.models.user import Organization, User, Driver
from app.models.truck import Truck, CapacityOffer
from app.models.shipment import Shipment, ShipmentEvent
from app.models.incident import Incident, RecoveryPlan
from app.models.payment import Payment
from app.models.notification import Notification

def seed_demo_database(db: Session):
    """
    Seeds database with deterministic demo state per PRD Section 17.
    Clears previous dynamic data and initializes Golden Demo baseline.
    """
    # Clear in reverse foreign key order
    db.query(ShipmentEvent).delete()
    db.query(Payment).delete()
    db.query(RecoveryPlan).delete()
    db.query(Incident).delete()
    db.query(Shipment).delete()
    db.query(CapacityOffer).delete()
    db.query(Driver).delete()
    db.query(Truck).delete()
    db.query(User).delete()
    db.query(Organization).delete()
    db.query(Notification).delete()
    db.commit()

    now = datetime.utcnow()
    departure_time = now + timedelta(hours=2)

    # 1. Organizations
    org_fleet_1 = Organization(id="ORG-FLEET-01", name="Apex Fleet Logistics", type="FLEET_OPERATOR", status="ACTIVE")
    org_fleet_2 = Organization(id="ORG-FLEET-02", name="Southern Express Freight", type="FLEET_OPERATOR", status="ACTIVE")
    org_shipper = Organization(id="ORG-SHIP-01", name="ABC Distributors", type="SHIPPER", status="ACTIVE")
    db.add_all([org_fleet_1, org_fleet_2, org_shipper])
    db.commit()

    # 2. Users
    user_op = User(
        id="USR-OPERATOR-01",
        name="Vikram Mehta",
        email="operator@fleetgrid.io",
        role="OPERATOR",
        organization_id="ORG-FLEET-01",
        contact="+91-9876543210"
    )
    user_driver = User(
        id="USR-DRIVER-01",
        name="Ramesh Kumar",
        email="driver@fleetgrid.io",
        role="DRIVER",
        organization_id="ORG-FLEET-01",
        contact="+91-9812345678"
    )
    user_shipper = User(
        id="USR-SHIPPER-01",
        name="Priya Sharma",
        email="shipper@abc.com",
        role="SHIPPER",
        organization_id="ORG-SHIP-01",
        contact="+91-9988776655"
    )
    user_auditor = User(
        id="USR-AUDITOR-01",
        name="Anand Rao (Auditor)",
        email="auditor@fleetgrid.io",
        role="AUDITOR",
        organization_id=None,
        contact="+91-9765432100"
    )
    db.add_all([user_op, user_driver, user_shipper, user_auditor])
    db.commit()

    # 3. Trucks
    # FG-027: 10T truck, Bengaluru -> Chennai, 6.2T loaded, 3.8T spare
    truck_27 = Truck(
        id="FG-027",
        organization_id="ORG-FLEET-01",
        registration_no="KA-01-AK-2027",
        capacity_t=10.0,
        available_t=3.8,
        status="AVAILABLE",
        lat=12.9716,
        lng=77.5946,
        speed_kmph=58.0,
        heading=92,
        location_status="ACTIVE",
        last_location_update=now,
        origin="Bengaluru",
        destination="Chennai",
        departure_at=departure_time,
        driver_id="DRV-001"
    )
    # FG-041: Recovery truck, 3.1T spare, ~8.2 km from Hosur
    truck_41 = Truck(
        id="FG-041",
        organization_id="ORG-FLEET-02",
        registration_no="TN-24-FG-041",
        capacity_t=6.0,
        available_t=3.1,
        status="AVAILABLE",
        lat=12.7600,
        lng=77.8400,
        speed_kmph=46.0,
        heading=105,
        location_status="ACTIVE",
        last_location_update=now,
        origin="Hosur",
        destination="Chennai",
        departure_at=departure_time + timedelta(hours=1),
        driver_id=None
    )
    # FG-052: Recovery truck, 5.0T spare, ~15.8 km from Hosur
    truck_52 = Truck(
        id="FG-052",
        organization_id="ORG-FLEET-02",
        registration_no="KA-51-FG-052",
        capacity_t=10.0,
        available_t=5.0,
        status="AVAILABLE",
        lat=12.7900,
        lng=77.7700,
        speed_kmph=52.0,
        heading=85,
        location_status="ACTIVE",
        last_location_update=now,
        origin="Attibele",
        destination="Chennai",
        departure_at=departure_time + timedelta(hours=1),
        driver_id=None
    )
    db.add_all([truck_27, truck_41, truck_52])
    db.commit()

    # 4. Drivers
    driver_record = Driver(
        id="DRV-001",
        organization_id="ORG-FLEET-01",
        user_id="USR-DRIVER-01",
        assigned_truck_id="FG-027",
        status="AVAILABLE"
    )
    db.add(driver_record)

    # 5. Capacity Offer for FG-027
    offer_27 = CapacityOffer(
        id="CAP-027",
        truck_id="FG-027",
        route="Bengaluru -> Chennai",
        available_t=3.8,
        departure_at=departure_time,
        status="OPEN",
        price_rule="INR 2500 per Ton"
    )
    db.add(offer_27)
    db.commit()

    return {
        "status": "RESET_COMPLETE",
        "message": "Deterministic demo state seeded per PRD Section 17",
        "trucks": ["FG-027", "FG-041", "FG-052"],
        "capacity_offer": "CAP-027 (3.8T spare)",
        "users": ["operator@fleetgrid.io", "driver@fleetgrid.io", "shipper@abc.com", "auditor@fleetgrid.io"]
    }
