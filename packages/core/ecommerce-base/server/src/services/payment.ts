import { errors } from '@strapi/utils';
import { WEBHOOK_EVENTS } from '../constants';

const { ApplicationError, ValidationError } = errors;

export interface PaymentGateway {
  id: string;
  name: string;
  supports(method: string): boolean;
  authorize(params: {
    amount: number;
    currency: string;
    orderId: string;
    metadata?: Record<string, unknown>;
  }): Promise<{ success: boolean; reference?: string; error?: string }>;
  capture(params: {
    reference: string;
  }): Promise<{ success: boolean; reference?: string; error?: string }>;
  refund(params: {
    reference: string;
    amount: number;
  }): Promise<{ success: boolean; reference?: string; error?: string }>;
}

/**
 * Built-in mock gateway used for development, testing and CI. It never talks
 * to an external PSP and always succeeds unless the amount is negative.
 */
export const mockGateway: PaymentGateway = {
  id: 'mock',
  name: 'Mock Gateway (dev only)',
  supports(method: string) {
    return ['card', 'bank_transfer', 'cod'].includes(method);
  },
  async authorize({ amount, currency, orderId }) {
    if (amount < 0) return { success: false, error: 'Negative amount not allowed' };
    const reference = `mock-${orderId}-${Date.now()}`;
    return { success: true, reference };
  },
  async capture({ reference }) {
    return { success: true, reference };
  },
  async refund({ reference }) {
    return { success: true, reference };
  },
};

export default ({ strapi }: { strapi: any }) => {
  const gateways = new Map<string, PaymentGateway>([['mock', mockGateway]]);

  function resolveGateway(identifier?: string): PaymentGateway {
    const id =
      identifier ?? strapi.config?.get?.('plugin::ecommerce-base.payment.gateway') ?? 'mock';
    const gateway = gateways.get(id);
    if (!gateway) {
      throw new ApplicationError(`Payment gateway "${id}" is not registered.`);
    }
    return gateway;
  }

  return {
    /**
     * Register a custom payment gateway implementation at runtime.
     * Application code can call this from bootstrap or an initialization plugin.
     */
    registerGateway(gateway: PaymentGateway) {
      if (!gateway?.id || !gateway?.authorize || !gateway?.capture || !gateway?.refund) {
        throw new ValidationError(
          'A gateway must implement id, supports, authorize, capture and refund.'
        );
      }
      gateways.set(gateway.id, gateway);
      return gateway;
    },

    listGateways() {
      return [...gateways.values()].map(({ id, name }) => ({ id, name }));
    },

    getGateway(identifier?: string) {
      return resolveGateway(identifier);
    },

    /**
     * End-to-end authorize → markPaid flow. On failure the order keeps the
     * pending payment status and the event is still emitted for observability.
     */
    async processPayment({
      orderId,
      method,
      gatewayId,
    }: {
      orderId: number | string;
      method: string;
      gatewayId?: string;
    }) {
      const orderService = strapi.plugin('ecommerce-base').service('order');
      const order = await orderService.findOne(orderId);

      if (order.paymentStatus === 'paid') {
        throw new ApplicationError('Order is already paid.');
      }
      if (order.status === 'cancelled' || order.status === 'refunded') {
        throw new ApplicationError('Cannot pay a cancelled or refunded order.');
      }

      const gateway = resolveGateway(gatewayId);
      if (!gateway.supports(method)) {
        throw new ValidationError(
          `Gateway "${gateway.id}" does not support the "${method}" method.`
        );
      }

      const auth = await gateway.authorize({
        amount: Number(order.total),
        currency: order.currency ?? 'USD',
        orderId: order.orderNumber,
      });

      if (!auth.success || !auth.reference) {
        strapi.eventHub.emit(WEBHOOK_EVENTS.orderUpdated, {
          order,
          paymentError: auth.error ?? 'Authorization failed',
        });
        throw new ApplicationError(`Payment authorization failed: ${auth.error ?? 'unknown'}`);
      }

      const capture = await gateway.capture({ reference: auth.reference });
      if (!capture.success) {
        throw new ApplicationError('Payment capture failed.');
      }

      return orderService.markPaid({
        id: order.id,
        paymentMethod: method,
        paymentReference: capture.reference,
        paymentGateway: gateway.id,
      });
    },

    async refund({ orderId, amount }: { orderId: number | string; amount: number }) {
      const orderService = strapi.plugin('ecommerce-base').service('order');
      const order = await orderService.findOne(orderId);
      if (order.paymentStatus !== 'paid') {
        throw new ApplicationError('Only paid orders can be refunded.');
      }
      if (amount <= 0 || amount > Number(order.total)) {
        throw new ValidationError('Refund amount must be between 0 and the order total.');
      }
      const gateway = resolveGateway(order.paymentGateway ?? undefined);
      const result = await gateway.refund({ reference: order.paymentReference, amount });
      if (!result.success) {
        throw new ApplicationError('Refund failed at the gateway.');
      }
      return orderService.transition(order.id, 'refunded');
    },

    async webhookHandler({ orderId, event }: { orderId: number | string; event: string }) {
      const orderService = strapi.plugin('ecommerce-base').service('order');
      const order = await orderService.findOne(orderId);
      if (event === 'payment.succeeded') {
        return orderService.markPaid({
          id: order.id,
          paymentMethod: order.paymentMethod ?? 'webhook',
          paymentReference: order.paymentReference ?? '',
        });
      }
      if (event === 'payment.failed') {
        await orderService.transition(order.id, 'cancelled').catch(() => undefined);
        return { status: 'cancelled' };
      }
      throw new ValidationError(`Unknown payment event "${event}".`);
    },
  };
};
