# FleetGrid Logistics Network

Authoritative backend and agent coordination engine for the FleetGrid Logistics Network hackathon project.

Built with **FastAPI · SQLAlchemy 2.0 · Alembic · Pydantic V2 · PostgreSQL (Render) / SQLite (local)**.

---

## Local Development

### Prerequisites

- Python 3.11+
- No database installation required (SQLite is used by default)

### Setup

```bash
cd backend

# 1. Install dependencies
pip install -r requirements.txt

# 2. Copy environment template
cp .env.example .env
# .env defaults to SQLite — no changes needed for local dev

# 3. Run database migrations
alembic upgrade head

# 4. Start the server
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

### Verify

| URL | Description |
|-----|-------------|
| `http://localhost:8000/health` | Health check + DB status |
| `http://localhost:8000/docs` | Interactive API documentation |
| `http://localhost:8000/` | Service root |

### Running Tests

```bash
cd backend
python -m pytest tests/ -v
```

---

## Render Deployment (PostgreSQL)

### Architecture

```
GitHub → Render Web Service (FastAPI + Uvicorn)
                  ↓
         Render PostgreSQL
```

`DATABASE_URL` is the single source of truth.
Render injects it automatically from the managed PostgreSQL instance — no credentials in code.

---

### Option A — Blueprint (render.yaml) — Recommended

The `render.yaml` in the repository root creates both resources in one click.

1. In Render dashboard: **New → Blueprint**
2. Connect your GitHub repository
3. Render detects `render.yaml` and shows a preview of resources to create
4. Click **Apply** — Render creates PostgreSQL + Web Service and wires `DATABASE_URL` automatically
5. Set the required secret environment variables (see below)
6. First deploy runs `alembic upgrade head` then starts uvicorn

---

### Option B — Manual Setup

#### Step 1 — Create PostgreSQL Database

1. Render dashboard → **New → PostgreSQL**
2. Name: `fleetgrid-db`
3. Database name: `fleetgrid`
4. Plan: Free (or Starter for production SLA)
5. Click **Create Database**
6. Copy the **Internal Database URL** for use in Step 3

#### Step 2 — Create Web Service

1. Render dashboard → **New → Web Service**
2. Connect your GitHub repository
3. Settings:

| Field | Value |
|-------|-------|
| **Root Directory** | `backend` |
| **Runtime** | Python |
| **Build Command** | `pip install -r requirements.txt` |
| **Start Command** | `alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port $PORT` |
| **Health Check Path** | `/health` |

#### Step 3 — Environment Variables

In **Environment → Environment Variables**, set:

| Variable | Value / Notes |
|----------|---------------|
| `DATABASE_URL` | Paste the **Internal Database URL** from your Render PostgreSQL → auto-set if using Blueprint |
| `ENVIRONMENT` | `production` |
| `CORS_ORIGINS` | Your frontend URL(s), e.g. `https://fleetgrid-ui.onrender.com` |
| `ELEVENLABS_API_KEY` | From ElevenLabs dashboard |
| `ELEVENLABS_VOICE_ID` | ElevenLabs voice ID |
| `ELEVENLABS_AGENT_ID` | ElevenLabs agent ID |
| `DODO_PAYMENTS_API_KEY` | From Dodo Payments dashboard |
| `DODO_WEBHOOK_SECRET` | Dodo webhook secret |
| `EVM_RPC_URL` | RPC URL for Sepolia / Polygon Amoy |
| `EVM_PRIVATE_KEY` | Wallet private key (testnet only) |
| `EVM_PROOF_CONTRACT_ADDRESS` | Deployed proof contract address |

> **Security:** Never commit real values to source code. All third-party keys must be set via Render dashboard only.

#### Step 4 — Deploy

1. Click **Manual Deploy → Deploy latest commit**
2. Watch the deploy logs — you should see:
   ```
   INFO  [alembic.runtime.migration] Running upgrade -> 439315a1cb2f, initial_schema
   INFO:     Uvicorn running on http://0.0.0.0:10000
   ```
3. On first deploy the app auto-seeds the Golden Demo data (FG-027, FG-041, FG-052)

#### Step 5 — Verify

```bash
# Health check
curl https://YOUR-SERVICE.onrender.com/health

# Expected response:
# {"status": "HEALTHY", "database": {"type": "PostgreSQL", "connected": true}, ...}

# Interactive docs
open https://YOUR-SERVICE.onrender.com/docs
```

#### Step 6 — Run Migrations (after schema changes)

Migrations run automatically on every deploy via the start command.

To run manually via Render Shell:
```bash
alembic upgrade head
```

---

## Database Management (Local)

```bash
cd backend

# Check connectivity
python setup_db.py --check

# Run migrations
python setup_db.py --migrate

# Seed demo data
python setup_db.py --seed

# Full reset (drop all tables, migrate, seed)
python setup_db.py --reset

# Full setup (check + migrate + seed)
python setup_db.py --all

# Generate a new migration after model changes
python setup_db.py --gen-migration "add_shipment_eta"
```

---

## Project Structure

```
backend/
├── app/
│   ├── config.py          # Settings from environment variables
│   ├── database.py        # SQLAlchemy engine + session factory
│   ├── main.py            # FastAPI app, CORS, lifespan, router mounts
│   ├── models/            # SQLAlchemy ORM models
│   ├── routers/           # API route handlers
│   ├── schemas/           # Pydantic request/response schemas
│   ├── services/          # Business logic (agent, event hashing, proof, etc.)
│   └── utils/             # Shared utilities (time helpers)
├── migrations/            # Alembic migration environment
│   └── versions/          # Migration scripts
├── tests/                 # Integration + unit test suite
├── .env.example           # Environment template (safe to commit)
├── alembic.ini            # Alembic configuration
├── requirements.txt       # Python dependencies
└── setup_db.py            # Database management CLI
render.yaml                # Render Blueprint (PostgreSQL + Web Service)
```

---

## Architecture Constraints (PRD Non-Negotiables)

1. **Backend is authoritative** — all state mutations go through the API
4. **Human approval gate** — recovery plans require operator approval before execution
7. **Never fake blockchain confirmation** — `proof_status` remains `PENDING` until confirmed on-chain
8. **No secrets in source code** — all credentials via environment variables only

---

## Golden Demo Scenario

On first startup after migration, the app seeds the Bengaluru–Chennai route scenario:

| Truck | Status | Capacity |
|-------|--------|----------|
| FG-027 | EN_ROUTE | 5T (3.8T available) |
| FG-041 | AVAILABLE | 8T |
| FG-052 | AVAILABLE | 10T |

Demo login endpoint: `POST /auth/demo-login` with `{"role": "OPERATOR"}` (or `SHIPPER`, `DRIVER`, `AUDITOR`)