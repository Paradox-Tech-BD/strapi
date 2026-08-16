import type { Context } from 'koa';
import type { Core } from '@strapi/types';
import { getService } from '../utils';
import { ACTIONS } from '../constants';

export default {
  async stats(ctx: Context) {
    const {
      state: { userAbility },
    } = ctx;
    const pm = strapi
      .service('admin::permission')
      .createPermissionsManager({ ability: userAbility, action: ACTIONS.ordersRead });
    if (!pm.isAllowed) {
      return ctx.forbidden();
    }
    const [orderStats, lowStock] = await Promise.all([
      getService('order').stats(),
      getService('inventory').lowStockReport(),
    ]);
    const [publishedProducts, abandonedCarts, customers] = await Promise.all([
      strapi.db.query('plugin::ecommerce-base.product').count({ where: { status: 'published' } }),
      strapi.db.query('plugin::ecommerce-base.cart').count({ where: { status: 'abandoned' } }),
      strapi.db.query('plugin::ecommerce-base.customer').count(),
    ]);
    ctx.body = {
      orders: orderStats,
      publishedProducts,
      customers,
      abandonedCarts,
      lowStockCount: lowStock.length,
    };
  },
} as const;
