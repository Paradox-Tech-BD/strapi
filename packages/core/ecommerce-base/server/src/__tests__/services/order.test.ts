import { errors } from '@strapi/utils';
import orderFactory from '../../services/order';
import { createStrapiMock, mountServices } from '../../helpers/strapi';
import { ORDER_MODEL_UID, WEBHOOK_EVENTS } from '../../constants';

const { ApplicationError, ValidationError } = errors;

/**
 * Order service unit tests. The order service reads product prices from the
 * database (`db.query(PRODUCT_MODEL_UID).findMany`), delegates inventory
 * reservations to the `inventory` service and promotion lookups to the
 * `promotion` service, and emits events through `strapi.eventHub`. These
 * tests therefore mount lightweight doubles for those services and seed the
 * shared query store with products and inventory rows.
 *
 * Note: `getService()` in `server/src/utils` reads `global.strapi`, so every
 * test assigns the mock to `global.strapi` before exercising the service.
 */
describe('ecommerce-base order service', () => {
  let ctx: ReturnType<typeof createStrapiMock>;
  let order: ReturnType<typeof orderFactory>;
  let dbQuery: jest.Mock;
  let orderQueryObj: any;
  let productQueryObj: any;
  let inventoryQueryObj: any;
  let inventoryMock: Record<string, jest.Mock>;
  let promotionMock: Record<string, jest.Mock>;
  let customerMock: Record<string, jest.Mock>;
  let taxMock: Record<string, jest.Mock>;
  let eventEmitted: { event: string; payload: unknown } | null = null;

  beforeEach(() => {
    ctx = createStrapiMock();
    dbQuery = ctx.db.query as unknown as jest.Mock;
    // Pre-resolve the query objects so `findMany`/`findOne` are stable mock
    // references (a fresh call to `db.query(uid)` yields a new object).
    orderQueryObj = (dbQuery as any)(ORDER_MODEL_UID);
    productQueryObj = (dbQuery as any)('plugin::ecommerce-base.product');
    inventoryQueryObj = (dbQuery as any)('plugin::ecommerce-base.inventory-item');
    eventEmitted = null;
    ctx.eventHub.emit.mockImplementation((event: string, payload: unknown) => {
      eventEmitted = { event, payload };
    });

    inventoryMock = {
      reserve: jest.fn(async () => ({ id: 9, reservedQuantity: 3 })),
      releaseReservation: jest.fn(async () => ({ id: 9, reservedQuantity: 0 })),
    };
    promotionMock = {
      findByCode: jest.fn(async () => null),
      incrementUsage: jest.fn(async () => ({})),
    };
    customerMock = {
      recordOrder: jest.fn(async () => ({})),
    };
    taxMock = {
      compute: jest.fn(async () => ({ taxAmount: 0, effectiveRate: 0, rules: [] })),
    };
    mountServices(ctx, {
      inventory: inventoryMock,
      promotion: promotionMock,
      customer: customerMock,
      tax: taxMock,
    });

    order = orderFactory({ strapi: ctx.strapi });

    // `getService()` reads `global.strapi` (see `server/src/utils`).
    (global as unknown as Record<string, unknown>).strapi = ctx.strapi;

    // Seed the product store so `create` can snapshot line prices.
    (ctx.db.query as any).store['plugin::ecommerce-base.product'] = [
      { id: 1, name: 'Item 1', sku: 'SKU-1', price: 10, stockTracking: true },
      { id: 2, name: 'Item 2', sku: 'SKU-2', price: 25.5, stockTracking: true },
    ];
    // Seed the inventory-item store so the product->inventory join resolves.
    // The inventory row mirrors a populated relation (`product: { id }`) so
    // the `findOne({ where: { product: { id } } })` join in the order service
    // resolves against the in-memory store.
    (ctx.db.query as any).store['plugin::ecommerce-base.inventory-item'] = [
      { id: 9, product: { id: 1 }, quantity: 50, reservedQuantity: 0 },
    ];
  });

  afterEach(() => {
    delete (global as unknown as Record<string, unknown>).strapi;
  });

  describe('create', () => {
    it('generates an order number and computes totals from line items', async () => {
      const created = await order.create({
        items: [
          { productId: 1, quantity: 2, unitPrice: 10 },
          { productId: 2, quantity: 1, unitPrice: 25.5 },
        ],
        shippingCost: 5,
      });

      expect(created.orderNumber).toMatch(/^EC-\d{6}-\d{4}$/);
      expect(created.status).toBe('pending');
      expect(created.paymentStatus).toBe('pending');
      expect(Number(created.subtotal)).toBe(45.5);
      expect(Number(created.total)).toBe(50.5);
      expect(created.currency).toBe('USD');
    });

    it('rejects empty orders', async () => {
      await expect(order.create({ items: [] })).rejects.toBeInstanceOf(ValidationError);
    });

    it('rejects line items that reference unknown products', async () => {
      await expect(
        order.create({ items: [{ productId: 999, quantity: 1, unitPrice: 5 }] })
      ).rejects.toBeInstanceOf(ValidationError);
    });

    it('falls back to the product price when no unit price is given', async () => {
      const created = await order.create({ items: [{ productId: 2, quantity: 2 }] });
      expect(Number(created.subtotal)).toBe(51);
    });

    it('applies a percentage promotion when a valid code is given', async () => {
      (promotionMock.findByCode as jest.Mock).mockResolvedValue({
        id: 5,
        code: 'SAVE10',
        type: 'percentage',
        value: 10,
        isActive: true,
        maxUses: 100,
        usedCount: 1,
        minOrderAmount: 0,
      });
      const created = await order.create({
        items: [{ productId: 1, quantity: 1, unitPrice: 100 }],
        promotionCode: 'SAVE10',
      });
      expect(Number(created.discountAmount)).toBe(10);
      // 100 - 10 discount + 0 tax + 0 shipping
      expect(Number(created.total)).toBe(90);
      expect(promotionMock.incrementUsage).toHaveBeenCalledWith(5);
    });

    it('reserves inventory for each stock-tracked line item', async () => {
      await order.create({ items: [{ productId: 1, quantity: 3, unitPrice: 10 }] });
      expect(inventoryMock.reserve).toHaveBeenCalledWith({ id: 9, quantity: 3 });
    });

    it('skips inventory reservation for products without stock tracking', async () => {
      (ctx.db.query as any).store['plugin::ecommerce-base.product'] = [
        { id: 1, name: 'Digital Download', sku: 'DIG-1', price: 10, stockTracking: false },
      ];
      await order.create({ items: [{ productId: 1, quantity: 3, unitPrice: 10 }] });
      expect(inventoryMock.reserve).not.toHaveBeenCalled();
    });

    it('emits the order.created webhook event with the hydrated order', async () => {
      await order.create({ items: [{ productId: 1, quantity: 1, unitPrice: 5 }] });
      expect(eventEmitted?.event).toBe(WEBHOOK_EVENTS.orderCreated);
      expect(eventEmitted?.payload).toEqual(
        expect.objectContaining({ order: expect.objectContaining({ status: 'pending' }) })
      );
    });

    it('records the order on the linked customer when customerId is given', async () => {
      await order.create({ customerId: 7, items: [{ productId: 1, quantity: 1, unitPrice: 5 }] });
      expect(customerMock.recordOrder).toHaveBeenCalledWith(7, expect.any(Number));
    });

    it('computes regional tax after discounts and includes it in the total', async () => {
      (taxMock.compute as jest.Mock).mockResolvedValue({
        taxAmount: 15,
        effectiveRate: 0.15,
        rules: [{ id: 4, name: 'BD VAT', region: 'BD', rate: 0.15, type: 'exclusive' }],
      });

      const created = await order.create({
        items: [{ productId: 1, quantity: 1, unitPrice: 100 }],
        shippingCost: 5,
        region: 'BD',
      });

      expect(taxMock.compute).toHaveBeenCalledWith(100, 'BD');
      expect(Number(created.taxAmount)).toBe(15);
      expect(Number(created.total)).toBe(120);
      expect(created.metadata).toEqual(
        expect.objectContaining({
          tax: expect.objectContaining({ region: 'BD', taxAmount: 15, effectiveRate: 0.15 }),
        })
      );
    });
  });

  describe('transition', () => {
    beforeEach(() => {
      // `releaseLineReservations` reads `line.product.id`, so lines must be
      // seeded as if the `lines` relation had been populated by the database.
      (ctx.db.query as any).store[ORDER_MODEL_UID] = [
        {
          id: 1,
          orderNumber: 'EC-260801-0001',
          status: 'pending',
          paymentStatus: 'pending',
          total: 40,
          customer: 3,
          lines: [{ product: { id: 1 }, quantity: 2, unitPrice: 20 }],
        },
      ];
    });

    it('follows the allowed state machine: pending → confirmed', async () => {
      const updated = await order.transition(1, 'confirmed');
      expect(updated.status).toBe('confirmed');
      expect(eventEmitted?.event).toBe(WEBHOOK_EVENTS.orderUpdated);
    });

    it('rejects invalid transitions (pending → delivered)', async () => {
      await expect(order.transition(1, 'delivered')).rejects.toBeInstanceOf(ApplicationError);
      expect(ctx.eventHub.emit).not.toHaveBeenCalledWith(
        WEBHOOK_EVENTS.orderUpdated,
        expect.anything()
      );
    });

    it('cancels pending orders and releases inventory reservations', async () => {
      (inventoryQueryObj.findOne as jest.Mock).mockResolvedValue({
        id: 4,
        reservedQuantity: 2,
        quantity: 40,
      });

      const cancelled = await order.transition(1, 'cancelled');
      expect(cancelled.status).toBe('cancelled');
      expect(cancelled.paymentStatus).toBe('failed');
      expect(inventoryQueryObj.findOne).toHaveBeenCalledWith({ where: { product: { id: 1 } } });
      expect(inventoryMock.releaseReservation).toHaveBeenCalledWith({ id: 4, quantity: 2 });
      expect(eventEmitted?.event).toBe(WEBHOOK_EVENTS.orderCancelled);
    });

    it('marks the payment status as refunded when transitioning to refunded', async () => {
      (ctx.db.query as any).store[ORDER_MODEL_UID][0].status = 'shipped';
      const refunded = await order.transition(1, 'refunded');
      expect(refunded.status).toBe('refunded');
      expect(refunded.paymentStatus).toBe('refunded');
    });
  });

  describe('stats', () => {
    it('aggregates revenue from paid orders and status counts', async () => {
      (ctx.db.query as any).store[ORDER_MODEL_UID] = [
        { id: 1, status: 'delivered', paymentStatus: 'paid', total: 100 },
        { id: 2, status: 'pending', paymentStatus: 'pending', total: 50 },
      ];
      const stats = await order.stats();
      expect(stats.totalOrders).toBe(2);
      expect(stats.paidOrders).toBe(1);
      expect(Number(stats.revenue)).toBe(100);
      expect(stats.byStatus).toEqual({ delivered: 1, pending: 1 });
    });

    it('filters orders by a createdAt range when bounds are given', async () => {
      await order.stats({ from: '2026-08-01', to: '2026-08-31' });
      const findMany = orderQueryObj.findMany as jest.Mock;
      expect(findMany).toHaveBeenCalledWith({
        where: { createdAt: { $gte: '2026-08-01', $lte: '2026-08-31' } },
      });
    });
  });

  describe('markPaid', () => {
    beforeEach(() => {
      (ctx.db.query as any).store[ORDER_MODEL_UID] = [
        {
          id: 1,
          orderNumber: 'EC-260801-0001',
          status: 'pending',
          paymentStatus: 'pending',
          total: 40,
          customer: 3,
          lines: [],
        },
      ];
    });

    it('records the gateway reference and emits orderUpdated', async () => {
      const paid = await order.markPaid({
        id: 1,
        paymentMethod: 'stripe',
        paymentReference: 'pi_abc123',
        paymentGateway: 'stripe',
      });
      expect(paid.paymentStatus).toBe('paid');
      expect(paid.paymentReference).toBe('pi_abc123');
      expect(eventEmitted?.event).toBe(WEBHOOK_EVENTS.orderUpdated);
    });

    it('refuses to mark a cancelled order as paid', async () => {
      (ctx.db.query as any).store[ORDER_MODEL_UID][0].status = 'cancelled';
      await expect(
        order.markPaid({ id: 1, paymentMethod: 'stripe', paymentReference: 'pi_x' })
      ).rejects.toBeInstanceOf(ApplicationError);
    });
  });
});
