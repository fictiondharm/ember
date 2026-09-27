# FleetGrid

**AI-powered self-healing logistics network + controlled shared-capacity network**
EmberGround AI Hackathon 2026 — Bharat Infra track (logistics / transport / supply chains)

FleetGrid does two things:

1. **Uses empty space.** A truck travelling with spare capacity publishes compatible
   capacity; a business finds it, reserves it, pays, and the shipment moves.
2. **Heals the network.** A breakdown is reported (voice or text), the agent identifies
   the affected shipment, finds replacement capacity, produces a structured recovery
   plan, a human approves it, and recovery executes with full event proof.

The goal was never maximum feature count — it was **one complete, reliable,
shared-state workflow** that three laptops can watch at once.

---

## Status: honest summary

The **core shared-state workflow is complete and tested end to end.**
What is **not** done is the layer of third-party integrations and cloud
infrastructure around it. Nothing is faked: every unfinished integration returns an
explicit error or a labelled placeholder rather than a fabricated success.

| Area | State |
| --- | --- |
| Golden demo flow (book → depart → breakdown → plan → approve → recover → deliver) | **Done** |
| Authoritative backend, all state machines, atomic capacity, idempotent recovery | **Done** |
| Realtime convergence across 3 concurrent clients | **Done** |
| Control Tower / Business / Driver UIs | **Done** |
| Agent tools + approval gate + event log | **Done** (11 of 13 tools) |
| Deterministic seed / reset | **Done** |
| Automated test suite | **Done** — 85 backend checks, 30 browser checks |
| PostgreSQL (schema + migrations) | **Not done** — JSON file store instead |
| Dodo Payments | **Not done** — endpoint returns honest 501 |
| ElevenLabs voice | **Not done** — text incident path is complete |
| Blockchain anchoring | **Not done** — hashes real, `proofStatus` stays `NOT_ANCHORED` |
| Render deployment | **Not done** — runs locally only |

---

## What is done

### Backend / data (the authoritative layer)
- Express + TypeScript API, backend is the single source of truth for all state.
- Full entity set from Master PRD §10: users, organizations, trucks, drivers,
  shipments, capacity offers, incidents, recovery plans, payments, shipment events,
  notifications.
- State machines enforced server-side (truck, shipment, payment, recovery plan, incident).
- **Atomic capacity reservation** — a mutex plus in-transaction capacity re-check
  prevents two businesses from claiming the same spare tonnage.
- **Idempotent recovery execution** — replaying `execute` never double-moves cargo.
- **Approval gate** — `execute_recovery` rejects any plan that is not `APPROVED`.
- Append-only `ShipmentEvent` log, SHA-256 hashed per event.
- Every important state change emits a realtime event *after* commit.
- Deterministic seed and `POST /demo/reset` restore the exact starting scenario.
- 85-check end-to-end test suite (`server/test/flow.test.ts`), passing.

### Agent layer
- 13 tools declared in the Master PRD contract; **11 fully implemented**,
  2 explicit placeholders (`create_payment_intent`, `anchor_proof`).
- Tools are the only mutation path; read tools return authoritative backend data.
- Recovery reasoning is **deterministic and explainable** — operational facts
  (`3.1T spare, ~17 min arrival, compatible Chennai route`), not hidden chain-of-thought.
- Returns at least two candidates when seeded data supports it (FG-041 and FG-052).
- Executes only after human approval, then **verifies resulting state via a read tool**.
- Works with no external model, so the demo cannot break on a provider outage.

### Frontend
- Three role views — **Business / Shipper**, **Driver**, **Control Tower**.
- Realtime subscription with a visible connection indicator; on reconnect the client
  refetches authoritative state rather than trusting local state.
- No frontend-only state decisions: every visible status comes from the backend.
- Control Tower: fleet view, active shipments/trucks, incident + recovery panel,
  agent activity timeline, prominent **Approve Recovery** only when approval is
  actually available, and a proof panel that reports status honestly.
- Driver: identity, truck, route, capacity, Start Journey, incident report with
  transcript confirmation, recovery instruction, cargo handoff confirmation.
- Business: create shipment, capacity results, reserve, payment status, tracking,
  revised ETA, disruption/recovery notifications.
- Responsive down to 390px with no horizontal overflow (verified).

### Known-good behaviour worth calling out
- A truck that completes recovery returns to `AVAILABLE` rather than being stranded
  in `RECOVERY`, and its driver returns to `AVAILABLE`.
- The Control Tower recovery receipt **persists** after execution and survives a
  page reload, instead of vanishing on the state change that completed it.
- `/demo/reset` returns the whole system to a byte-identical starting state.

