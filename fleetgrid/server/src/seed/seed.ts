import { demoTime, sha256 } from '../lib/ids.js';
import { ROUTE_CORRIDOR } from '../lib/geo.js';
import type {
  CapacityOffer,
  Driver,
  Incident,
  Notification,
  Organization,
  Payment,
  RecoveryPlan,
  Shipment,
  ShipmentEvent,
  Truck,
  User,
} from '../types.js';

const node = (city: string) => {
  const found = ROUTE_CORRIDOR.find((n) => n.city === city);
  if (!found) throw new Error(`Unknown corridor city ${city}`);
  return found;
};

export interface SeedData {
  organizations: Organization[];
  users: User[];
  drivers: Driver[];
  trucks: Truck[];
  shipments: Shipment[];
  capacityOffers: CapacityOffer[];
  incidents: Incident[];
  recoveryPlans: RecoveryPlan[];
  payments: Payment[];
  events: ShipmentEvent[];
  notifications: Notification[];
}

export const SEED_ORG_IDS = {
  abc: 'org_abc_distributors',
  fleetgrid: 'org_fleetgrid_logistics',
} as const;

export const SEED_USER_IDS = {
  controlTower: 'user_olivia_control_tower',
  operator: 'user_arjun_operator',
  business: 'user_priya_business',
  driver: 'user_ravi_driver',
  driverFg041: 'user_imran_driver',
  driverFg052: 'user_suresh_driver',
} as const;

export const SEED_TRUCK_IDS = {
  fg027: 'FG-027',
  fg041: 'FG-041',
  fg052: 'FG-052',
} as const;

export const SEED_DRIVER_IDS = {
  ravi: 'drv_ravi_kumar',
  imran: 'drv_imran_sheikh',
  suresh: 'drv_suresh_naidu',
} as const;

/**
 * Deterministic demo dataset.
 *
 * Deviations from Master PRD §17, documented for the team lead:
 * - Master PRD lists FG-027 as a 10T truck with 6.2T loaded / 3.8T spare.
 *   The phase-1 brief for this build specifies 5.0T capacity / 3.8T spare
 *   (and the Driver screen mock shows "Capacity 5.0T / Remaining 2.8T").
 *   Spare capacity (3.8T) — the number the golden demo asserts — is identical.
 */
