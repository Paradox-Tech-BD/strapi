import cartServiceFactory from '../../services/cart';
import { CART_ITEM_MODEL_UID, CART_MODEL_UID, PRODUCT_MODEL_UID } from '../../constants';
import {
  createDbQueryMock,
  createStrapiMock,
  mountServices,
  seedRecords,
} from '../../helpers/strapi';

describe('ecommerce-base cart currency integration', () => {
  it('converts a product price into the active cart currency when adding an item', async () => {
    const data: Record<string, unknown[]> = {
      [CART_MODEL_UID]: [{ id: 10, currency: 'BDT', status: 'active' }],
      [CART_ITEM_MODEL_UID]: [],
      [PRODUCT_MODEL_UID]: [{ id: 5, price: 10, currency: 'USD' }],
    };
    const db = createDbQueryMock(data);
    const ctx = createStrapiMock({ db });
    mountServices(ctx, {
      tax: { convert: jest.fn(() => ({ amount: 1200, rate: 120 })) },
    });
    (global as any).strapi = ctx.strapi;

    try {
      const cart = cartServiceFactory({ strapi: ctx.strapi });
      await cart.addItem({ cartId: 10, productId: 5, quantity: 2 });

      expect(db.query(CART_ITEM_MODEL_UID).create).toHaveBeenCalledWith({
        data: {
          cart: 10,
          product: 5,
          quantity: 2,
          unitPrice: 1200,
          currency: 'BDT',
        },
      });
      expect(db.query(CART_MODEL_UID).update).toHaveBeenCalledWith({
        where: { id: 10 },
        data: { subtotal: 2400 },
      });
    } finally {
      delete (global as any).strapi;
    }
  });

  it('converts an active BDT cart into an order and marks it converted', async () => {
    const data: Record<string, unknown[]> = {
      [CART_MODEL_UID]: [
        {
          id: 10,
          customer: 42,
          currency: 'BDT',
          status: 'active',
          items: [{ id: 20, product: { id: 5 }, quantity: 2, unitPrice: 1200 }],
        },
      ],
      [CART_ITEM_MODEL_UID]: [],
      [PRODUCT_MODEL_UID]: [],
    };
    const db = createDbQueryMock(data);
    const ctx = createStrapiMock({ db });
    const createOrder = jest.fn(async (input) => ({ id: 99, ...input }));
    mountServices(ctx, { order: { create: createOrder } });
    (global as any).strapi = ctx.strapi;

    try {
      const cart = cartServiceFactory({ strapi: ctx.strapi });
      const order = await cart.convertToOrder({ cartId: 10, notes: 'Phase 3 test' });

      expect(createOrder).toHaveBeenCalledWith({
        customerId: 42,
        items: [{ productId: 5, quantity: 2, unitPrice: 1200, currency: 'BDT' }],
        currency: 'BDT',
        notes: 'Phase 3 test',
      });
      expect(order).toEqual(expect.objectContaining({ id: 99, currency: 'BDT' }));
      expect(db.query(CART_MODEL_UID).update).toHaveBeenCalledWith({
        where: { id: 10 },
        data: { status: 'converted', convertedOrderId: '99' },
      });
      expect(ctx.eventHub.emit).toHaveBeenCalledWith(
        'ecommerce.cart.converted',
        expect.objectContaining({ cart: { id: 10 }, order: expect.objectContaining({ id: 99 }) })
      );
    } finally {
      delete (global as any).strapi;
    }
  });

  it('refuses to convert a cart that is no longer active', async () => {
    const db = createDbQueryMock({
      [CART_MODEL_UID]: [{ id: 10, status: 'converted', items: [] }],
      [CART_ITEM_MODEL_UID]: [],
      [PRODUCT_MODEL_UID]: [],
    });
    const ctx = createStrapiMock({ db });
    mountServices(ctx, { order: { create: jest.fn() } });
    (global as any).strapi = ctx.strapi;

    try {
      const cart = cartServiceFactory({ strapi: ctx.strapi });
      await expect(cart.convertToOrder({ cartId: 10 })).rejects.toThrow(
        'Only active carts can be converted into orders.'
      );
    } finally {
      delete (global as any).strapi;
    }
  });
});
