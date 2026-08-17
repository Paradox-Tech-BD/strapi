import contentApi from '../../controllers/content-api';
import { createStrapiMock, mountServices } from '../../helpers/strapi';

function createContext(
  options: { body?: unknown; query?: Record<string, unknown>; user?: any } = {}
) {
  return {
    state: { user: options.user },
    request: { body: options.body },
    query: options.query ?? {},
    params: {},
    body: undefined,
    badRequest: jest.fn((message: string) => ({ status: 400, message })),
    unauthorized: jest.fn((message: string) => ({ status: 401, message })),
    notFound: jest.fn((message: string) => ({ status: 404, message })),
  } as any;
}

describe('ecommerce-base content API contracts', () => {
  let ctx: ReturnType<typeof createStrapiMock>;
  let preview: jest.Mock;
  let create: jest.Mock;
  let findByUserId: jest.Mock;
  let dashboard: jest.Mock;
  let update: jest.Mock;
  let isSupportedCurrency: jest.Mock;

  beforeEach(() => {
    ctx = createStrapiMock();
    preview = jest.fn(async (input) => ({ ...input, total: 120 }));
    create = jest.fn(async (input) => ({ id: 7, ...input }));
    findByUserId = jest.fn(async (userId) => ({ id: 42, userId, preferredCurrency: 'USD' }));
    dashboard = jest.fn(async (customerId, currency) => ({
      customerId,
      currency,
      recentOrders: [],
    }));
    update = jest.fn(async (customerId, input) => ({ id: customerId, ...input }));
    isSupportedCurrency = jest.fn((currency: string) => ['USD', 'BDT'].includes(currency));

    mountServices(ctx, {
      tax: { isSupportedCurrency },
      order: { preview, create },
      customer: { findByUserId, dashboard, update },
      product: { findPage: jest.fn() },
      promotion: { findByCode: jest.fn() },
    });
    (global as any).strapi = ctx.strapi;
  });

  afterEach(() => {
    delete (global as any).strapi;
  });

  it('normalizes a valid BDT checkout preview request before forwarding it', async () => {
    const request = createContext({
      body: {
        items: [{ productId: '5', quantity: '2' }],
        region: 'BD',
        currency: 'bdt',
        shippingCost: '25.50',
        exemptionCode: 'ngo-2026',
      },
    });

    await contentApi.previewCheckout(request);

    expect(preview).toHaveBeenCalledWith({
      items: [{ productId: '5', quantity: 2 }],
      region: 'BD',
      currency: 'BDT',
      shippingCost: 25.5,
      exemptionCode: 'ngo-2026',
    });
    expect(request.body).toEqual(expect.objectContaining({ total: 120 }));
  });

  it('rejects malformed line items before reaching the order service', async () => {
    const request = createContext({ body: { items: [{ productId: 5, quantity: 0 }] } });

    await contentApi.previewCheckout(request);

    expect(request.badRequest).toHaveBeenCalledWith(
      'items[0].quantity must be a positive integer.'
    );
    expect(preview).not.toHaveBeenCalled();
  });

  it('rejects unsupported currencies consistently', async () => {
    const request = createContext({
      body: { items: [{ productId: 5, quantity: 1 }], currency: 'EUR' },
    });

    await contentApi.createCheckoutOrder(request);

    expect(request.badRequest).toHaveBeenCalledWith('Unsupported currency "EUR".');
    expect(create).not.toHaveBeenCalled();
  });

  it('rejects an unsupported currency declared on an individual line item', async () => {
    const request = createContext({
      body: { items: [{ productId: 5, quantity: 1, currency: 'EUR' }] },
    });

    await contentApi.previewCheckout(request);

    expect(request.badRequest).toHaveBeenCalledWith(
      'Unsupported currency "EUR" for items[0].currency.'
    );
    expect(preview).not.toHaveBeenCalled();
  });

  it('binds an authenticated checkout to the resolved customer profile', async () => {
    const request = createContext({
      user: { id: 9 },
      body: { items: [{ productId: 5, quantity: 1 }], currency: 'USD' },
    });

    await contentApi.createCheckoutOrder(request);

    expect(findByUserId).toHaveBeenCalledWith(9);
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ customerId: 42, currency: 'USD' })
    );
    expect(request.body).toEqual(expect.objectContaining({ id: 7 }));
  });

  it('returns the dashboard in a validated requested currency', async () => {
    const request = createContext({
      user: { id: 9 },
      query: { currency: 'bdt' },
    });

    await contentApi.getCustomerDashboard(request);

    expect(dashboard).toHaveBeenCalledWith(42, 'BDT');
    expect(request.body).toEqual({ customerId: 42, currency: 'BDT', recentOrders: [] });
  });

  it('rejects an unsupported dashboard currency without calling the dashboard service', async () => {
    const request = createContext({
      user: { id: 9 },
      query: { currency: 'EUR' },
    });

    await contentApi.getCustomerDashboard(request);

    expect(request.badRequest).toHaveBeenCalledWith('Unsupported currency "EUR".');
    expect(dashboard).not.toHaveBeenCalled();
  });

  it('normalizes and persists a supported customer preference', async () => {
    const request = createContext({ user: { id: 9 }, body: { preferredCurrency: 'bdt' } });

    await contentApi.updateCustomerPreferences(request);

    expect(update).toHaveBeenCalledWith(42, { preferredCurrency: 'BDT' });
    expect(request.body).toEqual({ id: 42, preferredCurrency: 'BDT' });
  });
});
