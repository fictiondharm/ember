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
