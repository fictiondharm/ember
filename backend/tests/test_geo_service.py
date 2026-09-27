from app.services.geo_service import (
    CORRIDOR_ORDER,
    CORRIDOR_NODES,
    canonical_location,
    corridor_index,
    segment_fit,
    distance_km,
)


def test_corridor_places_count_and_order():
    """Verify all 16 corridor places exist in correct geographic order."""
    expected_major = [
        "Bengaluru",
        "Electronic City",
        "Attibele",
        "Hosur",
        "Shoolagiri",
        "Krishnagiri",
        "Bargur",
        "Natrampalli",
        "Vaniyambadi",
        "Ambur",
        "Pallikonda",
        "Vellore",
        "Ranipet",
        "Kanchipuram",
        "Sriperumbudur",
        "Chennai",
    ]
    for place in expected_major:
        assert place in CORRIDOR_ORDER
        assert place in CORRIDOR_NODES

    # Verify Hosur comes BEFORE Krishnagiri (fixing previous bug)
    assert corridor_index("Hosur") < corridor_index("Krishnagiri")
    assert corridor_index("Krishnagiri") < corridor_index("Vellore")
    assert corridor_index("Vellore") < corridor_index("Sriperumbudur")
    assert corridor_index("Sriperumbudur") < corridor_index("Chennai")


def test_canonical_location_aliases():
    """Verify canonical naming normalizes various common casing and alias formats."""
    assert canonical_location("bangalore") == "Bengaluru"
    assert canonical_location("bengaluru") == "Bengaluru"
    assert canonical_location("electronic city") == "Electronic City"
    assert canonical_location("hosur, tamil nadu") == "Hosur"
    assert canonical_location("walajapet") == "Ranipet"
    assert canonical_location("madras") == "Chennai"


def test_segment_fit_exact_and_partial():
    """Verify truck running Bengaluru -> Chennai can serve all intermediate half-route drops."""
    # Exact match
    assert segment_fit("Bengaluru", "Chennai", "Bengaluru", "Chennai") == "EXACT"

    # Partial / Half-routes along corridor
    assert segment_fit("Bengaluru", "Chennai", "Hosur", "Chennai") == "PARTIAL"
    assert segment_fit("Bengaluru", "Chennai", "Electronic City", "Vellore") == "PARTIAL"
    assert segment_fit("Bengaluru", "Chennai", "Krishnagiri", "Sriperumbudur") == "PARTIAL"
    assert segment_fit("Bengaluru", "Chennai", "Ambur", "Chennai") == "PARTIAL"

    # Opposing direction
    assert segment_fit("Bengaluru", "Chennai", "Chennai", "Bengaluru") == "REVERSED"

    # Beyond corridor bounds
    assert segment_fit("Hosur", "Vellore", "Bengaluru", "Chennai") == "NONE"


def test_distance_haversine_accuracy():
    """Verify realistic distances along the corridor."""
    # Bengaluru to Hosur ~ 35-45 km
    b_lat, b_lng = CORRIDOR_NODES["Bengaluru"]["lat"], CORRIDOR_NODES["Bengaluru"]["lng"]
    h_lat, h_lng = CORRIDOR_NODES["Hosur"]["lat"], CORRIDOR_NODES["Hosur"]["lng"]
    c_lat, c_lng = CORRIDOR_NODES["Chennai"]["lat"], CORRIDOR_NODES["Chennai"]["lng"]

    dist_bh = distance_km(b_lat, b_lng, h_lat, h_lng)
    assert 35.0 <= dist_bh <= 45.0

    # Bengaluru to Chennai ~ 280-320 km straight-line
    dist_bc = distance_km(b_lat, b_lng, c_lat, c_lng)
    assert 280.0 <= dist_bc <= 320.0
