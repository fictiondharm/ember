import { db } from '../store/db.js';
import { ApiError } from '../lib/errors.js';
import { nowIso, round } from '../lib/ids.js';
import { runExclusive } from '../lib/mutex.js';
import { hub } from './realtime.js';
import { canonicalLocation, distanceKm, etaLabelFor, proximityLabel } from '../lib/geo.js';
import type { CapacityOffer, Shipment, Truck } from '../types.js';

export interface CapacitySearchInput {
  origin?: string;
  destination?: string;
  weightT?: number;
  minAvailableT?: number;
}

export interface CapacityMatch {
  offer: CapacityOffer;
  truck: Truck;
  driverName: string | null;
  route: string;
  etaLabel: string;
  estimatedPrice: number;
  currency: string;
  matchesRequestedRoute: boolean;
  fitsRequestedWeight: boolean;
  blockers: string[];
}

const BLOCKING_TRUCK_STATES = new Set(['DELIVERED', 'INCIDENT', 'RECOVERY']);

/** Keeps the published offer's available tonnage in step with the truck. */
export async function syncOfferForTruck(truck: Truck, status?: CapacityOffer['status']): Promise<CapacityOffer | undefined> {
  const offers = await db.capacityOffers.find((o) => o.truckId === truck.id);
  const current = offers[0];
  if (!current) return undefined;

  const nextStatus: CapacityOffer['status'] = status ?? (current.status === 'CLOSED' ? 'CLOSED' : truck.availableT > 0 ? 'OPEN' : 'HELD');
  const updated = await db.capacityOffers.update(current.id, {
    availableT: round(truck.availableT),
    route: `${truck.origin} → ${truck.destination}`,
    origin: truck.origin,
    destination: truck.destination,
    status: nextStatus,
    departureAt: truck.departureAt,
    updatedAt: nowIso(),
  });
  if (updated) hub.broadcast('capacity.updated', updated);
  return updated;
}

/**
 * GET /capacity — compatible open capacity only (Backend PRD §4).
 * A truck is a candidate when it still has spare tonnage and is not blocked.
 */
export async function searchCapacity(input: CapacitySearchInput): Promise<CapacityMatch[]> {
  const [offers, trucks, drivers] = await Promise.all([
    db.capacityOffers.get(),
    db.trucks.get(),
    db.drivers.get(),
  ]);

  const origin = input.origin ? canonicalLocation(input.origin) : null;
  const destination = input.destination ? canonicalLocation(input.destination) : null;
  const required = input.minAvailableT ?? input.weightT ?? 0;

  const matches: CapacityMatch[] = [];

  for (const offer of offers) {
    const truck = trucks.find((t) => t.id === offer.truckId);
    if (!truck) continue;

    const blockers: string[] = [];
    if (offer.status === 'CLOSED') blockers.push('Capacity offer is closed');
    if (BLOCKING_TRUCK_STATES.has(truck.status)) {
      blockers.push(`Truck is ${truck.status.replace('_', ' ').toLowerCase()}`);
    }
    if (offer.availableT <= 0) blockers.push('No spare capacity remaining');

    const matchesRoute =
      (!origin || canonicalLocation(offer.origin) === origin) &&
      (!destination || canonicalLocation(offer.destination) === destination);
    if (!matchesRoute) blockers.push('Route does not match the request');

    const fits = truck.availableT >= required;
    if (!fits) {
      blockers.push(`Only ${round(truck.availableT)}T spare, request needs ${round(required)}T`);
    }

    const driver = truck.driverId ? drivers.find((d) => d.id === truck.driverId) : undefined;

    matches.push({
      offer,
      truck,
      driverName: driver?.name ?? null,
      route: `${offer.origin} → ${offer.destination}`,
      etaLabel: offer.departureAt ? etaLabelFor(offer.departureAt) : 'Unscheduled',
      estimatedPrice: Math.round(truck.availableT * offer.pricePerT),
      currency: 'INR',
      matchesRequestedRoute: matchesRoute,
      fitsRequestedWeight: fits,
      blockers,
    });
  }

  matches.sort((a, b) => {
    if (a.blockers.length !== b.blockers.length) return a.blockers.length - b.blockers.length;
    if (a.fitsRequestedWeight !== b.fitsRequestedWeight) return a.fitsRequestedWeight ? -1 : 1;
    return b.truck.availableT - a.truck.availableT;
  });

  return matches;
}

