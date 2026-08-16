import type { Context } from 'koa';
import type { Core } from '@strapi/types';
import { getService } from '../utils';
import { ACTIONS, CART_MODEL_UID } from '../constants';

export default {
  async getActive(ctx: Context) {
    const {
      state: { userAbility },
    } = ctx;
    const pm = strapi
      .service('admin::permission')
      .createPermissionsManager({
        ability: userAbility,
        action: ACTIONS.ordersRead,
        model: CART_MODEL_UID,
      });
    if (!pm.isAllowed) {
      return ctx.forbidden();
    }
    const query = pm.sanitizeQuery(ctx.query);
    const cart = await getService('cart').findActive({
      customerId: query.customerId ? Number(query.customerId) : undefined,
      sessionId: query.sessionId ? String(query.sessionId) : undefined,
    });
    ctx.body = await pm.sanitizeOutput(cart);
  },

  async addItem(ctx: Context) {
    const {
      state: { userAbility },
      request,
    } = ctx;
    const pm = strapi
      .service('admin::permission')
      .createPermissionsManager({
        ability: userAbility,
        action: ACTIONS.ordersRead,
        model: CART_MODEL_UID,
      });
    if (!pm.isAllowed) {
      return ctx.forbidden();
    }
    const body = await pm.sanitizeInput(request.body);
    ctx.body = await getService('cart').addItem(body);
  },

  async updateItem(ctx: Context) {
    const {
      state: { userAbility },
      params: { itemId },
      request,
    } = ctx;
    const pm = strapi
      .service('admin::permission')
      .createPermissionsManager({
        ability: userAbility,
        action: ACTIONS.ordersRead,
        model: CART_MODEL_UID,
      });
    if (!pm.isAllowed) {
      return ctx.forbidden();
    }
    const sanitized = (await pm.sanitizeInput(request.body)) as Record<string, unknown>;
    const quantity = Number(sanitized.quantity ?? 1);
    ctx.body = await getService('cart').updateItemQuantity({ itemId, quantity });
  },

  async removeItem(ctx: Context) {
    const {
      state: { userAbility },
      params: { itemId },
    } = ctx;
    const pm = strapi
      .service('admin::permission')
      .createPermissionsManager({
        ability: userAbility,
        action: ACTIONS.ordersRead,
        model: CART_MODEL_UID,
      });
    if (!pm.isAllowed) {
      return ctx.forbidden();
    }
    ctx.body = await getService('cart').removeItem(itemId);
  },

  async convert(ctx: Context) {
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
        model: CART_MODEL_UID,
      });
    if (!pm.isAllowed) {
      return ctx.forbidden();
    }
    const body = await pm.sanitizeInput(request.body);
    ctx.body = await getService('cart').convertToOrder({
      cartId: id,
      ...(body as Record<string, unknown>),
    });
  },

  async clear(ctx: Context) {
    const {
      state: { userAbility },
      params: { id },
    } = ctx;
    const pm = strapi
      .service('admin::permission')
      .createPermissionsManager({
        ability: userAbility,
        action: ACTIONS.ordersRead,
        model: CART_MODEL_UID,
      });
    if (!pm.isAllowed) {
      return ctx.forbidden();
    }
    await getService('cart').clear(id);
    ctx.body = { cleared: true };
  },
} as const;
