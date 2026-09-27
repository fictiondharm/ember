# FleetGrid — Agent Instructions

## 1. Project Identity

Project name: FleetGrid

FleetGrid is an AI-powered shared intelligence and operations network for commercial fleets.

It is not primarily a generic truck-booking application. The core product is a shared operational layer where connected commercial vehicles contribute real-time intelligence and that intelligence improves freight dispatch, routing, safety, sustainability, and delivery verification.

Core product promise:

> Turn real-time fleet information into better operational decisions.

The product continuously answers:

- What is moving?
- What is happening on the road?
- Which vehicle should handle this shipment?
- Which route should be used?
- What is the cost, ETA, and estimated CO₂e?
- What should change when road conditions change?
- Is a driver potentially in danger?
- Can the delivery record be verified afterward?

This repository is the existing Ember project on the `drame` branch. Extend the existing codebase; do not replace or rewrite the project architecture blindly.

---

## 2. Mandatory First Step

Before writing or changing code:

1. Inspect the existing repository structure.
2. Identify the current frontend framework, backend framework, database, routing/map integration, authentication, and package manager.
3. Identify reusable components, services, utilities, API clients, and existing design-system code.
4. Read `DESIGN.md` before implementing frontend UI.
5. Preserve working existing functionality unless the new FleetGrid requirements explicitly require a change.
6. Prefer incremental changes over large rewrites.

If the repository's current stack differs from the preferred stack below, adapt to the existing stack unless there is a strong technical reason to migrate.

---

## 3. Product Architecture

FleetGrid consists of connected subsystems:

- Fleet Control Center
- Shipment and Dispatch
- AI Decision Layer
- Road Intelligence Network
- Dynamic Routing
- Green Dispatch
- Driver Safety / SOS
- Telegram Driver Agent
- ElevenLabs Voice Copilot
- Digital Proof of Delivery
- Blockchain PoD verification
- Analytics
- Authentication and RBAC
- Realtime telemetry/event system

These are not separate mini-apps. They must share application state, domain models, APIs, and events.

Core event chain:

Road/vehicle event
→ FleetGrid event layer
→ impact analysis
→ dispatch/routing decision
→ notification
→ operational action

Delivery chain:

Shipment
→ assigned vehicle
→ route
→ delivery
→ PoD capture
→ PoD hash
→ blockchain anchoring
→ verification

Safety chain:

Driver
→ SOS / possible incident
→ location
→ safety event
→ Fleet Control Center
→ escalation
→ resolution

---

## 4. Existing Codebase Rule

The repository is the source of truth for implementation.

Do not assume files, folders, components, services, or libraries exist.

Search before creating duplicates.

Before adding a dependency:

- check whether an equivalent dependency already exists;
- prefer existing project conventions;
- add only what is genuinely needed.

Do not create duplicate authentication, API-client, modal, table, toast, map, or state-management systems when one already exists.

---

## 5. Preferred Technical Direction

Use the repository's existing choices where practical.

Preferred direction if compatible:

### Frontend
- Next.js
- React
- TypeScript
- Tailwind CSS
- accessible component primitives
- realtime UI updates
- responsive dashboard

### Backend
- FastAPI
- Python
- Pydantic
- async I/O

### Database
- PostgreSQL
- migration-based schema changes

### Realtime
- WebSockets or equivalent event/realtime system

### AI
- LLM with structured outputs and tool/function calling

### Messaging
- Telegram Bot API

### Voice
- ElevenLabs Voice/Agents/Speech APIs

### Mapping
- a real map/routing provider compatible with the current project

### Blockchain
- Solidity / EVM testnet for PoD integrity anchoring

### Storage
- secure off-chain object storage for PoD evidence

Use alternatives only when required by the existing Ember architecture or project constraints.

---

## 6. Engineering Skills / Specialist Instructions

Use the appropriate specialist skill when available.

Planning and architecture:
- @brainstorming
- @nerdzao-elite
- @software-architecture
- @architecture
- @database-design

Frontend:
- @frontend-dev-guidelines
- @nextjs-app-router-patterns
- @nextjs-best-practices
- @react-ui-patterns
- @frontend-ui-dark-ts
- @tailwind-design-system
- @radix-ui-design-system

Backend:
- FastAPI specialist skill if available
- @async-python-patterns
- @pydantic-models-py
- @api-design-principles
- @api-patterns

AI:
- @ai-engineer
- @ai-agents-architect
- @llm-application-dev-ai-assistant
- @prompt-engineering-patterns
- @llm-evaluation

