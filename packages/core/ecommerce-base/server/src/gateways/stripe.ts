import Stripe from 'stripe';
import type { PaymentGateway } from '../services/payment';

export type GatewayProcessArgs = {
  orderId: number | string;
  amount: number;
  currency: string;
  method?: string;
  metadata?: Record<string, unknown>;
};

export type GatewayProcessResult = {
  success: boolean;
  paymentReference?: string;
  error?: string;
};

type ExtendedPaymentGateway = PaymentGateway & {
  process(args: GatewayProcessArgs): Promise<GatewayProcessResult>;
  verify(paymentReference: string): Promise<boolean>;
};

function toMinorUnits(amount: number) {
  return Math.round(Number(amount) * 100);
}

function toStripeMetadata(metadata: Record<string, unknown> | undefined) {
  return Object.fromEntries(
    Object.entries(metadata ?? {}).map(([key, value]) => [key, String(value)])
  );
}

export function createStripeGateway(
  secretKey = process.env.STRIPE_SECRET_KEY
): ExtendedPaymentGateway {
  const client = secretKey ? new Stripe(secretKey) : null;
  const missingKeyError = 'STRIPE_SECRET_KEY is not set';

  const gateway: ExtendedPaymentGateway = {
    id: 'stripe',
    name: 'Stripe',

    supports(method: string) {
      return ['card', 'stripe'].includes(method);
    },

    async authorize({ amount, currency, orderId, metadata }) {
      if (!client) return { success: false, error: missingKeyError };

      try {
        const paymentIntent = await client.paymentIntents.create({
          amount: toMinorUnits(amount),
          currency: currency.toLowerCase(),
          capture_method: 'manual',
          automatic_payment_methods: { enabled: true },
          metadata: {
            orderId: String(orderId),
            ...toStripeMetadata(metadata),
          },
        });

        return { success: true, reference: paymentIntent.id };
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : String(error) };
      }
    },

    async capture({ reference }) {
      if (!client) return { success: false, error: missingKeyError };

      try {
        const paymentIntent = await client.paymentIntents.capture(reference);
        if (!['succeeded', 'processing'].includes(paymentIntent.status)) {
          return { success: false, error: `Stripe payment status is ${paymentIntent.status}` };
        }
        return { success: true, reference: paymentIntent.id };
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : String(error) };
      }
    },

    async refund({ reference, amount }) {
      if (!client) return { success: false, error: missingKeyError };

      try {
        const refund = await client.refunds.create({
          payment_intent: reference,
          ...(amount === undefined ? {} : { amount: toMinorUnits(amount) }),
        });
        if (refund.status === 'failed' || refund.status === 'canceled') {
          return { success: false, error: `Stripe refund status is ${refund.status}` };
        }
        return { success: true, reference: refund.id };
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : String(error) };
      }
    },

    async process({ orderId, amount, currency, metadata }) {
      const authorization = await gateway.authorize({
        amount,
        currency,
        orderId: String(orderId),
        metadata,
      });
      if (!authorization.success || !authorization.reference) {
        return { success: false, error: authorization.error ?? 'Stripe authorization failed' };
      }

      const capture = await gateway.capture({ reference: authorization.reference });
      if (!capture.success || !capture.reference) {
        return { success: false, error: capture.error ?? 'Stripe capture failed' };
      }
      return { success: true, paymentReference: capture.reference };
    },

    async verify(paymentReference) {
      if (!client) return false;
      try {
        const paymentIntent = await client.paymentIntents.retrieve(paymentReference);
        return paymentIntent.status === 'succeeded';
      } catch {
        return false;
      }
    },
  };

  return gateway;
}

const stripeGateway = createStripeGateway();

export default stripeGateway;
