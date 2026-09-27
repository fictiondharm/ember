import type { NextFunction, Request, Response } from 'express';
import { ZodError, type ZodTypeAny } from 'zod';
import { ApiError } from '../lib/errors.js';

/** Validates and replaces req.body with the parsed, typed value. */
export function validateBody<T extends ZodTypeAny>(schema: T) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body ?? {});
    if (!result.success) {
      next(ApiError.badRequest('Request body failed validation.', formatZod(result.error)));
      return;
    }
    req.body = result.data;
    next();
  };
}

export function validateQuery<T extends ZodTypeAny>(schema: T) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.query ?? {});
    if (!result.success) {
      next(ApiError.badRequest('Query parameters failed validation.', formatZod(result.error)));
      return;
    }
    res.locals.query = result.data;
    next();
  };
}

function formatZod(error: ZodError): Array<{ path: string; message: string }> {
  return error.issues.map((issue) => ({
    path: issue.path.join('.') || '(root)',
    message: issue.message,
  }));
}
