import { db } from '../store/db.js';
import { ApiError } from '../lib/errors.js';
import { newId, nowIso, round } from '../lib/ids.js';
import { runExclusive } from '../lib/mutex.js';
import { recordEvent } from './events.js';
import { hub } from './realtime.js';
import { getIncident, setIncidentStatus } from './incidents.js';
import { getShipment, releaseCapacity, setShipmentStatus } from './shipments.js';
import { transitionTruck } from './trucks.js';
import { RECOVERY_PLAN_TRANSITIONS, type RecoveryOption, type RecoveryPlan } from '../types.js';

/**
 * Deterministic demo estimates (Master PRD §17).
 *
 * These are seeded demo numbers, NOT routing-provider output. Anything not listed
 * falls back to a haversine estimate with a road factor, and the UI labels every
 * distance/ETA as a demo estimate.
 */
const DEMO_LEG_ESTIMATES: Record<string, { distanceKm: number; etaMinutes: number }> = {
  'FG-041': { distanceKm: 8.2, etaMinutes: 17 },
  'FG-052': { distanceKm: 15.8, etaMinutes: 26 },
};

const DEMO_SPEED_KMH = 32;
const ROAD_FACTOR = 1.35;
const RECOVERY_COST_MULTIPLIER = 1.25;
const CARGO_TRANSFER_MINUTES = 25;
const UNASSIGNED_RECOVERY_TRUCKS = ['FG-041', 'FG-052'];

export interface ImpactSummary {
  incidentId: string;
  truckId: string;
  location: string;
  affectedShipments: Array<{
    id: string;
    cargoName: string;
    weightT: number;
    status: string;
    origin: string;
    destination: string;
    deadlineAt: string | null;
    shipperId: string;
  }>;
  totalWeightT: number;
  origin: string;
  destination: string;
  notes: string[];
}

export async function calculateImpact(incidentId: string): Promise<ImpactSummary> {
  const incident = await getIncident(incidentId);
  const truck = await db.trucks.findById(incident.truckId);
  if (!truck) throw ApiError.notFound(`Truck ${incident.truckId} does not exist.`);

  const shipments = await db.shipments.find((s) => incident.affectedShipmentIds.includes(s.id));
  const totalWeightT = round(shipments.reduce((sum, s) => sum + s.weightT, 0));

  return {
    incidentId: incident.id,
    truckId: truck.id,
    location: incident.location,
    origin: truck.origin,
    destination: truck.destination,
    totalWeightT,
    affectedShipments: shipments.map((s) => ({
      id: s.id,
      cargoName: s.cargoName,
      weightT: s.weightT,
      status: s.status,
      origin: s.origin,
      destination: s.destination,
      shipperId: s.shipperId,
      deadlineAt: s.deadlineAt,
    })),
    notes: [
      `Truck ${truck.id} is blocked at ${incident.location} (${incident.severity.toLowerCase()} severity).`,
      `${shipments.length} shipment(s) carrying ${totalWeightT}T are now AT_RISK.`,
      'Distances and ETAs below are demo estimates unless a routing provider is integrated.',
    ],
  };
}

function estimateLeg(
  truckId: string,
  from: { lat: number; lng: number },
  to: { lat: number; lng: number },
): { distanceKm: number; etaMinutes: number } {
  const seeded = DEMO_LEG_ESTIMATES[truckId];
  if (seeded && UNASSIGNED_RECOVERY_TRUCKS.includes(truckId)) return seeded;

  const distanceKm = round(haversineKm(from, to) * ROAD_FACTOR, 1);
  return { distanceKm, etaMinutes: Math.max(5, Math.round((distanceKm / DEMO_SPEED_KMH) * 60)) };
}

function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 + Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * R * Math.asin(Math.sqrt(h));
}

const UNAVAILABLE_RECOVERY_STATES = new Set(['DELIVERED', 'RECOVERY', 'INCIDENT']);

