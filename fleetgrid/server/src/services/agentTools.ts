import { ApiError } from '../lib/errors.js';
import { db } from '../store/db.js';
import { nowIso } from '../lib/ids.js';
import { recordEvent, type RecordEventInput } from './events.js';
import { getIncident } from './incidents.js';
import {
  approveRecoveryPlan,
  calculateImpact,
  createRecoveryPlan,
  executeRecoveryPlan,
  findRecoveryOptions,
  getRecoveryPlan,
  rejectRecoveryPlan,
  type ExecuteResult,
} from './recovery.js';
import { listShipments, shipmentTimeline } from './shipments.js';
import { getTruck } from './trucks.js';
import type { CapacityOffer, Incident, RecoveryPlan, Shipment, Truck } from '../types.js';

/**
 * The only route to state mutation for the future recovery agent (Master PRD §9/§11).
 *
 * The LLM never gets a database handle. It will call these functions, each of
 * which validates its inputs and enforces the state machine. Tools marked
 * NOT_IMPLEMENTED are honest placeholders for a later phase — they fail loudly
 * instead of pretending to work.
 */
export interface ToolResult<T> {
  ok: true;
  tool: string;
  data: T;
}

function ok<T>(tool: string, data: T): ToolResult<T> {
  return { ok: true, tool, data };
}

function notImplemented(tool: string, why: string): never {
  throw new ApiError(
    501,
    'NOT_IMPLEMENTED',
    `Tool ${tool} is a placeholder in this phase. ${why}`,
  );
}

export interface ToolCatalogEntry {
  name: string;
  purpose: string;
  status: 'READY' | 'PLACEHOLDER';
  validates: string;
}

export const TOOL_CATALOG: ToolCatalogEntry[] = [
  { name: 'get_truck', purpose: 'Read current truck/capacity/location/status', status: 'READY', validates: 'Truck exists; caller scope' },
  { name: 'get_shipments_for_truck', purpose: 'Find cargo at risk', status: 'READY', validates: 'Truck scope' },
  { name: 'find_nearby_capacity', purpose: 'Find compatible spare capacity', status: 'READY', validates: 'Capacity, route, availability, status' },
  { name: 'get_route_options', purpose: 'Return route candidates', status: 'READY', validates: 'Origin/destination' },
  { name: 'calculate_impact', purpose: 'Compare ETA/cost/operational impact', status: 'READY', validates: 'Shipment constraints' },
  { name: 'create_recovery_plan', purpose: 'Create structured plan', status: 'READY', validates: 'Incident open; valid option' },
  { name: 'request_approval', purpose: 'Set plan awaiting operator', status: 'READY', validates: 'Plan valid' },
  { name: 'execute_recovery', purpose: 'Apply approved recovery', status: 'READY', validates: 'Plan APPROVED; idempotent' },
  { name: 'notify_driver', purpose: 'Send recovery/incident message', status: 'READY', validates: 'Recipient exists' },
  { name: 'notify_business', purpose: 'Send shipment update', status: 'READY', validates: 'Recipient exists' },
  { name: 'record_event', purpose: 'Append immutable event', status: 'READY', validates: 'Valid event schema' },
  { name: 'create_payment_intent', purpose: 'Start payment flow', status: 'PLACEHOLDER', validates: 'Amount/context valid' },
  { name: 'anchor_proof', purpose: 'Hash/anchor critical event', status: 'PLACEHOLDER', validates: 'Hash exists; no fake confirmation' },
];

export async function toolGetTruck(truckId: string): Promise<ToolResult<Truck>> {
  return ok('get_truck', await getTruck(truckId));
}

export async function toolGetShipmentsForTruck(truckId: string): Promise<ToolResult<Shipment[]>> {
  await getTruck(truckId);
  return ok('get_shipments_for_truck', await listShipments({ truckId }));
}

export interface NearbyCapacityInput {
  origin: string;
  destination: string;
  minAvailableT: number;
  excludeTruckIds?: string[];
}

export interface NearbyCapacityResult {
  offer: CapacityOffer;
  truck: Truck;
  route: string;
  driverName: string | null;
  pricePerT: number;
  currency: string;
  /** Demo estimate of the leg from the requesting position. Null when unknown. */
  distanceKm: number | null;
  etaMinutes: number | null;
}

export async function toolFindNearbyCapacity(input: NearbyCapacityInput): Promise<ToolResult<NearbyCapacityResult[]>> {
  if (!Number.isFinite(input.minAvailableT) || input.minAvailableT <= 0) {
    throw ApiError.badRequest('minAvailableT must be a positive number of tonnes.');
  }
  if (!input.origin || !input.destination) {
    throw ApiError.badRequest('origin and destination are required.');
  }
  return ok('find_nearby_capacity', await findCapacityForRoute(input));
}

/**
 * Route-keyed capacity search that does not need an incident.
 * Applies the same compatibility rules as recovery option generation.
 */
async function findCapacityForRoute(input: NearbyCapacityInput): Promise<NearbyCapacityResult[]> {
  const exclude = new Set(input.excludeTruckIds ?? []);
  const [offers, trucks, drivers] = await Promise.all([
    db.capacityOffers.get(),
    db.trucks.get(),
    db.drivers.get(),
  ]);

  const results: NearbyCapacityResult[] = [];

  for (const offer of offers) {
    if (exclude.has(offer.truckId)) continue;
    const truck = trucks.find((t) => t.id === offer.truckId);
    if (!truck) continue;
    if (offer.status === 'CLOSED') continue;
    if (truck.availableT < input.minAvailableT) continue;
    if (!canonicalEquals(truck.origin, input.origin)) continue;
    if (!canonicalEquals(truck.destination, input.destination)) continue;
    if (['DELIVERED', 'RECOVERY', 'INCIDENT'].includes(truck.status)) continue;

    const driver = truck.driverId ? drivers.find((d) => d.id === truck.driverId) : undefined;
    results.push({
      offer,
      truck,
      route: `${truck.origin} → ${truck.destination}`,
      driverName: driver?.name ?? null,
      pricePerT: offer.pricePerT,
      currency: 'INR',
      distanceKm: null,
      etaMinutes: null,
    });
  }

  return results;
}

