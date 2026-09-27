import { API_BASE } from './config';
import type {
  CapacityMatch,
  DemoLoginResponse,
  FleetSnapshot,
  Incident,
  RecoveryOption,
  RecoveryPlan,
  Role,
  Shipment,
  ShipmentEvent,
  Truck,
} from './types';

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      ...init,
      headers: { 'content-type': 'application/json', ...(init?.headers ?? {}) },
    });
  } catch (err) {
    throw new ApiError(
      0,
      'NETWORK',
      `Cannot reach the FleetGrid server at ${API_BASE}. Is the backend running? (${(err as Error).message})`,
    );
  }

  const text = await res.text();
  let body: unknown = null;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
  }

  if (!res.ok) {
    const error = (body as { error?: { code?: string; message?: string; details?: unknown } } | null)?.error;
    throw new ApiError(
      res.status,
      error?.code ?? 'ERROR',
      error?.message ?? `Request failed with status ${res.status}`,
      error?.details,
    );
  }

  return body as T;
}

const post = <T,>(path: string, body?: unknown) =>
  request<T>(path, { method: 'POST', body: body === undefined ? '{}' : JSON.stringify(body) });

export const api = {
  base: API_BASE,
  health: () => request<Record<string, unknown>>('/health'),
  state: () => request<FleetSnapshot>('/state'),
  demoLogin: (role: Role) => post<DemoLoginResponse>('/auth/demo-login', { role }),
  resetDemo: () => post<{ ok: true; trucks: number; shipments: number }>('/demo/reset'),

  trucks: () => request<{ trucks: Truck[] }>('/trucks'),
  truck: (id: string) => request<{ truck: Truck; shipments: Shipment[]; incidents: Incident[] }>(`/trucks/${id}`),
  depart: (id: string, driverId?: string) =>
    post<{ ok: true; truck: Truck; truckStatus: string; shipments: Shipment[] }>(
      `/trucks/${id}/depart`,
      driverId ? { driverId } : {},
    ),

  capacity: (params: { origin?: string; destination?: string; weightT?: number; includeAll?: boolean }) => {
    const qs = new URLSearchParams();
    if (params.origin) qs.set('origin', params.origin);
    if (params.destination) qs.set('destination', params.destination);
    if (params.weightT !== undefined) qs.set('weightT', String(params.weightT));
    if (params.includeAll) qs.set('includeAll', 'true');
    const suffix = qs.toString() ? `?${qs.toString()}` : '';
    return request<{ matches: CapacityMatch[]; count: number; note: string }>(`/capacity${suffix}`);
  },

  createShipment: (input: {
    shipperId: string;
    cargoName: string;
    origin: string;
    destination: string;
    weightT: number;
    capacityOfferId?: string;
    actorId?: string;
  }) =>
    post<{ ok: true; shipment: Shipment; reserved: boolean; confirmed: boolean }>('/shipments', input),

  shipments: () => request<{ shipments: Shipment[] }>('/shipments'),
  shipment: (id: string) => request<{ shipment: Shipment }>(`/shipments/${id}`),
  timeline: (id: string) =>
    request<{
      shipment: Shipment;
      truck: Truck | null;
      events: ShipmentEvent[];
      incidents: Incident[];
      recoveryPlans: RecoveryPlan[];
    }>(`/shipments/${id}/timeline`),

  createIncident: (input: {
    truckId: string;
    type: Incident['type'];
    location: string;
    description?: string;
    severity?: Incident['severity'];
    actorId?: string;
  }) =>
    post<{ ok: true; incident: Incident; truck: Truck; affectedShipments: Shipment[] }>('/incidents', input),
  incidents: () => request<{ incidents: Incident[] }>('/incidents'),
  incident: (id: string) => request<{ incident: Incident }>(`/incidents/${id}`),

  recoveryOptions: (incidentId: string) =>
    request<{
      options: RecoveryOption[];
      impact: {
        totalWeightT: number;
        notes: string[];
        affectedShipments: Array<{ id: string; cargoName: string; weightT: number }>;
      };
      engine: string;
    }>(`/incidents/${incidentId}/recovery-options`),

  createRecoveryPlan: (incidentId: string) =>
    post<{ ok: true; plan: RecoveryPlan; options: RecoveryOption[]; created: boolean; engine: string }>(
      '/recovery-plans',
      { incidentId },
    ),
  approvePlan: (planId: string, approvedBy: string) =>
    post<{ ok: true; plan: RecoveryPlan }>(`/recovery-plans/${planId}/approve`, { approvedBy }),
  executePlan: (planId: string, executedBy: string) =>
    post<{
      ok: true;
      plan: RecoveryPlan;
      verification: Record<string, string | number>;
      alreadyExecuted: boolean;
    }>(`/recovery-plans/${planId}/execute`, { executedBy }),

  recordEvent: (input: { eventType: string; shipmentId?: string; payload?: Record<string, unknown> }) =>
    post<{ ok: true; event: ShipmentEvent }>('/events', input),
};