/** Deterministic candidate generation, identical to the eventual agent's read tools. */
export async function findRecoveryOptions(incidentId: string): Promise<{
  impact: ImpactSummary;
  options: RecoveryOption[];
}> {
  const impact = await calculateImpact(incidentId);
  const incident = await getIncident(incidentId);
  const blockedTruck = await db.trucks.findById(impact.truckId);
  if (!blockedTruck) throw ApiError.notFound(`Truck ${impact.truckId} does not exist.`);

  const [trucks, offers, drivers] = await Promise.all([
    db.trucks.get(),
    db.capacityOffers.get(),
    db.drivers.get(),
  ]);

  const incidentPoint = Number.isFinite(blockedTruck.lat)
    ? { lat: blockedTruck.lat, lng: blockedTruck.lng }
    : { lat: blockedTruck.lat, lng: blockedTruck.lng };

  const options: RecoveryOption[] = trucks
    .filter((truck) => truck.id !== blockedTruck.id)
    .map((truck) => {
      const offer = offers.find((o) => o.truckId === truck.id);
      const leg = estimateLeg(truck.id, incidentPoint, { lat: truck.lat, lng: truck.lng });
      const cost = Math.round(impact.totalWeightT * (offer?.pricePerT ?? 850) * RECOVERY_COST_MULTIPLIER);

      const blockers: string[] = [];
      if (truck.availableT < impact.totalWeightT) {
        blockers.push(`insufficient spare capacity (${round(truck.availableT)}T < ${impact.totalWeightT}T)`);
      }
      if (truck.destination !== impact.destination) {
        blockers.push(`does not deliver to ${impact.destination}`);
      }
      if (truck.origin !== impact.origin) {
        blockers.push(`does not pick up from ${impact.origin}`);
      }
      if (UNAVAILABLE_RECOVERY_STATES.has(truck.status)) {
        blockers.push(`truck is ${truck.status}`);
      }
      if (offer?.status === 'CLOSED') {
        blockers.push('capacity offer closed');
      }

      const driver = truck.driverId ? drivers.find((d) => d.id === truck.driverId) : undefined;
      const facts = [
        `${round(truck.availableT)}T spare`,
        `${leg.distanceKm} km away`,
        `${leg.etaMinutes} min estimated arrival`,
        driver ? `driver ${driver.name}` : 'no driver assigned',
      ];

      return {
        truckId: truck.id,
        availableT: round(truck.availableT),
        etaMinutes: leg.etaMinutes,
        distanceKm: leg.distanceKm,
        cost,
        currency: 'INR',
        compatible: blockers.length === 0,
        reason: blockers.length === 0 ? `Compatible: ${facts.join(', ')}` : `Rejected: ${blockers.join('; ')}`,
      } satisfies RecoveryOption;
    })
    .sort((a, b) => {
      if (a.compatible !== b.compatible) return a.compatible ? -1 : 1;
      if (a.etaMinutes !== b.etaMinutes) return a.etaMinutes - b.etaMinutes;
      return a.cost - b.cost;
    });

  void incident;
  return { impact, options };
}

export async function listRecoveryPlans(filter?: { incidentId?: string }): Promise<RecoveryPlan[]> {
  return db.recoveryPlans.find((p) => (filter?.incidentId ? p.incidentId === filter.incidentId : true));
}

export async function getRecoveryPlan(id: string): Promise<RecoveryPlan> {
  const plan = await db.recoveryPlans.findById(id);
  if (!plan) throw ApiError.notFound(`Recovery plan ${id} does not exist.`);
  return plan;
}

export interface CreatePlanResult {
  plan: RecoveryPlan;
  incident: Awaited<ReturnType<typeof getIncident>>;
  options: RecoveryOption[];
  created: boolean;
}

/**
 * create_recovery_plan — deterministic, no LLM.
 *
 * The incident moves OPEN -> ANALYZING -> PLAN_READY and the plan is created in
 * PENDING_APPROVAL. Nothing is reassigned until an operator approves and executes.
 */
export async function createRecoveryPlan(incidentId: string): Promise<CreatePlanResult> {
  return runExclusive(async () => {
    const incident = await getIncident(incidentId);
    const { impact, options } = await findRecoveryOptions(incidentId);

    const existing = await db.recoveryPlans.find((p) => p.incidentId === incidentId);
    if (existing.length > 0) {
      const plan = existing[0] as RecoveryPlan;
      return { plan, incident, options: plan.options, created: false };
    }

    if (incident.status === 'OPEN') {
      await setIncidentStatus(incident, 'ANALYZING', { reason: 'Recovery analysis started' });
    }
    const analyzing = incident.status === 'OPEN' ? { ...incident, status: 'ANALYZING' as const } : incident;
    if (analyzing.status === 'ANALYZING') {
      await setIncidentStatus(analyzing, 'PLAN_READY', { reason: 'Deterministic options generated' });
    }

    const compatible = options.filter((o) => o.compatible);
    const selected = compatible[0] ?? null;

    const plan: RecoveryPlan = {
      id: newId('RCP'),
      incidentId,
      affectedShipmentIds: impact.affectedShipments.map((s) => s.id),
      options,
      selectedTruckId: selected?.truckId ?? null,
      cost: selected?.cost ?? 0,
      etaDeltaMinutes: selected ? selected.etaMinutes + CARGO_TRANSFER_MINUTES : 0,
      status: 'PENDING_APPROVAL',
      approvedBy: null,
      approvedAt: null,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };

    const saved = await db.recoveryPlans.create(plan);
    await db.incidents.update(incidentId, { recoveryPlanId: saved.id, updatedAt: nowIso() });
    await recordEvent({
      eventType: 'recovery.plan_proposed',
      incidentId,
      truckId: impact.truckId,
      payload: {
        planId: saved.id,
        candidateCount: compatible.length,
        rejectedCount: options.length - compatible.length,
        selectedTruckId: saved.selectedTruckId,
        cost: saved.cost,
        etaDeltaMinutes: saved.etaDeltaMinutes,
        engine: 'DETERMINISTIC_PLACEHOLDER',
        note: 'LLM reasoning is a later phase. Options are generated deterministically from backend state.',
      },
      actorType: 'AGENT',
    });
    hub.broadcast('recovery.updated', saved);
    return { plan: saved, incident, options, created: true };
  });
}

