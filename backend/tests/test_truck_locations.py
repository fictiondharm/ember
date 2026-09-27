import json
import pytest
from fastapi.testclient import TestClient
from app.main import app

def test_get_truck_locations(client: TestClient):
    """Test GET /trucks/locations returns all seeded trucks with valid location coordinates."""
    response = client.get("/trucks/locations")
    assert response.status_code == 200
    trucks = response.json()
    assert isinstance(trucks, list)
    assert len(trucks) >= 3

    truck_ids = [t["id"] for t in trucks]
    assert "FG-027" in truck_ids
    assert "FG-041" in truck_ids
    assert "FG-052" in truck_ids

    fg27 = next(t for t in trucks if t["id"] == "FG-027")
    assert fg27["latitude"] == pytest.approx(12.9716, rel=1e-3)
    assert fg27["longitude"] == pytest.approx(77.5946, rel=1e-3)
    assert fg27["speed_kmph"] == pytest.approx(58.0, rel=1e-1)
    assert fg27["heading"] == 92
    assert fg27["status"] == "ACTIVE"
    assert fg27["registration_number"] is not None
    assert fg27["registration_no"] is not None


def test_post_truck_location_valid(client: TestClient):
    """Test POST /trucks/{truck_id}/location updates location and returns updated record."""
    payload = {
        "latitude": 12.9782,
        "longitude": 77.6031,
        "speed_kmph": 61.5,
        "heading": 95
    }
    response = client.post("/trucks/FG-027/location", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["id"] == "FG-027"
    assert data["latitude"] == pytest.approx(12.9782, rel=1e-3)
    assert data["longitude"] == pytest.approx(77.6031, rel=1e-3)
    assert data["speed_kmph"] == pytest.approx(61.5, rel=1e-1)
    assert data["heading"] == 95
    assert data["status"] == "ACTIVE"
    assert data["location_status"] == "ACTIVE"
    assert data["last_location_update"] is not None

    # Verify GET returns updated data
    get_res = client.get("/trucks/locations")
    assert get_res.status_code == 200
    fg27 = next(t for t in get_res.json() if t["id"] == "FG-027")
    assert fg27["latitude"] == pytest.approx(12.9782, rel=1e-3)
    assert fg27["speed_kmph"] == pytest.approx(61.5, rel=1e-1)


def test_post_truck_location_invalid_latitude(client: TestClient):
    """Test validation fails for latitude < -90 or > 90."""
    res_high = client.post("/trucks/FG-027/location", json={"latitude": 95.0, "longitude": 77.0})
    assert res_high.status_code == 422

    res_low = client.post("/trucks/FG-027/location", json={"latitude": -91.0, "longitude": 77.0})
    assert res_low.status_code == 422


def test_post_truck_location_invalid_longitude(client: TestClient):
    """Test validation fails for longitude < -180 or > 180."""
    res_high = client.post("/trucks/FG-027/location", json={"latitude": 12.0, "longitude": 185.0})
    assert res_high.status_code == 422

    res_low = client.post("/trucks/FG-027/location", json={"latitude": 12.0, "longitude": -185.0})
    assert res_low.status_code == 422


def test_post_truck_location_invalid_speed_and_heading(client: TestClient):
    """Test validation fails for speed < 0 and heading > 360."""
    res_speed = client.post("/trucks/FG-027/location", json={
        "latitude": 12.0,
        "longitude": 77.0,
        "speed_kmph": -5.0
    })
    assert res_speed.status_code == 422

    res_heading = client.post("/trucks/FG-027/location", json={
        "latitude": 12.0,
        "longitude": 77.0,
        "heading": 365
    })
    assert res_heading.status_code == 422


def test_post_truck_location_not_found(client: TestClient):
    """Test 404 returned for unknown truck ID."""
    res = client.post("/trucks/UNKNOWN-999/location", json={
        "latitude": 12.0,
        "longitude": 77.0,
        "speed_kmph": 50.0,
        "heading": 90
    })
    assert res.status_code == 404


def test_websocket_tracking_broadcast(client: TestClient):
    """Test WebSocket /ws/tracking receives TRUCK_LOCATION_UPDATE on location POST."""
    with client.websocket_connect("/ws/tracking") as ws:
        # First message is connection acknowledgment
        conn_msg = ws.receive_json()
        assert conn_msg.get("type") == "connected"

        # Update truck location via REST
        res = client.post("/trucks/FG-041/location", json={
            "latitude": 12.7650,
            "longitude": 77.8450,
            "speed_kmph": 55.0,
            "heading": 110
        })
        assert res.status_code == 200

        # Receive WebSocket broadcast
        broadcast = ws.receive_json()
        assert broadcast["type"] == "TRUCK_LOCATION_UPDATE"
        assert broadcast["truck_id"] == "FG-041"
        assert broadcast["latitude"] == pytest.approx(12.7650, rel=1e-3)
        assert broadcast["longitude"] == pytest.approx(77.8450, rel=1e-3)
        assert broadcast["speed_kmph"] == pytest.approx(55.0, rel=1e-1)
        assert broadcast["heading"] == 110
        assert broadcast["status"] == "ACTIVE"
        assert "timestamp" in broadcast
