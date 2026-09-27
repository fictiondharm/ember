import { config } from '../config.js';
import { createJsonStore, dataFile, type Store } from './jsonStore.js';
import type {
  CapacityOffer,
  Driver,
  FleetSnapshot,
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

/**
 * The single persistence surface for the whole application.
 *
 * Services receive `db` (this object) and never know that files are involved.
 */
export interface Db {
  organizations: Store<Organization>;
  users: Store<User>;
  drivers: Store<Driver>;
  trucks: Store<Truck>;
  shipments: Store<Shipment>;
  capacityOffers: Store<CapacityOffer>;
  incidents: Store<Incident>;
  recoveryPlans: Store<RecoveryPlan>;
  payments: Store<Payment>;
  events: Store<ShipmentEvent>;
  notifications: Store<Notification>;
  snapshot(): Promise<FleetSnapshot>;
}

function build(dataDir: string): Db {
  const store = <T extends { id: string }>(name: string, file: string) =>
    createJsonStore<T>({ filePath: dataFile(dataDir, file), name });

  const db: Db = {
    organizations: store<Organization>('organizations', 'organizations.json'),
    users: store<User>('users', 'users.json'),
    drivers: store<Driver>('drivers', 'drivers.json'),
    trucks: store<Truck>('trucks', 'trucks.json'),
    shipments: store<Shipment>('shipments', 'shipments.json'),
    capacityOffers: store<CapacityOffer>('capacity-offers', 'capacity-offers.json'),
    incidents: store<Incident>('incidents', 'incidents.json'),
    recoveryPlans: store<RecoveryPlan>('recovery-plans', 'recovery-plans.json'),
    payments: store<Payment>('payments', 'payments.json'),
    events: store<ShipmentEvent>('shipment-events', 'shipment-events.json'),
    notifications: store<Notification>('notifications', 'notifications.json'),

    async snapshot() {
      const [
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
      ] = await Promise.all([
        db.organizations.get(),
        db.users.get(),
        db.drivers.get(),
        db.trucks.get(),
        db.shipments.get(),
        db.capacityOffers.get(),
        db.incidents.get(),
        db.recoveryPlans.get(),
        db.payments.get(),
        db.events.get(),
        db.notifications.get(),
      ]);
      return {
        generatedAt: new Date().toISOString(),
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
    },
  };

  return db;
}

export const db: Db = build(config.dataDir);
