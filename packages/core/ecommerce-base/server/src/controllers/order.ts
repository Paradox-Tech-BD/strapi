import type { Context } from 'koa';
import type { Core } from '@strapi/types';
import { getService } from '../utils';
import { ACTIONS, ORDER_MODEL_UID } from '../constants';

/**
 * Admin controller for order management. Follows the official upload
 * controller convention: a plain object of handler methods, each resolving
 * services through the shared `getService` helper and checking permissions
 * through `admin::permission`.createPermissionsManager.
 */
export default {
  async find(ctx: Context) {
    const {
      state: { userAbility },
    } = ctx;
    const pm = strapi
      .service('admin::permission')
      .createPermissionsManager({
        ability: userAbility,
        action: ACTIONS.ordersRead,
        model: ORDER_MODEL_UID,
      });
    if (!pm.isAllowed) {
      return ctx.forbidden();
    }
    await pm.validateQuery(ctx.query);
    const query = pm.sanitizeQuery(ctx.query);
    const data = await getService('order').findPage(query);
    ctx.body = {
      results: await pm.sanitizeOutput(data.results),
      pagination: data.pagination,
    };
  },

  async findOne(ctx: Context) {
    const {
      state: { userAbility },
      params: { id },
    } = ctx;
    const pm = strapi
      .service('admin::permission')
      .createPermissionsManager({
        ability: userAbility,
        action: ACTIONS.ordersRead,
        model: ORDER_MODEL_UID,
      });
    if (!pm.isAllowed) {
      return ctx.forbidden();
    }
    ctx.body = await pm.sanitizeOutput(await getService('order').findOne(id));
  },

  async create(ctx: Context) {
    const {
      state: { userAbility },
      request,
    } = ctx;
    const pm = strapi
      .service('admin::permission')
      .createPermissionsManager({
        ability: userAbility,
        action: ACTIONS.ordersManage,
        model: ORDER_MODEL_UID,
      });
    if (!pm.isAllowed) {
      return ctx.forbidden();
    }
    await pm.validateInput(request.body);
    const sanitizedInput = await pm.sanitizeInput(request.body);
    const order = await getService('order').create({
      ...sanitizedInput,
      createdBy: (ctx.state as { user?: { id: number | string } }).user?.id,
    });
    await getService('audit').logAction({
      actor: (ctx.state as { user?: { email?: string } }).user?.email ?? 'admin-api',
      action: 'order.create',

      resourceType: 'order',
      resourceId: order.id,
      detail: { orderNumber: order.orderNumber },
    });
    ctx.body = order;
  },

  async transition(ctx: Context) {
    const {
      state: { userAbility },
      params: { id },
      request,
    } = ctx;
    const pm = strapi
      .service('admin::permission')
      .createPermissionsManager({
        ability: userAbility,
        action: ACTIONS.ordersManage,
        model: ORDER_MODEL_UID,
      });
    if (!pm.isAllowed) {
      return ctx.forbidden();
    }
    const { status } = request.body ?? {};
    if (!status || typeof status !== 'string') {
      return ctx.badRequest('A target order status is required.');
    }
    const order = await getService('order').transition(id, status);
    await getService('audit').logAction({
      actor: (ctx.state as { user?: { email?: string } }).user?.email ?? 'admin-api',
      action: `order.transition:${status}`,
      resourceType: 'order',
      resourceId: id,
      detail: { newStatus: status },
    });
    ctx.body = order;
  },

  async cancel(ctx: Context) {
    const {
      state: { userAbility },
      params: { id },
    } = ctx;
    const pm = strapi
      .service('admin::permission')
      .createPermissionsManager({
        ability: userAbility,
        action: ACTIONS.ordersCancel,
        model: ORDER_MODEL_UID,
      });
    if (!pm.isAllowed) {
      return ctx.forbidden();
    }
    const order = await getService('order').transition(id, 'cancelled');
    await getService('audit').logAction({
      actor: (ctx.state as { user?: { email?: string } }).user?.email ?? 'admin-api',
      action: 'order.cancel',
      resourceType: 'order',
      resourceId: id,
    });
    ctx.body = order;
  },

  async stats(ctx: Context) {
    const {
      state: { userAbility },
    } = ctx;
    const pm = strapi
      .service('admin::permission')
      .createPermissionsManager({
        ability: userAbility,
        action: ACTIONS.financeRead,
        model: ORDER_MODEL_UID,
      });
    if (!pm.isAllowed) {
      return ctx.forbidden();
    }
    ctx.body = await getService('order').stats(ctx.query);
  },

  async pay(ctx: Context) {
    const {
      state: { userAbility },
      params: { id },
      request,
    } = ctx;
    const pm = strapi
      .service('admin::permission')
      .createPermissionsManager({
        ability: userAbility,
        action: ACTIONS.ordersManage,
        model: ORDER_MODEL_UID,
      });
    if (!pm.isAllowed) {
      return ctx.forbidden();
    }
    const { method, gatewayId } = request.body ?? {};
    const order = await getService('payment').processPayment({
      orderId: id,
      method: method ?? 'card',
      gatewayId,
    });
    await getService('audit').logAction({
      actor: (ctx.state as { user?: { email?: string } }).user?.email ?? 'admin-api',
      action: 'order.pay',
      resourceType: 'order',
      resourceId: id,
      detail: { method },
    });
    ctx.body = order;
  },
} as const;
