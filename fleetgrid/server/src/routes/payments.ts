import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../middleware/errors.js';
import { validateBody } from '../middleware/validate.js';
import { requiredParam } from '../middleware/params.js';
import {
  createDodoCheckout,
  confirmDodoPayment,
  getPayment,
  listPayments,
} from '../services/payments.js';

export const paymentsRouter: Router = Router();

const createDodoCheckoutSchema = z.object({
  shipmentId: z.string().min(2).nullish(),
  recoveryPlanId: z.string().min(2).nullish(),
  amount: z.number().positive(),
  currency: z.string().length(3).optional(),
  customerName: z.string().min(1).optional(),
  customerEmail: z.string().email().optional(),
  returnUrl: z.string().url().optional(),
});

/** POST /payments/dodo/checkout — Generates a Dodo Payments checkout session. */
paymentsRouter.post(
  '/payments/dodo/checkout',
  validateBody(createDodoCheckoutSchema),
  asyncHandler(async (req, res) => {
    const result = await createDodoCheckout(req.body);
    res.status(201).json(result);
  }),
);

const confirmDodoPaymentSchema = z.object({
  paymentId: z.string().min(2),
  providerReference: z.string().min(2).optional(),
  paymentMethod: z.string().optional(),
});

/** POST /payments/dodo/confirm — Finalizes payment status and confirms associated shipment. */
paymentsRouter.post(
  '/payments/dodo/confirm',
  validateBody(confirmDodoPaymentSchema),
  asyncHandler(async (req, res) => {
    const { paymentId, providerReference, paymentMethod } = req.body;
    const result = await confirmDodoPayment(paymentId, providerReference, paymentMethod);
    res.json({
      status: 'success',
      payment: result.payment,
      shipment: result.shipment,
    });
  }),
);

/** GET /payments — Lists all payment records. */
paymentsRouter.get(
  '/payments',
  asyncHandler(async (_req, res) => {
    res.json({ payments: await listPayments() });
  }),
);

/** GET /payments/:id — Gets a specific payment by ID. */
paymentsRouter.get(
  '/payments/:id',
  asyncHandler(async (req, res) => {
    const id = requiredParam(req, 'id');
    res.json({ payment: await getPayment(id) });
  }),
);

/** POST /payments/dodo/webhook — Handles Dodo Payments incoming webhooks. */
paymentsRouter.post(
  '/payments/dodo/webhook',
  asyncHandler(async (req, res) => {
    const payload = req.body;
    const paymentId = payload?.data?.payment_id || payload?.payment_id || payload?.data?.id;

    if (paymentId) {
      try {
        await confirmDodoPayment(paymentId, payload?.id, 'Dodo Webhook');
        res.json({ received: true, status: 'processed', paymentId });
        return;
      } catch (err) {
        console.warn('[DodoWebhook] Auto-confirm error:', (err as Error).message);
      }
    }

    res.json({ received: true, note: 'Webhook payload received' });
  }),
);