export async function approveRecoveryPlan(planId: string, approvedBy: string): Promise<RecoveryPlan> {
  return runExclusive(async () => {
    const plan = await getRecoveryPlan(planId);
    if (plan.status === 'APPROVED' || plan.status === 'EXECUTING' || plan.status === 'COMPLETED') {
      return plan;
    }
    if (plan.status !== 'PENDING_APPROVAL') {
      throw ApiError.conflict(
        `Recovery plan ${planId} is ${plan.status}. Only a PENDING_APPROVAL plan can be approved.`,
        { status: plan.status },
      );
    }
    const updated = await db.recoveryPlans.update(planId, {
      status: 'APPROVED',
      approvedBy,
      approvedAt: nowIso(),
      updatedAt: nowIso(),
    });
    if (!updated) throw ApiError.notFound(`Recovery plan ${planId} disappeared during approval.`);
    await recordEvent({
      eventType: 'recovery.approved',
      incidentId: updated.incidentId,
      payload: { planId: updated.id, approvedBy },
      actorType: 'OPERATOR',
      actorId: approvedBy,
    });
    hub.broadcast('recovery.updated', updated);
    return updated;
  });
}

export async function rejectRecoveryPlan(planId: string, rejectedBy: string, reason: string): Promise<RecoveryPlan> {
  return runExclusive(async () => {
    const plan = await getRecoveryPlan(planId);
    const updated = await db.recoveryPlans.update(planId, {
      status: 'REJECTED',
      approvedBy: rejectedBy,
      updatedAt: nowIso(),
    });
    if (!updated) throw ApiError.notFound(`Recovery plan ${planId} disappeared.`);
    void RECOVERY_PLAN_TRANSITIONS[plan.status];
    await recordEvent({
      eventType: 'recovery.rejected',
      incidentId: updated.incidentId,
      payload: { planId: updated.id, rejectedBy, reason },
      actorType: 'OPERATOR',
      actorId: rejectedBy,
    });
    hub.broadcast('recovery.updated', updated);
    return updated;
  });
}

export interface ExecuteResult {
  plan: RecoveryPlan;
  reassignments: Array<{
    shipmentId: string;
    fromTruckId: string | null;
    toTruckId: string;
    releasedT: number;
  }>;
  verification: {
    shipmentStatus: string;
    fromTruckStatus: string;
    toTruckStatus: string;
    toTruckAvailableT: number;
    incidentStatus: string;
  };
  notifications: string[];
  alreadyExecuted: boolean;
}

/**
 * execute_recovery — the only path that moves cargo, and only for an APPROVED plan.
 * Idempotent: re-running a COMPLETED plan returns the recorded result.
 */
