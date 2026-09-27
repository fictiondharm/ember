import { Router } from 'express';
import { z } from 'zod';
import { db } from '../store/db.js';
import { createTruck, departTruck, getTruck, listTrucks, updateTruckLocation } from '../services/trucks.js';
import { asyncHandler } from '../middleware/errors.js';
import { validateBody } from '../middleware/validate.js';
import { requiredParam } from '../middleware/params.js';

export const trucksRouter: Router = Router();

trucksRouter.get(
  '/trucks/locations',
  asyncHandler(async (_req, res) => {
    const trucks = await listTrucks();
    res.json(
      trucks.map((t) => ({
        id: t.id,
        registration_no: t.registrationNo,
        registration_number: t.registrationNo,
        latitude: t.lat,
        longitude: t.lng,
        speed_kmph: t.speedKmph ?? 0,
        heading: t.heading ?? 0,
        status: t.status,
        location_status: t.status,
        origin: t.origin,
        destination: t.destination,
      })),
    );
  }),
);


const createTruckSchema = z.object({
  id: z.string().min(2).max(32).optional(),
  organizationId: z.string().min(2),
  registrationNo: z.string().min(2),
  capacityT: z.number().positive(),
  availableT: z.number().positive().optional(),
  origin: z.string().min(2),
  destination: z.string().min(2),
  driverId: z.string().min(2).nullish(),
  departureAt: z.string().datetime().nullish(),
  lat: z.number().optional(),
  lng: z.number().optional(),
});

trucksRouter.get(
  '/trucks',
  asyncHandler(async (_req, res) => {
    res.json({ trucks: await listTrucks() });
  }),
);

trucksRouter.get(
  '/trucks/:id',
  asyncHandler(async (req, res) => {
    const truck = await getTruck(requiredParam(req, 'id'));
    const shipments = await db.shipments.find((s) => s.truckId === truck.id);
    const offer = (await db.capacityOffers.find((o) => o.truckId === truck.id))[0] ?? null;
    const driver = truck.driverId ? await db.drivers.findById(truck.driverId) : undefined;
    const incidents = await db.incidents.find((i) => i.truckId === truck.id);
    res.json({ truck, driver: driver ?? null, capacityOffer: offer, shipments, incidents });
  }),
);

trucksRouter.post(
  '/trucks',
  validateBody(createTruckSchema),
  asyncHandler(async (req, res) => {
    res.status(201).json({ truck: await createTruck(req.body) });
  }),
);

const departSchema = z.object({
  driverId: z.string().min(2).nullish(),
});

/** POST /trucks/:id/depart — truck ASSIGNED → IN_TRANSIT, shipments → IN_TRANSIT. */
trucksRouter.post(
  '/trucks/:id/depart',
  validateBody(departSchema),
  asyncHandler(async (req, res) => {
    const { driverId } = req.body as { driverId?: string | null };
    const result = await departTruck(requiredParam(req, 'id'), driverId ?? null);
    res.json({
      ok: true,
      truck: result.truck,
      truckStatus: result.truck.status,
      shipments: result.shipments,
      shipmentIds: result.shipments.map((s) => s.id),
    });
  }),
);

/** POST /trucks/:id/location — updates GPS coordinates & heading and broadcasts over websocket. */
trucksRouter.post(
  '/trucks/:id/location',
  asyncHandler(async (req, res) => {
    const id = requiredParam(req, 'id');
    const { lat, lng, latitude, longitude, speed_kmph, speedKmph, heading } = req.body ?? {};
    const finalLat = lat ?? latitude;
    const finalLng = lng ?? longitude;
    const finalSpeed = speed_kmph ?? speedKmph;
    if (typeof finalLat !== 'number' || typeof finalLng !== 'number') {
      res.status(400).json({ error: { message: 'latitude and longitude are required numbers' } });
      return;
    }
    const updated = await updateTruckLocation(id, finalLat, finalLng, finalSpeed, heading);
    res.json({
      status: 'success',
      truck_id: updated.id,
      latitude: updated.lat,
      longitude: updated.lng,
      speed_kmph: finalSpeed ?? 0,
      heading: heading ?? 0,
    });
  }),
);