/** GET /capacity returns only genuinely usable capacity unless `?includeAll=true`. */
export async function findAvailableCapacity(input: CapacitySearchInput): Promise<CapacityMatch[]> {
  const all = await searchCapacity(input);
  const usable = all.filter((m) => m.blockers.length === 0);
  return usable;
}

export interface NearbySuggestion extends CapacityMatch {
  /** Great-circle distance from the selected truck, in km. Null if either position is unknown. */
  distanceFromSelectedKm: number | null;
  proximityLabel: string;
  /** True when this other truck could take the same load that the selected one is carrying. */
  canAlsoCarry: boolean;
}

/**
 * GET /capacity/nearby — other trucks worth knowing about.
 *
 * When a shipper has picked a truck, two things are still useful: is there spare
 * tonnage left on the truck they chose, and which other trucks on the same corridor
 * sit closest by? This answers both from existing offers, ranked nearest-first.
 *
 * Distance is real great-circle arithmetic over stored coordinates. It is explicitly
 * a proximity hint, not a drive distance or ETA — the Master PRD forbids presenting
 * routing estimates as provider output, and we have no routing provider.
 */
export async function suggestNearbyCapacity(input: {
  truckId: string;
  origin?: string;
  destination?: string;
  weightT?: number;
  limit?: number;
}): Promise<{ selected: CapacityMatch | null; suggestions: NearbySuggestion[]; selectedTruck: Truck | null }> {
  const [offers, trucks, drivers] = await Promise.all([
    db.capacityOffers.get(),
    db.trucks.get(),
    db.drivers.get(),
  ]);

  const selectedTruck = trucks.find((t) => t.id === input.truckId) ?? null;

  const decorate = (offer: CapacityOffer): CapacityMatch | null => {
    const truck = trucks.find((t) => t.id === offer.truckId);
    if (!truck) return null;
    const driver = truck.driverId ? drivers.find((d) => d.id === truck.driverId) : undefined;
    const origin = input.origin ? canonicalLocation(input.origin) : null;
    const destination = input.destination ? canonicalLocation(input.destination) : null;
    const matchesRoute =
      (!origin || canonicalLocation(offer.origin) === origin) &&
      (!destination || canonicalLocation(offer.destination) === destination);
    const fits = !input.weightT || truck.availableT >= input.weightT;
    const blockers: string[] = [];
    if (offer.status === 'CLOSED') blockers.push('Capacity offer is closed');
    if (BLOCKING_TRUCK_STATES.has(truck.status)) {
      blockers.push(`Truck is ${truck.status.replace('_', ' ').toLowerCase()}`);
    }
    if (offer.availableT <= 0) blockers.push('No spare capacity remaining');
    if (!matchesRoute) blockers.push('Route does not match the request');
    if (!fits && input.weightT) {
      blockers.push(`Only ${round(truck.availableT)}T spare, request needs ${round(input.weightT)}T`);
    }
    return {
      offer,
      truck,
      driverName: driver?.name ?? null,
      route: `${offer.origin} → ${offer.destination}`,
      etaLabel: offer.departureAt ? etaLabelFor(offer.departureAt) : 'Unscheduled',
      estimatedPrice: Math.round(truck.availableT * offer.pricePerT),
      currency: 'INR',
      matchesRequestedRoute: matchesRoute,
      fitsRequestedWeight: fits,
      blockers,
    };
  };

  const selectedOffer = offers.find((o) => o.truckId === input.truckId) ?? null;
  const selected = selectedOffer ? decorate(selectedOffer) : null;

  const suggestions: NearbySuggestion[] = offers
    .filter((o) => o.truckId !== input.truckId)
    .map(decorate)
    .filter((m): m is CapacityMatch => m !== null)
    .map((m) => {
      const distance = selectedTruck ? distanceKm(selectedTruck, m.truck) : null;
      return {
        ...m,
        distanceFromSelectedKm: distance,
        proximityLabel: proximityLabel(distance),
        canAlsoCarry: input.weightT ? m.truck.availableT >= input.weightT : true,
      };
    })
    // Genuinely usable first, then nearest — the driver-helpful ordering.
    .sort((a, b) => {
      const aBlocked = a.blockers.length > 0;
      const bBlocked = b.blockers.length > 0;
      if (aBlocked !== bBlocked) return aBlocked ? 1 : -1;
      const ad = a.distanceFromSelectedKm ?? Number.POSITIVE_INFINITY;
      const bd = b.distanceFromSelectedKm ?? Number.POSITIVE_INFINITY;
      if (ad !== bd) return ad - bd;
      return b.truck.availableT - a.truck.availableT;
    })
    .slice(0, input.limit ?? 5);

  return { selected, suggestions, selectedTruck };
}