export async function toolGetRouteOptions(input: { origin: string; destination: string }): Promise<
  ToolResult<{ origin: string; destination: string; availableTrucks: number; totalSpareT: number; cheapestPerT: number | null }>
> {
  if (!input.origin || !input.destination) {
    throw ApiError.badRequest('origin and destination are required.');
  }
  if (canonicalEquals(input.origin, input.destination)) {
    throw ApiError.unprocessable(`origin and destination are identical (${input.origin}).`);
  }
  const options = await findCapacityForRoute({ ...input, minAvailableT: 0.01 });
  const totalSpareT = options.reduce((sum, o) => sum + o.truck.availableT, 0);
  const prices = options.map((o) => o.pricePerT);
  return ok('get_route_options', {
    origin: input.origin,
    destination: input.destination,
    availableTrucks: options.length,
    totalSpareT: Math.round(totalSpareT * 100) / 100,
    cheapestPerT: prices.length ? Math.min(...prices) : null,
  });
}

function canonicalEquals(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

export async function toolCalculateImpact(incidentId: string) {
  return ok('calculate_impact', await calculateImpact(incidentId));
}

export async function toolCreateRecoveryPlan(incidentId: string) {
  const result = await createRecoveryPlan(incidentId);
  return ok('create_recovery_plan', {
    plan: result.plan,
    options: result.options,
    reusedExistingPlan: !result.created,
  });
}

export async function toolRequestApproval(planId: string): Promise<ToolResult<RecoveryPlan>> {
  const plan = await getRecoveryPlan(planId);
  if (plan.status !== 'PENDING_APPROVAL' && plan.status !== 'PROPOSED') {
    throw ApiError.conflict(
      `Plan ${planId} is already ${plan.status}; it does not need an approval request.`,
      { status: plan.status },
    );
  }
  return ok('request_approval', await getRecoveryPlan(planId));
}

export async function toolApproveRecoveryPlan(planId: string, approvedBy: string) {
  return ok('approve_recovery_plan', await approveRecoveryPlan(planId, approvedBy));
}

export async function toolRejectRecoveryPlan(planId: string, rejectedBy: string, reason: string) {
  return ok('reject_recovery_plan', await rejectRecoveryPlan(planId, rejectedBy, reason));
}

export async function toolExecuteRecovery(planId: string, executedBy: string): Promise<ToolResult<ExecuteResult>> {
  return ok('execute_recovery', await executeRecoveryPlan(planId, executedBy));
}

export async function toolNotifyDriver(input: { driverId: string; message: string; incidentId?: string | null }) {
  const driver = await db.drivers.findById(input.driverId);
  if (!driver) throw ApiError.notFound(`Driver ${input.driverId} does not exist.`);
  const notification = await db.notifications.create({
    id: `ntf_${Date.now().toString(36)}`,
    recipientId: driver.id,
    type: 'RECOVERY_INSTRUCTION',
    message: input.message,
    status: 'PENDING',
    createdAt: nowIso(),
  });
  return ok('notify_driver', { notification, delivered: false, note: 'Delivery infrastructure is a later phase.' });
}

export async function toolNotifyBusiness(input: { organizationId: string; message: string }) {
  const org = await db.organizations.findById(input.organizationId);
  if (!org) throw ApiError.notFound(`Organization ${input.organizationId} does not exist.`);
  const notification = await db.notifications.create({
    id: `ntf_${Date.now().toString(36)}`,
    recipientId: org.id,
    type: 'SHIPMENT_UPDATE',
    message: input.message,
    status: 'PENDING',
    createdAt: nowIso(),
  });
  return ok('notify_business', { notification, delivered: false, note: 'Delivery infrastructure is a later phase.' });
}

export async function toolRecordEvent(input: RecordEventInput) {
  if (!input.eventType) throw ApiError.badRequest('eventType is required.');
  return ok('record_event', await recordEvent(input));
}

export async function toolAnchorProof(eventId: string): Promise<never> {
  const event = await db.events.findById(eventId);
  if (!event) {
    throw ApiError.notFound(`Event ${eventId} does not exist, so there is no hash to anchor.`);
  }
  return notImplemented(
    'anchor_proof',
    `Event ${eventId} is hashed (${event.hash.slice(0, 12)}…) but no EVM testnet anchoring is configured in this phase. proofStatus stays NOT_ANCHORED rather than faking a confirmation.`,
  );
}

export async function toolCreatePaymentIntent(input: { amount: number; currency: string }): Promise<never> {
  if (!Number.isFinite(input.amount) || input.amount <= 0) {
    throw ApiError.badRequest('amount must be a positive number.');
  }
  return notImplemented(
    'create_payment_intent',
    'Dodo Payments integration is a later phase. Payments in this build are placeholders only.',
  );
}

export async function toolGetIncident(incidentId: string): Promise<ToolResult<Incident>> {
  return ok('get_incident', await getIncident(incidentId));
}

export async function toolGetShipmentTimeline(shipmentId: string) {
  return ok('get_shipment_timeline', await shipmentTimeline(shipmentId));
}
