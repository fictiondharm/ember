import { db } from '../store/db.js';
import { ApiError } from '../lib/errors.js';
import { canonicalLocation } from '../lib/geo.js';
import { nowIso, round } from '../lib/ids.js';
import { runExclusive } from '../lib/mutex.js';
import { reserveCapacity, syncOfferForTruck } from './capacity.js';
import { assertTransition, recordEvent } from './events.js';
import { hub } from './realtime.js';
import { SHIPMENT_TRANSITIONS, type Shipment, type ShipmentStatus, type Truck } from '../types.js';

export const MAX_SHIPMENT_WEIGHT_T = 50;

export async function listShipments(filter?: { status?: string; truckId?: string }): Promise<Shipment[]> {
  return db.shipments.find((s) => {
    if (filter?.status && s.status !== filter.status) return false;
    if (filter?.truckId && s.truckId !== filter.truckId) return false;
    return true;
  });
}

export async function getShipment(id: string): Promise<Shipment> {
  const shipment = await db.shipments.findById(id);
  if (!shipment) {
    throw ApiError.notFound(`Shipment ${id} does not exist.`);
  }
  return shipment;
}

/** Readable, deterministic IDs: SHP-1002, SHP-1003, ... */
async function nextShipmentId(): Promise<string> {
  const shipments = await db.shipments.get();
  const max = shipments.reduce((acc, s) => {
    const parsed = Number(s.id.replace(/^SHP-/, ''));
    return Number.isFinite(parsed) ? Math.max(acc, parsed) : acc;
  }, 1000);
  return `SHP-${max + 1}`;
}

export interface CreateShipmentInput {
  shipperId: string;
  cargoName: string;
  reference?: string | null;
  origin: string;
  destination: string;
  weightT: number;
  deadlineAt?: string | null;
  /** When present, capacity is reserved and the shipment is confirmed atomically. */
  capacityOfferId?: string | null;
  actorType?: 'BUSINESS' | 'AGENT' | 'OPERATOR';
  actorId?: string | null;
}

export interface CreateShipmentResult {
  shipment: Shipment;
  reserved: boolean;
  confirmed: boolean;
}

/**
 * POST /shipments.
 *
 * With `capacityOfferId` the whole golden-flow business action happens in one
 * atomic step: reserve capacity (DRAFT → CAPACITY_RESERVED) then confirm
 * (CAPACITY_RESERVED → CONFIRMED), each with its own event.
 * Without it, a plain DRAFT shipment is created.
 */
export async function createShipment(input: CreateShipmentInput): Promise<CreateShipmentResult> {
  return runExclusive(async () => {
    const shipper = await db.organizations.findById(input.shipperId);
    if (!shipper) {
      throw ApiError.badRequest(`shipperId ${input.shipperId} does not exist.`);
    }
    if (shipper.type !== 'SHIPPER') {
      throw ApiError.unprocessable(
        `Organization ${shipper.name} is a ${shipper.type}. Only a SHIPPER organization can create shipments.`,
      );
    }
    if (shipper.status !== 'ACTIVE') {
      throw ApiError.unprocessable(`Organization ${shipper.name} is ${shipper.status} and cannot create shipments.`);
    }

    const origin = canonicalLocation(input.origin);
    const destination = canonicalLocation(input.destination);
    if (!origin || !destination) {
      throw ApiError.badRequest('origin and destination are both required.');
    }
    if (origin === destination) {
      throw ApiError.unprocessable(`origin and destination are the same (${origin}). A shipment must actually move.`);
    }
    if (!Number.isFinite(input.weightT) || input.weightT <= 0) {
      throw ApiError.unprocessable(`weightT must be a positive number of tonnes (received ${input.weightT}).`);
    }
    if (input.weightT > MAX_SHIPMENT_WEIGHT_T) {
      throw ApiError.unprocessable(
        `weightT ${input.weightT}T exceeds the ${MAX_SHIPMENT_WEIGHT_T}T demo limit for a single shipment.`,
        { max: MAX_SHIPMENT_WEIGHT_T },
      );
    }
    if (!input.cargoName || input.cargoName.trim().length < 2) {
      throw ApiError.badRequest('cargoName is required (e.g. "ABC Electronics").');
    }

    const offer = input.capacityOfferId ? await db.capacityOffers.findById(input.capacityOfferId) : undefined;
    if (input.capacityOfferId && !offer) {
      throw ApiError.notFound(`Capacity offer ${input.capacityOfferId} does not exist.`);
    }

    const shipment: Shipment = {
      id: await nextShipmentId(),
      reference: input.reference?.trim() || `FG-${nowIso().slice(2, 10).replace(/-/g, '')}`,
      cargoName: input.cargoName.trim(),
      shipperId: input.shipperId,
      origin,
      destination,
      weightT: round(input.weightT),
      deadlineAt: input.deadlineAt ?? null,
      status: 'DRAFT',
      truckId: null,
      capacityOfferId: null,
      price: offer ? Math.round(offer.pricePerT * input.weightT) : 0,
      currency: 'INR',
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };

    const created = await db.shipments.create(shipment);
    await recordEvent({
      eventType: 'shipment.created',
      shipmentId: created.id,
      payload: {
        cargoName: created.cargoName,
        weightT: created.weightT,
        origin: created.origin,
        destination: created.destination,
        shipperId: created.shipperId,
      },
      actorType: input.actorType ?? 'BUSINESS',
      actorId: input.actorId ?? null,
    });
    hub.broadcast('shipment.created', created);

    if (!offer) {
      return { shipment: created, reserved: false, confirmed: false };
    }

    const reserved = await reserveCapacity({
      offerId: offer.id,
      shipmentId: created.id,
      actorType: input.actorType,
      actorId: input.actorId,
    });

    await recordEvent({
      eventType: 'shipment.capacity_reserved',
      shipmentId: created.id,
      truckId: reserved.truck.id,
      payload: {
        truckId: reserved.truck.id,
        weightT: created.weightT,
        availableBefore: round(reserved.truck.availableT + created.weightT),
        availableAfter: reserved.truck.availableT,
      },
      actorType: input.actorType ?? 'BUSINESS',
      actorId: input.actorId ?? null,
    });

    const confirmed = await confirmShipment(created.id, {
      actorType: input.actorType,
      actorId: input.actorId,
    });

    return { shipment: confirmed, reserved: true, confirmed: true };
  });
}

