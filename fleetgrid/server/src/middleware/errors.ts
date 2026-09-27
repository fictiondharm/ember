import type { NextFunction, Request, Response } from 'express';
import { ApiError } from '../lib/errors.js';

export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({
    error: {
      code: 'NOT_FOUND',
      message: `No route matches ${req.method} ${req.path}. See GET / for the endpoint index.`,
    },
  });
}

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof ApiError) {
    res.status(err.status).json({
      error: { code: err.code, message: err.message, details: err.details ?? undefined },
    });
    return;
  }

  const message = err instanceof Error ? err.message : 'Unexpected server error';
  console.error('[fleetgrid] unhandled error:', err);
  res.status(500).json({
    error: { code: 'INTERNAL', message },
  });
}

/** Wraps an async handler so rejected promises reach the error handler. */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>,
) {
  return (req: Request, res: Response, next: NextFunction): void => {
    fn(req, res, next).catch(next);
  };
}
