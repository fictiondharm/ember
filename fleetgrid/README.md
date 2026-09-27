# FleetGrid

Multi-device logistics network demo: one React application, three modes, one authoritative backend.

A shipper books spare capacity, a driver runs the journey and reports a breakdown from a phone, and the
Control Tower analyzes the incident, gets operator approval, and executes a recovery that moves the cargo
to another truck. Every device converges on the same server state within one WebSocket round trip.

---

## Quick start

```bash
npm run install:all     # installs server + web dependencies
npm run dev             # starts the API (4000) and the web app (5173)
```

Open <http://localhost:5173> and pick a mode.

To run the real three-device demo, open the **Network** URL that Vite prints (for example
`http://192.168.1.20:5173`) on three laptops or phones on the same Wi-Fi, and pick a different mode on
each. The web app derives the backend origin from the page hostname, so no configuration is needed when
all devices are on one network. To point at a backend on another machine, set `VITE_API_URL` before
starting the web app (see `.env.example`).

### Demo flow

1. **Business** — search `Bengaluru → Chennai` for `1.2` tonnes, select the **FG-027** offer, create the
   shipment. One server call reserves capacity atomically and confirms: the truck goes `AVAILABLE →
   ASSIGNED` and its spare tonnage drops from 3.8T to 2.6T on every device at once.
2. **Driver** — open on a phone. Start the journey, then report an incident. The truck goes `INCIDENT`
   and the shipment `AT_RISK`.
3. **Control Tower** — analyze the incident, review the deterministic options, approve, then execute. The
   cargo is reassigned, the disabled truck returns to service, and the panel keeps a verified readback of
   the resulting server state.

`npm run reset --prefix server` restores the deterministic seed at any time (server must be running).

---

## Architecture

```
fleetgrid/
  server/                 authoritative backend (Express + ws + Zod)
    src/store/            JSON file collections, atomic writes, mutation mutex
    src/services/         domain logic and state machines
    src/routes/           REST API + endpoint index
    src/seed/             deterministic demo dataset
    test/flow.test.ts     end-to-end suite (133 checks, incl. two WebSocket clients)
  web/                    React + Vite + Tailwind single-page app
    src/store/            snapshot context, refetch-on-event, mode persistence
    src/views/            ControlTower, Business, Driver, RoleSelect
    src/components/       incident/recovery desk, event feed, map, tables
  scripts/                dev runner + reset helper
```

**The server is the only source of truth.** The browser holds no domain state: it fetches `GET /state`
and refetches after any relevant WebSocket event, on reconnect, and on tab focus. The one thing it
stores locally is the selected mode (`localStorage["fleetgrid.mode"]`).

### Realtime

Native `ws` endpoint at `/realtime`. Events: `connected`, `demo.reset`, `truck.updated`,
`driver.updated`, `shipment.created`, `shipment.updated`, `capacity.updated`, `incident.created`,
`incident.updated`, `recovery.updated`, `payment.updated`, `notification.created`, `event.appended`.

Clients treat events as a signal to refetch, never as the new state. That keeps a reconnect or a missed
frame from leaving a device stale.

### Persistence

Server-side JSON files under `server/data/`, written atomically (temp file + rename) and serialized
behind a re-entrant mutex, so concurrent bookings cannot oversell the same tonnage. No database, no
container, no migration step — the seed rebuilds itself when the directory is empty.

---

## State machines

Enforced server-side in `server/src/types.ts`; an illegal transition is a `409`, never a silent write.

- **Truck** `AVAILABLE → ASSIGNED → LOADING → IN_TRANSIT → DELIVERED`, with `DELAYED`, `INCIDENT`, and
  `RECOVERY` branches. Completing a recovery returns the disabled truck to `AVAILABLE` so the demo is
  repeatable without a reset. A truck whose last cargo is delivered also completes.
- **Shipment** `DRAFT → CAPACITY_RESERVED → CONFIRMED → IN_TRANSIT → DELIVERED`, plus `AT_RISK` and
  `RECOVERY`. `DELIVERED` is reached only by the business confirming receipt via
  `POST /shipments/:id/confirm-delivery` — the driver dropping the cargo is not proof of delivery, and
  the client cannot assert it locally. The call is idempotent, so a double tap on two devices is safe.