export async function executeRecoveryPlan(planId: string, executedBy: string): Promise<ExecuteResult> {
  return runExclusive(async () => {
    const plan = await getRecoveryPlan(planId);

    const state = await readPlanState(plan);
    if (plan.status === 'COMPLETED') {
      return { ...state, alreadyExecuted: true };
    }
    if (plan.status !== 'APPROVED' && plan.status !== 'EXECUTING') {
      throw ApiError.conflict(
        `Recovery plan ${planId} is ${plan.status}. Execution requires an APPROVED plan — the approval gate cannot be bypassed.`,
        { status: plan.status, required: ['APPROVED'] },
      );
    }
    if (!plan.selectedTruckId) {
      throw ApiError.conflict(`Recovery plan ${planId} has no selected replacement truck, so it cannot execute.`);
    }

    await db.recoveryPlans.update(planId, { status: 'EXECUTING', updatedAt: nowIso() });

    const incident = await getIncident(plan.incidentId);
    const originalTruck = await db.trucks.findById(incident.truckId);
    const targetTruck = await db.trucks.findById(plan.selectedTruckId);
    if (!originalTruck) throw ApiError.notFound(`Truck ${incident.truckId} does not exist.`);
    if (!targetTruck) throw ApiError.notFound(`Replacement truck ${plan.selectedTruckId} does not exist.`);

    const reassignments: ExecuteResult['reassignments'] = [];

    for (const shipmentId of plan.affectedShipmentIds) {
      const shipment = await db.shipments.findById(shipmentId);
      if (!shipment) continue;
      if (shipment.truckId === targetTruck.id) {
        reassignments.push({ shipmentId, fromTruckId: shipment.truckId, toTruckId: targetTruck.id, releasedT: 0 });
        continue;
      }

      const release = await releaseCapacity(shipment, `Recovery plan ${planId} approved by ${executedBy}`);

      if (targetTruck.availableT < shipment.weightT) {
        throw ApiError.unprocessable(
          `Replacement truck ${targetTruck.id} now has only ${round(targetTruck.availableT)}T spare, which cannot take ${shipment.weightT}T.`,
        );
      }

      const decremented = await db.trucks.update(targetTruck.id, {
        availableT: round(targetTruck.availableT - shipment.weightT),
        status: targetTruck.status === 'AVAILABLE' ? 'ASSIGNED' : targetTruck.status,
      });
      if (!decremented) throw ApiError.notFound(`Truck ${targetTruck.id} disappeared during recovery.`);
      hub.broadcast('truck.updated', decremented);
      const offers = await db.capacityOffers.find((o) => o.truckId === targetTruck.id);
      const offer = offers[0];
      if (offer) {
        const nextAvailable = round(decremented.availableT);
        const updatedOffer = await db.capacityOffers.update(offer.id, {
          availableT: nextAvailable,
          status: nextAvailable > 0 ? 'OPEN' : 'HELD',
          updatedAt: nowIso(),
        });
        if (updatedOffer) hub.broadcast('capacity.updated', updatedOffer);
      }

      const reassigned = await db.shipments.update(shipment.id, {
        truckId: targetTruck.id,
        updatedAt: nowIso(),
      });
      if (!reassigned) throw ApiError.notFound(`Shipment ${shipment.id} disappeared during recovery.`);

      if (reassigned.status === 'AT_RISK') {
        await setShipmentStatus(reassigned, 'RECOVERY', {
          planId: plan.id,
          toTruckId: targetTruck.id,
        }, 'AGENT');
      }
      const recoveryState = await db.shipments.findById(shipment.id);
      if (recoveryState && recoveryState.status === 'RECOVERY') {
        await setShipmentStatus(
          recoveryState,
          'IN_TRANSIT',
          { planId: plan.id, toTruckId: targetTruck.id, cargoTransferMinutes: CARGO_TRANSFER_MINUTES },
          'AGENT',
        );
      }

      await recordEvent({
        eventType: 'cargo.handoff',
        shipmentId: shipment.id,
        truckId: targetTruck.id,
        payload: {
          planId: plan.id,
          fromTruckId: originalTruck.id,
          toTruckId: targetTruck.id,
          releasedT: release.releasedT,
          recoveredTruckAvailableT: release.truck.availableT,
          note: 'Demo cargo handoff. No physical proof captured in this phase.',
        },
        actorType: 'AGENT',
      });

      reassignments.push({
        shipmentId: shipment.id,
        fromTruckId: release.truck.id,
        toTruckId: targetTruck.id,
        releasedT: release.releasedT,
      });
    }

    if (originalTruck.status === 'INCIDENT') {
      await transitionTruck(originalTruck, 'RECOVERY', {}, {
        eventType: 'truck.recovery',
        payload: { planId: plan.id },
      });
    }

    const currentIncident = await db.incidents.findById(incident.id);
    if (currentIncident && currentIncident.status !== 'RESOLVED') {
      const toPlanReady: Record<string, 'ANALYZING' | 'PLAN_READY'> = {
        OPEN: 'ANALYZING',
        ANALYZING: 'PLAN_READY',
        ESCALATED: 'ANALYZING',
      };
      const next = toPlanReady[currentIncident.status];
      if (next) {
        const moved = await setIncidentStatus(currentIncident, next, { planId: plan.id });
        await setIncidentStatus(moved, 'PLAN_READY', { planId: plan.id });
      }
      const ready = await db.incidents.findById(incident.id);
      if (ready && ready.status === 'PLAN_READY') {
        await setIncidentStatus(ready, 'RESOLVED', { planId: plan.id, resolvedBy: plan.approvedBy });
      }
    }

    const notificationIds: string[] = [];
    const targetDriver = targetTruck.driverId ? await db.drivers.findById(targetTruck.driverId) : undefined;
    if (targetDriver) {
      const row = await db.notifications.create({
        id: newId('ntf'),
        recipientId: targetDriver.id,
        type: 'RECOVERY_INSTRUCTION',
        message: `Collect ${plan.affectedShipmentIds.join(', ')} from ${originalTruck.id} at ${incident.location} and continue to ${targetTruck.destination}.`,
        status: 'PENDING',
        createdAt: nowIso(),
      });
      notificationIds.push(row.id);
    }
    for (const shipmentId of plan.affectedShipmentIds) {
      const shipment = await db.shipments.findById(shipmentId);
      if (!shipment) continue;
      const row = await db.notifications.create({
        id: newId('ntf'),
        recipientId: shipment.shipperId,
        type: 'SHIPMENT_RECOVERED',
        message: `Shipment ${shipment.id} (${shipment.cargoName}) is being moved by ${targetTruck.id} after a breakdown near ${incident.location}. Revised ETA impact: +${plan.etaDeltaMinutes} min (demo estimate).`,
        status: 'PENDING',
        createdAt: nowIso(),
      });
      notificationIds.push(row.id);
      hub.broadcast('notification.created', row);
    }

    const completed = await db.recoveryPlans.update(planId, {
      status: 'COMPLETED',
      updatedAt: nowIso(),
    });
    if (!completed) throw ApiError.notFound(`Recovery plan ${planId} disappeared during execution.`);

    // The cargo has been moved off the disabled truck, so it goes back into service
    // rather than staying stranded in RECOVERY. Demo assumption: repaired on site.
    const releasedTruck = await db.trucks.findById(originalTruck.id);
    if (releasedTruck && releasedTruck.status === 'RECOVERY') {
      const backInService = await transitionTruck(releasedTruck, 'AVAILABLE', {}, {
        eventType: 'truck.returned_to_service',
        payload: { planId: plan.id, incidentId: incident.id },
      });
      const releasedDriver = backInService.driverId ? await db.drivers.findById(backInService.driverId) : undefined;
      if (releasedDriver && releasedDriver.status === 'ON_JOURNEY') {
        await db.drivers.update(releasedDriver.id, { status: 'AVAILABLE' });
        hub.broadcast('driver.updated', await db.drivers.findById(releasedDriver.id));
      }
    }

    await recordEvent({
      eventType: 'recovery.completed',
      incidentId: incident.id,
      payload: {
        planId: plan.id,
        reassignments,
        toTruckId: targetTruck.id,
        notificationCount: notificationIds.length,
      },
      actorType: 'AGENT',
      actorId: executedBy,
    });
    hub.broadcast('recovery.updated', completed);

    const verified = await readPlanState(completed);
    return { ...verified, alreadyExecuted: false };
  });
}

