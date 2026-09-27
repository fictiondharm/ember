import { Router } from 'express';
import { z } from 'zod';
import { db } from '../store/db.js';
import { findAvailableCapacity, reserveCapacity, searchCapacity } from '../services/capacity.js';
import { asyncHandler } from '../middleware/errors.js';
import { validateBody, validateQuery } from '../middleware/validate.js';
import { requiredParam } from '../middleware/params.js';

export const capacityRouter: Router = Router();

const capacityQuerySchema = z.object({
  origin: z.string().min(2).optional(),
  destination: z.string().min(2).optional(),
  weightT: z.coerce.number().positive().optional(),
  minAvailableT: z.coerce.number().positive().optional(),
  includeAll: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => v === 'true'),
});

/** GET /capacity — compatible open capacity only, unless includeAll=true. */
capacityRouter.get(
  '/capacity',
  validateQuery(capacityQuerySchema),
  asyncHandler(async (_req, res) => {
    const query = res.locals.query as z.infer<typeof capacityQuerySchema>;
    const matches = query.includeAll
      ? await searchCapacity(query)
      : await findAvailableCapacity(query);

    res.json({
      matches,
      count: matches.length,
      criteria: {
        origin: query.origin ?? null,
        destination: query.destination ?? null,
        weightT: query.weightT ?? null,
      },
      note: 'All prices, ETAs and distances in this build are demo estimates.',
    });
  }),
);

const reserveSchema = z.object({
  shipmentId: z.string().min(2),
  actorId: z.string().min(2).nullish(),
});

/** POST /capacity/:id/reserve — atomic reservation of an existing DRAFT shipment. */
capacityRouter.post(
  '/capacity/:id/reserve',
  validateBody(reserveSchema),
  asyncHandler(async (req, res) => {
    const { shipmentId, actorId } = req.body as { shipmentId: string; actorId?: string | null };
    const result = await reserveCapacity({
      offerId: requiredParam(req, 'id'),
      shipmentId,
      actorType: 'BUSINESS',
      actorId: actorId ?? null,
    });
    res.json({ ok: true, ...result });
  }),
);

capacityRouter.get(
  '/capacity/:id',
  asyncHandler(async (req, res) => {
    const offer = await db.capacityOffers.findById(requiredParam(req, 'id'));
    if (!offer) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: `Capacity offer ${requiredParam(req, 'id')} does not exist.` } });
      return;
    }
    const truck = await db.trucks.findById(offer.truckId);
    res.json({ offer, truck: truck ?? null });
  }),
);
