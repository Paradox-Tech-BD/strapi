/**
 * Controller tests: build a minimal Koa-like context, mount a mocked strapi on
 * `global.strapi`, and assert that each handler performs permission checks and
 * forwards the right payload to its service. The admin controller reads the
 * permission manager through `strapi.service('admin::permission')` (which the
 * repo's unit test setup resolves via the `admin.services.permission` branch)
 * and all plugin services through `getService()` (`global.strapi.plugin(...)`).
 */
import { errors } from '@strapi/utils';
import orderController from '../../controllers/order';
import { createStrapiMock } from '../../helpers/strapi';
import { ACTIONS, ORDER_MODEL_UID } from '../../constants';

const { ApplicationError } = errors;

function createContext(
  options: {
    userAbility?: any;
    params?: Record<string, unknown>;
    body?: unknown;
    query?: Record<string, unknown>;
    user?: { id?: number; email?: string };
  } = {}
) {
  const ctx: any = {
    state: {
      user: options.user ?? { id: 1, email: 'admin@example.com' },
      userAbility: options.userAbility ?? null,
    },
    params: options.params ?? {},
    query: options.query ?? {},
    request: { body: options.body },
    forbidden: jest.fn(() => ({ status: 403 })),
    badRequest: jest.fn((msg?: string) => ({ status: 400, message: msg })),
  };
  ctx.body = null;
  return ctx;
}

