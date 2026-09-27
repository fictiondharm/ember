import { db } from '../store/db.js';
import { ApiError } from '../lib/errors.js';
import { newId, nowIso, round } from '../lib/ids.js';
import { runExclusive } from '../lib/mutex.js';
import { assertTransition, recordEvent } from './events.js';
import { hub } from './realtime.js';
import { TRUCK_TRANSITIONS, type Shipment, type Truck, type TruckStatus } from '../types.js';

export async function listTrucks(): Promise<Truck[]> {
  return db.trucks.get();
}

export async function getTruck(id: string): Promise<Truck> {
  const truck = await db.trucks.findById(id);
  if (!truck) {
    throw ApiError.notFound(`Truck ${id} does not exist.`);
  }
  return truck;
}

export interface CreateTruckInput {
  id?: string;
  organizationId: string;
  registrationNo: string;
  capacityT: number;
  availableT?: number;
  origin: string;
  destination: string;
  driverId?: string | null;
  departureAt?: string | null;
  lat?: number;
  lng?: number;
}

export async function createTruck(input: CreateTruckInput): Promise<Truck> {
  return runExclusive(async () => {
    const org = await db.organizations.findById(input.organizationId);
    if (!org) {
      throw ApiError.badRequest(`organizationId ${input.organizationId} does not exist.`);
    }
    if (org.type !== 'FLEET_OPERATOR') {
      throw ApiError.unprocessable(
        `Organization ${org.name} is a ${org.type} and cannot register trucks. Only FLEET_OPERATOR organizations own the fleet.`,
      );
    }
    if (input.driverId) {
      const driver = await db.drivers.findById(input.driverId);
      if (!driver) throw ApiError.badRequest(`driverId ${input.driverId} does not exist.`);
    }

    const existing = await db.trucks.get();
    const nextNumber =
      existing.reduce((max, t) => {
        const parsed = Number(t.id.replace(/^FG-/, ''));
        return Number.isFinite(parsed) ? Math.max(max, parsed) : max;
      }, 26) + 1;

    const truck: Truck = {
      id: input.id ?? `FG-${nextNumber}`,
      organizationId: input.organizationId,
      registrationNo: input.registrationNo,
      capacityT: round(input.capacityT),
      availableT: round(input.availableT ?? input.capacityT),
      status: 'AVAILABLE',
      lat: input.lat ?? 12.9716,
      lng: input.lng ?? 77.5946,
      origin: input.origin,
      destination: input.destination,
      departureAt: input.departureAt ?? null,
      driverId: input.driverId ?? null,
      createdAt: nowIso(),
    };

    if (truck.availableT > truck.capacityT) {
      throw ApiError.unprocessable(
        `availableT (${truck.availableT}) cannot exceed capacityT (${truck.capacityT}) for ${truck.id}.`,
      );
    }

    const saved = await db.trucks.create(truck);
    await db.capacityOffers.create({
      id: newId('cap'),
      truckId: saved.id,
      route: `${saved.origin} → ${saved.destination}`,
      origin: saved.origin,
      destination: saved.destination,
      availableT: saved.availableT,
      departureAt: saved.departureAt,
      status: 'OPEN',
      priceRule: 'DEMO_PER_TONNE',
      pricePerT: 850,
      updatedAt: saved.createdAt,
    });

    await recordEvent({
      eventType: 'truck.registered',
      truckId: saved.id,
      payload: { registrationNo: saved.registrationNo, capacityT: saved.capacityT },
      actorType: 'OPERATOR',
    });
    hub.broadcast('truck.updated', saved);
    return saved;
  });
}

/** Applies a status change with state-machine validation, persists, then broadcasts. */
export async function transitionTruck(
  truck: Truck,
  to: TruckStatus,
  patch: Partial<Truck> = {},
  event?: { eventType: string; payload?: Record<string, unknown>; shipmentId?: string | null },
): Promise<Truck> {
  assertTransition(TRUCK_TRANSITIONS, truck.status, to, `Truck ${truck.id}`);
  const updated = await db.trucks.update(truck.id, { ...patch, status: to });
  if (!updated) throw ApiError.notFound(`Truck ${truck.id} disappeared during update.`);
  if (event) {
    await recordEvent({
      eventType: event.eventType,
      truckId: updated.id,
      shipmentId: event.shipmentId ?? null,
      payload: { status: to, ...(event.payload ?? {}) },
    });
  }
  hub.broadcast('truck.updated', updated);
  return updated;
}

export interface DepartResult {
  truck: Truck;
  shipments: Shipment[];
}

export async function departTruck(truckId: string, actorId?: string | null): Promise<DepartResult> {
  return runExclusive(async () => {
    const truck = await getTruck(truckId);

    if (truck.status === 'IN_TRANSIT') {
      // Idempotent: departing an already-moving truck is a no-op, not an error.
      const shipments = await db.shipments.find((s) => s.truckId === truck.id);
      return { truck, shipments };
    }

    const assigned = await db.shipments.find(
      (s) => s.truckId === truck.id && ['CAPACITY_RESERVED', 'CONFIRMED', 'IN_TRANSIT'].includes(s.status),
    );

    if (assigned.length === 0) {
      throw ApiError.conflict(
        `Truck ${truck.id} has no assigned shipment, so a journey cannot be started. A shipment must reserve its capacity first.`,
        { truckStatus: truck.status },
      );
    }

    // The driver approval gate has to be enforced here too, or it is decorative:
    // a CAPACITY_RESERVED load means the business booked it and the driver has not
    // accepted yet, so the truck must not roll with cargo nobody agreed to carry.
    const awaitingDriver = assigned.filter((s) => s.status === 'CAPACITY_RESERVED');
    const firstPending = awaitingDriver[0];
    if (firstPending) {
      throw ApiError.conflict(
        `Truck ${truck.id} cannot depart: ${awaitingDriver.length} shipment(s) are still awaiting driver approval. ` +
          `The driver must accept or decline ${awaitingDriver.map((s) => s.id).join(', ')} first.`,
        {
          awaitingDriverApproval: awaitingDriver.map((s) => s.id),
          hint: `POST /shipments/${firstPending.id}/confirm or POST /shipments/${firstPending.id}/decline`,
        },
      );
    }

    const pending = assigned.filter((s) => s.status === 'CONFIRMED');
    if (pending.length === 0) {
      throw ApiError.conflict(
        `Truck ${truck.id} already has ${assigned.length} shipment(s) in progress and none can depart.`,
        { statuses: assigned.map((s) => s.status) },
      );
    }

    const departureAt = truck.departureAt ?? nowIso();
    const updatedTruck = await transitionTruck(
      truck,
      'IN_TRANSIT',
      { departureAt },
      { eventType: 'truck.departed', payload: { departureAt, shipments: pending.map((s) => s.id) } },
    );

    const updatedShipments = [];
    for (const shipment of pending) {
      const updated = await db.shipments.update(shipment.id, { status: 'IN_TRANSIT', updatedAt: nowIso() });
      if (!updated) continue;
      await recordEvent({
        eventType: 'shipment.departed',
        shipmentId: updated.id,
        truckId: updatedTruck.id,
        payload: { from: shipment.status, to: 'IN_TRANSIT' },
        actorType: 'DRIVER',
        actorId: actorId ?? truck.driverId,
      });
      hub.broadcast('shipment.updated', updated);
      updatedShipments.push(updated);
    }

    if (truck.driverId) {
      const driver = await db.drivers.findById(truck.driverId);
      if (driver) await db.drivers.update(driver.id, { status: 'ON_JOURNEY' });
    }

    return { truck: updatedTruck, shipments: updatedShipments };
  });
}
