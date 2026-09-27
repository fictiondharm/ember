import { createServer } from 'node:http';
import cors from 'cors';
import express from 'express';
import { config } from './config.js';
import { ensureSeeded } from './services/demo.js';
import { hub } from './services/realtime.js';
import { errorHandler, notFoundHandler } from './middleware/errors.js';
import { buildRouter, ENDPOINT_INDEX } from './routes/index.js';

export function createApp(): express.Express {
  const app = express();

  app.use(
    cors({
      origin: config.corsOrigins.includes('*') ? true : config.corsOrigins,
      credentials: false,
    }),
  );
  app.use(express.json({ limit: '256kb' }));

  app.get('/', (_req, res) => {
    res.json({
      service: 'FleetGrid API',
      phase: 'MVP foundation — shared server-authoritative state',
      storage: 'JSON files (no PostgreSQL in this phase)',
      realtime: '/realtime (WebSocket)',
      endpoints: ENDPOINT_INDEX,
    });
  });

  app.use(buildRouter());
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

async function main(): Promise<void> {
  const app = createApp();
  const server = createServer(app);
  hub.attach(server);

  const seed = await ensureSeeded();
  if (seed.seeded) {
    console.log(`[fleetgrid] seeded demo data → ${config.dataDir} (${seed.trucks} trucks, ${seed.shipments} shipments)`);
  }

  server.listen(config.port, config.host, () => {
    console.log(`[fleetgrid] API      http://localhost:${config.port}`);
    console.log(`[fleetgrid] realtime ws://localhost:${config.port}/realtime`);
    console.log(`[fleetgrid] data dir ${config.dataDir}`);
  });

  const shutdown = async (signal: string) => {
    console.log(`\n[fleetgrid] ${signal} received, shutting down.`);
    await hub.close();
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 3000).unref();
  };
  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
}

main().catch((err) => {
  console.error('[fleetgrid] failed to start:', err);
  process.exit(1);
});