async function readPlanState(plan: RecoveryPlan): Promise<Omit<ExecuteResult, 'alreadyExecuted'>> {
  const incident = await db.incidents.findById(plan.incidentId);
  const shipment = plan.affectedShipmentIds[0] ? await getShipment(plan.affectedShipmentIds[0]) : null;
  const fromTruck = incident ? await db.trucks.findById(incident.truckId) : undefined;
  const toTruck = plan.selectedTruckId ? await db.trucks.findById(plan.selectedTruckId) : undefined;

  const reassignments: ExecuteResult['reassignments'] = plan.affectedShipmentIds.map((id) => ({
    shipmentId: id,
    fromTruckId: fromTruck?.id ?? null,
    toTruckId: plan.selectedTruckId ?? '',
    releasedT: shipment && fromTruck ? shipment.weightT : 0,
  }));

  return {
    plan,
    reassignments,
    verification: {
      shipmentStatus: shipment?.status ?? 'UNKNOWN',
      fromTruckStatus: fromTruck?.status ?? 'UNKNOWN',
      toTruckStatus: toTruck?.status ?? 'UNKNOWN',
      toTruckAvailableT: toTruck ? round(toTruck.availableT) : 0,
      incidentStatus: incident?.status ?? 'UNKNOWN',
    },
    notifications: (await db.notifications.find((n) => n.type === 'RECOVERY_INSTRUCTION')).map((n) => n.id),
  };
}
