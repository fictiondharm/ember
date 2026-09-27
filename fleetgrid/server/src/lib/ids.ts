import { createHash, randomUUID } from 'node:crypto';

export function newId(prefix: string): string {
  return `${prefix}_${randomUUID().replace(/-/g, '').slice(0, 12)}`;
}

/** Deterministic hash used to canonicalise ShipmentEvent records. Never a blockchain receipt. */
export function sha256(input: string): string {
  return createHash('sha256').update(input, 'utf8').digest('hex');
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function round(n: number, decimals = 2): number {
  const f = 10 ** decimals;
  return Math.round(n * f) / f;
}

/** Joins a demo-deterministic ISO timestamp offset from a fixed demo epoch. */
export function demoTime(hoursFromEpoch: number): string {
  return new Date(DEMO_EPOCH_MS + hoursFromEpoch * 3600_000).toISOString();
}

/**
 * Fixed epoch so `POST /demo/reset` always restores byte-identical demo data.
 * 2026-04-18T04:00:00.000Z (10:00 IST on hackathon demo day).
 */
export const DEMO_EPOCH_MS = Date.UTC(2026, 3, 18, 4, 0, 0, 0);
