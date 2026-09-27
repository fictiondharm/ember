import { Router } from 'express';
import { z } from 'zod';
import { db } from '../store/db.js';
import { round } from '../lib/ids.js';
import { capacityOptions, findAvailableCapacity, reserveCapacity, searchCapacity, suggestNearbyCapacity } from '../services/capacity.js';
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

const optionsQuerySchema = z.object({
  origin: z.string().min(2).optional(),
  destination: z.string().min(2).optional(),
  weightT: z.coerce.number().positive().optional(),
});

/**
 * GET /capacity/options — the honest answer for any load.
 *
 * Returns one truck, a split across several, or a plain reason it cannot be done.
 * Registered before `/capacity/:id` so "options" is not read as an offer id.
 */
capacityRouter.get(
  '/capacity/options',
  validateQuery(optionsQuerySchema),
  asyncHandler(async (_req, res) => {
    const query = res.locals.query as z.infer<typeof optionsQuerySchema>;
    const result = await capacityOptions(query);
    res.json({
      ...result,
      note:
        'A split is a plan, not a booking. Each leg is reserved and driver-approved separately, exactly like a single-truck load.',
    });
  }),
);

const nearbyQuerySchema = z.object({
  truckId: z.string().min(2),
  origin: z.string().min(2).optional(),
  destination: z.string().min(2).optional(),
  weightT: z.coerce.number().positive().optional(),
  limit: z.coerce.number().int().min(1).max(20).optional(),
});

/**
 * GET /capacity/nearby - other trucks worth knowing about, nearest first.
 *
 * Registered before `/capacity/:id` so "nearby" is not swallowed as an offer id.
 * Distances are great-circle over stored coordinates, reported as a proximity hint.
 */
capacityRouter.get(
  '/capacity/nearby',
  validateQuery(nearbyQuerySchema),
  asyncHandler(async (_req, res) => {
    const query = res.locals.query as z.infer<typeof nearbyQuerySchema>;
    const result = await suggestNearbyCapacity(query);
    res.json({
      ...result,
      count: result.suggestions.length,
      selectedTruckSpareT: result.selectedTruck ? round(result.selectedTruck.availableT) : null,
      note: 'Distance is straight-line from stored coordinates, not a routing provider result.',
    });
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
