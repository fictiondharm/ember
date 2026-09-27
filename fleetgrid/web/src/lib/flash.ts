/**
 * Row-flash tone.
 *
 * A decline used to flash the same green as an acceptance, so rejecting a load
 * looked like a completed action. Tone is derived from the event that caused the
 * refetch, which keeps "something happened" and "something went well" separate.
 */
export type FlashKind = 'ok' | 'release' | 'alert';

const TONE_CLASS: Record<FlashKind, string> = {
  ok: 'animate-flash-row',
  release: 'animate-flash-row-release',
  alert: 'animate-flash-row-alert',
};

/** Events that mean capacity went back or a load was rejected. */
const RELEASE_EVENTS = new Set(['shipment.capacity_released']);

/** Events that mean something is wrong and needs a human. */
const ALERT_EVENTS = new Set([
  'incident.opened',
  'incident.resolved',
  'shipment.at_risk',
  'shipment.recovery_started',
]);

export function flashKindFor(eventType: string): FlashKind {
  if (RELEASE_EVENTS.has(eventType)) return 'release';
  if (ALERT_EVENTS.has(eventType)) return 'alert';
  return 'ok';
}

/** Empty string when the row is not flashing, so it can be passed straight to `cn`. */
export function flashClassFor(kind: FlashKind | undefined, id: string, flashIds: string[]): string {
  if (!flashIds.includes(id)) return '';
  return TONE_CLASS[kind ?? 'ok'];
}
