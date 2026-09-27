import { db } from '../store/db.js';
import { ApiError } from '../lib/errors.js';
import { newId, nowIso } from '../lib/ids.js';
import { runExclusive } from '../lib/mutex.js';
import { canonicalLocation } from '../lib/geo.js';
import { createTruck } from './trucks.js';
import type { Driver, Organization, Truck, User } from '../types.js';

/**
 * Self-service registration — Master PRD §10 entities, composed.
 *
 * This creates only entities the PRD already defines (`Organization`, `User`,
 * `Driver`, and optionally `Truck`). It invents no new entity and no new state, so
 * it stays inside the contract's "do not invent" rule.
 *
 * What differs by role is which of those rows exist afterwards:
 *
 * - `BUSINESS`  → a SHIPPER organization + a BUSINESS user. They can create
 *                 shipments and reserve capacity.
 * - `DRIVER`    → a FLEET_OPERATOR organization + a DRIVER user + a DRIVER row,
 *                 optionally with a truck. Only then can they receive offers,
 *                 because a driver with no truck has nothing to accept.
 *
 * Honest limitation: like `POST /auth/demo-login`, this is **not authentication**.
 * There is no password, token, or session. It records an account and returns the
 * same context shape the client already uses, so the demo can onboard a new user.
 * The Master PRD scopes real KYC/signup out, so that is deliberate, not an
 * oversight — but a production system must add credentials before this endpoint
 * touches real data.
 */

export type RegisterRole = 'BUSINESS' | 'DRIVER';

export interface RegisterInput {
  role: RegisterRole;
  name: string;
  contact: string;
  organizationName?: string | null;
  /** DRIVER only: register a truck in the same call. */
  truck?: {
    registrationNo: string;
    capacityT: number;
    origin: string;
    destination: string;
  } | null;
}

export interface RegisterResult {
  organization: Organization;
  user: User;
  driver: Driver | null;
  truck: Truck | null;
}

/** Slug that is unique among existing orgs, so two drivers can share a name. */
async function uniqueOrgSlug(base: string): Promise<string> {
  const existing = await db.organizations.get();
  const taken = new Set(existing.map((o) => o.id));
  // Lowercase BEFORE stripping, otherwise capitals are treated as separators and
  // "Asha Textiles" slugs to "sha_extiles".
  const root =
    base
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 40) || 'org';
  if (!taken.has(root)) return root;
  let n = 2;
  while (taken.has(`${root}_${n}`)) n += 1;
  return `${root}_${n}`;
}

/**
 * POST /auth/register
 *
 * Runs inside the mutation lock so a concurrent double submit cannot create two
 * organizations for the same person.
 */
export async function register(input: RegisterInput): Promise<RegisterResult> {
  return runExclusive(async () => {
    const name = input.name?.trim();
    if (!name || name.length < 2) {
      throw ApiError.badRequest('name is required (at least 2 characters).');
    }
    const contact = input.contact?.trim();
    if (!contact || contact.length < 3) {
      throw ApiError.badRequest('contact is required — a phone number or email.');
    }

    const isDriver = input.role === 'DRIVER';

    const orgName = (input.organizationName?.trim() || (isDriver ? `${name} Transport` : `${name} Logistics`));
    if (orgName.length > 120) {
      throw ApiError.badRequest('organizationName must be 120 characters or fewer.');
    }

    if (isDriver && input.truck) {
      const origin = canonicalLocation(input.truck.origin);
      const destination = canonicalLocation(input.truck.destination);
      if (!origin || !destination) {
        throw ApiError.badRequest('truck origin and destination are both required.');
      }
      if (origin === destination) {
        throw ApiError.unprocessable(
          `truck origin and destination are the same (${origin}). A truck has to actually move.`,
        );
      }
      if (!Number.isFinite(input.truck.capacityT) || input.truck.capacityT <= 0) {
        throw ApiError.badRequest('truck capacityT must be a positive number of tonnes.');
      }
      if (!input.truck.registrationNo?.trim()) {
        throw ApiError.badRequest('truck registrationNo is required.');
      }
    }

    const organization: Organization = {
      id: await uniqueOrgSlug(orgName),
      name: orgName,
      type: isDriver ? 'FLEET_OPERATOR' : 'SHIPPER',
      status: 'ACTIVE',
      createdAt: nowIso(),
    };
    await db.organizations.create(organization);

    const user: User = {
      id: newId('usr'),
      name,
      role: isDriver ? 'DRIVER' : 'BUSINESS',
      organizationId: organization.id,
      contact,
      createdAt: nowIso(),
    };
    await db.users.create(user);

    if (!isDriver) {
      return { organization, user, driver: null, truck: null };
    }

    const driver: Driver = {
      id: newId('drv'),
      organizationId: organization.id,
      userId: user.id,
      name,
      phone: contact,
      assignedTruckId: null,
      status: 'AVAILABLE',
      createdAt: nowIso(),
    };

    let truck: Truck | null = null;

    // The driver row has to exist before the truck, because createTruck validates
    // that driverId resolves. Link the truck onto the driver afterwards.
    await db.drivers.create(driver);

    if (input.truck) {
      // createTruck publishes a capacity offer and records truck.registered, so the
      // new driver can receive offers the moment registration returns.
      truck = await createTruck({
        organizationId: organization.id,
        registrationNo: input.truck.registrationNo.trim(),
        capacityT: input.truck.capacityT,
        origin: canonicalLocation(input.truck.origin),
        destination: canonicalLocation(input.truck.destination),
        driverId: driver.id,
      });
      const linked = await db.drivers.update(driver.id, { assignedTruckId: truck.id });
      if (linked) driver.assignedTruckId = linked.assignedTruckId;
    }

    return { organization, user, driver, truck };
  });
}
