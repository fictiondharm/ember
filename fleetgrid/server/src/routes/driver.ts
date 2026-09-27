import { Router } from 'express';
import { z } from 'zod';
import { driverOffers } from '../services/shipments.js';
import { asyncHandler } from '../middleware/errors.js';
import { validateQuery } from '../middleware/validate.js';

export const driverRouter: Router = Router();

const driverQuerySchema = z.object({
  driverId: z.string().min(2),
});

/**
 * GET /driver/offers - the approval queue.
 *
 * A read model over existing rows, not a new entity. `pending` is exactly the set of
 * shipments sitting in CAPACITY_RESERVED on the driver's own truck, which is the same
 * condition `POST /shipments/:id/confirm` and `/decline` accept, so what the driver
 * sees and what the state machine allows can never drift apart.
 */
driverRouter.get(
  '/driver/offers',
  validateQuery(driverQuerySchema),
  asyncHandler(async (_req, res) => {
    const query = res.locals.query as z.infer<typeof driverQuerySchema>;
    const result = await driverOffers(query.driverId);
    res.json({
      ...result,
      counts: { pending: result.pending.length, accepted: result.accepted.length },
      note:
        'Accepting runs CAPACITY_RESERVED -> CONFIRMED. Declining releases the tonnage and returns the shipment to DRAFT.',
    });
  }),
);