export interface ReserveInput {
  offerId: string;
  shipmentId: string;
  actorType?: 'BUSINESS' | 'AGENT' | 'OPERATOR';
  actorId?: string | null;
}export interface ReserveResult {
  truck: Truck;
  offer: CapacityOffer;
  shipment: Shipment;
}

/**
 * Atomic capacity reservation (Backend PRD §5).
 * Runs inside the global mutation lock, so concurrent reservations cannot oversell.
 */
export async function reserveCapacity(input: ReserveInput): Promise<ReserveResult> {
  return runExclusive(async () => {
    const offer = await db.capacityOffers.findById(input.offerId);
    if (!offer) {
      throw ApiError.notFound(`Capacity offer ${input.offerId} does not exist.`);
    }
    if (offer.status === 'CLOSED') {
      throw ApiError.conflict(`Capacity offer ${input.offerId} is closed and cannot be reserved.`);
    }

    const shipment = await db.shipments.findById(input.shipmentId);
    if (!shipment) {
      throw ApiError.notFound(`Shipment ${input.shipmentId} does not exist.`);
    }
    if (shipment.status !== 'DRAFT' && shipment.status !== 'CAPACITY_RESERVED') {
      throw ApiError.conflict(
        `Shipment ${shipment.id} is ${shipment.status} and can no longer change capacity.`,
        { status: shipment.status },
      );
    }

    if (shipment.capacityOfferId && shipment.capacityOfferId !== offer.id) {
      throw ApiError.conflict(
        `Shipment ${shipment.id} already holds capacity on offer ${shipment.capacityOfferId}. Cancel and recreate to switch trucks.`,
      );
    }

    const truck = await db.trucks.findById(offer.truckId);
    if (!truck) {
      throw ApiError.notFound(`Truck ${offer.truckId} for offer ${offer.id} does not exist.`);
    }
    if (BLOCKING_TRUCK_STATES.has(truck.status)) {
      throw ApiError.conflict(
        `Truck ${truck.id} is ${truck.status} and cannot accept new capacity right now.`,
        { truckStatus: truck.status },
      );
    }
    if (canonicalLocation(truck.origin) !== canonicalLocation(shipment.origin)) {
      throw ApiError.unprocessable(
        `Truck ${truck.id} departs from ${truck.origin}, but the shipment needs pickup in ${shipment.origin}.`,
      );
    }
    if (canonicalLocation(truck.destination) !== canonicalLocation(shipment.destination)) {
      throw ApiError.unprocessable(
        `Truck ${truck.id} delivers to ${truck.destination}, but the shipment needs delivery in ${shipment.destination}.`,
      );
    }
    if (truck.availableT < shipment.weightT) {
      throw ApiError.unprocessable(
        `Cannot reserve ${shipment.weightT}T on ${truck.id}: only ${round(truck.availableT)}T available.`,
        { requested: shipment.weightT, available: round(truck.availableT), truckId: truck.id },
      );
    }

    const remaining = round(truck.availableT - shipment.weightT);
    const updatedTruck = await db.trucks.update(truck.id, {
      availableT: remaining,
      status: truck.status === 'AVAILABLE' ? 'ASSIGNED' : truck.status,
    });
    if (!updatedTruck) throw ApiError.notFound(`Truck ${truck.id} disappeared during reservation.`);

    const updatedOffer = await db.capacityOffers.update(offer.id, {
      availableT: remaining,
      status: remaining > 0 ? 'OPEN' : 'HELD',
      updatedAt: nowIso(),
    });
    if (!updatedOffer) throw ApiError.notFound(`Capacity offer ${offer.id} disappeared during reservation.`);

    const updatedShipment = await db.shipments.update(shipment.id, {
      truckId: updatedTruck.id,
      capacityOfferId: offer.id,
      status: 'CAPACITY_RESERVED',
      updatedAt: nowIso(),
    });
    if (!updatedShipment) throw ApiError.notFound(`Shipment ${shipment.id} disappeared during reservation.`);

    hub.broadcast('capacity.updated', updatedOffer);
    hub.broadcast('truck.updated', updatedTruck);
    hub.broadcast('shipment.updated', updatedShipment);

    return { truck: updatedTruck, offer: updatedOffer, shipment: updatedShipment };
  });
}
