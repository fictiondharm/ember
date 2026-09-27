import { Router } from 'express';
import { z } from 'zod';
import { db } from '../store/db.js';
import { ApiError } from '../lib/errors.js';
import { asyncHandler } from '../middleware/errors.js';
import { validateBody } from '../middleware/validate.js';
import { register } from '../services/registration.js';
import type { Role } from '../types.js';

export const authRouter: Router = Router();

const DEMO_ROLES = ['CONTROL_TOWER', 'BUSINESS', 'DRIVER', 'OPERATOR', 'VERIFIER'] as const;

const demoLoginSchema = z.object({
  role: z.enum(DEMO_ROLES).default('CONTROL_TOWER'),
});

/**
 * POST /auth/demo-login
 *
 * Demo role selection only — no password, no token, no session store.
 * It returns the seeded user + organization context for the requested role so the
 * UI can attribute actions to an actor. It is NOT authentication.
 */
authRouter.post(
  '/auth/demo-login',
  validateBody(demoLoginSchema),
  asyncHandler(async (req, res) => {
    const { role } = req.body as { role: Role };
    const users = await db.users.get();
    const user = users.find((u) => u.role === role) ?? users[0];

    if (!user) {
      throw ApiError.notFound('No seeded users are available. Run POST /demo/reset first.');
    }

    const organization = user.organizationId
      ? await db.organizations.findById(user.organizationId)
      : undefined;

    const driver = await db.drivers.find((d) => d.userId === user.id);

    res.json({
      ok: true,
      mode: 'demo',
      warning: 'Demo role selection. No authentication, no tokens. Do not use outside a hackathon demo.',
      user,
      organization: organization ?? null,
      driver: driver[0] ?? null,
      availableRoles: DEMO_ROLES,
    });
  }),
);

const registerSchema = z.object({
  role: z.enum(['BUSINESS', 'DRIVER']),
  name: z.string().min(2).max(120),
  contact: z.string().min(3).max(160),
  organizationName: z.string().min(2).max(120).nullish(),
  truck: z
    .object({
      registrationNo: z.string().min(2).max(32),
      capacityT: z.number().positive().max(50),
      origin: z.string().min(2).max(80),
      destination: z.string().min(2).max(80),
    })
    .nullish(),
});

/**
 * POST /auth/register
 *
 * Self-service onboarding. The caller picks whether they are a shipper or a driver;
 * the server creates only the entities that role needs (Master PRD §10).
 *
 * A DRIVER may pass `truck` to register a truck in the same call, which is what
 * makes them able to receive offers immediately. A DRIVER without a truck is
 * created but has nothing to accept until an operator assigns one.
 *
 * Returns the same `{ user, organization, driver }` shape as `demo-login` so the
 * client can treat a freshly registered account exactly like a seeded one.
 */
authRouter.post(
  '/auth/register',
  validateBody(registerSchema),
  asyncHandler(async (req, res) => {
    const body = req.body as z.infer<typeof registerSchema>;
    const result = await register({
      role: body.role,
      name: body.name,
      contact: body.contact,
      organizationName: body.organizationName ?? null,
      truck: body.truck ?? null,
    });
    res.status(201).json({
      ok: true,
      mode: 'registered',
      warning:
        'Account created, but this is not authentication: no password, token, or session. Demo scope only.',
      user: result.user,
      organization: result.organization,
      driver: result.driver,
      truck: result.truck,
    });
  }),
);
