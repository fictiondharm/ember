def test_golden_demo_end_to_end(client):
    """
    Simulates the exact Golden Demo Scenario from Master PRD Section 6:
    1. ABC Distributors needs 1T from Bengaluru to Chennai.
    2. FG-027 has 3.8T spare capacity.
    3. Business creates 1T shipment.
    4. Business discovers FG-027 and reserves capacity.
    5. Dodo payment completes flow.
    6. Driver departs -> IN_TRANSIT.
    7. Driver reports Hosur breakdown via ElevenLabs voice.
    8. Incident registered -> Truck INCIDENT, Shipment AT_RISK.
    9. Agent identifies options (FG-041, FG-052) and creates RecoveryPlan (PENDING_APPROVAL).
    10. Operator approves recovery with FG-041.
    11. Recovery executes -> cargo reassigned, handoff event + proof status PENDING.
    12. Shipment timeline verified.
    """
    # Step 1: Demo Login
    auth_resp = client.post("/auth/demo-login", json={"role": "SHIPPER"})
    assert auth_resp.status_code == 200
    auth_data = auth_resp.json()
    assert auth_data["role"] == "SHIPPER"
    shipper_org = auth_data["organization_id"]

    # Step 2: Create 1T Shipment
    shp_resp = client.post("/shipments", json={
        "shipper_id": shipper_org,
        "origin": "Bengaluru",
        "destination": "Chennai",
        "weight_t": 1.0,
        "price": 2500.0,
        "currency": "INR"
    })
    assert shp_resp.status_code == 200
    shipment = shp_resp.json()
    shipment_id = shipment["id"]
    assert shipment["status"] == "DRAFT"

    # Step 3: Find Compatible Open Capacity
    cap_resp = client.get("/capacity", params={"origin": "Bengaluru", "destination": "Chennai", "weight_t": 1.0})
    assert cap_resp.status_code == 200
    offers = cap_resp.json()
    assert len(offers) >= 1
    target_offer = next(o for o in offers if o["truck_id"] == "FG-027")
    assert target_offer["available_t"] == 3.8

    # Step 4: Reserve Capacity on FG-027
    res_resp = client.post(f"/capacity/{target_offer['id']}/reserve", json={"shipment_id": shipment_id})
    assert res_resp.status_code == 200
    res_data = res_resp.json()
    assert res_data["status"] == "CAPACITY_RESERVED"

    # Verify truck capacity updated
    truck_resp = client.get("/trucks/FG-027")
    assert truck_resp.status_code == 200
    assert truck_resp.json()["available_t"] == 2.8

    # Step 5: Dodo Payment Flow
    pay_create_resp = client.post("/payments/create", json={
        "shipment_id": shipment_id,
        "amount": 2500.0,
        "currency": "INR"
    })
    assert pay_create_resp.status_code == 200
    payment_id = pay_create_resp.json()["id"]

    # Webhook triggers successful payment
    webhook_resp = client.post("/webhooks/dodo", json={
        "event_type": "payment.succeeded",
        "payment_id": payment_id,
        "status": "PAID",
        "provider_reference": "dodo_tx_test_123"
    })
    assert webhook_resp.status_code == 200
    assert webhook_resp.json()["payment_status"] == "PAID"

    # Verify shipment is now CONFIRMED
    shp_verify = client.get(f"/shipments/{shipment_id}")
    assert shp_verify.json()["status"] == "CONFIRMED"

    # Step 6: Driver Departs
    depart_resp = client.post("/trucks/FG-027/depart", json={})
    assert depart_resp.status_code == 200
    assert depart_resp.json()["status"] == "IN_TRANSIT"

    shp_intransit = client.get(f"/shipments/{shipment_id}")
    assert shp_intransit.json()["status"] == "IN_TRANSIT"

    # Step 7: Driver Reports Breakdown near Hosur (ElevenLabs Voice Transcript)
    voice_transcript = "Truck breakdown ho gaya. Hosur ke paas hoon. Engine start nahi ho raha."
    inc_resp = client.post("/incidents", json={
        "truck_id": "FG-027",
        "type": "ENGINE_BREAKDOWN",
        "location": "Near Hosur, NH 44",
        "severity": "HIGH",
        "transcript": voice_transcript
    })
    assert inc_resp.status_code == 200
    incident_id = inc_resp.json()["id"]

    # Step 8: Verify Truck is in INCIDENT, Shipment is AT_RISK
    truck_inc = client.get("/trucks/FG-027")
    assert truck_inc.json()["status"] == "INCIDENT"

    shp_at_risk = client.get(f"/shipments/{shipment_id}")
    assert shp_at_risk.json()["status"] == "AT_RISK"

    # Step 9: Agent has automatically created Recovery Plan
    plans_resp = client.get("/recovery-plans")
    assert plans_resp.status_code == 200
    plans = plans_resp.json()
    assert len(plans) >= 1
    plan = next(p for p in plans if p["incident_id"] == incident_id)
    assert plan["status"] == "PENDING_APPROVAL"
    assert len(plan["options"]) >= 2  # FG-041 and FG-052
    
    # Verify option comparison: FG-041 is ranked top (17 min arrival)
    assert plan["options"][0]["truck_id"] == "FG-041"
    assert plan["options"][0]["eta_minutes"] == 17

    # Step 10: Operator Approves Recovery Plan with FG-041
    approve_resp = client.post(f"/recovery-plans/{plan['id']}/approve", json={
        "selected_truck_id": "FG-041",
        "approved_by": "USR-OPERATOR-01"
    })
    assert approve_resp.status_code == 200
    assert approve_resp.json()["status"] == "APPROVED"

    # Step 11: Execute Recovery Plan
    exec_resp = client.post(f"/recovery-plans/{plan['id']}/execute", json={})
    assert exec_resp.status_code == 200
    exec_data = exec_resp.json()
    assert exec_data["status"] == "COMPLETED"
    assert exec_data["replacement_truck_id"] == "FG-041"

    # Step 12: Verify Reassigned State
    shp_recovered = client.get(f"/shipments/{shipment_id}")
    assert shp_recovered.json()["truck_id"] == "FG-041"
    assert shp_recovered.json()["status"] == "IN_TRANSIT"

    # Verify FG-041 capacity reduced from 3.1T to 2.1T
    truck_41 = client.get("/trucks/FG-041")
    assert truck_41.json()["available_t"] == 2.1

    # Step 13: Read Timeline and Proof Status
    timeline_resp = client.get(f"/shipments/{shipment_id}/timeline")
    assert timeline_resp.status_code == 200
    events = timeline_resp.json()
    event_types = [e["event_type"] for e in events]
    assert "SHIPMENT_CREATED" in event_types
    assert "CAPACITY_RESERVED" in event_types
    assert "PAYMENT_COMPLETED" in event_types
    assert "JOURNEY_STARTED" in event_types
    assert "INCIDENT_DETECTED" in event_types
    assert "CARGO_HANDOFF" in event_types

    # Ensure all events have canonical 64-char SHA-256 hashes
    for e in events:
        assert len(e["hash"]) == 64
        # Rule 7: Never fake confirmation
        assert e["proof_status"] in ["PENDING", "CONFIRMED"]

    # Step 14: Demo Reset restores pristine state
    reset_resp = client.post("/demo/reset")
    assert reset_resp.status_code == 200
    assert reset_resp.json()["status"] == "RESET_COMPLETE"

    # Verify FG-027 back to 3.8T spare
    fresh_truck = client.get("/trucks/FG-027")
    assert fresh_truck.json()["available_t"] == 3.8
    assert fresh_truck.json()["status"] == "AVAILABLE"
