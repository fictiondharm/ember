import { Router } from 'express';
import { z } from 'zod';
import { db } from '../store/db.js';
import { ApiError } from '../lib/errors.js';
import { asyncHandler } from '../middleware/errors.js';
import { validateBody } from '../middleware/validate.js';

/**
 * Sponsor integrations that the Master PRD §16 requires but this build has not
 * connected: Dodo Payments and on-chain proof anchoring.
 *
 * Every route here validates its input and then fails with an explicit `501
 * NOT_IMPLEMENTED` naming the missing provider. That is deliberate:
 *
 * - a `404` would read as a typo and hide a real PRD requirement,
 * - a `200` with a made-up reference would be a fabricated integration, which
 *   contract rules 6 and 7 forbid.
 *
 * So the demo degrades to a clearly labelled placeholder instead of blocking, and
 * the client can tell the difference between "not wired yet" and "bad request".
 */
export const integrationsRouter: Router = Router();

const createPaymentSchema = z.object({
  shipmentId: z.string().min(2).optional(),
  recoveryPlanId: z.string().min(2).optional(),
  amount: z.number().positive(),
  currency: z.string().length(3).default('INR'),
});

/** POST /payments/create — Dodo Payments intent creation. */
integrationsRouter.post(
  '/payments/create',
  validateBody(createPaymentSchema),
  asyncHandler(async (req, res) => {
    const body = req.body as z.infer<typeof createPaymentSchema>;

    if (body.shipmentId) {
      const shipment = await db.shipments.findById(body.shipmentId);
      if (!shipment) throw ApiError.notFound(`Shipment ${body.shipmentId} does not exist.`);
    }

    throw ApiError.notImplemented(
      'Dodo Payments is not connected in this build, so no payment intent was created and nothing was charged.',
      {
        provider: 'dodo',
        requestedAmount: body.amount,
        currency: body.currency,
        shipmentStatus: 'unchanged',
        nextStep:
          'Wire a Dodo sandbox product, create the intent server-side, confirm the shipment only after the backend verifies payment state, and handle the webhook idempotently.',
      },
    );
  }),
);

/**
 * POST /webhooks/dodo — provider callback.
 *
 * Validated for shape so a future implementation has a contract to code against,
 * but it always 501s: an unhandled provider callback must never be mistaken for a
 * handled one.
 */
const dodoWebhookSchema = z.object({
  eventId: z.string().min(2).optional(),
  type: z.string().min(2).optional(),
  data: z.record(z.unknown()).optional(),
});

integrationsRouter.post(
  '/webhooks/dodo',
  validateBody(dodoWebhookSchema),
  asyncHandler(async (req, res) => {
    const body = req.body as z.infer<typeof dodoWebhookSchema>;
    throw ApiError.notImplemented(
      'Dodo Payments is not connected, so this webhook was not accepted and no payment state changed.',
      {
        provider: 'dodo',
        receivedType: body.type ?? null,
        receivedEventId: body.eventId ?? null,
        nextStep: 'Verify the Dodo signature, resolve the intent idempotently by provider event id, then advance the payment state machine.',
      },
    );
  }),
);

const anchorProofSchema = z.object({
  eventId: z.string().min(2).optional(),
  shipmentId: z.string().min(2).optional(),
});

/**
 * POST /proof/anchor — anchor a critical event hash on an EVM testnet.
 *
 * Contract rule 7: never fake blockchain confirmation. So this reports the real
 * hash it would anchor and leaves `proofStatus` at `NOT_ANCHORED`. It must never
 * return a fabricated transaction hash.
 */
integrationsRouter.post(
  '/proof/anchor',
  validateBody(anchorProofSchema),
  asyncHandler(async (req, res) => {
    const body = req.body as z.infer<typeof anchorProofSchema>;

    if (!body.eventId && !body.shipmentId) {
      throw ApiError.badRequest('Provide either eventId or shipmentId so there is a hash to anchor.');
    }

    if (body.eventId) {
      const event = await db.events.findById(body.eventId);
      if (!event) throw ApiError.notFound(`Event ${body.eventId} does not exist, so there is no hash to anchor.`);
      throw ApiError.notImplemented(
        `Event ${event.id} is hashed (${event.hash.slice(0, 12)}…) but no EVM testnet anchoring is configured. proofStatus stays ${event.proofStatus} and no transaction hash is invented.`,
        {
          eventId: event.id,
          hash: event.hash,
          proofStatus: event.proofStatus,
          blockchainTx: null,
          nextStep: 'Submit the hash to a testnet, store the transaction reference, and flip proofStatus PENDING → CONFIRMED or FAILED.',
        },
      );
    }

    const events = await db.events.find((e) => e.shipmentId === body.shipmentId);
    throw ApiError.notImplemented(
      `Shipment ${body.shipmentId} has ${events.length} hashed event(s), but no EVM testnet anchoring is configured. proofStatus stays NOT_ANCHORED and no transaction hash is invented.`,
      {
        shipmentId: body.shipmentId,
        candidateEventIds: events.slice(-5).map((e) => e.id),
        proofStatus: 'NOT_ANCHORED',
        blockchainTx: null,
        nextStep: 'Anchor a single critical event hash and record the transaction reference against it.',
      },
    );
  }),
);
