import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = fileURLToPath(new URL('.', import.meta.url));

/** `server/` directory. */
export const serverRoot = resolve(here, '..');

function envStr(key: string, fallback: string): string {
  const value = process.env[key];
  return value === undefined || value === '' ? fallback : value;
}

function envNum(key: string, fallback: number): number {
  const value = process.env[key];
  if (value === undefined || value === '') return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export const config = {
  port: envNum('PORT', 4000),
  host: envStr('HOST', '0.0.0.0'),
  /** Directory holding the JSON collections. */
  dataDir: envStr('DATA_DIR', resolve(serverRoot, 'data')),
  /** Comma-separated list of allowed browser origins, or `*` for any. */
  corsOrigins: envStr('CORS_ORIGIN', '*')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
  /** Reap dead websocket clients. */
  heartbeatMs: envNum('WS_HEARTBEAT_MS', 30_000),
  /** Reset demo data automatically when the data directory is empty. */
  autoSeed: envStr('AUTO_SEED', 'true') !== 'false',
} as const;

export type AppConfig = typeof config;
