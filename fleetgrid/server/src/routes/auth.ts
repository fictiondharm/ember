import { Router } from 'express';
import { z } from 'zod';
import { db } from '../store/db.js';
import { ApiError } from '../lib/errors.js';
import { asyncHandler } from '../middleware/errors.js';
import { validateBody } from '../middleware/validate.js';
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
