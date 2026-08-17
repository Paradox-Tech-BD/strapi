const mockPaymentIntents = {
  create: jest.fn(),
  capture: jest.fn(),
  retrieve: jest.fn(),
};
const mockRefunds = { create: jest.fn() };
const mockStripeClient = { paymentIntents: mockPaymentIntents, refunds: mockRefunds };

jest.mock('stripe', () => jest.fn().mockImplementation(() => mockStripeClient));

import { createStripeGateway } from '../../gateways/stripe';

describe('Stripe gateway', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPaymentIntents.create.mockResolvedValue({ id: 'pi_xxx' });
    mockPaymentIntents.capture.mockResolvedValue({ id: 'pi_xxx', status: 'succeeded' });
    mockPaymentIntents.retrieve.mockResolvedValue({ status: 'succeeded' });
    mockRefunds.create.mockResolvedValue({ id: 're_xxx', status: 'succeeded' });
  });

  it('processes and captures a payment successfully', async () => {
    const gateway = createStripeGateway('sk_test_123');

    await expect(
      gateway.process({ orderId: 42, amount: 100, currency: 'USD', metadata: { source: 'test' } })
    ).resolves.toEqual({ success: true, paymentReference: 'pi_xxx' });

    expect(mockPaymentIntents.create).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 10000, currency: 'usd', capture_method: 'manual' })
    );
    expect(mockPaymentIntents.capture).toHaveBeenCalledWith('pi_xxx');
  });

  it('returns a failure object for network errors instead of throwing', async () => {
    mockPaymentIntents.create.mockRejectedValueOnce(new Error('network error'));
    const gateway = createStripeGateway('sk_test_123');

    await expect(gateway.process({ orderId: 42, amount: 100, currency: 'USD' })).resolves.toEqual({
      success: false,
      error: 'network error',
    });
  });

  it('refunds a payment successfully', async () => {
    const gateway = createStripeGateway('sk_test_123');
    await expect(gateway.refund({ reference: 'pi_xxx', amount: 25 })).resolves.toEqual({
      success: true,
      reference: 're_xxx',
    });
    expect(mockRefunds.create).toHaveBeenCalledWith({ payment_intent: 'pi_xxx', amount: 2500 });
  });

  it('fails gracefully when the secret is missing', async () => {
    const gateway = createStripeGateway('');
    await expect(gateway.process({ orderId: 42, amount: 100, currency: 'USD' })).resolves.toEqual({
      success: false,
      error: 'STRIPE_SECRET_KEY is not set',
    });
    await expect(gateway.verify('pi_xxx')).resolves.toBe(false);
  });
});
