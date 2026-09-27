import { Router } from 'express';
import { resetDemo } from '../services/demo.js';
import { asyncHandler } from '../middleware/errors.js';

export const demoRouter: Router = Router();

/**
 * POST /demo/reset — restores the exact deterministic demo state
 * (FG-027 3.8T spare, FG-041 3.1T, FG-052 5.0T, no live incidents).
 */
demoRouter.post(
  '/demo/reset',
  asyncHandler(async (_req, res) => {
    const result = await resetDemo();
    res.json({
      ok: true,
      message: 'Demo state restored to the deterministic seed.',
      ...result,
      state: 'READY',
    });
  }),
);
