import { Router } from 'express';
import { z } from 'zod';
import { createIncident, getIncident, listIncidents } from '../services/incidents.js';
import { asyncHandler } from '../middleware/errors.js';
import { validateBody, validateQuery } from '../middleware/validate.js';
import { requiredParam } from '../middleware/params.js';

export const incidentsRouter: Router = Router();

const INCIDENT_TYPES = [
  'TRUCK_BREAKDOWN',
  'ACCIDENT',
  'DELAY',
  'CARGO_DAMAGE',
  'ROUTE_BLOCKED',
  'OTHER',
] as const;

const createIncidentSchema = z.object({
  truckId: z.string().min(2),
  type: z.enum(INCIDENT_TYPES).default('TRUCK_BREAKDOWN'),
  location: z.string().min(2).max(120),
  severity: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).optional(),
  description: z.string().max(600).optional(),
  transcript: z.string().max(2000).nullish(),
  source: z.enum(['DRIVER_APP', 'VOICE', 'OPERATOR', 'SYSTEM']).optional(),
  actorId: z.string().min(2).nullish(),
});

/**
 * POST /incidents
 * truck IN_TRANSIT → INCIDENT, shipments IN_TRANSIT → AT_RISK, incident OPEN.
 */
incidentsRouter.post(
  '/incidents',
  validateBody(createIncidentSchema),
  asyncHandler(async (req, res) => {
    const body = req.body as z.infer<typeof createIncidentSchema>;
    const result = await createIncident({
      truckId: body.truckId,
      type: body.type,
      location: body.location,
      severity: body.severity,
      description: body.description,
      transcript: body.transcript ?? null,
      source: body.source,
      actorId: body.actorId ?? null,
    });
    res.status(201).json({
      ok: true,
      incident: result.incident,
      truck: result.truck,
      affectedShipments: result.affectedShipments,
    });
  }),
);

const listQuerySchema = z.object({
  status: z.string().optional(),
  truckId: z.string().optional(),
});

incidentsRouter.get(
  '/incidents',
  validateQuery(listQuerySchema),
  asyncHandler(async (_req, res) => {
    const query = res.locals.query as z.infer<typeof listQuerySchema>;
    const incidents = await listIncidents(query);
    res.json({ incidents, count: incidents.length });
  }),
);

incidentsRouter.get(
  '/incidents/:id',
  asyncHandler(async (req, res) => {
    const incident = await getIncident(requiredParam(req, 'id'));
    res.json({ incident });
  }),
);
