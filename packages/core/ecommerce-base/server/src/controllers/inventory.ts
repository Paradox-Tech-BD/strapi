import type { Context } from 'koa';
import type { Core } from '@strapi/types';
import { getService } from '../utils';
import { ACTIONS, INVENTORY_ITEM_MODEL_UID } from '../constants';

export default {
  async find(ctx: Context) {
    const {
      state: { userAbility },
    } = ctx;
    const pm = strapi
      .service('admin::permission')
      .createPermissionsManager({
        ability: userAbility,
        action: ACTIONS.inventoryRead,
        model: INVENTORY_ITEM_MODEL_UID,
      });
    if (!pm.isAllowed) {
      return ctx.forbidden();
    }
    await pm.validateQuery(ctx.query);
    const query = pm.sanitizeQuery(ctx.query);
    const data = await getService('inventory').findPage(query);
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
        action: ACTIONS.inventoryRead,
        model: INVENTORY_ITEM_MODEL_UID,
      });
    if (!pm.isAllowed) {
      return ctx.forbidden();
    }
    ctx.body = await pm.sanitizeOutput(await getService('inventory').findOne(id));
  },

  async adjust(ctx: Context) {
    const {
      state: { userAbility },
      params: { id },
      request,
    } = ctx;
    const pm = strapi
      .service('admin::permission')
      .createPermissionsManager({
        ability: userAbility,
        action: ACTIONS.inventoryAdjust,
        model: INVENTORY_ITEM_MODEL_UID,
      });
    if (!pm.isAllowed) {
      return ctx.forbidden();
    }
    const { delta, reason } = request.body ?? {};
    const item = await getService('inventory').adjust({ id, delta: Number(delta), reason });
    await getService('audit').logAction({
      actor: (ctx.state as { user?: { email?: string } }).user?.email ?? 'admin-api',
      action: 'inventory.adjust',
      resourceType: 'inventory-item',
      resourceId: id,
      detail: { delta: Number(delta), reason, newQuantity: item.quantity },
    });
    ctx.body = item;
  },

  async reserve(ctx: Context) {
    const {
      state: { userAbility },
      params: { id },
      request,
    } = ctx;
    const pm = strapi
      .service('admin::permission')
      .createPermissionsManager({
        ability: userAbility,
        action: ACTIONS.inventoryAdjust,
        model: INVENTORY_ITEM_MODEL_UID,
      });
    if (!pm.isAllowed) {
      return ctx.forbidden();
    }
    const { quantity } = request.body ?? {};
    ctx.body = await getService('inventory').reserve({ id, quantity: Number(quantity) });
  },

  async releaseReservation(ctx: Context) {
    const {
      state: { userAbility },
      params: { id },
      request,
    } = ctx;
    const pm = strapi
      .service('admin::permission')
      .createPermissionsManager({
        ability: userAbility,
        action: ACTIONS.inventoryAdjust,
        model: INVENTORY_ITEM_MODEL_UID,
      });
    if (!pm.isAllowed) {
      return ctx.forbidden();
    }
    const { quantity } = request.body ?? {};
    ctx.body = await getService('inventory').releaseReservation({ id, quantity: Number(quantity) });
  },

  async lowStock(ctx: Context) {
    const {
      state: { userAbility },
    } = ctx;
    const pm = strapi
      .service('admin::permission')
      .createPermissionsManager({
        ability: userAbility,
        action: ACTIONS.inventoryRead,
        model: INVENTORY_ITEM_MODEL_UID,
      });
    if (!pm.isAllowed) {
      return ctx.forbidden();
    }
    ctx.body = await getService('inventory').lowStockReport();
  },
} as const;
