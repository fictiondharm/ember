import DodoPayments from 'dodopayments';
import { db } from '../store/db.js';
import { ApiError } from '../lib/errors.js';
import { newId, nowIso } from '../lib/ids.js';
import { runExclusive } from '../lib/mutex.js';
import { recordEvent } from './events.js';
import { hub } from './realtime.js';
import type { Payment, Shipment } from '../types.js';

export interface CreateDodoCheckoutInput {
  shipmentId?: string | null;
  recoveryPlanId?: string | null;
  amount: number;
  currency?: string;
  customerName?: string;
  customerEmail?: string;
  returnUrl?: string;
}

export interface DodoCheckoutResult {
  payment: Payment;
  checkoutUrl: string;
  isSandbox: boolean;
  provider: string;
}

/**
 * Creates a Dodo Payments checkout session.
 * Uses real Dodo Payments API when DODO_PAYMENTS_API_KEY is configured in the environment.
 * If not set, creates a high-fidelity interactive sandbox checkout session.
 */
export async function createDodoCheckout(input: CreateDodoCheckoutInput): Promise<DodoCheckoutResult> {
  return runExclusive(async () => {
    let shipment: Shipment | undefined;
    if (input.shipmentId) {
      shipment = await db.shipments.findById(input.shipmentId);
      if (!shipment) {
        throw ApiError.notFound(`Shipment ${input.shipmentId} does not exist.`);
      }
    }

    const paymentId = newId('pay');
    const currency = input.currency || 'INR';
    const amount = Math.round(input.amount);
    const apiKey = process.env.DODO_PAYMENTS_API_KEY;

    let checkoutUrl = `https://checkout.dodopayments.com/pay/ch_dodo_${paymentId}`;
    let providerReference = `dodo_ref_${paymentId}`;
    let isSandbox = true;

    if (apiKey && apiKey.trim().length > 5) {
      try {
        const client = new DodoPayments({
          bearerToken: apiKey,
          environment: (process.env.DODO_ENVIRONMENT as 'test_mode' | 'live_mode') || 'test_mode',
        });

        const session = await client.checkoutSessions.create({
          product_cart: [
            {
              product_id: process.env.DODO_PRODUCT_ID || 'prod_fleetgrid_freight',
              quantity: 1,
              amount: amount * 100, // Dodo accepts smallest currency unit (paise/cents)
            },
          ],
          return_url: input.returnUrl || `${process.env.FRONTEND_ORIGIN || 'http://localhost:5173'}?payment=success&id=${paymentId}`,
          customer: {
            email: input.customerEmail || 'shipper@fleetgrid.io',
            name: input.customerName || 'FleetGrid Shipper',
          },
        });

        if (session.checkout_url) {
          checkoutUrl = session.checkout_url;
          isSandbox = false;
        }
        if (session.session_id) {
          providerReference = session.session_id;
        }
      } catch (err) {
        console.warn('[DodoPayments] API session creation failed, using sandbox fallback:', (err as Error).message);
      }
    }

    const payment: Payment = {
      id: paymentId,
      shipmentId: input.shipmentId ?? null,
      recoveryPlanId: input.recoveryPlanId ?? null,
      provider: 'Dodo Payments',
      amount,
      currency,
      status: 'PENDING',
      providerReference,
      checkoutUrl,
      customerName: input.customerName || 'FleetGrid Shipper',
      customerEmail: input.customerEmail || 'shipper@fleetgrid.io',
      paymentMethod: 'DODO_CHECKOUT',
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };

    const saved = await db.payments.create(payment);

    await recordEvent({
      eventType: 'payment.created',
      shipmentId: shipment?.id ?? null,
      truckId: shipment?.truckId ?? null,
      payload: {
        paymentId: saved.id,
        amount: saved.amount,
        currency: saved.currency,
        provider: 'Dodo Payments',
        checkoutUrl,
      },
      actorType: 'BUSINESS',
    });

    hub.broadcast('payment.updated', saved);

    return {
      payment: saved,
      checkoutUrl,
      isSandbox,
      provider: 'Dodo Payments',
    };
  });
}

export interface ConfirmPaymentResult {
  payment: Payment;
  shipment: Shipment | null;
}

/**
 * Confirms payment from Dodo Payments webhook or completed checkout return.
 * Atomically marks payment PAID, confirms linked shipment, hashes audit trail, and broadcasts.
 */
export async function confirmDodoPayment(
  paymentId: string,
  providerReference?: string,
  paymentMethod?: string,
): Promise<ConfirmPaymentResult> {
  return runExclusive(async () => {
    const payment = await db.payments.findById(paymentId);
    if (!payment) {
      throw ApiError.notFound(`Payment ${paymentId} does not exist.`);
    }

    const updatedPayment = await db.payments.update(payment.id, {
      status: 'PAID',
      providerReference: providerReference ?? payment.providerReference,
      paymentMethod: paymentMethod ?? 'Dodo Hosted Checkout',
      updatedAt: nowIso(),
    });

    if (!updatedPayment) throw ApiError.notFound(`Payment ${paymentId} disappeared.`);

    let updatedShipment: Shipment | null = null;
    if (updatedPayment.shipmentId) {
      const shipment = await db.shipments.findById(updatedPayment.shipmentId);
      if (shipment) {
        // If shipment was holding capacity, advance it to CONFIRMED
        if (shipment.status === 'CAPACITY_RESERVED' || shipment.status === 'DRAFT') {
          updatedShipment =
            (await db.shipments.update(shipment.id, {
              status: 'CONFIRMED',
              updatedAt: nowIso(),
            })) ?? null;
          if (updatedShipment) {
            hub.broadcast('shipment.updated', updatedShipment);
          }
        } else {
          updatedShipment = shipment ?? null;
        }

        await recordEvent({
          eventType: 'payment.confirmed',
          shipmentId: shipment.id,
          truckId: shipment.truckId ?? null,
          payload: {
            paymentId: updatedPayment.id,
            amount: updatedPayment.amount,
            currency: updatedPayment.currency,
            providerReference: updatedPayment.providerReference,
            provider: 'Dodo Payments',
          },
          actorType: 'SYSTEM',
        });
      }
    }

    hub.broadcast('payment.updated', updatedPayment);

    return {
      payment: updatedPayment,
      shipment: updatedShipment,
    };
  });
}

export async function listPayments(): Promise<Payment[]> {
  return db.payments.get();
}

export async function getPayment(id: string): Promise<Payment> {
  const payment = await db.payments.findById(id);
  if (!payment) {
    throw ApiError.notFound(`Payment ${id} does not exist.`);
  }
  return payment;
}