/** CAPACITY_RESERVED → CONFIRMED. */
export async function confirmShipment(
  shipmentId: string,
  actor?: { actorType?: 'BUSINESS' | 'AGENT' | 'OPERATOR'; actorId?: string | null },
): Promise<Shipment> {
  return runExclusive(async () => {
    const shipment = await getShipment(shipmentId);
    if (shipment.status === 'CONFIRMED') return shipment;
    assertTransition(SHIPMENT_TRANSITIONS, shipment.status, 'CONFIRMED', `Shipment ${shipment.id}`);

    const updated = await db.shipments.update(shipmentId, { status: 'CONFIRMED', updatedAt: nowIso() });
    if (!updated) throw ApiError.notFound(`Shipment ${shipmentId} disappeared during confirm.`);

    await recordEvent({
      eventType: 'shipment.confirmed',
      shipmentId: updated.id,
      truckId: updated.truckId,
      payload: { from: shipment.status, to: 'CONFIRMED', price: updated.price, currency: updated.currency },
      actorType: actor?.actorType ?? 'BUSINESS',
      actorId: actor?.actorId ?? null,
    });
    hub.broadcast('shipment.updated', updated);
    return updated;
  });
}

export async function setShipmentStatus(
  shipment: Shipment,
  to: ShipmentStatus,
  payload: Record<string, unknown>,
  actorType: 'SYSTEM' | 'AGENT' | 'OPERATOR' | 'DRIVER' | 'BUSINESS' = 'SYSTEM',
  actorId: string | null = null,
): Promise<Shipment> {
  assertTransition(SHIPMENT_TRANSITIONS, shipment.status, to, `Shipment ${shipment.id}`);
  const updated = await db.shipments.update(shipment.id, { status: to, updatedAt: nowIso() });
  if (!updated) throw ApiError.notFound(`Shipment ${shipment.id} disappeared during update.`);
  await recordEvent({
    eventType: `shipment.${to.toLowerCase()}`,
    shipmentId: updated.id,
    truckId: updated.truckId,
    payload: { from: shipment.status, to, ...payload },
    actorType,
    actorId,
  });
  hub.broadcast('shipment.updated', updated);
  return updated;
}

export async function shipmentTimeline(shipmentId: string) {
  const shipment = await getShipment(shipmentId);
  const incidents = await db.incidents.find((i) => i.affectedShipmentIds.includes(shipmentId));
  const incidentIds = new Set(incidents.map((i) => i.id));

  // A shipment timeline = its own events + its truck's events + events of the
  // incidents that hit it. Each event is stored once; the timeline just links it.
  const [ownEvents, truckEvents, incidentEvents] = await Promise.all([
    db.events.find((e) => e.shipmentId === shipmentId),
    shipment.truckId ? db.events.find((e) => e.truckId === shipment.truckId) : Promise.resolve([]),
    db.events.find((e) => e.incidentId !== null && incidentIds.has(e.incidentId)),
  ]);

  const timeline = [...ownEvents, ...truckEvents, ...incidentEvents]
    .filter((event, index, all) => all.findIndex((e) => e.id === event.id) === index)
    .sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp));

  const truck = shipment.truckId ? await db.trucks.findById(shipment.truckId) : undefined;
  const payments = await db.payments.find((p) => p.shipmentId === shipmentId);
  const recoveryPlans = await db.recoveryPlans.find((p) => p.affectedShipmentIds.includes(shipmentId));
  const notifications = await db.notifications.find((n) => n.recipientId === shipment.shipperId);

  return {
    shipment,
    truck: truck ?? null,
    events: timeline,
    incidents,
    payments,
    recoveryPlans,
    notifications,
  };
}

export interface ReleaseResult {
  truck: Truck;
  shipment: Shipment;
  releasedT: number;
}

/**
 * Releases previously reserved tonnage back to a truck and closes the offer.
 * Used by recovery execution and by any future cancellation path.
 */
export async function releaseCapacity(shipment: Shipment, reason: string): Promise<ReleaseResult> {
  if (!shipment.truckId) {
    throw ApiError.conflict(`Shipment ${shipment.id} has no truck, so there is no capacity to release.`);
  }
  const truck = await db.trucks.findById(shipment.truckId);
  if (!truck) throw ApiError.notFound(`Truck ${shipment.truckId} does not exist.`);

  const released = round(Math.min(shipment.weightT, truck.capacityT - truck.availableT));
  if (released <= 0) {
    return { truck, shipment, releasedT: 0 };
  }

  const updatedTruck = await db.trucks.update(truck.id, {
    availableT: round(truck.availableT + released),
  });
  if (!updatedTruck) throw ApiError.notFound(`Truck ${truck.id} disappeared during release.`);

  await syncOfferForTruck(updatedTruck, 'OPEN');
  await recordEvent({
    eventType: 'capacity.released',
    shipmentId: shipment.id,
    truckId: truck.id,
    payload: { releasedT: released, reason },
    actorType: 'AGENT',
  });
  hub.broadcast('truck.updated', updatedTruck);

  return { truck: updatedTruck, shipment, releasedT: released };
}
