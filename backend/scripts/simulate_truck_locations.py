"""
simulate_truck_locations.py — FleetGrid Development Location Simulator

DEVELOPMENT / DEMO ONLY: Simulates realistic GPS telemetry for demo trucks
(FG-027, FG-041, FG-052) along the Bengaluru -> Hosur -> Krishnagiri -> Vellore -> Chennai freight corridor.

Posts telemetry to: POST /trucks/{truck_id}/location every ~3 seconds.
FastAPI persists coordinates to the database and broadcasts live updates over /ws/tracking.

Usage:
    python backend/scripts/simulate_truck_locations.py
    python backend/scripts/simulate_truck_locations.py --base-url http://localhost:8000 --interval 2.5
    python backend/scripts/simulate_truck_locations.py --once
"""

import math
import sys
import time
import argparse
import urllib.request
import json
from typing import List, Tuple

# Bengaluru -> Hosur -> Krishnagiri -> Vellore -> Chennai waypoints (lat, lng)
CORRIDOR_WAYPOINTS: List[Tuple[float, float]] = [
    (12.9716, 77.5946),  # Bengaluru Central
    (12.9180, 77.6250),  # Silk Board
    (12.8452, 77.6602),  # Electronic City
    (12.7783, 77.7712),  # Attibele
    (12.7409, 77.8253),  # Hosur
    (12.6658, 78.0121),  # Shoolagiri
    (12.5186, 78.2138),  # Krishnagiri
    (12.5442, 78.3615),  # Bargur
    (12.6074, 78.5303),  # Natrampalli
    (12.7904, 78.7166),  # Ambur
    (12.8751, 78.9329),  # Pallikonda
    (12.9165, 79.1325),  # Vellore
    (12.9304, 79.3621),  # Walajapet
    (12.8342, 79.7036),  # Kanchipuram bypass
    (12.9675, 79.9439),  # Sriperumbudur
    (13.0475, 80.0890),  # Poonamallee
    (13.0674, 80.2376),  # Chennai Port
]


def calculate_heading(lat1: float, lon1: float, lat2: float, lon2: float) -> int:
    """Calculate compass heading in degrees (0-360) between two coordinates."""
    d_lon = math.radians(lon2 - lon1)
    y = math.sin(d_lon) * math.cos(math.radians(lat2))
    x = (math.cos(math.radians(lat1)) * math.sin(math.radians(lat2)) -
         math.sin(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.cos(d_lon))
    bearing = math.atan2(y, x)
    degrees = (math.degrees(bearing) + 360) % 360
    return int(round(degrees))


def interpolate_position(waypoints: List[Tuple[float, float]], progress: float) -> Tuple[float, float, int]:
    """
    Interpolate position along waypoint path based on progress fraction [0.0, 1.0].
    Returns (lat, lng, heading).
    """
    total_segments = len(waypoints) - 1
    scaled = progress * total_segments
    seg_idx = int(scaled)
    frac = scaled - seg_idx

    if seg_idx >= total_segments:
        seg_idx = total_segments - 1
        frac = 1.0

    p1 = waypoints[seg_idx]
    p2 = waypoints[seg_idx + 1]

    lat = p1[0] + (p2[0] - p1[0]) * frac
    lng = p1[1] + (p2[1] - p1[1]) * frac
    heading = calculate_heading(p1[0], p1[1], p2[0], p2[1])

    return lat, lng, heading


class DemoTruckSim:
    def __init__(self, truck_id: str, speed_kmph: float, start_progress: float, speed_jitter: float = 2.0):
        self.truck_id = truck_id
        self.base_speed = speed_kmph
        self.progress = start_progress
        self.speed_jitter = speed_jitter
        self.direction = 1  # 1 for forward, -1 for reverse loop

    def tick(self, interval_seconds: float) -> dict:
        # Total corridor approx 350 km
        # Fraction per hour = speed / 350
        # Fraction per tick = (speed / 350) * (interval / 3600)
        speed = self.base_speed + (math.sin(time.time() / 10.0) * self.speed_jitter)
        step = (speed / 350.0) * (interval_seconds / 3600.0) * 12.0  # demo acceleration factor: 12x

        self.progress += step * self.direction
        if self.progress >= 0.98:
            self.direction = -1
        elif self.progress <= 0.02:
            self.direction = 1

        waypoints = CORRIDOR_WAYPOINTS if self.direction == 1 else list(reversed(CORRIDOR_WAYPOINTS))
        normalized_progress = self.progress if self.direction == 1 else (1.0 - self.progress)
        lat, lng, heading = interpolate_position(waypoints, normalized_progress)

        return {
            "truck_id": self.truck_id,
            "latitude": round(lat, 6),
            "longitude": round(lng, 6),
            "speed_kmph": round(max(speed, 0.0), 1),
            "heading": heading,
        }


def post_location(base_url: str, payload: dict) -> bool:
    truck_id = payload["truck_id"]
    url = f"{base_url.rstrip('/')}/trucks/{truck_id}/location"
    body = json.dumps({
        "latitude": payload["latitude"],
        "longitude": payload["longitude"],
        "speed_kmph": payload["speed_kmph"],
        "heading": payload["heading"]
    }).encode("utf-8")

    req = urllib.request.Request(
        url,
        data=body,
        headers={"Content-Type": "application/json"},
        method="POST"
    )
    try:
        with urllib.request.urlopen(req, timeout=5) as resp:
            return resp.status == 200
    except Exception as e:
        print(f"   [Error] Failed to post {truck_id}: {e}")
        return False


def main():
    parser = argparse.ArgumentParser(description="FleetGrid Live Truck Location Telemetry Simulator")
    parser.add_argument("--base-url", default="http://localhost:8000", help="FastAPI backend URL")
    parser.add_argument("--interval", type=float, default=3.0, help="Telemetric push interval in seconds")
    parser.add_argument("--once", action="store_true", help="Run a single update tick and exit")
    args = parser.parse_args()

    print("=" * 65)
    print(" 🚛 FleetGrid Live Truck Location Simulator (Dev/Demo Only)")
    print(f" Target Backend: {args.base_url}")
    print(f" Push Interval : {args.interval}s")
    print(" Trucks        : FG-027, FG-041, FG-052")
    print(" Corridor      : Bengaluru -> Hosur -> Krishnagiri -> Chennai")
    print("=" * 65)

    sims = [
        DemoTruckSim("FG-027", speed_kmph=58.0, start_progress=0.08),  # Near Bengaluru/Hosur border
        DemoTruckSim("FG-041", speed_kmph=46.0, start_progress=0.28),  # Near Hosur/Krishnagiri
        DemoTruckSim("FG-052", speed_kmph=52.0, start_progress=0.45),  # Between Krishnagiri & Vellore
    ]

    tick_count = 0
    try:
        while True:
            tick_count += 1
            print(f"\n[Tick #{tick_count}] Telemetry push at {time.strftime('%H:%M:%S')}:")
            for sim in sims:
                data = sim.tick(args.interval)
                success = post_location(args.base_url, data)
                status_icon = "✅" if success else "❌"
                print(
                    f"  {status_icon} {data['truck_id']}: "
                    f"Lat {data['latitude']:.4f}, Lng {data['longitude']:.4f} | "
                    f"{data['speed_kmph']} km/h | Heading {data['heading']}°"
                )

            if args.once:
                print("\n[Done] One-shot execution complete.")
                break

            time.sleep(args.interval)
    except KeyboardInterrupt:
        print("\n[Stopped] Simulator halted by user.")


if __name__ == "__main__":
    main()