- **Incident** `OPEN → ANALYZING → PLAN_READY → RESOLVED`, plus `ESCALATED`.
- **Recovery plan** `PENDING_APPROVAL → APPROVED → EXECUTING → COMPLETED`, plus `REJECTED`.

> **Known gap.** Recovery execution leaves the *receiving* truck `ASSIGNED`, and there is no
> `ASSIGNED → DELIVERED` edge in the machine. So confirming delivery on a recovered load delivers the
> shipment but cannot also complete the truck; the response says why in `truckNote` rather than
> inventing the transition.

### Recovery, honestly

Option generation is **deterministic** — distance, ETA, tonnage compatibility, and cost are computed from
server state, and the same inputs always produce the same ranked options. The LLM reasoning layer is
phase 2; the UI says so rather than faking it.

The approval gate cannot be bypassed: executing a plan that is not `APPROVED` returns `409`, and
re-executing a completed plan is idempotent.

Deliberately **not** faked in this phase: payment capture, notification delivery (rows are stored as
`PENDING` and never marked delivered), and blockchain proof anchoring. Both layers fail the same way —
the agent tools *and* the REST routes (`POST /payments/create`, `POST /webhooks/dodo`,
`POST /proof/anchor`) return `501 NOT_IMPLEMENTED` with a reason. The routes validate input first, so a
malformed request is a `400` rather than a misleading `501`, and `POST /proof/anchor` reports the real
event hash with `blockchainTx: null` instead of inventing a transaction.

### Agent tool contract

`GET /agent/tools` returns the readable catalog plus a formal JSON Schema (draft 2020-12) under
`contract`: per-tool input, output, and failure shapes, `$defs` for every entity, and `PLACEHOLDER`
tools that declare a failure shape and no success output. A test asserts the schema and the catalog
never drift on names, order, or status, and that every `$ref` resolves.

---

## Seeded data

Two organizations (ABC Distributors as shipper, FleetGrid Logistics as operator), six users, three
drivers, three trucks on the Bengaluru → Chennai corridor, and two delivered historical shipments.

| Truck  | Capacity | Seeded spare | Driver            |
| ------ | -------- | ------------ | ----------------- |
| FG-027 | 5.0T     | 3.8T         | Ravi Kumar        |
| FG-041 | 5.0T     | 3.1T         | Imran Sheikh      |
| FG-052 | 8.0T     | 5.0T         | Suresh Naidu      |

> **Deviation from the Master PRD.** Master PRD §17 lists FG-027 as 10T with 8.8T spare. The direct task
> brief specified 5.0T capacity and 3.8T spare so the driver screen shows those exact figures, and the
> seed follows the brief. This is called out in `server/src/seed/seed.ts`.

---

## Scripts

| Command                                | Does                                              |
| -------------------------------------- | ------------------------------------------------- |
| `npm run install:all`                  | Install both packages                             |
| `npm run dev`                          | Run API + web together (Ctrl+C stops both)        |
| `npm run dev:server` / `npm run dev:web` | Run one side only                               |
| `npm run typecheck`                    | Typecheck both packages                           |
| `npm test`                             | Backend end-to-end suite                          |
| `npm run build --prefix server`        | Compile the server to `server/dist`               |
| `npm run build --prefix web`           | Production web build into `web/dist`              |
| `npm run reset --prefix server`        | Restore the demo seed (server must be running)    |

### Testing

`npm test` boots the real server on a spare port and exercises the golden flow over HTTP and two
independent WebSocket clients: seed integrity, capacity search, oversell rejection, atomic reservation,
departure, incident creation, recovery options, the approval gate (including a bypass attempt that must
fail), execution, idempotent re-execution, timeline, delivery confirmation, the honesty of
the unwired integration routes, the published tool contract, and reset. 133 checks, no
mocking of business rules.

---

## Configuration

Copy `.env.example` to `.env`. Every value has a working default, so an empty file behaves identically.
Server: `PORT`, `HOST`, `DATA_DIR`, `CORS_ORIGIN`, `WS_HEARTBEAT_MS`, `AUTO_SEED`.
Web: `VITE_API_URL`.

## Known limits

- Single-process server with file storage. Fine for the demo; a real deployment wants Postgres plus a
  shared pub/sub so multiple instances broadcast the same events.
- No authentication. `POST /auth/demo-login` selects a seeded role; device mode is a demo affordance.
- Cost, ETA, and distance numbers are demo estimates, labelled as such in the UI.
