import paypal from '@paypal/checkout-server-sdk';
import type { PaymentGateway } from '../services/payment';
import type { GatewayProcessArgs, GatewayProcessResult } from './stripe';

type ExtendedPaymentGateway = PaymentGateway & {
  process(args: GatewayProcessArgs): Promise<GatewayProcessResult>;
  verify?(paymentReference: string): Promise<boolean>;
};

function createClient(
  clientId = process.env.PAYPAL_CLIENT_ID,
  clientSecret = process.env.PAYPAL_CLIENT_SECRET
) {
  if (!clientId || !clientSecret) return null;
  const environment = new paypal.core.SandboxEnvironment(clientId, clientSecret);
  return new paypal.core.PayPalHttpClient(environment);
}

function missingCredentialsError() {
  return 'PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET are not set';
}

export function createPayPalGateway(
  clientId = process.env.PAYPAL_CLIENT_ID,
  clientSecret = process.env.PAYPAL_CLIENT_SECRET
): ExtendedPaymentGateway {
  const client = createClient(clientId, clientSecret);

  const gateway: ExtendedPaymentGateway = {
    id: 'paypal',
    name: 'PayPal',

    supports(method: string) {
      return ['paypal', 'card'].includes(method);
    },

    async authorize({ amount, currency, orderId }) {
      if (!client) return { success: false, error: missingCredentialsError() };

      try {
        const request = new paypal.orders.OrdersCreateRequest();
        request.prefer('return=representation');
        request.requestBody({
          intent: 'CAPTURE',
          purchase_units: [
            {
              reference_id: String(orderId),
              amount: {
                currency_code: currency.toUpperCase(),
                value: Number(amount).toFixed(2),
              },
            },
          ],
        });
        const response = await client.execute(request);
        return { success: true, reference: response.result.id };
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : String(error) };
      }
    },

    async capture({ reference }) {
      if (!client) return { success: false, error: missingCredentialsError() };

      try {
        const request = new paypal.orders.OrdersCaptureRequest(reference);
        request.requestBody({});
        const response = await client.execute(request);
        const captureId =
          response.result.purchase_units?.[0]?.payments?.captures?.[0]?.id ?? response.result.id;
        return captureId
          ? { success: true, reference: captureId }
          : { success: false, error: 'PayPal capture did not return a capture reference' };
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : String(error) };
      }
    },

    async refund({ reference, amount }) {
      if (!client) return { success: false, error: missingCredentialsError() };

      try {
        const request = new paypal.payments.CapturesRefundRequest(reference);
        request.requestBody(
          amount === undefined
            ? {}
            : {
                amount: {
                  currency_code: 'USD',
                  value: Number(amount).toFixed(2),
                },
              }
        );
        const response = await client.execute(request);
        return response.result.id
          ? { success: true, reference: response.result.id }
          : { success: false, error: 'PayPal refund did not return a refund reference' };
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
        return { success: false, error: authorization.error ?? 'PayPal order creation failed' };
      }

      const capture = await gateway.capture({ reference: authorization.reference });
      if (!capture.success || !capture.reference) {
        return { success: false, error: capture.error ?? 'PayPal capture failed' };
      }
      return { success: true, paymentReference: capture.reference };
    },
  };

  return gateway;
}

const paypalGateway = createPayPalGateway();

export default paypalGateway;
