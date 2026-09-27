/**
 * Deterministic corridor geometry for the Control Tower diagram.
 * Mirrors `server/src/lib/geo.ts`. Distances/ETAs shown in the UI are demo
 * estimates and are labelled as such — this is a schematic, not a map.
 */
export interface CorridorPoint {
  city: string;
  lat: number;
  lng: number;
  progress: number;
}

export const ROUTE_CORRIDOR: CorridorPoint[] = [
  { city: 'Bengaluru', lat: 12.9716, lng: 77.5946, progress: 0 },
  { city: 'Electronic City', lat: 12.8452, lng: 77.6602, progress: 0.08 },
  { city: 'Attibele', lat: 12.7783, lng: 77.7712, progress: 0.14 },
  { city: 'Hosur', lat: 12.7409, lng: 77.8253, progress: 0.20 },
  { city: 'Shoolagiri', lat: 12.6658, lng: 78.0121, progress: 0.28 },
  { city: 'Krishnagiri', lat: 12.5186, lng: 78.2138, progress: 0.36 },
  { city: 'Bargur', lat: 12.5442, lng: 78.3615, progress: 0.43 },
  { city: 'Natrampalli', lat: 12.6074, lng: 78.5303, progress: 0.49 },
  { city: 'Vaniyambadi', lat: 12.6825, lng: 78.6200, progress: 0.55 },
  { city: 'Ambur', lat: 12.7904, lng: 78.7166, progress: 0.61 },
  { city: 'Pallikonda', lat: 12.8751, lng: 78.9329, progress: 0.68 },
  { city: 'Vellore', lat: 12.9165, lng: 79.1325, progress: 0.75 },
  { city: 'Ranipet', lat: 12.9304, lng: 79.3621, progress: 0.81 },
  { city: 'Kanchipuram', lat: 12.8342, lng: 79.7036, progress: 0.88 },
  { city: 'Sriperumbudur', lat: 12.9675, lng: 79.9439, progress: 0.94 },
  { city: 'Chennai', lat: 13.0827, lng: 80.2707, progress: 1 },
];

/** Where a truck sits on the drawn corridor, derived from its server coordinates. */
export function progressFor(lat: number, lng: number, origin: string, destination: string): number {
  const start = ROUTE_CORRIDOR.find((n) => n.city === origin) ?? ROUTE_CORRIDOR[0];
  const end = ROUTE_CORRIDOR.find((n) => n.city === destination) ?? ROUTE_CORRIDOR[ROUTE_CORRIDOR.length - 1];
  if (!start || !end) return 0;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return start.progress;

  const legs = ROUTE_CORRIDOR.filter((n) => n.progress >= start.progress && n.progress <= end.progress);
  const path = legs.length >= 2 ? legs : [start, end];

  let best = { progress: start.progress, distance: Number.POSITIVE_INFINITY };
  for (let i = 0; i < path.length - 1; i += 1) {
    const a = path[i] as CorridorPoint;
    const b = path[i + 1] as CorridorPoint;
    const t = clamp01(projectOntoSegment(lat, lng, a, b));
    const point = { lat: a.lat + (b.lat - a.lat) * t, lng: a.lng + (b.lng - a.lng) * t };
    const distance = haversineKm({ lat, lng }, point);
    const progress = a.progress + (b.progress - a.progress) * t;
    if (distance < best.distance) best = { progress, distance };
  }
  return best.progress;
}

function projectOntoSegment(
  lat: number,
  lng: number,
  a: CorridorPoint,
  b: CorridorPoint,
): number {
  // Equirectangular projection is plenty accurate over a ~350 km corridor.
  const kx = Math.cos((((a.lat + b.lat) / 2) * Math.PI) / 180);
  const ax = a.lng;
  const ay = a.lat;
  const bx = b.lng;
  const by = b.lat;
  const px = lng;
  const py = lat;
  const dx = (bx - ax) * kx;
  const dy = by - ay;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return 0;
  return ((px - ax) * kx * dx + (py - ay) * dy) / lenSq;
}

function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * R * Math.asin(Math.sqrt(h));
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}
