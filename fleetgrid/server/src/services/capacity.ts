import { db } from '../store/db.js';
import { ApiError } from '../lib/errors.js';
import { nowIso, round } from '../lib/ids.js';
import { runExclusive } from '../lib/mutex.js';
import { hub } from './realtime.js';
import { canonicalLocation, distanceKm, etaLabelFor, proximityLabel, segmentFit, segmentNote, type SegmentFit } from '../lib/geo.js';
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
  /** EXACT = whole lane, PARTIAL = truck passes the requested stop on a longer run. */
  segmentFit: SegmentFit;
  /** Why a truck qualifies despite not matching the requested lane exactly. */
  segmentNote: string | null;
  /** How much of the request this truck alone could take. */
  canCarryT: number;
  /** Surplus on this truck once the whole request is placed here, when it fits. */
  spareAfterT: number | null;
  /** What the whole request would cost on this truck, at this lane's demo rate. */
  priceForRequest: number | null;
  /** What the whole request would cost split across `legs`. */
  priceForSplit: number | null;
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

    const driver = truck.driverId ? drivers.find((d) => d.id === truck.driverId) : undefined;

    // A truck running the whole lane also passes the intermediate stops, so a
    // Bengaluru → Hosur request is legitimately served by a Bengaluru → Chennai truck.
    const fit: SegmentFit =
      origin && destination
        ? segmentFit(offer.origin, offer.destination, origin, destination)
        : 'EXACT';
    const onRoute = fit === 'EXACT' || fit === 'PARTIAL';
    if (!onRoute) {
      blockers.push(
        fit === 'REVERSED'
          ? `Runs the other way — ${offer.origin} → ${offer.destination}`
          : `Route does not cover ${origin ?? '?'} → ${destination ?? '?'}`,
      );
    }

    const fits = truck.availableT >= required;

    // Only tonnage is a hard blocker. A truck that cannot take the whole load is
    // still returned as a partial option, because a split across trucks may well
    // cover the request — the caller decides that, not this function.
    if (!fits) {
      blockers.push(`Takes only ${round(truck.availableT)}T of the ${round(required)}T request`);
    }

    matches.push({
      offer,
      truck,
      driverName: driver?.name ?? null,
      route: `${offer.origin} → ${offer.destination}`,
      etaLabel: offer.departureAt ? etaLabelFor(offer.departureAt) : 'Unscheduled',
      estimatedPrice: Math.round(truck.availableT * offer.pricePerT),
      currency: 'INR',
      matchesRequestedRoute: onRoute,
      fitsRequestedWeight: fits,
      blockers,
      segmentFit: fit,
      segmentNote: origin && destination ? segmentNote(fit, destination, offer.destination) : null,
      canCarryT: required > 0 ? round(Math.min(truck.availableT, required)) : round(truck.availableT),
      spareAfterT: fits ? round(truck.availableT - required) : null,
      priceForRequest: required > 0 && fits ? Math.round(required * offer.pricePerT) : null,
      priceForSplit:
        required > 0 && !fits ? Math.round(Math.min(truck.availableT, required) * offer.pricePerT) : null,
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

export interface SplitLeg {
  truck: Truck;
  offer: CapacityOffer;
  /** How much of the request this truck is being asked to carry. */
  assignedT: number;
  /** What is left on the truck after this leg. */
  spareAfterT: number;
  price: number;
  segmentFit: SegmentFit;
}

export interface CapacityOptions {
  request: { origin: string | null; destination: string | null; weightT: number };
  /** One truck can take the whole load. */
  single: CapacityMatch[];
  /** No single truck is big enough; these together might cover it. */
  partial: CapacityMatch[];
  /** A concrete split across several trucks, largest truck first. */
  split: {
    legs: SplitLeg[];
    coveredT: number;
    uncoveredT: number;
    fullyCovered: boolean;
    totalPrice: number;
    truckCount: number;
  } | null;
  /** True when the request cannot be served at all, with the reason. */
  impossible: string | null;
}

/**
 * GET /capacity/options — what can actually be done with this load.
 *
 * A 10T request against trucks holding 5T, 3.8T and 3.1T used to return nothing at
 * all, which reads as "the product is broken". This composes the three real answers
 * instead: one truck, a split across trucks, or an honest "not possible".
 *
 * The split is a *plan*, not an assignment — nothing is reserved here. The caller
 * books the legs explicitly, each one going through the same atomic reservation and
 * the same driver approval gate as any other load.
 */
export async function capacityOptions(input: CapacitySearchInput): Promise<CapacityOptions> {
  const request = {
    origin: input.origin ? canonicalLocation(input.origin) : null,
    destination: input.destination ? canonicalLocation(input.destination) : null,
    weightT: round(input.weightT ?? input.minAvailableT ?? 0),
  };
  const all = await searchCapacity(input);

  // Only trucks that are genuinely on the requested lane and not blocked for any
  // reason other than tonnage can contribute to a split.
  const routeBlocked = all.filter((m) =>
    m.blockers.some((b) => b !== `Takes only ${round(m.truck.availableT)}T of the ${round(request.weightT)}T request`),
  );
  const usableForSplit = all.filter(
    (m) => !routeBlocked.includes(m) && m.truck.availableT > 0 && (m.segmentFit === 'EXACT' || m.segmentFit === 'PARTIAL'),
  );

  const single = usableForSplit.filter((m) => m.fitsRequestedWeight);

  // Greedy fill, biggest truck first, so the plan uses as few trucks as possible.
  let remaining = request.weightT;
  const legs: SplitLeg[] = [];
  for (const m of [...usableForSplit].sort((a, b) => b.truck.availableT - a.truck.availableT)) {
    if (remaining <= 0) break;
    const assignedT = round(Math.min(m.truck.availableT, remaining));
    if (assignedT <= 0) continue;
    legs.push({
      truck: m.truck,
      offer: m.offer,
      assignedT,
      spareAfterT: round(m.truck.availableT - assignedT),
      price: Math.round(assignedT * m.offer.pricePerT),
      segmentFit: m.segmentFit,
    });
    remaining = round(remaining - assignedT);
  }

  const coveredT = round(request.weightT - Math.max(remaining, 0));
  // Only surface a split when one truck genuinely cannot do it. A "split across 1
  // truck" line next to a normal single-truck result is noise that reads as a bug.
  const plan =
    legs.length > 0
      ? {
          legs,
          coveredT,
          uncoveredT: round(Math.max(remaining, 0)),
          fullyCovered: remaining <= 0,
          totalPrice: legs.reduce((sum, l) => sum + l.price, 0),
          truckCount: legs.length,
        }
      : null;
  const split = single.length === 0 ? plan : null;

  let impossible: string | null = null;
  if (single.length === 0 && (!plan || plan.coveredT <= 0)) {
    if (usableForSplit.length === 0) {
      const offRoute = all.length === 0;
      impossible = offRoute
        ? `No truck publishes capacity on this network right now.`
        : `No truck covers ${request.origin ?? 'this pickup'} → ${request.destination ?? 'this drop'} with any spare capacity.`;
    } else {
      impossible = `Together the ${usableForSplit.length} truck(s) on this route only have ${round(
        usableForSplit.reduce((s, m) => s + m.truck.availableT, 0),
      )}T spare, short of the ${request.weightT}T requested.`;
    }
  } else if (plan && !plan.fullyCovered) {
    impossible = `The trucks on this route can only cover ${plan.coveredT}T of the ${request.weightT}T requested.`;
  }

  return {
    request,
    single,
    partial: usableForSplit.filter((m) => !m.fitsRequestedWeight),
    split,
    impossible,
  };
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
    const required = input.weightT ?? 0;
    const fit: SegmentFit =
      origin && destination ? segmentFit(offer.origin, offer.destination, origin, destination) : 'EXACT';
    const onRoute = fit === 'EXACT' || fit === 'PARTIAL';
    const fits = !required || truck.availableT >= required;
    const blockers: string[] = [];
    if (offer.status === 'CLOSED') blockers.push('Capacity offer is closed');
    if (BLOCKING_TRUCK_STATES.has(truck.status)) {
      blockers.push(`Truck is ${truck.status.replace('_', ' ').toLowerCase()}`);
    }
    if (offer.availableT <= 0) blockers.push('No spare capacity remaining');
    if (!onRoute) blockers.push(`Route does not cover ${origin ?? '?'} → ${destination ?? '?'}`);
    if (!fits && required) blockers.push(`Takes only ${round(truck.availableT)}T of the ${round(required)}T request`);
    return {
      offer,
      truck,
      driverName: driver?.name ?? null,
      route: `${offer.origin} → ${offer.destination}`,
      etaLabel: offer.departureAt ? etaLabelFor(offer.departureAt) : 'Unscheduled',
      estimatedPrice: Math.round(truck.availableT * offer.pricePerT),
      currency: 'INR',
      matchesRequestedRoute: onRoute,
      fitsRequestedWeight: fits,
      blockers,
      segmentFit: fit,
      segmentNote: origin && destination ? segmentNote(fit, destination, offer.destination) : null,
      canCarryT: required > 0 ? round(Math.min(truck.availableT, required)) : round(truck.availableT),
      spareAfterT: fits && required ? round(truck.availableT - required) : null,
      priceForRequest: required > 0 && fits ? Math.round(required * offer.pricePerT) : null,
      priceForSplit:
        required > 0 && !fits ? Math.round(Math.min(truck.availableT, required) * offer.pricePerT) : null,
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
    // The same segment rule the search uses. Booking must agree with search: if
    // `GET /capacity/options` offered a passing truck for a half-route drop, then
    // reserving on it has to work rather than fail with a route-mismatch error.
    const fit = segmentFit(truck.origin, truck.destination, shipment.origin, shipment.destination);
    if (fit === 'NONE' || fit === 'UNKNOWN') {
      throw ApiError.unprocessable(
        `Truck ${truck.id} runs ${truck.origin} → ${truck.destination}, which does not cover ` +
          `pickup in ${shipment.origin} and delivery in ${shipment.destination}.`,
        { truckRoute: `${truck.origin} → ${truck.destination}`, requested: `${shipment.origin} → ${shipment.destination}` },
      );
    }
    if (fit === 'REVERSED') {
      throw ApiError.unprocessable(
        `Truck ${truck.id} runs the other way — ${truck.origin} → ${truck.destination}.`,
        { truckRoute: `${truck.origin} → ${truck.destination}` },
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