---

## What is left to do

Ordered by what unblocks the most PRD criteria.

### 1. PostgreSQL — the largest genuine gap
Master PRD §8 specifies `PostgreSQL`, §10 defines the core schema, and the Backend
workstream acceptance criterion is *"fresh database migrates successfully."*

Current state: a typed JSON file store (`server/src/store/jsonStore.ts`) with atomic
writes and a mutex. It behaves correctly and the whole app runs on it, but **there are
no migrations and no SQL schema**, so that acceptance criterion is not met.

To do: write migrations for the 11 entities, add a repository layer behind the existing
service APIs, keep the JSON store as a zero-config fallback, and verify a fresh
database migrates and seeds cleanly.

### 2. Payments (Dodo)
`POST /payments/create` and `POST /webhooks/dodo` return an explicit
`501` with a message naming the missing integration.

To do: one simple capacity-reservation product/price path, backend-created intent,
idempotent webhook handling, and shipment confirmation only after the backend verifies
payment state. The frontend must never be able to mark itself paid — that rule is
already enforced.

### 3. Voice (ElevenLabs)
The **text incident path is complete and tested**, which is the required fallback.

To do: ElevenLabs conversational agent that extracts `incident_type`, location, and
severity from mixed English/Hinglish, confirms understanding, and posts the structured
incident to the backend. Must be idempotent on repeated webhook delivery, and must not
claim success when the incident did not persist.

### 4. Blockchain proof
Events are already SHA-256 hashed. `POST /proof/anchor` returns an honest error and
`proofStatus` remains `NOT_ANCHORED`.

To do: anchor a critical event hash on an EVM testnet, store the transaction reference,
and flip status through `PENDING` → `CONFIRMED`/`FAILED`. **Never display a fabricated
transaction hash** — that is an explicit non-negotiable in the contract.

### 5. Render deployment
To do: deploy frontend + API publicly, provision managed PostgreSQL, set secrets as
environment variables, and verify three separate laptops hit the same environment.

### 6. Smaller gaps
- `get_route_options` returns deterministic estimates, not a real routing provider.
  Distances/ETAs are labelled demo estimates.
- The map is a schematic route visual, deliberately not a fragile map animation.
- Business "confirm delivery" is not yet a button in the UI.

---

## PRD coverage, file by file

Source of truth: `FleetGrid_PRD_Pack/01_FleetGrid_Master_PRD.docx`.

### `00_CODING_AGENT_CONTRACT.txt` — **followed**
Backend authoritative; tools-only mutation; approval gate on recovery; event per state
change; fallbacks for external dependencies; no faked blockchain confirmation; no
secrets in source; golden demo still working; smallest consistent implementation with
assumptions documented.

### `01_FleetGrid_Master_PRD.docx` — **mostly done**
- §6 Golden demo — **done**, except the payment and blockchain steps are placeholders.
- §7 State machines — **done** for all five entities.
- §8 Architecture — **partial**: realtime + agent layer done; PostgreSQL and Render not.
- §9 Backend authority rules — **done**.
- §10 Core database schema — **entities done, SQL schema not**.
- §11 Agent tools — **11 of 13 done**, 2 honest placeholders.
- §12 Agent decision policy — **done** (deterministic, explainable).
- §13 API contract — **most endpoints done**; `/payments/create`, `/webhooks/dodo`,
  `/proof/anchor` are explicit 501s.
- §14 Three-laptop UX — **done**, verified with three concurrent browser clients.
- §15 Realtime contract — **done**.
- §16 Sponsor integrations — **not done** (all four are the remaining work).
- §17 Deterministic demo data — **done** (FG-027 / FG-041 / FG-052 as specified).
- §18 Demo safety — **done** (idempotency keys, honest loading/pending states).
- §19 Definition of Done — **13 of 19 items done**; the 6 open items are payment,
  ElevenLabs, blockchain anchoring, Render deployment, shared persistent database,
  and delivery confirmation.

### `02_Agent_1_Product_Agent_PRD.docx` — **substantially done**
Input/output schemas, tool contracts, incident → impact → capacity → comparison →
plan workflow, human approval gate, execution verification, readable event log, and
deterministic fallback recovery are all implemented and covered by the acceptance
criteria. Remaining: the tool contract table is not yet exported as a formal
JSON-schema artifact, and there is no LLM narrative layer (the PRD explicitly permits
deterministic option generation, so this is a quality upgrade, not a gap).

### `03_Agent_2_Backend_Data_PRD.docx` — **8 of 9 acceptance criteria done**
Done: entities and fields, state transitions, all core APIs, atomic reservation,
frontend cannot force payment success, events after commit, realtime push, seed and
reset, health endpoint.
**Not done: "fresh database migrates successfully"** — no PostgreSQL, no migrations.

