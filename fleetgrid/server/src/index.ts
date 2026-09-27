import { createServer } from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import cors from 'cors';
import express from 'express';
import { config, serverRoot } from './config.js';
import { ensureSeeded } from './services/demo.js';
import { hub } from './services/realtime.js';
import { errorHandler, notFoundHandler } from './middleware/errors.js';
import { buildRouter, ENDPOINT_INDEX } from './routes/index.js';

// Auto-load .env file into process.env
const envPath = resolve(serverRoot, '.env');
if (existsSync(envPath)) {
  try {
    const lines = readFileSync(envPath, 'utf8').split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const idx = trimmed.indexOf('=');
      if (idx > 0) {
        const key = trimmed.slice(0, idx).trim();
        const val = trimmed.slice(idx + 1).trim();
        if (!process.env[key]) {
          process.env[key] = val;
        }
      }
    }
  } catch {}
}

export function createApp(): express.Express {
  const app = express();

  app.use(
    cors({
      origin: config.corsOrigins.includes('*') ? true : config.corsOrigins,
      credentials: false,
    }),
  );
  app.use(express.json({ limit: '256kb' }));

  const webDist = resolve(serverRoot, '../web/dist');
  const hasWeb = existsSync(webDist);

  if (hasWeb) {
    app.use(express.static(webDist));
    app.get('/', (req, res, next) => {
      if (req.accepts('html')) {
        return res.sendFile(resolve(webDist, 'index.html'));
      }
      return next();
    });
  }

  app.get('/api', (_req, res) => {
    res.json({
      service: 'FleetGrid API',
      phase: 'Authoritative self-healing logistics network',
      realtime: '/realtime (WebSocket)',
      endpoints: ENDPOINT_INDEX,
    });
  });

  if (!hasWeb) {
    app.get('/', (_req, res) => {
      res.json({
        service: 'FleetGrid API',
        phase: 'Authoritative self-healing logistics network',
        realtime: '/realtime (WebSocket)',
        endpoints: ENDPOINT_INDEX,
      });
    });
  }

  app.use(buildRouter());

  if (hasWeb) {
    app.get('*', (req, res, next) => {
      if (
        req.path.startsWith('/state') ||
        req.path.startsWith('/realtime') ||
        req.path.startsWith('/incidents') ||
        req.path.startsWith('/trucks') ||
        req.path.startsWith('/shipments') ||
        req.path.startsWith('/payments') ||
        req.path.startsWith('/auth') ||
        req.path.startsWith('/capacity') ||
        req.path.startsWith('/bids') ||
        req.path.startsWith('/recovery-plans') ||
        req.path.startsWith('/agent') ||
        req.path.startsWith('/demo')
      ) {
        return next();
      }
      res.sendFile(resolve(webDist, 'index.html'));
    });
  }

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