export function buildSeedData(): SeedData {
  const bengaluru = node('Bengaluru');
  const hosur = node('Hosur');

  const organizations: Organization[] = [
    {
      id: SEED_ORG_IDS.abc,
      name: 'ABC Distributors',
      type: 'SHIPPER',
      status: 'ACTIVE',
      createdAt: demoTime(0),
    },
    {
      id: SEED_ORG_IDS.fleetgrid,
      name: 'FleetGrid Logistics',
      type: 'FLEET_OPERATOR',
      status: 'ACTIVE',
      createdAt: demoTime(0),
    },
  ];

  const users: User[] = [
    {
      id: SEED_USER_IDS.controlTower,
      name: 'Olivia Grant',
      role: 'CONTROL_TOWER',
      organizationId: SEED_ORG_IDS.fleetgrid,
      contact: 'olivia.grant@fleetgrid.demo',
      createdAt: demoTime(0),
    },
    {
      id: SEED_USER_IDS.operator,
      name: 'Arjun Rao',
      role: 'OPERATOR',
      organizationId: SEED_ORG_IDS.fleetgrid,
      contact: 'arjun.rao@fleetgrid.demo',
      createdAt: demoTime(0),
    },
    {
      id: SEED_USER_IDS.business,
      name: 'Priya Nair',
      role: 'BUSINESS',
      organizationId: SEED_ORG_IDS.abc,
      contact: 'priya.nair@abcdistributors.demo',
      createdAt: demoTime(0),
    },
    {
      id: SEED_USER_IDS.driver,
      name: 'Ravi Kumar',
      role: 'DRIVER',
      organizationId: SEED_ORG_IDS.fleetgrid,
      contact: '+91 90000 00027',
      createdAt: demoTime(0),
    },
    {
      id: SEED_USER_IDS.driverFg041,
      name: 'Imran Sheikh',
      role: 'DRIVER',
      organizationId: SEED_ORG_IDS.fleetgrid,
      contact: '+91 90000 00041',
      createdAt: demoTime(0),
    },
    {
      id: SEED_USER_IDS.driverFg052,
      name: 'Suresh Naidu',
      role: 'DRIVER',
      organizationId: SEED_ORG_IDS.fleetgrid,
      contact: '+91 90000 00052',
      createdAt: demoTime(0),
    },
  ];

  const drivers: Driver[] = [
    {
      id: SEED_DRIVER_IDS.ravi,
      organizationId: SEED_ORG_IDS.fleetgrid,
      userId: SEED_USER_IDS.driver,
      name: 'Ravi Kumar',
      phone: '+91 90000 00027',
      assignedTruckId: SEED_TRUCK_IDS.fg027,
      status: 'AVAILABLE',
      createdAt: demoTime(0),
    },
    {
      id: SEED_DRIVER_IDS.imran,
      organizationId: SEED_ORG_IDS.fleetgrid,
      userId: SEED_USER_IDS.driverFg041,
      name: 'Imran Sheikh',
      phone: '+91 90000 00041',
      assignedTruckId: SEED_TRUCK_IDS.fg041,
      status: 'AVAILABLE',
      createdAt: demoTime(0),
    },
    {
      id: SEED_DRIVER_IDS.suresh,
      organizationId: SEED_ORG_IDS.fleetgrid,
      userId: SEED_USER_IDS.driverFg052,
      name: 'Suresh Naidu',
      phone: '+91 90000 00052',
      assignedTruckId: SEED_TRUCK_IDS.fg052,
      status: 'AVAILABLE',
      createdAt: demoTime(0),
    },
  ];

  const makeTruck = (
    id: string,
    registrationNo: string,
    capacityT: number,
    availableT: number,
    driverId: string,
    lat: number,
    lng: number,
    departureHours: number,
  ): Truck => ({
    id,
    organizationId: SEED_ORG_IDS.fleetgrid,
    registrationNo,
    capacityT,
    availableT,
    status: 'AVAILABLE',
    lat,
    lng,
    origin: bengaluru.city,
    destination: 'Chennai',
    departureAt: demoTime(departureHours),
    driverId,
    createdAt: demoTime(0),
  });

  const trucks: Truck[] = [
    makeTruck(SEED_TRUCK_IDS.fg027, 'KA01AB1234', 5, 3.8, SEED_DRIVER_IDS.ravi, bengaluru.lat, bengaluru.lng, 4),
    // Recovery trucks are staged near Hosur (demo estimates: 8.2 km / 15.8 km away).
    makeTruck(SEED_TRUCK_IDS.fg041, 'KA05CD5678', 5, 3.1, SEED_DRIVER_IDS.imran, 12.7442, 77.5288, 5),
    makeTruck(SEED_TRUCK_IDS.fg052, 'KA09EF9012', 8, 5, SEED_DRIVER_IDS.suresh, 12.7086, 77.5431, 6),
  ];

  const pricePerT = 850;
  const capacityOffers: CapacityOffer[] = trucks.map((truck) => ({
    id: `cap_${truck.id.toLowerCase().replace('-', '')}`,
    truckId: truck.id,
    route: `${truck.origin} → ${truck.destination}`,
    origin: truck.origin,
    destination: truck.destination,
    availableT: truck.availableT,
    departureAt: truck.departureAt,
    status: 'OPEN',
    priceRule: 'DEMO_PER_TONNE',
    pricePerT,
    updatedAt: demoTime(0),
  }));

  /**
   * Two completed historical shipments only. The golden-flow shipment is created
   * live by the Business screen, so the demo starts from a clean active board.
   */
  const shipments: Shipment[] = [
    {
      id: 'SHP-1001',
      reference: 'ABC-PO-4417',
      cargoName: 'Consumer Electronics',
      shipperId: SEED_ORG_IDS.abc,
      origin: 'Bengaluru',
      destination: 'Chennai',
      weightT: 1,
      deadlineAt: demoTime(26),
      status: 'DELIVERED',
      truckId: SEED_TRUCK_IDS.fg027,
      capacityOfferId: capacityOffers[0]?.id ?? null,
      price: pricePerT,
      currency: 'INR',
      createdAt: demoTime(-30),
      updatedAt: demoTime(-4),
    },
    {
      id: 'SHP-0994',
      reference: 'ABC-PO-4380',
      cargoName: 'Kitchen Appliances',
      shipperId: SEED_ORG_IDS.abc,
      origin: 'Bengaluru',
      destination: 'Chennai',
      weightT: 0.8,
      deadlineAt: demoTime(-6),
      status: 'DELIVERED',
      truckId: SEED_TRUCK_IDS.fg041,
      capacityOfferId: capacityOffers[1]?.id ?? null,
      price: Math.round(pricePerT * 0.8),
      currency: 'INR',
      createdAt: demoTime(-56),
      updatedAt: demoTime(-8),
    },
  ];

  const makeEvent = (
    id: string,
    shipmentId: string | null,
    truckId: string | null,
    eventType: string,
    payload: Record<string, unknown>,
    hourOffset: number,
  ): ShipmentEvent => {
    const timestamp = demoTime(hourOffset);
    const canonical = JSON.stringify({ id, shipmentId, truckId, eventType, payload, timestamp });
    return {
      id,
      shipmentId,
      incidentId: null,
      truckId,
      eventType,
      payload,
      actorType: eventType === 'shipment.delivered' ? 'DRIVER' : 'SYSTEM',
      actorId: null,
      timestamp,
      hash: sha256(canonical),
      blockchainTx: null,
      proofStatus: 'NOT_ANCHORED',
    };
  };

  const events: ShipmentEvent[] = [
    makeEvent('evt_seed_1001_reserved', 'SHP-1001', SEED_TRUCK_IDS.fg027, 'shipment.capacity_reserved', { weightT: 1 }, -30),
    makeEvent('evt_seed_1001_confirmed', 'SHP-1001', SEED_TRUCK_IDS.fg027, 'shipment.confirmed', { weightT: 1 }, -29.5),
    makeEvent('evt_seed_1001_departed', 'SHP-1001', SEED_TRUCK_IDS.fg027, 'shipment.departed', { weightT: 1 }, -28),
    makeEvent('evt_seed_1001_delivered', 'SHP-1001', SEED_TRUCK_IDS.fg027, 'shipment.delivered', { weightT: 1 }, -4),
    makeEvent('evt_seed_0994_delivered', 'SHP-0994', SEED_TRUCK_IDS.fg041, 'shipment.delivered', { weightT: 0.8 }, -8),
    makeEvent('evt_seed_fleet_online', null, null, 'fleet.online', { trucks: trucks.length }, 0),
    makeEvent(
      'evt_seed_capacity_published',
      null,
      SEED_TRUCK_IDS.fg027,
      'capacity.published',
      { availableT: 3.8, demo: true, location: hosur.city },
      0.5,
    ),
  ];

  /** Placeholder rows: the real payment provider is a later phase. */
  const payments: Payment[] = [
    {
      id: 'pay_seed_1001',
      shipmentId: 'SHP-1001',
      recoveryPlanId: null,
      provider: 'DEMO_PLACEHOLDER',
      amount: pricePerT,
      currency: 'INR',
      status: 'PAID',
      providerReference: 'demo_seed_pay_1001',
      createdAt: demoTime(-29.4),
      updatedAt: demoTime(-29.3),
    },
    {
      id: 'pay_seed_0994',
      shipmentId: 'SHP-0994',
      recoveryPlanId: null,
      provider: 'DEMO_PLACEHOLDER',
      amount: Math.round(pricePerT * 0.8),
      currency: 'INR',
      status: 'PAID',
      providerReference: 'demo_seed_pay_0994',
      createdAt: demoTime(-55.4),
      updatedAt: demoTime(-55.3),
    },
  ];

  const incidents: Incident[] = [];
  const recoveryPlans: RecoveryPlan[] = [];
  const notifications: Notification[] = [];

  return {
    organizations,
    users,
    drivers,
    trucks,
    shipments,
    capacityOffers,
    incidents,
    recoveryPlans,
    payments,
    events,
    notifications,
  };
}
