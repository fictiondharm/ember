import { Router } from 'express';
import { z } from 'zod';
import { db } from '../store/db.js';
import { asyncHandler } from '../middleware/errors.js';
import { validateBody } from '../middleware/validate.js';
import { TOOL_CATALOG } from '../services/agentTools.js';
import { AGENT_TOOL_CONTRACT } from '../services/agentToolSchema.js';

export const miscRouter: Router = Router();

/**
 * GET /state — one read-only aggregate of every collection.
 *
 * The web client refetches this after every realtime event, which is how it stays
 * consistent with server authority without ever deriving state locally. It adds
 * no mutation surface, so it does not widen the Master PRD contract.
 */
miscRouter.get(
  '/state',
  asyncHandler(async (_req, res) => {
    res.json(await db.snapshot());
  }),
);

/**
 * GET /agent/tools — the tool contract the recovery agent must use.
 *
 * Returns the readable catalog plus the formal JSON Schema (draft 2020-12) for
 * every tool's input, output, and failure shape, so an external tool-runner can be
 * pointed straight at this endpoint.
 */
miscRouter.get('/agent/tools', (_req, res) => {
  res.json({
    tools: TOOL_CATALOG,
    contract: AGENT_TOOL_CONTRACT,
    note: 'Mutations are only possible through these validated tools. No unrestricted database access for the agent.',
  });
});

const createOrgSchema = z.object({
  name: z.string().min(2).max(120),
  type: z.enum(['SHIPPER', 'FLEET_OPERATOR']),
  id: z.string().min(2).max(64).optional(),
});

miscRouter.post(
  '/organizations',
  validateBody(createOrgSchema),
  asyncHandler(async (req, res) => {
    const body = req.body as z.infer<typeof createOrgSchema>;
    const org = {
      id: body.id ?? `org_${body.name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_')}`,
      name: body.name.trim(),
      type: body.type,
      status: 'ACTIVE' as const,
      createdAt: new Date().toISOString(),
    };
    res.status(201).json({ organization: await db.organizations.create(org) });
  }),
);

miscRouter.get(
  '/organizations',
  asyncHandler(async (_req, res) => {
    res.json({ organizations: await db.organizations.get() });
  }),
);

/**
 * GET /payments — placeholder read model.
 * Real payment capture (Dodo) is a later phase; nothing here reports a fake success.
 */
miscRouter.get(
  '/payments',
  asyncHandler(async (_req, res) => {
    const payments = await db.payments.get();
    res.json({
      payments,
      note: 'Payment provider integration is a later phase. Seeded rows are labelled DEMO_PLACEHOLDER.',
    });
  }),
);

miscRouter.get(
  '/notifications',
  asyncHandler(async (_req, res) => {
    res.json({
      notifications: await db.notifications.get(),
      note: 'Notification delivery is a later phase; rows are stored as PENDING.',
    });
  }),
);