Telegram:
- @telegram-bot-builder

Testing:
- @testing-patterns
- @e2e-testing-patterns
- Playwright/browser testing skill if available

Security:
- @auth-implementation-patterns
- @api-security-best-practices
- @backend-security-coder
- @frontend-security-coder

Blockchain:
- blockchain development skill if available
- Solidity security skill if available
- Web3 testing skill if available

Observability:
- @observability-engineer
- @error-handling-patterns

Use the closest available skill when a named skill is unavailable.

---

## 7. Frontend Rules

Read `DESIGN.md` before every major frontend implementation.

Treat `DESIGN.md` as the visual source of truth.

FleetGrid should feel like a high-end fleet operations command center:

- dark
- technical
- information-dense
- calm
- trustworthy
- precise
- responsive
- accessible

Do not create a generic admin dashboard.

Do not copy Linear branding, logos, or proprietary assets.

Use the provided Linear-inspired system as a design foundation and FleetGrid-specific semantics defined in `DESIGN.md`.

Every interactive component must implement appropriate:
- default
- hover
- focus
- active
- disabled
- loading
- error
- success
states.

Do not rely on color alone to communicate meaning.

Critical emergency actions must remain obvious and accessible.

---

## 8. Primary Frontend Surfaces

Build or extend these surfaces as appropriate to the current repository:

- Login / authentication
- Fleet Control Center
- Live Fleet Map
- Shipments
- Shipment Details
- Dispatch
- Vehicles
- Vehicle Details
- Incidents
- Incident Details
- Routing / Route Comparison
- Green Optimization
- Safety / SOS
- PoD / verification
- Analytics
- Settings / organization

The Fleet Control Center is the primary operational surface.

---

## 9. Fleet Control Center

The main dashboard should provide:

- active trucks
- active shipments
- active incidents
- SOS alerts
- at-risk shipments
- emissions summary
- live map
- incident feed
- shipment feed
- route recommendations

Use real API/realtime data when implemented.

Do not hardcode values into production views.

Seed/demo data may be used for local development, but it must come through the same service/data path as realistic application state.

---

## 10. Live Map

The map is a product surface, not decoration.

Support:

- truck markers
- shipment markers
- road incidents
- hazards
- SOS markers
- charging/refuelling points where available
- route overlays

Clicking a truck should expose:
- vehicle
- driver reference
- shipment
- speed
- ETA
- capacity remaining
- powertrain
- route
- nearby incidents

Protect driver location according to RBAC and privacy requirements.

---

## 11. Shipment and Dispatch

Shipment fields should support:

- origin
- destination
- weight
- volume
- cargo type
- deadline
- priority
- vehicle restrictions
- optimization preference

Optimization modes:

- Cheapest
- Fastest
- Lowest estimated CO₂e
- Balanced

Dispatch considers:

- capacity
- current vehicle location
- available capacity
- current route
- deadline
- vehicle type
- powertrain
- range
- road restrictions
- incidents

Never let an LLM invent the actual dispatch result.

LLM may interpret requests and explain recommendations. Deterministic application services must perform the actual feasibility and optimization calculations.

---

## 12. Smart Consolidation

Support matching multiple compatible shipments into one vehicle when feasible.

Check:
- route compatibility
- pickup windows
- delivery deadlines
- capacity
- cargo compatibility

Explain estimated effects on:
- cost
- emissions
- utilization

---

## 13. Green Dispatch

Do not build only a carbon calculator.

CO₂e is one optimization input.

Feasibility comes first.

A lower-emission vehicle must not be selected if:
- capacity is insufficient;
- deadline cannot be met;
- range is inadequate;
- charging/refuelling is infeasible;
- route restrictions make it unsuitable.

Show transparent comparisons:
- cost
- ETA
- estimated CO₂e
- reason for selection

Use terminology such as "estimated CO₂e" rather than claiming exact emissions.

---

## 14. Dynamic Routing

Routing may change while a trip is active.

Consider:
- road incidents
- traffic
- restrictions
- vehicle size
- vehicle powertrain
- range
- charging/refuelling
- delivery deadline
- route deviation
- cost
- estimated CO₂e

When rerouting, show:
- original route
- alternatives
- ETA change
- cost change
- estimated CO₂e change
- reason for recommendation

---

## 15. Road Intelligence Network

Drivers can report:
- accident
- road closure
- congestion
- flooding
- construction
- truck restriction
- broken road
- low clearance
- other hazard

