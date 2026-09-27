import { db } from '../store/db.js';
import { ApiError } from '../lib/errors.js';
import { resolveLocation } from '../lib/geo.js';
import { newId, nowIso } from '../lib/ids.js';
import { runExclusive } from '../lib/mutex.js';
import { assertTransition, recordEvent } from './events.js';
import { hub } from './realtime.js';
import { setShipmentStatus } from './shipments.js';
import { transitionTruck } from './trucks.js';
import { INCIDENT_TRANSITIONS, type Incident, type IncidentStatus } from '../types.js';

const DEPARTED_TRUCK_STATES = new Set(['IN_TRANSIT', 'DELAYED']);

export async function listIncidents(filter?: { status?: string; truckId?: string }): Promise<Incident[]> {
  return db.incidents.find((i) => {
    if (filter?.status && i.status !== filter.status) return false;
    if (filter?.truckId && i.truckId !== filter.truckId) return false;
    return true;
  });
}

export async function getIncident(id: string): Promise<Incident> {
  const incident = await db.incidents.findById(id);
  if (!incident) {
    throw ApiError.notFound(`Incident ${id} does not exist.`);
  }
  return incident;
}

export interface CreateIncidentInput {
  truckId: string;
  type: Incident['type'];
  location: string;
  severity?: Incident['severity'];
  description?: string;
  transcript?: string | null;
  source?: Incident['source'];
  actorId?: string | null;
}

/**
 * POST /incidents — the driver's report becomes structured backend state.
 *
 * Effects (Master PRD §7):
 *   truck    IN_TRANSIT -> INCIDENT
 *   shipment IN_TRANSIT -> AT_RISK
 *   incident created as OPEN
 * No recovery plan is created or executed here — that needs human approval.
 */
export async function createIncident(input: CreateIncidentInput): Promise<{
  incident: Incident;
  truck: Awaited<ReturnType<typeof transitionTruck>>;
  affectedShipments: Awaited<ReturnType<typeof setShipmentStatus>>[];
}> {
  return runExclusive(async () => {
    const truck = await db.trucks.findById(input.truckId);
    if (!truck) {
      throw ApiError.notFound(`Truck ${input.truckId} does not exist, so the incident cannot be attached.`);
    }
    if (!DEPARTED_TRUCK_STATES.has(truck.status)) {
      throw ApiError.conflict(
        `Truck ${truck.id} is ${truck.status}. An incident can only be reported while the truck is IN_TRANSIT.`,
        { truckStatus: truck.status, required: ['IN_TRANSIT'] },
      );
    }
    if (!input.location || input.location.trim().length < 2) {
      throw ApiError.badRequest('location is required (e.g. "Hosur").');
    }

    const resolved = resolveLocation(input.location);
    const description = input.description?.trim() || `${input.type.replace(/_/g, ' ').toLowerCase()} reported by driver`;
    const transcript = input.transcript ?? description;
    const severity = input.severity ?? defaultSeverity(input.type);

    const incident: Incident = {
      id: newId('INC'),
      truckId: truck.id,
      type: input.type,
      location: resolved.label,
      severity,
      transcript,
      structuredSummary: `${labelFor(input.type)} at ${resolved.label}. Truck ${truck.id} on ${truck.origin} → ${truck.destination}.`,
      status: 'OPEN',
      source: input.source ?? 'DRIVER_APP',
      affectedShipmentIds: [],
      recoveryPlanId: null,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };

    const onTruck = await db.shipments.find(
      (s) => s.truckId === truck.id && ['IN_TRANSIT', 'CONFIRMED', 'CAPACITY_RESERVED'].includes(s.status),
    );
    incident.affectedShipmentIds = onTruck.map((s) => s.id);

    const created = await db.incidents.create(incident);
    await recordEvent({
      eventType: 'incident.created',
      incidentId: created.id,
      truckId: truck.id,
      shipmentId: null,
      payload: {
        type: created.type,
        location: created.location,
        severity: created.severity,
        transcript: created.transcript,
        affectedShipmentIds: created.affectedShipmentIds,
        source: created.source,
        positionSimulated: resolved.simulated,
      },
      actorType: 'DRIVER',
      actorId: input.actorId ?? truck.driverId,
    });

    const updatedTruck = await transitionTruck(
      truck,
      'INCIDENT',
      Number.isFinite(resolved.lat) && Number.isFinite(resolved.lng)
        ? { lat: round6(resolved.lat), lng: round6(resolved.lng) }
        : {},
      { eventType: 'truck.incident', payload: { incidentId: created.id, location: created.location } },
    );

    const affectedShipments = [];
    for (const shipment of onTruck) {
      if (shipment.status === 'IN_TRANSIT') {
        const updated = await setShipmentStatus(
          shipment,
          'AT_RISK',
          { incidentId: created.id, reason: 'Truck incident blocks the planned route' },
          'SYSTEM',
          input.actorId ?? null,
        );
        affectedShipments.push(updated);
      }
    }

    hub.broadcast('incident.created', { ...created, affectedShipmentIds: incident.affectedShipmentIds });
    return { incident: { ...created, affectedShipmentIds: incident.affectedShipmentIds }, truck: updatedTruck, affectedShipments };
  });
}

export async function setIncidentStatus(
  incident: Incident,
  to: IncidentStatus,
  payload: Record<string, unknown> = {},
): Promise<Incident> {
  assertTransition(INCIDENT_TRANSITIONS, incident.status, to, `Incident ${incident.id}`);
  const updated = await db.incidents.update(incident.id, { status: to, updatedAt: nowIso() });
  if (!updated) throw ApiError.notFound(`Incident ${incident.id} disappeared during update.`);
  await recordEvent({
    eventType: `incident.${to.toLowerCase()}`,
    incidentId: updated.id,
    truckId: updated.truckId,
    payload: { from: incident.status, to, ...payload },
    actorType: 'AGENT',
  });
  hub.broadcast('incident.updated', updated);
  return updated;
}

function defaultSeverity(type: Incident['type']): Incident['severity'] {
  switch (type) {
    case 'ACCIDENT':
      return 'CRITICAL';
    case 'TRUCK_BREAKDOWN':
      return 'HIGH';
    case 'CARGO_DAMAGE':
      return 'HIGH';
    case 'DELAY':
      return 'MEDIUM';
    default:
      return 'LOW';
  }
}

function labelFor(type: Incident['type']): string {
  switch (type) {
    case 'TRUCK_BREAKDOWN':
      return 'Truck breakdown';
    case 'ACCIDENT':
      return 'Accident';
    case 'CARGO_DAMAGE':
      return 'Cargo damage';
    case 'DELAY':
      return 'Delay';
    case 'ROUTE_BLOCKED':
      return 'Route blocked';
    default:
      return 'Incident';
  }
}

function round6(n: number): number {
  return Math.round(n * 1e6) / 1e6;
}
