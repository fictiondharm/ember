"""
geo_service.py — Deterministic Corridor Geography & Multi-Stop Route Matching

Defines all intermediate places along the Bengaluru -> Chennai freight corridor (NH 44 / NH 48),
calculates segment fits for partial routes (half-route booking), and provides proximity calculations.
"""

import math
from typing import Optional, Tuple, Dict, Any, List

# True physical order along NH 44 / NH 48 from Bengaluru to Chennai Port
CORRIDOR_ORDER: List[str] = [
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

# Physical GPS coordinates and progress fraction (0.00 to 1.00)
CORRIDOR_NODES: Dict[str, Dict[str, Any]] = {
    "Bengaluru": {"lat": 12.9716, "lng": 77.5946, "progress": 0.00},
    "Electronic City": {"lat": 12.8452, "lng": 77.6602, "progress": 0.08},
    "Attibele": {"lat": 12.7783, "lng": 77.7712, "progress": 0.14},
    "Hosur": {"lat": 12.7409, "lng": 77.8253, "progress": 0.20},
    "Shoolagiri": {"lat": 12.6658, "lng": 78.0121, "progress": 0.28},
    "Krishnagiri": {"lat": 12.5186, "lng": 78.2138, "progress": 0.36},
    "Bargur": {"lat": 12.5442, "lng": 78.3615, "progress": 0.43},
    "Natrampalli": {"lat": 12.6074, "lng": 78.5303, "progress": 0.49},
    "Vaniyambadi": {"lat": 12.6825, "lng": 78.6200, "progress": 0.55},
    "Ambur": {"lat": 12.7904, "lng": 78.7166, "progress": 0.61},
    "Pallikonda": {"lat": 12.8751, "lng": 78.9329, "progress": 0.68},
    "Vellore": {"lat": 12.9165, "lng": 79.1325, "progress": 0.75},
    "Ranipet": {"lat": 12.9304, "lng": 79.3621, "progress": 0.81},
    "Kanchipuram": {"lat": 12.8342, "lng": 79.7036, "progress": 0.88},
    "Sriperumbudur": {"lat": 12.9675, "lng": 79.9439, "progress": 0.94},
    "Chennai": {"lat": 13.0827, "lng": 80.2707, "progress": 1.00},
}

LOCATION_ALIASES: Dict[str, str] = {
    "bengaluru": "Bengaluru",
    "bangalore": "Bengaluru",
    "electronic city": "Electronic City",
    "attibele": "Attibele",
    "hosur": "Hosur",
    "hosur, tamil nadu": "Hosur",
    "new hosur": "Hosur",
    "shoolagiri": "Shoolagiri",
    "krishnagiri": "Krishnagiri",
    "bargur": "Bargur",
    "natrampalli": "Natrampalli",
    "vaniyambadi": "Vaniyambadi",
    "ambur": "Ambur",
    "pallikonda": "Pallikonda",
    "vellore": "Vellore",
    "ranipet": "Ranipet",
    "walajapet": "Ranipet",
    "kanchipuram": "Kanchipuram",
    "sriperumbudur": "Sriperumbudur",
    "poonamallee": "Chennai",
    "chennai": "Chennai",
    "madras": "Chennai",
    "nellore": "Nellore",
    "tiruppur": "Tiruppur",
}


def canonical_location(raw: Optional[str]) -> str:
    if not raw:
        return ""
    key = raw.strip().lower()
    return LOCATION_ALIASES.get(key, raw.strip())


def corridor_index(city: Optional[str]) -> Optional[int]:
    name = canonical_location(city)
    try:
        return CORRIDOR_ORDER.index(name)
    except ValueError:
        return None


def segment_fit(
    truck_origin: Optional[str],
    truck_dest: Optional[str],
    ship_origin: Optional[str],
    ship_dest: Optional[str],
) -> str:
    """
    Evaluates whether a truck running `truck_origin -> truck_dest` can carry
    a shipment requiring `ship_origin -> ship_dest`.

    Returns:
        "EXACT"    - Direct identical lane
        "PARTIAL"  - Truck route encompasses the shipment segment (half-route / intermediate drop)
        "REVERSED" - Opposing direction
        "NONE"     - Incompatible or off-corridor
    """
    t_from = corridor_index(truck_origin)
    t_to = corridor_index(truck_dest)
    s_from = corridor_index(ship_origin)
    s_to = corridor_index(ship_dest)

    # If any location is off the corridor, require exact match
    if None in (t_from, t_to, s_from, s_to):
        if canonical_location(truck_origin) == canonical_location(ship_origin) and \
           canonical_location(truck_dest) == canonical_location(ship_dest):
            return "EXACT"
        return "NONE"

    # Opposite directions
    if (t_from > t_to and s_from < s_to) or (t_from < t_to and s_from > s_to):
        return "REVERSED"

    # Forward direction along corridor
    if t_from <= s_from and t_to >= s_to:
        if t_from == s_from and t_to == s_to:
            return "EXACT"
        return "PARTIAL"

    return "NONE"


def distance_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Haversine distance in km between two coordinate pairs."""
    r = 6371.0
    d_lat = math.radians(lat2 - lat1)
    d_lon = math.radians(lon2 - lon1)
    a = (math.sin(d_lat / 2.0) ** 2 +
         math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(d_lon / 2.0) ** 2)
    c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))
    return round(r * c, 1)
