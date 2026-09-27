# FleetGrid

**AI-powered self-healing logistics network + controlled shared-capacity network**
EmberGround AI Hackathon 2026 — Bharat Infra track (logistics / transport / supply chains)

Built with **FastAPI · PostgreSQL (Render) / SQLite · SQLAlchemy 2.0 · Alembic · WebSockets · React + Vite · Google Maps**.

---

## What FleetGrid Does

1. **Uses empty space.** A truck travelling with spare capacity publishes compatible capacity; a business finds it, reserves it, pays, and the shipment moves.
2. **Heals the network.** A breakdown is reported (voice or text), the agent identifies the affected shipment, finds replacement capacity, produces a structured recovery plan, a human approves it, and recovery executes with full event proof.
3. **Visualizes live telemetry.** Live GPS telemetry streams via WebSockets into an interactive Google Maps layer with heading-oriented truck markers along the Bengaluru → Hosur → Krishnagiri → Vellore → Chennai freight corridor.

---

## Architecture Overview

```text
                 +---------------------------------------------+
                 |              React / Vite UI                |
                 | (Control Tower · Driver · Business · Maps)  |
                 +----------------------+----------------------+
                                        | REST / WS
                                        v
                 +---------------------------------------------+
                 |              FastAPI Backend                |
                 |  State Machines · Recovery Agent · Auth     |
                 +----------------------+----------------------+
                                        |
                 +----------------------+----------------------+
                 |          PostgreSQL (Render) / SQLite       |
                 |         SQLAlchemy 2.0 + Alembic Migrations |
                 +---------------------------------------------+
```

---

## Quickstart

### 1. Authoritative Backend (FastAPI + PostgreSQL / SQLite)

Requires Python 3.11+:

```bash
cd backend

# Install dependencies
pip install -r requirements.txt

# Run migrations (defaults to local SQLite if DATABASE_URL is not set)
alembic upgrade head

# Seed deterministic demo state
python setup_db.py --seed

# Start the backend server
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

* **Health Check**: `http://localhost:8000/health`
* **Interactive Docs**: `http://localhost:8000/docs`
* **Locations API**: `http://localhost:8000/trucks/locations`
* **Live WebSocket**: `ws://localhost:8000/ws/tracking`

#### Run Tests
```bash
cd backend
python -m pytest tests/ -v
```

---

### 2. Frontend Dashboards

#### A. FleetGrid Multi-Role Web Dashboard (`fleetgrid/web`)
```bash
cd fleetgrid/web
npm install
npm run dev
# Open http://localhost:5173
```

#### B. Live Google Maps Telemetry Tracking (`frontend`)
```bash
cd frontend
npm install
npm run dev
# Open http://localhost:5173
```

#### C. Run Live Corridor Telemetry Simulator (Dev Only)
```bash
python backend/scripts/simulate_truck_locations.py --interval 2.5
```

---

## Render Deployment (PostgreSQL + Web Service)

Deploy the authoritative backend to Render using the included `render.yaml` blueprint:

1. In Render Dashboard: **New → Blueprint**
2. Connect this repository
3. Render automatically creates:
   * **`fleetgrid-db`**: Render Managed PostgreSQL
   * **`fleetgrid-backend`**: Python Web Service with automatic migration on start (`alembic upgrade head && uvicorn app.main:app`)

---

## Golden Demo Scenario

The seeded scenario models the Bengaluru → Hosur → Krishnagiri → Vellore → Chennai freight corridor:

| Truck | Status | Capacity | Spare | Route |
|:---|:---|:---|:---|:---|
| **FG-027** | AVAILABLE / IN_TRANSIT | 10.0T | 3.8T | Bengaluru → Chennai |
| **FG-041** | AVAILABLE (Recovery) | 6.0T | 3.1T | Hosur → Chennai |
| **FG-052** | AVAILABLE (Recovery) | 10.0T | 5.0T | Attibele → Chennai |

Demo login endpoint: `POST /auth/demo-login` with `{"role": "OPERATOR"}` (or `SHIPPER`, `DRIVER`, `AUDITOR`).
