/**
 * Deterministic demo geography.
 *
 * The Bengaluru -> Chennai corridor is stylised (Hosur sits at 42% of the drawn
 * corridor) so the Control Tower diagram reads well. Distances and ETAs shown in
 * the UI are demo estimates, never presented as routing-provider output
 * (Master PRD §17).
 */
export interface CorridorNode {
  city: string;
  lat: number;
  lng: number;
  /** 0..1 position along the drawn corridor (visual only). */
  progress: number;
}

export const ROUTE_CORRIDOR: CorridorNode[] = [
  { city: 'Bengaluru', lat: 12.9716, lng: 77.5946, progress: 0 },
  { city: 'Hosur', lat: 12.7299, lng: 77.5172, progress: 0.42 },
  { city: 'Chennai', lat: 13.0827, lng: 80.2707, progress: 1 },
];

const LOCATION_ALIASES: Record<string, string> = {
  bengaluru: 'Bengaluru',
  bangalore: 'Bengaluru',
  hosur: 'Hosur',
  'hosur, tamil nadu': 'Hosur',
  chennai: 'Chennai',
  madras: 'Chennai',
  'new hosur': 'Hosur',
  nellore: 'Nellore',
  tiruppur: 'Tiruppur',
  krishnagiri: 'Krishnagiri',
};

/** Loose coordinates for incident locations that are not on the seeded corridor. */
const EXTRA_POINTS: Record<string, { lat: number; lng: number; progress: number }> = {
  Nellore: { lat: 14.4426, lng: 79.9864, progress: 0.74 },
  Tiruppur: { lat: 11.1085, lng: 77.3411, progress: 0.3 },
  Krishnagiri: { lat: 12.5266, lng: 78.2141, progress: 0.2 },
};

/** Normalises a free-text location to a canonical city label where possible. */
export function canonicalLocation(raw: string): string {
  const key = raw.trim().toLowerCase();
  return LOCATION_ALIASES[key] ?? raw.trim();
}

export function resolveLocation(raw: string): {
  label: string;
  lat: number;
  lng: number;
  progress: number;
  simulated: boolean;
} {
  const label = canonicalLocation(raw);
  const corridor = ROUTE_CORRIDOR.find((node) => node.city === label);
  if (corridor) {
    return { label, lat: corridor.lat, lng: corridor.lng, progress: corridor.progress, simulated: true };
  }
  const extra = EXTRA_POINTS[label];
  if (extra) {
    return { label, lat: extra.lat, lng: extra.lng, progress: extra.progress, simulated: true };
  }
  // Unknown location: keep the truck where it was and mark the position as unresolved.
  return { label, lat: Number.NaN, lng: Number.NaN, progress: Number.NaN, simulated: true };
}

/** Human ETA label relative to now, for a scheduled departure slot. */
export function etaLabelFor(departureAtIso: string): string {
  const departure = Date.parse(departureAtIso);
  if (Number.isNaN(departure)) return 'Unscheduled';
  const hours = (departure - Date.now()) / 3_600_000;
  if (hours <= 12) return 'Today';
  if (hours <= 36) return 'Tomorrow';
  return new Date(departure).toISOString().slice(0, 10);
}

const EARTH_RADIUS_KM = 6371;
const toRad = (deg: number): number => (deg * Math.PI) / 180;

/**
 * The Bengaluru → Chennai corridor in travel order, including the intermediate
 * stops a shipper might want to use.
 *
 * This is what makes a half-route request work: a truck running the whole
 * Bengaluru → Chennai lane also passes Krishnagiri, Hosur and Nellore, so it can
 * legitimately serve Bengaluru → Hosur without being re-seeded as a separate lane.
 *
 * Order is declared rather than derived from latitude because the demo corridor is
 * stylised; sorting by coordinates would put Tiruppur (off to the west, near
 * Coimbatore) in the middle of a lane it is not part of.
 */
export const CORRIDOR_ORDER = ['Bengaluru', 'Krishnagiri', 'Hosur', 'Nellore', 'Chennai'] as const;

/** Position of a city along the corridor, or null when it is not on the lane. */
export function corridorIndex(city: string): number | null {
  const key = canonicalLocation(city);
  const idx = CORRIDOR_ORDER.indexOf(key as (typeof CORRIDOR_ORDER)[number]);
  return idx === -1 ? null : idx;
}

export type SegmentFit = 'EXACT' | 'PARTIAL' | 'NONE' | 'REVERSED' | 'UNKNOWN';

/**
 * Can a truck running `truckOrigin → truckDestination` carry a shipment that only
 * needs `shipOrigin → shipDestination`?
 *
 * PARTIAL means the truck covers a longer run than the shipment needs, which is the
 * half-route case. REVERSED means the two run the same lane in opposite directions,
 * which this build does not serve — reported honestly rather than silently matching.
 */
export function segmentFit(
  truckOrigin: string,
  truckDestination: string,
  shipOrigin: string,
  shipDestination: string,
): SegmentFit {
  const tFrom = corridorIndex(truckOrigin);
  const tTo = corridorIndex(truckDestination);
  const sFrom = corridorIndex(shipOrigin);
  const sTo = corridorIndex(shipDestination);

  // Anything off the declared lane can only be matched exactly.
  if (tFrom === null || tTo === null || sFrom === null || sTo === null) {
    const exact =
      canonicalLocation(truckOrigin) === canonicalLocation(shipOrigin) &&
      canonicalLocation(truckDestination) === canonicalLocation(shipDestination);
    return exact ? 'EXACT' : 'NONE';
  }

  if (tFrom > tTo || sFrom > sTo) return 'REVERSED';
  if (tFrom <= sFrom && tTo >= sTo) {
    return tFrom === sFrom && tTo === sTo ? 'EXACT' : 'PARTIAL';
  }
  return 'NONE';
}

/** Human wording for a PARTIAL match, so the UI can say why a truck qualifies. */
export function segmentNote(fit: SegmentFit, shipDestination: string, truckDestination: string): string | null {
  if (fit !== 'PARTIAL') return null;
  return `On the way to ${truckDestination}, so it covers your ${shipDestination} drop`;
}

/**
 * Great-circle distance between two stored points, in km.
 *
 * This is real arithmetic over the seeded `lat`/`lng` on each truck, not a routing
 * provider result. The UI must present it as a proximity hint, not a drive distance
 * or an ETA (Master PRD §17: no fake routing data).
 */
export function distanceKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number | null {
  if (
    !Number.isFinite(a.lat) ||
    !Number.isFinite(a.lng) ||
    !Number.isFinite(b.lat) ||
    !Number.isFinite(b.lng)
  ) {
    return null;
  }
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return Math.round(2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h)) * 10) / 10;
}

/** Short, honest label for a proximity hint. Never presented as travel distance. */
export function proximityLabel(km: number | null): string {
  if (km === null) return 'Position unknown';
  if (km < 1) return 'Same area';
  if (km < 25) return `${Math.round(km)} km away`;
  return `${Math.round(km)} km away`;
}
