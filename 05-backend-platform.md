# FleetGrid Skill: Backend / Platform Engineering

## Mission
Provide the central APIs and event-processing layer that connects Telegram, AI, routing, fleet state, blockchain, and the web dashboard.

## Suggested Stack
- FastAPI
- PostgreSQL
- Redis (optional)
- WebSockets
- Background workers
- JWT/auth where required

## Core Services
### Shipment Service
- Create/update shipment
- Validate fields
- Track status

### Fleet Service
- Vehicle registry
- Driver assignment
- Availability
- Capacity

### Incident Service
- Create/confirm/resolve incident
- Confidence updates
- Expiration

### Dispatch Service
- Request recommendations
- Persist dispatch decision
- Trigger reroute

### Safety Service
- SOS
- Acknowledgements
- Escalation

### Proof Service
- PoD upload metadata
- Hash generation
- Blockchain anchor

### Reputation Service
- Rating submission
- Validation
- Aggregation
- On-chain anchoring

## Suggested Tables
- users
- drivers
- fleets
- vehicles
- shipments
- dispatches
- route_plans
- incidents
- incident_confirmations
- sos_events
- deliveries
- pod_records
- ratings
- reputation_snapshots

## API Examples
`POST /shipments`
`GET /shipments/{id}`
`GET /fleets/{id}/vehicles`
`POST /incidents`
`POST /incidents/{id}/confirm`
`POST /sos`
`POST /deliveries/{id}/pod`
`POST /ratings`
`GET /fleets/{id}/reputation`

## Real-Time Events
Publish:
- `truck.location.updated`
- `incident.created`
- `incident.confirmed`
- `route.affected`
- `sos.triggered`
- `pod.verified`

## Hackathon Rule
Prefer a modular monolith over premature microservices. Keep interfaces clean so services can be split later.
