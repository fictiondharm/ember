import type { Request } from 'express';
import { ApiError } from '../lib/errors.js';

/** Express types params as possibly-undefined under strict indexing; route params are never missing. */
export function requiredParam(req: Request, name: string): string {
  const value = req.params[name];
  if (typeof value !== 'string' || value.length === 0) {
    throw ApiError.badRequest(`Missing required route parameter :${name}.`);
  }
  return value;
}
