# FleetGrid — Shared Team Context

This document maintains shared architecture decisions and team contracts across backend, frontend, and logistics engineers.

---

## Live Truck Tracking — Current Architecture

The FleetGrid frontend now uses Google Maps for truck visualization.

Architecture:

```text
React/Vite
   ↓
FastAPI REST/WebSocket
   ↓
PostgreSQL
   ↓
Truck location state
```

Google Maps is only the visualization layer.

Current endpoints:
- `GET /trucks/locations`
- `POST /trucks/{truck_id}/location`
- `WS /ws/tracking`

Frontend environment variable:
- `VITE_GOOGLE_MAPS_API_KEY`

Important:
- Frontend never connects directly to PostgreSQL.
- Backend is the authoritative source of truck location state.
- WebSocket is used for live updates.
- Demo truck IDs: `FG-027`, `FG-041`, `FG-052`.

---

## Team Action Required

Frontend members:
- Integrate with the tracking API/WebSocket.
- Do not create hardcoded truck-location logic.

Backend members:
- Treat the FastAPI location endpoints as the source of truth.
- Do not create a second tracking API.

Other members:
- Build new features on top of the existing truck/backend architecture.
- Do not replace the map implementation with another mapping stack without discussing it with the team.
