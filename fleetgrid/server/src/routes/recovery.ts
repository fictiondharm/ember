import { Router } from 'express';
import { z } from 'zod';
import {
  approveRecoveryPlan,
  createRecoveryPlan,
  executeRecoveryPlan,
  findRecoveryOptions,
  getRecoveryPlan,
  listRecoveryPlans,
  rejectRecoveryPlan,
} from '../services/recovery.js';
import { asyncHandler } from '../middleware/errors.js';
import { validateBody, validateQuery } from '../middleware/validate.js';
import { requiredParam } from '../middleware/params.js';

export const recoveryRouter: Router = Router();

const createPlanSchema = z.object({
  incidentId: z.string().min(2),
});

/**
 * POST /recovery-plans — the ANALYZE RECOVERY action.
 *
 * Deterministic options are generated from backend state (no LLM in this phase)
 * and the plan is parked in PENDING_APPROVAL. Nothing is reassigned until an
 * operator approves and a separate execute call runs.
 */
recoveryRouter.post(
  '/recovery-plans',
  validateBody(createPlanSchema),
  asyncHandler(async (req, res) => {
    const { incidentId } = req.body as z.infer<typeof createPlanSchema>;
    const result = await createRecoveryPlan(incidentId);
    res.status(result.created ? 201 : 200).json({
      ok: true,
      plan: result.plan,
      options: result.options,
      created: result.created,
      engine: 'DETERMINISTIC_PLACEHOLDER',
      note: 'Option generation is deterministic. LLM reasoning is a later phase. Approval is required before execution.',
    });
  }),
);

recoveryRouter.get(
  '/recovery-plans',
  validateQuery(z.object({ incidentId: z.string().optional() })),
  asyncHandler(async (_req, res) => {
    const query = res.locals.query as { incidentId?: string };
    const plans = await listRecoveryPlans(query);
    res.json({ plans, count: plans.length });
  }),
);

recoveryRouter.get(
  '/recovery-plans/:id',
  asyncHandler(async (req, res) => {
    res.json({ plan: await getRecoveryPlan(requiredParam(req, 'id')) });
  }),
);

/** GET /incidents/:id/recovery-options — read-only preview, creates nothing. */
recoveryRouter.get(
  '/incidents/:id/recovery-options',
  asyncHandler(async (req, res) => {
    const { impact, options } = await findRecoveryOptions(requiredParam(req, 'id'));
    res.json({ impact, options, engine: 'DETERMINISTIC_PLACEHOLDER' });
  }),
);

const approveSchema = z.object({
  approvedBy: z.string().min(2).optional(),
});

recoveryRouter.post(
  '/recovery-plans/:id/approve',
  validateBody(approveSchema),
  asyncHandler(async (req, res) => {
    const { approvedBy } = req.body as z.infer<typeof approveSchema>;
    const plan = await approveRecoveryPlan(requiredParam(req, 'id'), approvedBy ?? 'operator_demo');
    res.json({ ok: true, plan });
  }),
);

const rejectSchema = z.object({
  rejectedBy: z.string().min(2).optional(),
  reason: z.string().min(2).max(300).default('Rejected by operator'),
});

recoveryRouter.post(
  '/recovery-plans/:id/reject',
  validateBody(rejectSchema),
  asyncHandler(async (req, res) => {
    const { rejectedBy, reason } = req.body as z.infer<typeof rejectSchema>;
    const plan = await rejectRecoveryPlan(requiredParam(req, 'id'), rejectedBy ?? 'operator_demo', reason);
    res.json({ ok: true, plan });
  }),
);

const executeSchema = z.object({
  executedBy: z.string().min(2).optional(),
});

recoveryRouter.post(
  '/recovery-plans/:id/execute',
  validateBody(executeSchema),
  asyncHandler(async (req, res) => {
    const { executedBy } = req.body as z.infer<typeof executeSchema>;
    const result = await executeRecoveryPlan(requiredParam(req, 'id'), executedBy ?? 'operator_demo');
    res.json({ ok: true, ...result });
  }),
);
