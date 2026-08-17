const mockExecute = jest.fn();
const mockRequestBody = jest.fn();
const mockPrefer = jest.fn();

jest.mock('@paypal/checkout-server-sdk', () => {
  class SandboxEnvironment {
    clientId: string;
    clientSecret: string;

    constructor(clientId: string, clientSecret: string) {
      this.clientId = clientId;
      this.clientSecret = clientSecret;
    }
  }

  class PayPalHttpClient {
    execute = mockExecute;
    environment: unknown;

    constructor(environment: unknown) {
      this.environment = environment;
    }
  }

  class OrdersCreateRequest {
    prefer = mockPrefer;
    requestBody = mockRequestBody;
  }

  class OrdersCaptureRequest {
    prefer = mockPrefer;
    requestBody = mockRequestBody;
    orderId: string;

    constructor(orderId: string) {
      this.orderId = orderId;
    }
  }

  class CapturesRefundRequest {
    requestBody = mockRequestBody;
    captureId: string;

    constructor(captureId: string) {
      this.captureId = captureId;
    }
  }

  return {
    core: { SandboxEnvironment, PayPalHttpClient },
    orders: { OrdersCreateRequest, OrdersCaptureRequest },
    payments: { CapturesRefundRequest },
  };
});

import { createPayPalGateway } from '../../gateways/paypal';

describe('PayPal gateway', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockExecute
      .mockResolvedValueOnce({ result: { id: 'ORDER-123' } })
      .mockResolvedValueOnce({
        result: {
          id: 'ORDER-123',
          purchase_units: [{ payments: { captures: [{ id: 'CAPTURE-123' }] } }],
        },
      })
      .mockResolvedValueOnce({ result: { id: 'REFUND-123' } });
  });

  it('creates and captures a PayPal order successfully', async () => {
    const gateway = createPayPalGateway('client-id', 'client-secret');

    await expect(gateway.process({ orderId: 42, amount: 100, currency: 'USD' })).resolves.toEqual({
      success: true,
      paymentReference: 'CAPTURE-123',
    });

    expect(mockExecute).toHaveBeenCalledTimes(2);
    expect(mockRequestBody).toHaveBeenCalledWith(
      expect.objectContaining({ intent: 'CAPTURE', purchase_units: expect.any(Array) })
    );
  });

  it('returns a failure object for network errors instead of throwing', async () => {
    mockExecute.mockReset();
    mockExecute.mockRejectedValueOnce(new Error('network error'));
    const gateway = createPayPalGateway('client-id', 'client-secret');

    await expect(gateway.process({ orderId: 42, amount: 100, currency: 'USD' })).resolves.toEqual({
      success: false,
      error: 'network error',
    });
  });

  it('refunds a PayPal capture successfully', async () => {
    mockExecute.mockReset();
    mockExecute.mockResolvedValueOnce({ result: { id: 'REFUND-123' } });
    const gateway = createPayPalGateway('client-id', 'client-secret');

    await expect(gateway.refund({ reference: 'CAPTURE-123', amount: 20 })).resolves.toEqual({
      success: true,
      reference: 'REFUND-123',
    });
  });

  it('fails gracefully when credentials are missing', async () => {
    const gateway = createPayPalGateway('', '');
    await expect(gateway.process({ orderId: 42, amount: 100, currency: 'USD' })).resolves.toEqual({
      success: false,
      error: 'PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET are not set',
    });
  });
});
