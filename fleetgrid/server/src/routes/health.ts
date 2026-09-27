import { Router } from 'express';
import { config } from '../config.js';
import { db } from '../store/db.js';
import { hub } from '../services/realtime.js';
import { asyncHandler } from '../middleware/errors.js';
import { nowIso } from '../lib/ids.js';

export const healthRouter: Router = Router();

healthRouter.get(
  '/health',
  asyncHandler(async (_req, res) => {
    const [trucks, shipments, incidents, events] = await Promise.all([
      db.trucks.get(),
      db.shipments.get(),
      db.incidents.get(),
      db.events.get(),
    ]);

    res.json({
      status: 'ok',
      service: 'fleetgrid-api',
      version: '0.1.0',
      time: nowIso(),
      storage: 'json-file',
      dataDir: config.dataDir,
      realtime: { path: '/realtime', connectedClients: hub.clientCount() },
      counts: {
        trucks: trucks.length,
        shipments: shipments.length,
        incidents: incidents.length,
        events: events.length,
      },
    });
  }),
);
