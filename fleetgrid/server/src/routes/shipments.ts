import { Router } from 'express';
import { z } from 'zod';
import {
  confirmShipment,
  createShipment,
  getShipment,
  listShipments,
  shipmentTimeline,
  MAX_SHIPMENT_WEIGHT_T,
} from '../services/shipments.js';
import { asyncHandler } from '../middleware/errors.js';
import { validateBody, validateQuery } from '../middleware/validate.js';
import { requiredParam } from '../middleware/params.js';

export const shipmentsRouter: Router = Router();

const createShipmentSchema = z.object({
  shipperId: z.string().min(2),
  cargoName: z.string().min(2).max(120),
  reference: z.string().max(64).nullish(),
  origin: z.string().min(2),
  destination: z.string().min(2),
  weightT: z.number().positive().max(MAX_SHIPMENT_WEIGHT_T),
  deadlineAt: z.string().datetime().nullish(),
  capacityOfferId: z.string().min(2).nullish(),
  actorId: z.string().min(2).nullish(),
});

/**
 * POST /shipments
 *
 * With `capacityOfferId`, one atomic call performs the whole business action:
 * reserve capacity (DRAFT → CAPACITY_RESERVED) and confirm
 * (CAPACITY_RESERVED → CONFIRMED), decrementing the truck's spare tonnage.
 * Without it, a plain DRAFT shipment is created.
 */
shipmentsRouter.post(
  '/shipments',
  validateBody(createShipmentSchema),
  asyncHandler(async (req, res) => {
    const body = req.body as z.infer<typeof createShipmentSchema>;
    const result = await createShipment({
      shipperId: body.shipperId,
      cargoName: body.cargoName,
      reference: body.reference ?? null,
      origin: body.origin,
      destination: body.destination,
      weightT: body.weightT,
      deadlineAt: body.deadlineAt ?? null,
      capacityOfferId: body.capacityOfferId ?? null,
      actorType: 'BUSINESS',
      actorId: body.actorId ?? null,
    });
    res.status(201).json({
      ok: true,
      shipment: result.shipment,
      reserved: result.reserved,
      confirmed: result.confirmed,
    });
  }),
);

const listQuerySchema = z.object({
  status: z.string().optional(),
  truckId: z.string().optional(),
});

shipmentsRouter.get(
  '/shipments',
  validateQuery(listQuerySchema),
  asyncHandler(async (_req, res) => {
    const query = res.locals.query as z.infer<typeof listQuerySchema>;
    const shipments = await listShipments(query);
    res.json({ shipments, count: shipments.length });
  }),
);

shipmentsRouter.get(
  '/shipments/:id',
  asyncHandler(async (req, res) => {
    res.json({ shipment: await getShipment(requiredParam(req, 'id')) });
  }),
);

/** CAPACITY_RESERVED → CONFIRMED. */
shipmentsRouter.post(
  '/shipments/:id/confirm',
  asyncHandler(async (req, res) => {
    const shipment = await confirmShipment(requiredParam(req, 'id'), { actorType: 'BUSINESS' });
    res.json({ ok: true, shipment });
  }),
);

/** GET /shipments/:id/timeline — append-only event history for one shipment. */
shipmentsRouter.get(
  '/shipments/:id/timeline',
  asyncHandler(async (req, res) => {
    res.json(await shipmentTimeline(requiredParam(req, 'id')));
  }),
);
