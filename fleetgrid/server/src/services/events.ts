import { db } from '../store/db.js';
import { ApiError } from '../lib/errors.js';
import { newId, nowIso, sha256 } from '../lib/ids.js';
import { hub } from './realtime.js';
import type { ActorType, ProofStatus, ShipmentEvent } from '../types.js';

export interface RecordEventInput {
  eventType: string;
  shipmentId?: string | null;
  incidentId?: string | null;
  truckId?: string | null;
  payload?: Record<string, unknown>;
  actorType?: ActorType;
  actorId?: string | null;
  proofStatus?: ProofStatus;
}

/**
 * Append-only event log (Master PRD §9).
 *
 * Every important state change goes through here. The hash is a plain SHA-256 of
 * the canonical record — it is NOT a blockchain receipt, and `proofStatus` stays
 * `NOT_ANCHORED` until a real anchoring phase confirms one.
 */
export async function recordEvent(input: RecordEventInput): Promise<ShipmentEvent> {
  const id = newId('evt');
  const timestamp = nowIso();
  const payload = input.payload ?? {};
  const canonical = JSON.stringify({
    id,
    shipmentId: input.shipmentId ?? null,
    truckId: input.truckId ?? null,
    eventType: input.eventType,
    payload,
    timestamp,
  });

  const event: ShipmentEvent = {
    id,
    shipmentId: input.shipmentId ?? null,
    incidentId: input.incidentId ?? null,
    truckId: input.truckId ?? null,
    eventType: input.eventType,
    payload,
    actorType: input.actorType ?? 'SYSTEM',
    actorId: input.actorId ?? null,
    timestamp,
    hash: sha256(canonical),
    blockchainTx: null,
    proofStatus: input.proofStatus ?? 'NOT_ANCHORED',
  };

  const saved = await db.events.create(event);
  hub.broadcast('event.appended', saved);
  return saved;
}

/** Valid transition helper driven by the Master PRD state machines. */
export function assertTransition<T extends string>(
  transitions: Record<T, T[]>,
  from: T,
  to: T,
  label: string,
): void {
  const allowed = transitions[from] ?? [];
  if (!allowed.includes(to)) {
    throw ApiError.conflict(
      `${label} cannot move from ${from} to ${to}. Allowed next states: ${allowed.length ? allowed.join(', ') : 'none (terminal state)'}.`,
      { from, to, allowed },
    );
  }
}
