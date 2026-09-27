# FleetGrid Authoritative Backend

FleetGrid is an AI-powered logistics network that discovers unused transport capacity and coordinates shipment recovery when logistics breaks.

This backend serves as the authoritative state coordinator, event broadcaster, and validated tool layer for the Control Tower, Driver UI, Business Shipper UI, ElevenLabs voice reporting, and EVM testnet proof anchoring.

---

## Architecture & Tech Stack
- **Framework:** FastAPI (Modular Monolith)
- **Database:** PostgreSQL (Production / Render) with SQLite compatibility (Local Development) via SQLAlchemy 2.0
- **Validation:** Pydantic V2
- **Real-Time Delivery:** WebSockets (`/realtime`)
- **Event Integrity:** Append-only canonical SHA-256 event hashing & EVM testnet proof anchoring
- **Integrations:**
  - **ElevenLabs:** Driver voice incident ingestion & structured parsing
  - **Dodo Payments:** Capacity reservation checkout flow & verified webhooks
  - **EVM Testnet:** Critical event hash anchoring (Status: PENDING when unconfirmed per PRD Rule #7)

---

## Quick Start (Local Development)

### 1. Install Dependencies
```bash
pip install -r requirements.txt
```

### 2. Configure Environment
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```

### 3. Run Development Server
```bash
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

The API docs are available at `http://localhost:8000/docs`.

### 4. Run Test Suite
```bash
python -m pytest tests/ -v
```

---

## API Contract (PRD Section 13)

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/auth/demo-login` | Fast seeded-role login (`OPERATOR`, `DRIVER`, `SHIPPER`, `AUDITOR`) |
| `POST` | `/organizations` | Register organization |
| `POST` | `/trucks` | Register truck |
| `GET` | `/trucks` | List trucks and statuses |
| `POST` | `/trucks/:id/depart` | Driver starts journey (`IN_TRANSIT`) |
| `POST` | `/shipments` | Business creates shipment (`DRAFT`) |
| `GET` | `/shipments` | List shipments |
| `GET` | `/shipments/:id` | Read shipment details |
| `GET` | `/shipments/:id/timeline`| Read immutable canonical SHA-256 event timeline |
| `GET` | `/capacity` | Find compatible open capacity (`origin`, `destination`, `weight_t`) |
| `POST` | `/capacity/:id/reserve` | Reserve truck capacity |
| `POST` | `/payments/create` | Create Dodo payment intent |
| `POST` | `/webhooks/dodo` | Receive Dodo payment webhook (`PAID` -> `CONFIRMED`) |
| `POST` | `/incidents` | Register structured incident (from ElevenLabs or manual) |
| `GET` | `/incidents/:id` | Read incident details |
| `POST` | `/recovery-plans` | Agent generates recovery comparison (`PENDING_APPROVAL`) |
| `POST` | `/recovery-plans/:id/approve` | Operator approval gate (`APPROVED`) |
| `POST` | `/recovery-plans/:id/execute` | Execute recovery (`CARGO_HANDOFF` event + proof anchor) |
| `POST` | `/proof/anchor` | Anchor critical event hash to EVM testnet |
| `POST` | `/demo/reset` | Restore deterministic baseline scenario (FG-027, FG-041, FG-052) |
| `GET` | `/health` | Health check |
| `WS` | `/realtime` | Live WebSocket event stream |

---

## Golden Demo Deterministic Scenario
- **FG-027:** 10T truck, Bengaluru → Chennai, 6.2T loaded, 3.8T spare capacity.
- **FG-041:** Recovery candidate, 3.1T spare, ~8.2 km from Hosur, ~17 min ETA.
- **FG-052:** Secondary candidate, 5.0T spare, ~15.8 km from Hosur, ~26 min ETA.
- **Shipment:** 1T electronics from ABC Distributors (Bengaluru → Chennai).
- **Incident:** Driver voice report near Hosur ("Truck breakdown ho gaya. Hosur ke paas hoon. Engine start nahi ho raha.").