Incident records should contain:
- ID
- type
- severity
- location
- timestamp
- reporter
- vehicle reference
- optional evidence
- direction
- status
- confidence
- expiration

Do not assume a single report is automatically true.

---

## 16. Incident Confidence

Incident confidence can increase from:
- multiple reports
- confirmations
- telemetry supporting the event
- trusted external data if integrated
- evidence

Confidence must decrease with age and contradictory reports.

Display confidence clearly.

Support:
- confirmation
- resolution
- expiration

Do not leave stale incidents permanently active.

---

## 17. Telemetry-Based Road Intelligence

Aggregate telemetry can detect unusual patterns.

Example:
- multiple trucks slow to near-zero speed at the same area.

Treat this as a possible disruption, not proof of an accident.

Use driver confirmation to turn a possible event into a structured incident.

---

## 18. Fleet Impact Analysis

When an incident is created:

1. find affected active routes;
2. find affected trucks;
3. find affected shipments;
4. identify deadline risk;
5. propose alternative routes.

Expose:
- number of affected trucks
- number of affected shipments
- deadline-risk count
- reroute recommendation

---

## 19. Driver Safety / SOS

Support:
- assistance
- medical
- SOS

SOS should capture:
- driver
- truck
- shipment
- current location
- timestamp
- relevant telemetry snapshot

Notify authorized Fleet Control personnel.

Do not expose emergency location data to unauthorized users.

Possible incident detection may use telemetry anomalies, but call them "possible incidents" unless explicitly confirmed.

---

## 20. Telegram Driver Agent

Telegram is the driver/shipper lightweight operational interface.

Support:
- shipment creation
- assignments
- trip status
- incident reporting
- SOS
- route updates
- PoD submission
- basic help

Telegram handlers should call domain services.

Do not put core business logic inside Telegram handlers.

---

## 21. ElevenLabs Voice Copilot

ElevenLabs is the voice interface, not the source of truth.

Voice assistant can support:
- report incident
- ask ETA
- ask about nearby road hazards
- request reroute
- ask for greenest feasible route
- ask charging/refuelling information
- trigger SOS
- submit delivery state

Recommended tool pattern:

Voice input
→ intent/parameters
→ validated FleetGrid tool
→ backend/domain service
→ result
→ voice response

Useful tools may include:
- get_current_location
- get_trip_status
- get_nearby_incidents
- report_incident
- calculate_route
- request_reroute
- get_vehicle_status
- trigger_sos
- find_charging_station
- submit_pod
- verify_pod

For safety-critical actions, use deliberate confirmation where appropriate.

Do not allow the voice model to perform arbitrary privileged actions.

---

## 22. Digital PoD

Capture:
- delivery photo
- receiver confirmation/signature
- delivered quantity where applicable
- GPS
- timestamp
- shipment ID

Store the actual evidence off-chain.

---

## 23. Blockchain PoD

Use blockchain only for integrity/audit anchoring.

Do NOT store:
- live GPS streams
- private driver data
- large photos
- sensitive documents

on-chain.

Preferred flow:

PoD evidence
→ canonical payload
→ SHA-256 hash
→ blockchain transaction
→ transaction reference stored in database

Verification:

current evidence
→ hash
→ compare against anchored hash

Result:
- verified
- mismatch
- pending/unavailable

Important:
Blockchain verifies integrity of the recorded digital evidence. It does not independently prove the physical-world event was truthful.

---

## 24. AI Safety / Reliability Rules

AI must use structured outputs.

Validate all AI-generated fields before domain actions.

Do not let AI directly:
- change database records without validation;
- bypass authorization;
- calculate authoritative routing;
- invent prices;
- invent emissions;
- declare accidents with certainty;
- resolve SOS events without authorized workflow.

Business rules must remain deterministic and testable.

---

## 25. Authentication and RBAC

Support role-aware access for at least:

- Driver
- Dispatcher
- Fleet Manager
- Shipper
- Administrator

Check permissions server-side.

Never rely only on frontend hiding.

---

## 26. Data Model

Prefer relational entities such as:

- users
- organizations
- drivers
- vehicles
- shipments
- trips
- incidents
- incident_confirmations
- telemetry
- sos_events
- pod_records
- notifications
- audit_logs

Use:
- foreign keys
- indexes
- constraints
- migrations
- timestamps
- appropriate status enums

Do not use in-memory data for critical persistent state.

---

## 27. Realtime

