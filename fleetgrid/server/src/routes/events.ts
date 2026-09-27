import { Router } from 'express';
import { z } from 'zod';
import { db } from '../store/db.js';
import { recordEvent } from '../services/events.js';
import { asyncHandler } from '../middleware/errors.js';
import { validateBody, validateQuery } from '../middleware/validate.js';

export const eventsRouter: Router = Router();

const recordEventSchema = z.object({
  eventType: z
    .string()
    .min(3)
    .max(64)
    .regex(/^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)*$/, 'eventType must be lower_snake or dot.separated, e.g. "shipment.note"'),
  shipmentId: z.string().min(2).nullish(),
  incidentId: z.string().min(2).nullish(),
  truckId: z.string().min(2).nullish(),
  payload: z.record(z.unknown()).optional(),
  actorType: z.enum(['SYSTEM', 'AGENT', 'OPERATOR', 'DRIVER', 'BUSINESS']).optional(),
  actorId: z.string().min(2).nullish(),
});

/** POST /events — append an event to the immutable log. */
eventsRouter.post(
  '/events',
  validateBody(recordEventSchema),
  asyncHandler(async (req, res) => {
    const body = req.body as z.infer<typeof recordEventSchema>;

    if (body.shipmentId) {
      const shipment = await db.shipments.findById(body.shipmentId);
      if (!shipment) {
        res.status(404).json({
          error: { code: 'NOT_FOUND', message: `Shipment ${body.shipmentId} does not exist.` },
        });
        return;
      }
    }

    const event = await recordEvent({
      eventType: body.eventType,
      shipmentId: body.shipmentId ?? null,
      incidentId: body.incidentId ?? null,
      truckId: body.truckId ?? null,
      payload: body.payload ?? {},
      actorType: body.actorType,
      actorId: body.actorId ?? null,
    });
    res.status(201).json({ ok: true, event });
  }),
);

const listQuerySchema = z.object({
  shipmentId: z.string().optional(),
  truckId: z.string().optional(),
  incidentId: z.string().optional(),
  limit: z.coerce.number().int().positive().max(500).optional(),
});

eventsRouter.get(
  '/events',
  validateQuery(listQuerySchema),
  asyncHandler(async (_req, res) => {
    const query = res.locals.query as z.infer<typeof listQuerySchema>;
    const events = await db.events.find((e) => {
      if (query.shipmentId && e.shipmentId !== query.shipmentId) return false;
      if (query.truckId && e.truckId !== query.truckId) return false;
      if (query.incidentId && e.incidentId !== query.incidentId) return false;
      return true;
    });
    const limited = query.limit ? events.slice(-query.limit) : events;
    res.json({ events: limited, count: limited.length, total: events.length });
  }),
);