### `04_Agent_3_Frontend_PRD.docx` — **done, with two partials**
Role selection, Business dashboard, create shipment, capacity results, shipment
tracking, Control Tower overview, incident detail, agent activity timeline, recovery
options, and approval confirmation are all present, with realtime rules honoured
(events refetch authoritative state; connection status shown; reconnect refetches).
Two partials: **payment status** is a labelled placeholder rather than a live Dodo
status, and the **proof panel** shows the real hash and an honest
`NOT_ANCHORED` status instead of a confirmed transaction.

### `05_Agent_4_Voice_Integrations_PRD.docx` — **UI done, ElevenLabs not done**
Driver identity/truck/route/capacity, Start Journey, transcript and incident
confirmation, recovery instruction, cargo handoff confirmation, and the required
**text fallback** all work. Not done: the ElevenLabs conversation contract, agent ID
and webhook documentation, and mixed English/Hinglish extraction.

### `06_Agent_5_Payments_Infra_Proof_PRD.docx` — **structure only, no live integrations**
The payment state machine and proof fields exist and are honest, but there is no Dodo
sandbox, no Render deployment, and no testnet anchoring. The PRD's fallback
requirement is satisfied: unavailable providers degrade to clearly labelled
placeholders instead of blocking the demo. The critical remaining criterion is that
**no fake transaction hash is ever displayed** — currently guaranteed by
construction, since `anchor_proof` throws rather than inventing a hash.

---

## Running it

Requires Node 20+.

```bash
git clone https://github.com/fictiondharm/em.git
cd em/fleetgrid
npm install
npm install --prefix server
npm install --prefix web
npm run dev
```

Or, from the repo root, `npm --prefix fleetgrid run dev`.

- Web: <http://localhost:5173>
- API: <http://localhost:4000>
- Realtime: `ws://localhost:4000/realtime`
- Health: <http://localhost:4000/health>

### Other scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Starts API and web together with prefixed logs |
| `npm run reset` | Restores the deterministic demo state |
| `npm test --prefix server` | Runs the 85-check backend suite |
| `npm run typecheck --prefix server` | Server typecheck |
| `npm run typecheck --prefix web` | Web typecheck |
| `npm run build --prefix web` | Production web build |

### The demo, in order

The seeded scenario has truck **FG-027** with 3.8T spare on Bengaluru → Chennai.

1. **Business** — create a 1T Bengaluru → Chennai shipment, see FG-027 as compatible
   capacity, reserve it.
2. **Driver** — start the journey; shipment goes `IN_TRANSIT`.
3. **Driver** — report the Hosur engine breakdown (text path today).
4. **Control Tower** — incident appears with no refresh. The agent identifies the
   affected shipment and proposes FG-041 and FG-052 with capacity, ETA and cost.
5. **Control Tower** — approve the plan, then execute recovery.
6. **All three** — the replacement truck is assigned, the handoff is recorded, the
   business sees the revised ETA, and the event timeline shows hashed proof.

Open the three roles in **three separate browser windows** to see shared realtime
state. `npm run reset` puts everything back to the start.

---

## Project layout

```
fleetgrid/
  server/            Express + TypeScript API (authoritative)
    src/store/       JSON persistence (swap target for PostgreSQL)
    src/services/    Business logic: capacity, incidents, recovery, agent tools
    src/routes/      REST endpoints + WebSocket upgrade
    src/seed/        Deterministic demo data
    test/            End-to-end suite
  web/               React + Vite frontend
    src/views/       Business, Driver, ControlTower, RoleSelect
    src/components/  IncidentPanel, ShipmentTable, NetworkMap, EventFeed
    src/store/       FleetContext — authoritative snapshot + realtime sync
  scripts/           dev.mjs, reset.mjs
FleetGrid_PRD_Pack/  The specification this was built against
```

## Known limitations

- **No PostgreSQL.** JSON file store with atomic writes and a mutex. Correct for a
  single-process demo, not multi-instance.
- **No payment, voice, or blockchain provider is connected.** All three return honest
  errors or labelled placeholders.
- **Not deployed.** Runs locally; no public URL yet.
- **Route estimates are deterministic demo values**, not a routing provider.
- **Auth is demo-role login only** — seeded users, no passwords or sessions. The Master
  PRD specifies only `POST /auth/demo-login` and explicitly excludes production KYC, so
  this is in scope; real signup is not.
- Agent reasoning is deterministic by design, so demo output is stable and explainable.

## License

Hackathon project — internal demo use.