describe('ecommerce-base order admin controller', () => {
  let ctx: ReturnType<typeof createStrapiMock>;
  let createPermissionsManager: jest.Mock;
  let findPage: jest.Mock;
  let findOne: jest.Mock;
  let createOrder: jest.Mock;
  let transitionOrder: jest.Mock;
  let stats: jest.Mock;
  let logAction: jest.Mock;

  beforeEach(() => {
    ctx = createStrapiMock();

    findPage = jest.fn(async () => ({
      results: [{ id: 1, orderNumber: 'EC-260801-0001' }],
      pagination: { page: 1, pageSize: 10, pageCount: 1, total: 1 },
    }));
    findOne = jest.fn(async (id: number | string) => ({ id, orderNumber: 'EC-260801-0001' }));
    createOrder = jest.fn(async () => ({ id: 1, orderNumber: 'EC-260801-0001' }));
    transitionOrder = jest.fn(async (id: number | string, status: string) => ({ id, status }));
    stats = jest.fn(async () => ({ totalOrders: 0, revenue: 0 }));
    logAction = jest.fn(async () => ({}));

    createPermissionsManager = jest.fn(() => ({
      isAllowed: true,
      validateQuery: jest.fn(async () => {}),
      sanitizeQuery: jest.fn((q: unknown) => q),
      validateInput: jest.fn(async () => {}),
      sanitizeInput: jest.fn((input: unknown) => input),
      sanitizeOutput: jest.fn(async (output: unknown) => output),
      addPermissionsQueryTo: jest.fn((q: unknown) => q),
    }));

    // `strapi.service('admin::permission')` — resolved by the repo's
    // unit.setup.js `admin.services` branch of the global strapi mock.
    (
      ctx.strapi.admin.services.permission.createPermissionsManager as unknown as jest.Mock
    ).mockImplementation(createPermissionsManager);

    // Plugin services resolved through `global.strapi` (`getService()`).
    (global as unknown as Record<string, unknown>).strapi = ctx.strapi;
    ctx.strapi.plugin('ecommerce-base').services = {
      order: {
        findPage,
        findOne,
        create: createOrder,
        transition: transitionOrder,
        stats,
      },
      audit: { logAction },
      payment: { processPayment: jest.fn(async () => ({ id: 1 })) },
      inventory: { reserve: jest.fn(async () => ({})) },
      promotion: { findByCode: jest.fn(async () => null) },
      customer: { recordOrder: jest.fn(async () => ({})) },
    };
  });

  afterEach(() => {
    delete (global as unknown as Record<string, unknown>).strapi;
  });

  describe('find', () => {
    it('forbids access when the permission manager disallows', async () => {
      createPermissionsManager.mockReturnValue({ isAllowed: false });
      const controllerCtx = createContext();
      await orderController.find(controllerCtx);
      expect(controllerCtx.forbidden).toHaveBeenCalled();
    });

    it('forwards a sanitized query to the order service', async () => {
      const controllerCtx = createContext({ query: { limit: 10 } });
      await orderController.find(controllerCtx);
      expect(createPermissionsManager).toHaveBeenCalledWith({
        ability: controllerCtx.state.userAbility,
        action: ACTIONS.ordersRead,
        model: ORDER_MODEL_UID,
      });
      expect(findPage).toHaveBeenCalled();
      expect(controllerCtx.body).toHaveProperty('results');
      expect(controllerCtx.body).toHaveProperty('pagination');
    });
  });

  describe('create', () => {
    it('persists the order and records an audit entry', async () => {
      const controllerCtx = createContext({
        body: { items: [{ productId: 1, quantity: 2, unitPrice: 10 }] },
      });
      await orderController.create(controllerCtx);
      expect(createOrder).toHaveBeenCalledWith(
        expect.objectContaining({
          items: [{ productId: 1, quantity: 2, unitPrice: 10 }],
          createdBy: 1,
        })
      );
      expect((controllerCtx.body as any).orderNumber).toBe('EC-260801-0001');
      expect(logAction).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'order.create',
          resourceType: 'order',
          actor: 'admin@example.com',
        })
      );
    });

    it('sanitizes the input through the permission manager', async () => {
      const pm = createPermissionsManager();
      (pm.sanitizeInput as jest.Mock).mockResolvedValue({ items: [] });
      createPermissionsManager.mockReturnValue(pm);
      const controllerCtx = createContext({ body: { items: [] } });
      await orderController.create(controllerCtx);
      expect(pm.sanitizeInput).toHaveBeenCalledWith({ items: [] });
    });
  });

  describe('transition', () => {
    it('rejects a missing status with a bad-request payload', async () => {
      const controllerCtx = createContext({ params: { id: 5 }, body: {} });
      await orderController.transition(controllerCtx);
      expect(controllerCtx.badRequest).toHaveBeenCalledWith('A target order status is required.');
      expect(transitionOrder).not.toHaveBeenCalled();
    });

    it('transitions the order and records an audit entry', async () => {
      const controllerCtx = createContext({ params: { id: 5 }, body: { status: 'confirmed' } });
      await orderController.transition(controllerCtx);
      expect(transitionOrder).toHaveBeenCalledWith(5, 'confirmed');
      expect(logAction).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'order.transition:confirmed',
          resourceType: 'order',
          resourceId: 5,
          detail: { newStatus: 'confirmed' },
        })
      );
    });

    it('rejects illegal state changes', async () => {
      transitionOrder.mockRejectedValueOnce(new ApplicationError('Invalid transition'));
      const controllerCtx = createContext({ params: { id: 5 }, body: { status: 'delivered' } });
      await expect(orderController.transition(controllerCtx)).rejects.toBeInstanceOf(
        ApplicationError
      );
    });
  });

  describe('cancel', () => {
    it('transitions the order and uses the cancel action scope', async () => {
      const controllerCtx = createContext({ params: { id: 5 } });
      await orderController.cancel(controllerCtx);
      expect(transitionOrder).toHaveBeenCalledWith(5, 'cancelled');
      expect(createPermissionsManager).toHaveBeenCalledWith({
        ability: controllerCtx.state.userAbility,
        action: ACTIONS.ordersCancel,
        model: ORDER_MODEL_UID,
      });
      expect(logAction).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'order.cancel', resourceType: 'order', resourceId: 5 })
      );
    });
  });

  describe('stats', () => {
    it('scopes to the finance-read action', async () => {
      const controllerCtx = createContext();
      await orderController.stats(controllerCtx);
      expect(createPermissionsManager).toHaveBeenCalledWith({
        ability: controllerCtx.state.userAbility,
        action: ACTIONS.financeRead,
        model: ORDER_MODEL_UID,
      });
      expect(stats).toHaveBeenCalledWith(controllerCtx.query);
      expect(controllerCtx.body).toEqual({ totalOrders: 0, revenue: 0 });
    });
  });

  describe('pay', () => {
    it('delegates to the payment service and records an audit entry', async () => {
      const processPayment = jest.fn(async () => ({
        id: 5,
        paymentStatus: 'paid',
        paymentReference: 'pi_test',
      }));
      ctx.strapi.plugin('ecommerce-base').services = {
        ...ctx.strapi.plugin('ecommerce-base').services,
        payment: { processPayment },
      };
      const controllerCtx = createContext({
        params: { id: 5 },
        body: { method: 'card', gatewayId: 'stripe' },
      });
      await orderController.pay(controllerCtx);
      expect(processPayment).toHaveBeenCalledWith({
        orderId: 5,
        method: 'card',
        gatewayId: 'stripe',
      });
      expect(logAction).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'order.pay', resourceType: 'order', resourceId: 5 })
      );
      expect((controllerCtx.body as any).paymentStatus).toBe('paid');
    });

    it('forbids when the permission manager disallows', async () => {
      createPermissionsManager.mockReturnValue({ isAllowed: false });
      const controllerCtx = createContext({ params: { id: 5 }, body: { method: 'card' } });
      await orderController.pay(controllerCtx);
      expect(controllerCtx.forbidden).toHaveBeenCalled();
    });
  });
});