Use WebSockets or existing realtime capabilities to propagate:
- truck movement
- incident creation
- incident confirmation
- incident resolution
- SOS events
- shipment status
- route updates
- notifications

Avoid polling when the existing architecture supports true realtime updates.

---

## 28. API Design

Use clear REST or existing project API conventions.

Keep controllers thin.

Move business rules into services/domain modules.

Validate requests with typed schemas.

Provide consistent:
- success responses
- validation errors
- authorization errors
- not-found errors
- server errors

---

## 29. Security

Protect:
- vehicle locations
- driver identity
- SOS data
- shipment data
- PoD evidence
- blockchain credentials
- API keys
- Telegram credentials
- ElevenLabs credentials

Never commit secrets.

Use environment variables/secret management.

Validate uploaded files.

Rate-limit sensitive endpoints.

Log security-relevant events.

---

## 30. Testing

Write tests alongside implementation.

At minimum test:

### Unit
- dispatch feasibility
- truck matching
- consolidation
- CO₂e calculations
- incident confidence
- incident expiry
- route feasibility
- SOS state transitions
- PoD hashing

### Integration
- authentication
- shipment API
- vehicle API
- incident API
- Telegram webhook
- PoD service
- blockchain service

### E2E
- login
- create shipment
- match vehicle
- assign vehicle
- report incident
- confirm incident
- reroute
- trigger SOS
- submit PoD
- verify PoD

---

## 31. Error Handling

Every async flow must have:
- loading
- success
- error
- retry
- empty
- disabled states

Never show false success.

Never silently swallow errors.

---

## 32. Seed / Demo Environment

Maintain realistic synthetic data for local development.

Include:
- multiple fleets
- multiple vehicles
- drivers
- shipments
- incidents
- different powertrains
- active routes
- at least one SOS event
- sample PoDs

Use synthetic data only.

---

## 33. Demo Mode

A demo mode may simulate:
- vehicle movement
- congestion
- accident
- road closure
- incident confirmation
- rerouting
- SOS
- delivery
- PoD blockchain anchoring

The demo must exercise real application logic rather than fake UI-only transitions.

---

## 34. Performance

Avoid unnecessary:
- rerenders
- map redraws
- API requests
- database queries
- AI calls

Debounce high-frequency location updates where appropriate.

Do not send unnecessary telemetry to the frontend.

Use pagination/virtualization for large operational lists.

---

## 35. Accessibility

Follow WCAG-conscious practices.

Ensure:
- keyboard navigation
- visible focus
- sufficient contrast
- semantic labels
- accessible dialogs
- accessible forms
- non-color-only status indicators
- adequate mobile tap targets

SOS must be especially clear and accessible.

---

## 36. Documentation

Keep project documentation current.

At minimum:
- README
- architecture documentation
- environment setup
- API documentation
- database setup
- Telegram setup
- ElevenLabs setup
- blockchain setup
- testing
- deployment

Document important architecture decisions.

---

## 37. Implementation Workflow

Follow this sequence:

### Phase 1
Inspect existing Ember repository and current architecture.

### Phase 2
Write/update implementation architecture.

### Phase 3
Read and apply `DESIGN.md`.

### Phase 4
Build/repair shared frontend foundation.

### Phase 5
Build/repair backend foundation.

### Phase 6
Connect database and API.

### Phase 7
Implement fleet dashboard and map.

### Phase 8
Implement shipment + dispatch + green optimization.

### Phase 9
Implement road intelligence + dynamic rerouting.

### Phase 10
Implement SOS and safety.

### Phase 11
Implement Telegram.

### Phase 12
Implement ElevenLabs Voice Copilot.

### Phase 13
Implement PoD + blockchain verification.

### Phase 14
Testing/security/observability.

### Phase 15
Final visual QA and end-to-end validation.

Do not stop after planning. Continue into implementation.

---

## 38. Definition of Done

A feature is not done merely because:
- code compiles;
- a screen exists;
- a mock response appears.

A feature is done when:
- UI works;
- API works;
- data persists;
- errors are handled;
- loading states exist;
- authorization is correct;
- tests exist;
- integration works;
- visual design follows `DESIGN.md`.

---

## 39. Final Product Principle

Every feature should answer:

> Does this help FleetGrid turn real-time fleet information into a better operational decision?

If yes, implement it coherently.

If not, avoid feature creep.

The final experience should feel like one integrated commercial fleet operating system:
dispatch + road intelligence + routing + green optimization + safety + voice + delivery trust.
